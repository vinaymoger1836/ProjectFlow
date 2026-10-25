import { Injectable, Inject, BadRequestException, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, eq, inArray } from 'drizzle-orm';
import { Database, issues, sprints, milestones, releases, users, activities, aiAuditTrail } from '@projectflow/database';
import { BulkChangeField, BulkChangePreview, BulkFieldDiff, BulkIssueDiff, BulkIssueChanges } from '@projectflow/types';
import { DRIZZLE_DB } from '../database/database.module';
import { ProjectAccessService } from '../auth/project-access.service';
import { EventsGateway } from '../events/events.gateway';
import { DomainEvents, IssueAssignedEvent, IssueUpdatedEvent } from '../../common/events/domain-events';
import { AssignmentTargetsService } from './assignment-targets.service';
import { BulkUpdateIssuesDto } from './dto/bulk-update-issues.dto';

type IssueRow = Pick<
  typeof issues.$inferSelect,
  'id' | 'issueKey' | 'title' | 'type' | 'status' | 'priority' | 'assigneeId' | 'sprintId' | 'milestoneId' | 'releaseId'
>;

/** Field order in diffs, so previews read consistently. */
const FIELD_ORDER: BulkChangeField[] = ['status', 'priority', 'assigneeId', 'sprintId', 'milestoneId', 'releaseId'];

const EMPTY_LABEL: Record<BulkChangeField, string> = {
  status: '—',
  priority: '—',
  assigneeId: 'Unassigned',
  sprintId: 'Backlog',
  milestoneId: 'No milestone',
  releaseId: 'No release',
};

/**
 * Human-in-the-loop batch edits. The same request runs as a dry run (diff preview) and,
 * once confirmed, as an atomic apply that re-computes the diff against current state.
 */
@Injectable()
export class IssueBulkService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly projectAccess: ProjectAccessService,
    private readonly assignmentTargets: AssignmentTargetsService,
    private readonly eventEmitter: EventEmitter2,
    @Optional() private readonly eventsGateway?: EventsGateway,
  ) {}

  async bulkUpdate(userId: string, projectId: string, dto: BulkUpdateIssuesDto): Promise<BulkChangePreview> {
    const startedAt = Date.now();
    const project = await this.projectAccess.assertProjectAccess(userId, projectId);
    const source = dto.source ?? 'MANUAL';

    const issueIds = dto.operations.map((op) => op.issueId);
    if (new Set(issueIds).size !== issueIds.length) {
      throw new BadRequestException('Each issue may appear only once per bulk change.');
    }
    if (dto.operations.some((op) => definedFields(op.changes).length === 0)) {
      throw new BadRequestException('Every operation must change at least one field.');
    }

    const rows = await this.db
      .select({
        id: issues.id,
        issueKey: issues.issueKey,
        title: issues.title,
        type: issues.type,
        status: issues.status,
        priority: issues.priority,
        assigneeId: issues.assigneeId,
        sprintId: issues.sprintId,
        milestoneId: issues.milestoneId,
        releaseId: issues.releaseId,
      })
      .from(issues)
      .where(and(inArray(issues.id, issueIds), eq(issues.projectId, projectId), eq(issues.isArchived, false)));

    if (rows.length !== issueIds.length) {
      throw new BadRequestException('Some issues do not exist, are archived, or belong to another project.');
    }
    const issueById = new Map<string, IssueRow>(rows.map((r) => [r.id, r]));

    await this.assertTargets(projectId, project.organizationId, dto.operations.map((op) => op.changes));
    const labels = await this.loadLabels(rows, dto.operations.map((op) => op.changes));

    const items: BulkIssueDiff[] = [];
    const unchangedIssueKeys: string[] = [];
    for (const op of dto.operations) {
      const issue = issueById.get(op.issueId) as IssueRow;
      const diffs = diffIssue(issue, op.changes, labels);
      if (diffs.length === 0) {
        unchangedIssueKeys.push(issue.issueKey);
      } else {
        items.push({ issueId: issue.id, issueKey: issue.issueKey, title: issue.title, type: issue.type, diffs });
      }
    }

    if (dto.dryRun || items.length === 0) {
      return { items, unchangedIssueKeys, applied: false };
    }

    const now = new Date();
    await this.db.transaction(async (tx) => {
      for (const item of items) {
        const issue = issueById.get(item.issueId) as IssueRow;
        const updates: Partial<typeof issues.$inferInsert> = { updatedAt: now };
        for (const diff of item.diffs) {
          applyField(updates, diff.field, diff.to);
        }
        // Keep resolution timestamps consistent with single-issue edits
        if (updates.status && updates.status !== issue.status) {
          if (updates.status === 'DONE') {
            updates.resolvedAt = now;
            updates.closedAt = now;
          } else if (issue.status === 'DONE') {
            updates.resolvedAt = null;
            updates.closedAt = null;
          }
        }
        await tx.update(issues).set(updates).where(eq(issues.id, item.issueId));
      }

      await tx.insert(activities).values(
        items.map((item) => ({
          organizationId: project.organizationId,
          projectId,
          userId,
          entityType: 'ISSUE',
          entityId: item.issueId,
          action: 'BULK_UPDATED',
          details: {
            issueKey: item.issueKey,
            source,
            batchSize: items.length,
            changes: item.diffs.map((d) => ({ field: d.field, from: d.fromLabel, to: d.toLabel })),
          },
        })),
      );

      if (source === 'AI_READINESS') {
        await tx.insert(aiAuditTrail).values({
          organizationId: project.organizationId,
          projectId,
          userId,
          userPrompt: `Apply readiness fix to ${items.length} issue(s)`,
          toolsCalled: ['bulk_update_issues'],
          modelName: 'tool-execution',
          latencyMs: Date.now() - startedAt,
        });
      }
    });

    for (const item of items) {
      this.eventsGateway?.broadcastIssueUpdated(projectId, { id: item.issueId, issueKey: item.issueKey });
      this.eventEmitter.emit(DomainEvents.IssueUpdated, {
        issueId: item.issueId,
        projectId,
        updatedFields: item.diffs.map((d) => d.field),
      } satisfies IssueUpdatedEvent);
      const assigned = item.diffs.find((d) => d.field === 'assigneeId' && d.to !== null);
      if (assigned?.to) {
        this.eventEmitter.emit(DomainEvents.IssueAssigned, {
          issueId: item.issueId,
          projectId,
          assigneeId: assigned.to,
          actorId: userId,
        } satisfies IssueAssignedEvent);
      }
    }

    return { items, unchangedIssueKeys, applied: true };
  }

  private async assertTargets(projectId: string, organizationId: string, changes: BulkIssueChanges[]) {
    const distinct = (field: 'sprintId' | 'milestoneId' | 'releaseId' | 'assigneeId') => [
      ...new Set(changes.map((c) => c[field]).filter((v): v is string => typeof v === 'string')),
    ];

    for (const id of distinct('sprintId')) await this.assignmentTargets.assertSprint(projectId, id);
    for (const id of distinct('milestoneId')) await this.assignmentTargets.assertMilestone(projectId, id);
    for (const id of distinct('releaseId')) await this.assignmentTargets.assertRelease(projectId, id);
    for (const id of distinct('assigneeId')) await this.assignmentTargets.assertAssignee(organizationId, id);
  }

  /** Display names for every current and requested container / assignee referenced by the batch. */
  private async loadLabels(rows: IssueRow[], changes: BulkIssueChanges[]): Promise<Map<string, string>> {
    const collect = (field: 'sprintId' | 'milestoneId' | 'releaseId' | 'assigneeId') => [
      ...new Set(
        [...rows.map((r) => r[field]), ...changes.map((c) => c[field])].filter(
          (v): v is string => typeof v === 'string',
        ),
      ),
    ];

    const [sprintRows, milestoneRows, releaseRows, userRows] = await Promise.all([
      lookup(collect('sprintId'), (ids) =>
        this.db.select({ id: sprints.id, label: sprints.name }).from(sprints).where(inArray(sprints.id, ids)),
      ),
      lookup(collect('milestoneId'), (ids) =>
        this.db.select({ id: milestones.id, label: milestones.name }).from(milestones).where(inArray(milestones.id, ids)),
      ),
      lookup(collect('releaseId'), (ids) =>
        this.db.select({ id: releases.id, label: releases.version }).from(releases).where(inArray(releases.id, ids)),
      ),
      lookup(collect('assigneeId'), (ids) =>
        this.db.select({ id: users.id, label: users.name }).from(users).where(inArray(users.id, ids)),
      ),
    ]);

    return new Map([...sprintRows, ...milestoneRows, ...releaseRows, ...userRows].map((r) => [r.id, r.label]));
  }
}

