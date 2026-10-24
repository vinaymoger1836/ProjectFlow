import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Optional,
} from '@nestjs/common';
import { and, eq, or, sql, inArray } from 'drizzle-orm';
import { Database, issues, issueDependencies, activities } from '@projectflow/database';
import { IssueDependencyLink, IssueLinkKind, IssueLinkedIssue, IssueRelationType } from '@projectflow/types';
import { DRIZZLE_DB } from '../database/database.module';
import { ProjectAccessService, ProjectRecord } from '../auth/project-access.service';
import { EventsGateway } from '../events/events.gateway';
import { CreateIssueDependencyDto } from './dto/issue-dependency.dto';

type IssueRef = { id: string; projectId: string; issueKey: string };

const ISSUE_KEY_REGEX = /^[A-Z0-9]+-\d+$/i;

/** How each link kind maps onto a stored, canonical row (ADR-019). */
const CANONICAL: Record<IssueLinkKind, { relation: IssueRelationType; thisIsSource: boolean }> = {
  BLOCKS: { relation: 'BLOCKS', thisIsSource: true },
  BLOCKED_BY: { relation: 'BLOCKS', thisIsSource: false },
  RELATES_TO: { relation: 'RELATES_TO', thisIsSource: true },
  DUPLICATES: { relation: 'DUPLICATES', thisIsSource: true },
  DUPLICATED_BY: { relation: 'DUPLICATES', thisIsSource: false },
};

const linkedIssueColumns = {
  id: issues.id,
  issueKey: issues.issueKey,
  title: issues.title,
  type: issues.type,
  status: issues.status,
  priority: issues.priority,
};

/**
 * Issue dependency graph: blocks / blocked by, relates to, duplicates. Links are restricted
 * to one project, and BLOCKS links may not form cycles.
 */
