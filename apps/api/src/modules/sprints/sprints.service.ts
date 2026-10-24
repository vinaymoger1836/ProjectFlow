import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Optional,
} from '@nestjs/common';
import { and, eq, ne, inArray, desc, sql, isNotNull } from 'drizzle-orm';
import { Database, sprints, issues, activities } from '@projectflow/database';
import {
  SprintStatus,
  SprintSummary,
  SprintProgress,
  SprintVelocity,
  SprintCompletionResult,
} from '@projectflow/types';
import { DRIZZLE_DB } from '../database/database.module';
import { ProjectAccessService, ProjectRecord } from '../auth/project-access.service';
import { EventsGateway } from '../events/events.gateway';
import {
  CreateSprintDto,
  UpdateSprintDto,
  StartSprintDto,
  CompleteSprintDto,
  SPRINT_STATUSES,
} from './dto/sprint.dto';

type SprintRecord = typeof sprints.$inferSelect;
type Executor = Pick<Database, 'select' | 'insert' | 'update'>;

/** Statuses that count as finished work; everything else is carried over on completion. */
export const RESOLVED_ISSUE_STATUSES = ['DONE', 'CANCELLED'];

/** Sprints can only receive issues while they are not yet finished. */
const ASSIGNABLE_SPRINT_STATUSES: SprintStatus[] = ['PLANNED', 'ACTIVE'];

const DEFAULT_SPRINT_LENGTH_DAYS = 14;
const VELOCITY_WINDOW = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

const STATUS_ORDER: Record<SprintStatus, number> = { ACTIVE: 0, PLANNED: 1, COMPLETED: 2, CANCELLED: 3 };

const EMPTY_PROGRESS: SprintProgress = {
  issueCount: 0,
  doneIssueCount: 0,
  totalPoints: 0,
  donePoints: 0,
  unestimatedCount: 0,
  blockedCount: 0,
};

