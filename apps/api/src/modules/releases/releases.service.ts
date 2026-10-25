import {
  Injectable,
  Inject,
  BadRequestException,
  ConflictException,
  Optional,
} from '@nestjs/common';
import { and, eq, inArray, isNotNull, ne, notInArray, sql } from 'drizzle-orm';
import { Database, releases, issues, activities } from '@projectflow/database';
import { ReleaseReadinessReport, ReleaseShipResult, ReleaseStatus, ReleaseSummary, WorkProgress } from '@projectflow/types';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DomainEvents, PlanningChangedEvent } from '../../common/events/domain-events';
import { DRIZZLE_DB } from '../database/database.module';
import { ProjectAccessService, ProjectRecord } from '../auth/project-access.service';
import { EventsGateway } from '../events/events.gateway';
import { loadWorkProgress, EMPTY_WORK_PROGRESS } from '../issues/work-progress';
import { ReleaseReadinessService, ReleaseRecord } from './release-readiness.service';
import { CreateReleaseDto, UpdateReleaseDto, UpdateReleaseStatusDto, ShipReleaseDto } from './dto/release.dto';

type Executor = Pick<Database, 'insert'>;

const STATUS_ORDER: Record<ReleaseStatus, number> = { READY_FOR_RELEASE: 0, IN_PROGRESS: 1, PLANNED: 2, RELEASED: 3 };
const RESOLVED_STATUSES = ['DONE', 'CANCELLED'];
/** Statuses where the readiness gate applies. */
const GATED_STATUSES: ReleaseStatus[] = ['READY_FOR_RELEASE', 'RELEASED'];
const PG_UNIQUE_VIOLATION = '23505';