@Injectable()
export class IssueDependenciesService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly projectAccess: ProjectAccessService,
    @Optional() private readonly eventsGateway?: EventsGateway,
  ) {}

  async listDependencies(userId: string, identifier: string): Promise<IssueDependencyLink[]> {
    const issue = await this.resolveIssue(identifier);
    await this.projectAccess.assertProjectAccess(userId, issue.projectId);

    const rows = await this.db
      .select()
      .from(issueDependencies)
      .where(or(eq(issueDependencies.sourceIssueId, issue.id), eq(issueDependencies.targetIssueId, issue.id)));
    if (rows.length === 0) return [];

    const otherIds = rows.map((r) => (r.sourceIssueId === issue.id ? r.targetIssueId : r.sourceIssueId));
    const others = await this.db
      .select(linkedIssueColumns)
      .from(issues)
      .where(and(inArray(issues.id, otherIds), eq(issues.isArchived, false)));
    const byId = new Map<string, IssueLinkedIssue>(others.map((o) => [o.id, o]));

    const links: IssueDependencyLink[] = [];
    for (const row of rows) {
      const isSource = row.sourceIssueId === issue.id;
      const other = byId.get(isSource ? row.targetIssueId : row.sourceIssueId);
      // Links to archived issues are hidden rather than deleted so un-archiving restores them
      if (!other) continue;
      links.push({ id: row.id, kind: readKind(row.relationType, isSource), issue: other, createdAt: row.createdAt.toISOString() });
    }
    return links.sort((a, b) => a.kind.localeCompare(b.kind) || a.issue.issueKey.localeCompare(b.issue.issueKey));
  }

  async addDependency(userId: string, identifier: string, dto: CreateIssueDependencyDto): Promise<IssueDependencyLink> {
    const issue = await this.resolveIssue(identifier);
    const project = await this.projectAccess.assertProjectAccess(userId, issue.projectId);
    const other = await this.resolveIssue(dto.targetIssue);

    if (other.projectId !== issue.projectId) {
      throw new BadRequestException('Issues can only be linked within the same project.');
    }
    if (other.id === issue.id) {
      throw new BadRequestException('An issue cannot be linked to itself.');
    }

    const { relation, thisIsSource } = CANONICAL[dto.kind];
    const sourceId = thisIsSource ? issue.id : other.id;
    const targetId = thisIsSource ? other.id : issue.id;

    await this.assertNoConflictingLink(relation, sourceId, targetId);
    if (relation === 'BLOCKS' && (await this.blocksTransitively(targetId, sourceId))) {
      throw new BadRequestException(
        `Linking would create a blocking cycle: ${thisIsSource ? other.issueKey : issue.issueKey} already blocks ${thisIsSource ? issue.issueKey : other.issueKey} (directly or through other issues).`,
      );
    }

    const created = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(issueDependencies)
        .values({ sourceIssueId: sourceId, targetIssueId: targetId, relationType: relation })
        .returning();

      await tx.insert(activities).values([
        linkActivity(project, userId, issue, other, dto.kind, 'DEPENDENCY_ADDED'),
        linkActivity(project, userId, other, issue, readKind(relation, !thisIsSource), 'DEPENDENCY_ADDED'),
      ]);
      return row;
    });

    this.broadcast(issue, other);

    const [linked] = await this.db.select(linkedIssueColumns).from(issues).where(eq(issues.id, other.id)).limit(1);
    return { id: created.id, kind: dto.kind, issue: linked, createdAt: created.createdAt.toISOString() };
  }

  async removeDependency(userId: string, dependencyId: string): Promise<{ success: boolean }> {
    const [row] = await this.db.select().from(issueDependencies).where(eq(issueDependencies.id, dependencyId)).limit(1);
    if (!row) {
      throw new NotFoundException(`Dependency '${dependencyId}' not found.`);
    }

    const [source, target] = await Promise.all([
      this.resolveIssue(row.sourceIssueId, true),
      this.resolveIssue(row.targetIssueId, true),
    ]);
    const project = await this.projectAccess.assertProjectAccess(userId, source.projectId);

    await this.db.transaction(async (tx) => {
      await tx.delete(issueDependencies).where(eq(issueDependencies.id, row.id));
      await tx.insert(activities).values([
        linkActivity(project, userId, source, target, readKind(row.relationType, true), 'DEPENDENCY_REMOVED'),
        linkActivity(project, userId, target, source, readKind(row.relationType, false), 'DEPENDENCY_REMOVED'),
      ]);
    });

    this.broadcast(source, target);
    return { success: true };
  }

  /** Rejects exact duplicates, symmetric RELATES_TO duplicates, and direct two-way BLOCKS. */
  private async assertNoConflictingLink(relation: IssueRelationType, sourceId: string, targetId: string) {
    const sameDirection = and(eq(issueDependencies.sourceIssueId, sourceId), eq(issueDependencies.targetIssueId, targetId));
    const reverseDirection = and(eq(issueDependencies.sourceIssueId, targetId), eq(issueDependencies.targetIssueId, sourceId));

    const [existing] = await this.db
      .select({ relationType: issueDependencies.relationType })
      .from(issueDependencies)
      .where(
        and(
          eq(issueDependencies.relationType, relation),
          relation === 'BLOCKS' ? sameDirection : or(sameDirection, reverseDirection),
        ),
      )
      .limit(1);

    if (existing) {
      throw new ConflictException('These issues are already linked this way.');
    }
  }

  /** True when `fromId` already blocks `toId` through a chain of BLOCKS links. */
  private async blocksTransitively(fromId: string, toId: string): Promise<boolean> {
    const result = await this.db.execute<{ found: number }>(sql`
      with recursive chain(issue_id) as (
        select ${issueDependencies.targetIssueId} from ${issueDependencies}
        where ${issueDependencies.sourceIssueId} = ${fromId} and ${issueDependencies.relationType} = 'BLOCKS'
        union
        select d.target_issue_id from issue_dependencies d
        join chain c on d.source_issue_id = c.issue_id
        where d.relation_type = 'BLOCKS'
      )
      select 1 as found from chain where issue_id = ${toId} limit 1
    `);
    return result.rows.length > 0;
  }

  private async resolveIssue(identifier: string, includeArchived = false): Promise<IssueRef> {
    const condition = ISSUE_KEY_REGEX.test(identifier)
      ? eq(sql`UPPER(${issues.issueKey})`, identifier.toUpperCase())
      : eq(issues.id, identifier);

    const [row] = await this.db
      .select({ id: issues.id, projectId: issues.projectId, issueKey: issues.issueKey })
      .from(issues)
      .where(includeArchived ? condition : and(condition, eq(issues.isArchived, false)))
      .limit(1);

    if (!row) {
      throw new NotFoundException(`Issue '${identifier}' not found.`);
    }
    return row;
  }

  private broadcast(...affected: IssueRef[]) {
    for (const issue of affected) {
      this.eventsGateway?.broadcastIssueUpdated(issue.projectId, { id: issue.id, issueKey: issue.issueKey });
    }
  }
}

function readKind(relation: IssueRelationType, isSource: boolean): IssueLinkKind {
  if (relation === 'BLOCKS') return isSource ? 'BLOCKS' : 'BLOCKED_BY';
  if (relation === 'DUPLICATES') return isSource ? 'DUPLICATES' : 'DUPLICATED_BY';
  return 'RELATES_TO';
}

function linkActivity(
  project: ProjectRecord,
  userId: string,
  issue: IssueRef,
  other: IssueRef,
  kind: IssueLinkKind,
  action: 'DEPENDENCY_ADDED' | 'DEPENDENCY_REMOVED',
) {
  return {
    organizationId: project.organizationId,
    projectId: project.id,
    userId,
    entityType: 'ISSUE',
    entityId: issue.id,
    action,
    details: { issueKey: issue.issueKey, kind, otherIssueId: other.id, otherIssueKey: other.issueKey },
  };
}