@Injectable()
export class SprintsService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly projectAccess: ProjectAccessService,
    @Optional() private readonly eventsGateway?: EventsGateway,
  ) {}

  async listSprints(userId: string, projectId: string, statusFilter?: string): Promise<SprintSummary[]> {
    await this.projectAccess.assertProjectAccess(userId, projectId);

    const statuses = statusFilter
      ? statusFilter
          .split(',')
          .map((s) => s.trim().toUpperCase())
          .filter((s): s is SprintStatus => (SPRINT_STATUSES as string[]).includes(s))
      : [];

    const rows = await this.db
      .select()
      .from(sprints)
      .where(
        and(eq(sprints.projectId, projectId), statuses.length > 0 ? inArray(sprints.status, statuses) : undefined),
      );

    rows.sort((a, b) => {
      const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      if (byStatus !== 0) return byStatus;
      if (a.status === 'COMPLETED') return (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0);
      const aStart = a.startDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bStart = b.startDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return aStart - bStart || a.createdAt.getTime() - b.createdAt.getTime();
    });

    const progress = await this.loadProgress(rows.map((r) => r.id));
    return rows.map((r) => toSummary(r, progress.get(r.id)));
  }

  async getSprint(userId: string, sprintId: string): Promise<SprintSummary> {
    const { sprint } = await this.loadSprintWithAccess(userId, sprintId);
    const progress = await this.loadProgress([sprint.id]);
    return toSummary(sprint, progress.get(sprint.id));
  }

  async createSprint(userId: string, projectId: string, dto: CreateSprintDto): Promise<SprintSummary> {
    const project = await this.projectAccess.assertProjectAccess(userId, projectId);
    assertDateOrder(dto.startDate, dto.endDate);

    const [created] = await this.db
      .insert(sprints)
      .values({
        projectId,
        name: dto.name?.trim() || (await this.nextSprintName(projectId)),
        goal: dto.goal?.trim() || null,
        capacityPoints: dto.capacityPoints ?? null,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        status: 'PLANNED',
      })
      .returning();

    await this.logSprintActivity(this.db, project, userId, created.id, 'CREATED', { name: created.name });
    this.broadcast(projectId, created.id);
    return toSummary(created);
  }

  async updateSprint(userId: string, sprintId: string, dto: UpdateSprintDto): Promise<SprintSummary> {
    const { sprint, project } = await this.loadSprintWithAccess(userId, sprintId);
    assertNotFinished(sprint);

    const startDate = dto.startDate === undefined ? sprint.startDate : dto.startDate ? new Date(dto.startDate) : null;
    const endDate = dto.endDate === undefined ? sprint.endDate : dto.endDate ? new Date(dto.endDate) : null;
    assertDateOrder(startDate, endDate);

    const updates: Partial<typeof sprints.$inferInsert> = { updatedAt: new Date(), startDate, endDate };
    if (dto.name !== undefined) updates.name = dto.name.trim();
    if (dto.goal !== undefined) updates.goal = dto.goal?.trim() || null;
    if (dto.capacityPoints !== undefined) updates.capacityPoints = dto.capacityPoints;

    const [updated] = await this.db.update(sprints).set(updates).where(eq(sprints.id, sprint.id)).returning();

    await this.logSprintActivity(this.db, project, userId, sprint.id, 'UPDATED', { updatedFields: Object.keys(dto) });
    this.broadcast(sprint.projectId, sprint.id);
    return this.getSprint(userId, updated.id);
  }

  /**
   * Deletes a sprint that has not started yet; its issues return to the backlog (FK ON DELETE SET NULL).
   */
  async deleteSprint(userId: string, sprintId: string): Promise<{ success: boolean; message: string }> {
    const { sprint, project } = await this.loadSprintWithAccess(userId, sprintId);
    if (sprint.status !== 'PLANNED') {
      throw new BadRequestException('Only planned sprints can be deleted. Complete active sprints instead.');
    }

    await this.db.transaction(async (tx) => {
      await tx.delete(sprints).where(eq(sprints.id, sprint.id));
      await this.logSprintActivity(tx, project, userId, sprint.id, 'DELETED', { name: sprint.name });
    });

    this.broadcast(sprint.projectId, sprint.id);
    return { success: true, message: `${sprint.name} deleted; its issues were returned to the backlog.` };
  }

  /**
   * PLANNED → ACTIVE. Snapshots the committed scope so velocity and scope-creep can be measured later.
   */
  async startSprint(userId: string, sprintId: string, dto: StartSprintDto): Promise<SprintSummary> {
    const { sprint, project } = await this.loadSprintWithAccess(userId, sprintId);
    if (sprint.status !== 'PLANNED') {
      throw new ConflictException(`Sprint is ${sprint.status.toLowerCase()} and cannot be started.`);
    }

    const startDate = dto.startDate ? new Date(dto.startDate) : (sprint.startDate ?? new Date());
    const endDate = dto.endDate
      ? new Date(dto.endDate)
      : (sprint.endDate ?? addDays(startDate, DEFAULT_SPRINT_LENGTH_DAYS));
    assertDateOrder(startDate, endDate);

    const progress = (await this.loadProgress([sprint.id])).get(sprint.id) ?? EMPTY_PROGRESS;
    if (progress.issueCount === 0) {
      throw new BadRequestException('Add at least one issue to the sprint before starting it.');
    }

    const now = new Date();
    await this.db.transaction(async (tx) => {
      await tx
        .update(sprints)
        .set({
          status: 'ACTIVE',
          startDate,
          endDate,
          startedAt: now,
          committedPoints: progress.totalPoints,
          committedIssueCount: progress.issueCount,
          updatedAt: now,
        })
        .where(eq(sprints.id, sprint.id));

      await this.logSprintActivity(tx, project, userId, sprint.id, 'STARTED', {
        committedPoints: progress.totalPoints,
        committedIssueCount: progress.issueCount,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });
    });

    this.broadcast(sprint.projectId, sprint.id);
    return this.getSprint(userId, sprint.id);
  }

  /**
   * ACTIVE → COMPLETED. Records delivered points (velocity) and moves unfinished
   * issues to the backlog or another open sprint, as chosen by the user.
   */
  async completeSprint(userId: string, sprintId: string, dto: CompleteSprintDto): Promise<SprintCompletionResult> {
    const { sprint, project } = await this.loadSprintWithAccess(userId, sprintId);
    if (sprint.status !== 'ACTIVE') {
      throw new ConflictException(`Sprint is ${sprint.status.toLowerCase()} and cannot be completed.`);
    }

    let targetSprint: SprintRecord | null = null;
    if (dto.rolloverTo === 'SPRINT') {
      if (!dto.rolloverSprintId || dto.rolloverSprintId === sprint.id) {
        throw new BadRequestException('Choose a different sprint to receive unfinished issues.');
      }
      targetSprint = await this.loadAssignableSprint(sprint.projectId, dto.rolloverSprintId);
    }

    const progress = (await this.loadProgress([sprint.id])).get(sprint.id) ?? EMPTY_PROGRESS;

    const unfinished = await this.db
      .select({ id: issues.id, issueKey: issues.issueKey })
      .from(issues)
      .where(
        and(
          eq(issues.sprintId, sprint.id),
          eq(issues.isArchived, false),
          sql`${issues.status} NOT IN ('DONE', 'CANCELLED')`,
        ),
      );

    const now = new Date();
    await this.db.transaction(async (tx) => {
      if (unfinished.length > 0) {
        await tx
          .update(issues)
          .set({ sprintId: targetSprint?.id ?? null, updatedAt: now })
          .where(inArray(issues.id, unfinished.map((i) => i.id)));

        await tx.insert(activities).values(
          unfinished.map((issue) => ({
            organizationId: project.organizationId,
            projectId: sprint.projectId,
            userId,
            entityType: 'ISSUE',
            entityId: issue.id,
            action: 'SPRINT_CARRIED_OVER',
            details: {
              issueKey: issue.issueKey,
              fromSprintId: sprint.id,
              fromSprintName: sprint.name,
              toSprintId: targetSprint?.id ?? null,
              toSprintName: targetSprint?.name ?? 'Backlog',
            },
          })),
        );
      }

      await tx
        .update(sprints)
        .set({
          status: 'COMPLETED',
          completedAt: now,
          completedPoints: progress.donePoints,
          completedIssueCount: progress.doneIssueCount,
          carriedOverIssueCount: unfinished.length,
          updatedAt: now,
        })
        .where(eq(sprints.id, sprint.id));

      await this.logSprintActivity(tx, project, userId, sprint.id, 'COMPLETED', {
        completedPoints: progress.donePoints,
        committedPoints: sprint.committedPoints,
        carriedOverIssueCount: unfinished.length,
        carriedOverTo: targetSprint?.name ?? 'Backlog',
      });
    });

    this.broadcast(sprint.projectId, sprint.id);
    if (targetSprint) this.broadcast(sprint.projectId, targetSprint.id);

    return {
      sprint: await this.getSprint(userId, sprint.id),
      carriedOverCount: unfinished.length,
      carriedOverTo: targetSprint
        ? { type: 'SPRINT', sprintId: targetSprint.id, sprintName: targetSprint.name }
        : { type: 'BACKLOG' },
    };
  }

  /**
   * Moves backlog (or other open-sprint) issues into a sprint in one operation.
   */
  async assignIssues(userId: string, sprintId: string, issueIds: string[]): Promise<SprintSummary> {
    const { sprint, project } = await this.loadSprintWithAccess(userId, sprintId);
    assertNotFinished(sprint);
    await this.moveIssuesIntoSprint(this.db, project, userId, sprint, issueIds);
    this.broadcast(sprint.projectId, sprint.id);
    return this.getSprint(userId, sprint.id);
  }

  async getVelocity(userId: string, projectId: string): Promise<SprintVelocity> {
    await this.projectAccess.assertProjectAccess(userId, projectId);
    return this.computeVelocity(projectId);
  }

  // ---------------------------------------------------------------------------
  // Internal helpers shared with SprintPlannerService
  // ---------------------------------------------------------------------------

  async computeVelocity(projectId: string): Promise<SprintVelocity> {
    const rows = await this.db
      .select()
      .from(sprints)
      .where(and(eq(sprints.projectId, projectId), eq(sprints.status, 'COMPLETED'), isNotNull(sprints.completedAt)))
      .orderBy(desc(sprints.completedAt))
      .limit(VELOCITY_WINDOW);

    const recent = rows.map((r) => ({
      sprintId: r.id,
      name: r.name,
      committedPoints: r.committedPoints ?? 0,
      completedPoints: r.completedPoints ?? 0,
      completedAt: (r.completedAt as Date).toISOString(),
    }));

    const averageVelocity =
      recent.length > 0
        ? Math.round(recent.reduce((sum, r) => sum + r.completedPoints, 0) / recent.length)
        : null;

    const lengths = rows
      .map((r) => {
        const start = r.startedAt ?? r.startDate;
        return start && r.completedAt ? (r.completedAt.getTime() - start.getTime()) / DAY_MS : null;
      })
      .filter((days): days is number => days !== null && days > 0);
    const averageSprintLengthDays =
      lengths.length > 0 ? Math.max(1, Math.round(lengths.reduce((sum, d) => sum + d, 0) / lengths.length)) : null;

    return { recent, averageVelocity, averageSprintLengthDays };
  }

  async nextSprintName(projectId: string): Promise<string> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(sprints)
      .where(eq(sprints.projectId, projectId));
    return `Sprint ${(row?.count ?? 0) + 1}`;
  }

  async loadAssignableSprint(projectId: string, sprintId: string): Promise<SprintRecord> {
    const [sprint] = await this.db
      .select()
      .from(sprints)
      .where(and(eq(sprints.id, sprintId), eq(sprints.projectId, projectId)))
      .limit(1);

    if (!sprint) {
      throw new NotFoundException(`Sprint '${sprintId}' not found in this project.`);
    }
    if (!ASSIGNABLE_SPRINT_STATUSES.includes(sprint.status)) {
      throw new BadRequestException(`${sprint.name} is ${sprint.status.toLowerCase()} and cannot receive issues.`);
    }
    return sprint;
  }

  async moveIssuesIntoSprint(
    executor: Executor,
    project: ProjectRecord,
    userId: string,
    sprint: SprintRecord,
    issueIds: string[],
  ): Promise<void> {
    const uniqueIds = [...new Set(issueIds)];
    const rows = await executor
      .select({ id: issues.id, issueKey: issues.issueKey, sprintId: issues.sprintId })
      .from(issues)
      .where(and(inArray(issues.id, uniqueIds), eq(issues.projectId, sprint.projectId), eq(issues.isArchived, false)));

    if (rows.length !== uniqueIds.length) {
      throw new BadRequestException('Some issues do not exist, are archived, or belong to another project.');
    }

    const toMove = rows.filter((r) => r.sprintId !== sprint.id);
    if (toMove.length === 0) return;

    await executor
      .update(issues)
      .set({ sprintId: sprint.id, updatedAt: new Date() })
      .where(inArray(issues.id, toMove.map((r) => r.id)));

    await executor.insert(activities).values(
      toMove.map((issue) => ({
        organizationId: project.organizationId,
        projectId: sprint.projectId,
        userId,
        entityType: 'ISSUE',
        entityId: issue.id,
        action: 'SPRINT_ASSIGNED',
        details: { issueKey: issue.issueKey, sprintId: sprint.id, sprintName: sprint.name },
      })),
    );
  }

  /**
   * Live tallies per sprint. Subtasks are excluded: their effort is carried by the parent issue.
   */
  async loadProgress(sprintIds: string[]): Promise<Map<string, SprintProgress>> {
    const result = new Map<string, SprintProgress>();
    if (sprintIds.length === 0) return result;

    const rows = await this.db
      .select({
        sprintId: issues.sprintId,
        issueCount: sql<number>`count(*)::int`,
        doneIssueCount: sql<number>`(count(*) filter (where ${issues.status} = 'DONE'))::int`,
        totalPoints: sql<number>`coalesce(sum(${issues.storyPoints}), 0)::int`,
        donePoints: sql<number>`coalesce(sum(${issues.storyPoints}) filter (where ${issues.status} = 'DONE'), 0)::int`,
        unestimatedCount: sql<number>`(count(*) filter (where ${issues.storyPoints} is null))::int`,
        blockedCount: sql<number>`(count(*) filter (where ${issues.status} = 'BLOCKED'))::int`,
      })
      .from(issues)
      .where(and(inArray(issues.sprintId, sprintIds), eq(issues.isArchived, false), ne(issues.type, 'SUBTASK')))
      .groupBy(issues.sprintId);

    for (const row of rows) {
      if (!row.sprintId) continue;
      result.set(row.sprintId, {
        issueCount: row.issueCount,
        doneIssueCount: row.doneIssueCount,
        totalPoints: row.totalPoints,
        donePoints: row.donePoints,
        unestimatedCount: row.unestimatedCount,
        blockedCount: row.blockedCount,
      });
    }
    return result;
  }

  async logSprintActivity(
    executor: Executor,
    project: ProjectRecord,
    userId: string,
    sprintId: string,
    action: string,
    details: Record<string, unknown>,
  ): Promise<void> {
    await executor.insert(activities).values({
      organizationId: project.organizationId,
      projectId: project.id,
      userId,
      entityType: 'SPRINT',
      entityId: sprintId,
      action,
      details,
    });
  }

  broadcast(projectId: string, sprintId: string): void {
    this.eventsGateway?.broadcastSprintUpdated(projectId, sprintId);
  }

  private async loadSprintWithAccess(userId: string, sprintId: string) {
    const [sprint] = await this.db.select().from(sprints).where(eq(sprints.id, sprintId)).limit(1);
    if (!sprint) {
      throw new NotFoundException(`Sprint '${sprintId}' not found.`);
    }
    const project = await this.projectAccess.assertProjectAccess(userId, sprint.projectId);
    return { sprint, project };
  }
}