@Injectable()
export class ReleasesService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly projectAccess: ProjectAccessService,
    private readonly readiness: ReleaseReadinessService,
    private readonly eventEmitter: EventEmitter2,
    @Optional() private readonly eventsGateway?: EventsGateway,
  ) {}

  /** Unreleased versions first (closest to shipping), then shipped history newest first. */
  async listReleases(userId: string, projectId: string): Promise<ReleaseSummary[]> {
    await this.projectAccess.assertProjectAccess(userId, projectId);
    const rows = await this.db.select().from(releases).where(eq(releases.projectId, projectId));

    rows.sort((a, b) => {
      const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      if (byStatus !== 0) return byStatus;
      if (a.status === 'RELEASED') return (b.releasedAt?.getTime() ?? 0) - (a.releasedAt?.getTime() ?? 0);
      const aTarget = a.targetDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bTarget = b.targetDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return aTarget - bTarget || a.createdAt.getTime() - b.createdAt.getTime();
    });

    return this.summarize(rows);
  }

  async getRelease(userId: string, releaseId: string): Promise<ReleaseSummary> {
    const { release } = await this.readiness.loadWithAccess(userId, releaseId);
    const [summary] = await this.summarize([release]);
    return summary;
  }

  async createRelease(userId: string, projectId: string, dto: CreateReleaseDto): Promise<ReleaseSummary> {
    const project = await this.projectAccess.assertProjectAccess(userId, projectId);

    const created = await this.withVersionGuard(dto.version, async () => {
      const [row] = await this.db
        .insert(releases)
        .values({
          projectId,
          version: dto.version.trim(),
          name: dto.name?.trim() || dto.version.trim(),
          description: dto.description?.trim() || null,
          targetDate: dto.targetDate ? new Date(dto.targetDate) : null,
          status: 'PLANNED',
        })
        .returning();
      return row;
    });

    await this.logActivity(this.db, project, userId, created.id, 'CREATED', { version: created.version });
    this.broadcast(projectId, created.id);
    const [summary] = await this.summarize([created]);
    return summary;
  }

  async updateRelease(userId: string, releaseId: string, dto: UpdateReleaseDto): Promise<ReleaseSummary> {
    const { release, project } = await this.readiness.loadWithAccess(userId, releaseId);

    // A shipped release is a historical record: only its notes and description stay editable
    if (release.status === 'RELEASED' && (dto.version !== undefined || dto.name !== undefined || dto.targetDate !== undefined)) {
      throw new BadRequestException(`${release.version} has shipped; only its notes and description can change.`);
    }

    const updates: Partial<typeof releases.$inferInsert> = { updatedAt: new Date() };
    if (dto.version !== undefined) updates.version = dto.version.trim();
    if (dto.name !== undefined) updates.name = dto.name.trim();
    if (dto.description !== undefined) updates.description = dto.description?.trim() || null;
    if (dto.targetDate !== undefined) updates.targetDate = dto.targetDate ? new Date(dto.targetDate) : null;
    if (dto.releaseNotes !== undefined) updates.releaseNotes = dto.releaseNotes?.trim() ? dto.releaseNotes : null;

    const updated = await this.withVersionGuard(dto.version ?? release.version, async () => {
      const [row] = await this.db.update(releases).set(updates).where(eq(releases.id, release.id)).returning();
      return row;
    });

    await this.logActivity(this.db, project, userId, release.id, 'UPDATED', { updatedFields: Object.keys(dto) });
    this.broadcast(release.projectId, release.id);
    const [summary] = await this.summarize([updated]);
    return summary;
  }

  /** Deletes an unreleased version; its issues are unassigned (FK ON DELETE SET NULL). */
  async deleteRelease(userId: string, releaseId: string): Promise<{ success: boolean; message: string }> {
    const { release, project } = await this.readiness.loadWithAccess(userId, releaseId);
    if (release.status === 'RELEASED') {
      throw new BadRequestException('Shipped releases are kept as history and cannot be deleted.');
    }

    await this.db.transaction(async (tx) => {
      await tx.delete(releases).where(eq(releases.id, release.id));
      await this.logActivity(tx, project, userId, release.id, 'DELETED', { version: release.version });
    });

    this.broadcast(release.projectId, release.id);
    return { success: true, message: `${release.version} deleted; its issues are no longer tied to a release.` };
  }

  /**
   * PLANNED ⇄ IN_PROGRESS ⇄ READY_FOR_RELEASE. Entering READY_FOR_RELEASE runs the readiness gate.
   */
  async updateStatus(userId: string, releaseId: string, dto: UpdateReleaseStatusDto): Promise<ReleaseSummary> {
    const { release, project } = await this.readiness.loadWithAccess(userId, releaseId);
    if (release.status === 'RELEASED') {
      throw new ConflictException(`${release.version} has already shipped.`);
    }
    if (release.status === dto.status) {
      const [summary] = await this.summarize([release]);
      return summary;
    }

    const overridden = await this.enforceReadinessGate(release, dto.status, dto.acknowledgeRisks);

    const [updated] = await this.db
      .update(releases)
      .set({ status: dto.status, updatedAt: new Date() })
      .where(eq(releases.id, release.id))
      .returning();

    await this.logActivity(this.db, project, userId, release.id, 'STATUS_CHANGED', {
      from: release.status,
      to: dto.status,
      ...(overridden.length > 0 ? { readinessOverride: true, overriddenChecks: overridden } : {}),
    });
    this.broadcast(release.projectId, release.id);
    const [summary] = await this.summarize([updated]);
    return summary;
  }

  /**
   * Any open status → RELEASED. Snapshots what shipped and moves unfinished issues to
   * another unreleased version or out of any release, as chosen by the user.
   */
  async shipRelease(userId: string, releaseId: string, dto: ShipReleaseDto): Promise<ReleaseShipResult> {
    const { release, project } = await this.readiness.loadWithAccess(userId, releaseId);
    if (release.status === 'RELEASED') {
      throw new ConflictException(`${release.version} has already shipped.`);
    }

    let target: ReleaseRecord | null = null;
    if (dto.rolloverTo === 'RELEASE') {
      if (!dto.rolloverReleaseId || dto.rolloverReleaseId === release.id) {
        throw new BadRequestException('Choose a different release to receive unfinished issues.');
      }
      const [row] = await this.db
        .select()
        .from(releases)
        .where(and(eq(releases.id, dto.rolloverReleaseId), eq(releases.projectId, release.projectId)))
        .limit(1);
      if (!row) throw new BadRequestException('The chosen release does not exist in this project.');
      if (row.status === 'RELEASED') throw new BadRequestException(`${row.version} has already shipped.`);
      target = row;
    }

    const overridden = await this.enforceReadinessGate(release, 'RELEASED', dto.acknowledgeRisks);
    const progress = (await loadWorkProgress(this.db, 'releaseId', [release.id])).get(release.id) ?? EMPTY_WORK_PROGRESS;

    // Subtasks travel with the rest of the unfinished work so nothing is left in a shipped release
    const unfinished = await this.db
      .select({ id: issues.id, issueKey: issues.issueKey, type: issues.type })
      .from(issues)
      .where(
        and(eq(issues.releaseId, release.id), eq(issues.isArchived, false), notInArray(issues.status, RESOLVED_STATUSES)),
      );
    const carriedOverCount = unfinished.filter((i) => i.type !== 'SUBTASK').length;

    const now = new Date();
    await this.db.transaction(async (tx) => {
      if (unfinished.length > 0) {
        await tx
          .update(issues)
          .set({ releaseId: target?.id ?? null, updatedAt: now })
          .where(inArray(issues.id, unfinished.map((i) => i.id)));

        await tx.insert(activities).values(
          unfinished.map((issue) => ({
            organizationId: project.organizationId,
            projectId: release.projectId,
            userId,
            entityType: 'ISSUE',
            entityId: issue.id,
            action: 'RELEASE_CARRIED_OVER',
            details: {
              issueKey: issue.issueKey,
              fromReleaseId: release.id,
              fromVersion: release.version,
              toReleaseId: target?.id ?? null,
              toVersion: target?.version ?? null,
            },
          })),
        );
      }

      await tx
        .update(releases)
        .set({
          status: 'RELEASED',
          releasedAt: now,
          shippedIssueCount: progress.doneIssueCount,
          carriedOverIssueCount: carriedOverCount,
          updatedAt: now,
        })
        .where(eq(releases.id, release.id));

      await this.logActivity(tx, project, userId, release.id, 'RELEASED', {
        from: release.status,
        shippedIssueCount: progress.doneIssueCount,
        carriedOverIssueCount: carriedOverCount,
        carriedOverTo: target?.version ?? null,
        ...(overridden.length > 0 ? { readinessOverride: true, overriddenChecks: overridden } : {}),
      });
    });

    this.broadcast(release.projectId, release.id);
    if (target) this.broadcast(release.projectId, target.id);

    return {
      release: await this.getRelease(userId, release.id),
      carriedOverCount,
      carriedOverTo: target ? { type: 'RELEASE', releaseId: target.id, version: target.version } : { type: 'NONE' },
    };
  }

  /**
   * Blocks gated transitions while critical checks fail, unless the user explicitly acknowledged
   * the risk. Returns the ids of overridden checks for the audit log.
   */
  private async enforceReadinessGate(
    release: ReleaseRecord,
    toStatus: ReleaseStatus,
    acknowledgeRisks?: boolean,
  ): Promise<string[]> {
    if (!GATED_STATUSES.includes(toStatus)) return [];

    const report: ReleaseReadinessReport = await this.readiness.evaluate(release);
    const failing = report.checks.filter((c) => c.critical && c.status === 'FAIL');
    if (failing.length === 0) return [];

    if (!acknowledgeRisks) {
      throw new ConflictException({
        statusCode: 409,
        code: 'READINESS_CHECK_FAILED',
        message: `${release.version} fails ${failing.length} critical readiness check(s): ${failing.map((c) => c.label).join(', ')}. Confirm to proceed anyway.`,
        readiness: report,
      });
    }
    return failing.map((c) => c.id);
  }

  private async summarize(rows: ReleaseRecord[]): Promise<ReleaseSummary[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const [progress, milestoneCounts] = await Promise.all([
      loadWorkProgress(this.db, 'releaseId', ids),
      this.db
        .select({ releaseId: issues.releaseId, count: sql<number>`count(distinct ${issues.milestoneId})::int` })
        .from(issues)
        .where(and(inArray(issues.releaseId, ids), eq(issues.isArchived, false), isNotNull(issues.milestoneId), ne(issues.status, 'CANCELLED')))
        .groupBy(issues.releaseId),
    ]);
    const countById = new Map(milestoneCounts.map((r) => [r.releaseId, r.count]));
    return rows.map((row) => toSummary(row, progress.get(row.id) ?? EMPTY_WORK_PROGRESS, countById.get(row.id) ?? 0));
  }

  private async withVersionGuard<T>(version: string, write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException(`A release with version '${version}' already exists in this project.`);
      }
      throw err;
    }
  }

  private async logActivity(
    executor: Executor,
    project: ProjectRecord,
    userId: string,
    releaseId: string,
    action: string,
    details: Record<string, unknown>,
  ) {
    await executor.insert(activities).values({
      organizationId: project.organizationId,
      projectId: project.id,
      userId,
      entityType: 'RELEASE',
      entityId: releaseId,
      action,
      details,
    });
  }

  private broadcast(projectId: string, releaseId: string) {
    this.eventsGateway?.broadcastPlanningUpdated(projectId, 'release', releaseId);
    this.eventEmitter.emit(DomainEvents.PlanningChanged, { projectId, source: 'RELEASE' } satisfies PlanningChangedEvent);
  }
}

function toSummary(row: ReleaseRecord, progress: WorkProgress, milestoneCount: number): ReleaseSummary {
  return {
    id: row.id,
    projectId: row.projectId,
    version: row.version,
    name: row.name,
    description: row.description,
    status: row.status,
    targetDate: row.targetDate?.toISOString() ?? null,
    releasedAt: row.releasedAt?.toISOString() ?? null,
    releaseNotes: row.releaseNotes,
    shippedIssueCount: row.shippedIssueCount,
    carriedOverIssueCount: row.carriedOverIssueCount,
    progress,
    milestoneCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** node-postgres surfaces the SQLSTATE on `code`, possibly wrapped by Drizzle in `cause`. */
function isUniqueViolation(err: unknown): boolean {
  const code = (e: unknown) => (e && typeof e === 'object' && 'code' in e ? (e as { code?: unknown }).code : undefined);
  const cause = err && typeof err === 'object' && 'cause' in err ? (err as { cause?: unknown }).cause : undefined;
  return code(err) === PG_UNIQUE_VIOLATION || code(cause) === PG_UNIQUE_VIOLATION;
}