async function lookup(
  ids: string[],
  query: (ids: string[]) => Promise<{ id: string; label: string }[]>,
): Promise<{ id: string; label: string }[]> {
  return ids.length > 0 ? query(ids) : [];
}

function definedFields(changes: BulkIssueChanges): BulkChangeField[] {
  return FIELD_ORDER.filter((field) => changes[field] !== undefined);
}

function diffIssue(issue: IssueRow, changes: BulkIssueChanges, labels: Map<string, string>): BulkFieldDiff[] {
  const diffs: BulkFieldDiff[] = [];
  for (const field of definedFields(changes)) {
    const from = (issue[field] as string | null) ?? null;
    const to = (changes[field] as string | null | undefined) ?? null;
    if (from === to) continue;
    diffs.push({ field, from, to, fromLabel: labelFor(field, from, labels), toLabel: labelFor(field, to, labels) });
  }
  return diffs;
}

function labelFor(field: BulkChangeField, value: string | null, labels: Map<string, string>): string {
  if (value === null) return EMPTY_LABEL[field];
  if (field === 'status') return humanizeStatus(value);
  if (field === 'priority') return value;
  return labels.get(value) ?? 'Unknown';
}

function humanizeStatus(status: string): string {
  const words = status.toLowerCase().split('_');
  return words.map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(' ');
}

function applyField(updates: Partial<typeof issues.$inferInsert>, field: BulkChangeField, value: string | null) {
  switch (field) {
    case 'status':
      if (value) updates.status = value;
      break;
    case 'priority':
      if (value) updates.priority = value as typeof issues.$inferInsert.priority;
      break;
    case 'assigneeId':
      updates.assigneeId = value;
      break;
    case 'sprintId':
      updates.sprintId = value;
      break;
    case 'milestoneId':
      updates.milestoneId = value;
      break;
    case 'releaseId':
      updates.releaseId = value;
      break;
  }
}