export function toSummary(sprint: SprintRecord, progress: SprintProgress = EMPTY_PROGRESS): SprintSummary {
  return {
    id: sprint.id,
    projectId: sprint.projectId,
    name: sprint.name,
    goal: sprint.goal,
    status: sprint.status,
    capacityPoints: sprint.capacityPoints,
    startDate: sprint.startDate?.toISOString() ?? null,
    endDate: sprint.endDate?.toISOString() ?? null,
    startedAt: sprint.startedAt?.toISOString() ?? null,
    completedAt: sprint.completedAt?.toISOString() ?? null,
    committedPoints: sprint.committedPoints,
    committedIssueCount: sprint.committedIssueCount,
    completedPoints: sprint.completedPoints,
    completedIssueCount: sprint.completedIssueCount,
    carriedOverIssueCount: sprint.carriedOverIssueCount,
    progress,
    createdAt: sprint.createdAt.toISOString(),
    updatedAt: sprint.updatedAt.toISOString(),
  };
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function assertNotFinished(sprint: SprintRecord) {
  if (sprint.status === 'COMPLETED' || sprint.status === 'CANCELLED') {
    throw new BadRequestException(`${sprint.name} is ${sprint.status.toLowerCase()} and can no longer be changed.`);
  }
}

function assertDateOrder(start?: Date | string | null, end?: Date | string | null) {
  if (start && end && new Date(end).getTime() <= new Date(start).getTime()) {
    throw new BadRequestException('Sprint end date must be after its start date.');
  }
}
