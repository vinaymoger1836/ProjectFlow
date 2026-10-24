import { Injectable, Inject, NotFoundException, Optional } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { Database, milestones, activities } from '@projectflow/database';
import { MilestoneSummary, SprintVelocity, WorkProgress } from '@projectflow/types';
import { DRIZZLE_DB } from '../database/database.module';
import { ProjectAccessService, ProjectRecord } from '../auth/project-access.service';
import { EventsGateway } from '../events/events.gateway';
import { SprintsService } from '../sprints/sprints.service';
import { loadWorkProgress, EMPTY_WORK_PROGRESS } from '../issues/work-progress';
import { assessMilestoneHealth } from './milestone-health';
import { CreateMilestoneDto, UpdateMilestoneDto } from './dto/milestone.dto';

type MilestoneRecord = typeof milestones.$inferSelect;
type Executor = Pick<Database, 'insert'>;

const HEALTH_ORDER: Record<MilestoneSummary['health'], number> = {
  OVERDUE: 0,
  AT_RISK: 1,
  ON_TRACK: 2,
  NO_TARGET: 3,
  COMPLETED: 4,
};

@Injectable()
export class MilestonesService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly projectAccess: ProjectAccessService,
    private readonly sprintsService: SprintsService,
    @Optional() private readonly eventsGateway?: EventsGateway,
  ) {}

  /** Milestones needing attention first (overdue, at risk), then by target date. */
  async listMilestones(userId: string, projectId: string): Promise<MilestoneSummary[]> {
    await this.projectAccess.assertProjectAccess(userId, projectId);
    const rows = await this.db.select().from(milestones).where(eq(milestones.projectId, projectId));
    const summaries = await this.summarize(projectId, rows);

    return summaries.sort(
      (a, b) =>
        HEALTH_ORDER[a.health] - HEALTH_ORDER[b.health] ||
        (a.targetDate ? Date.parse(a.targetDate) : Number.MAX_SAFE_INTEGER) -
          (b.targetDate ? Date.parse(b.targetDate) : Number.MAX_SAFE_INTEGER) ||
        a.name.localeCompare(b.name),
    );
  }

  async getMilestone(userId: string, milestoneId: string): Promise<MilestoneSummary> {
    const { milestone } = await this.loadWithAccess(userId, milestoneId);
    const [summary] = await this.summarize(milestone.projectId, [milestone]);
    return summary;
  }

  async createMilestone(userId: string, projectId: string, dto: CreateMilestoneDto): Promise<MilestoneSummary> {
    const project = await this.projectAccess.assertProjectAccess(userId, projectId);

    const [created] = await this.db
      .insert(milestones)
      .values({
        projectId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        targetDate: dto.targetDate ? new Date(dto.targetDate) : null,
      })
      .returning();

    await this.logActivity(this.db, project, userId, created.id, 'CREATED', { name: created.name });
    this.broadcast(projectId, created.id);
    const [summary] = await this.summarize(projectId, [created]);
    return summary;
  }

  async updateMilestone(userId: string, milestoneId: string, dto: UpdateMilestoneDto): Promise<MilestoneSummary> {
    const { milestone, project } = await this.loadWithAccess(userId, milestoneId);

    const updates: Partial<typeof milestones.$inferInsert> = { updatedAt: new Date() };
    if (dto.name !== undefined) updates.name = dto.name.trim();
    if (dto.description !== undefined) updates.description = dto.description?.trim() || null;
    if (dto.targetDate !== undefined) updates.targetDate = dto.targetDate ? new Date(dto.targetDate) : null;

    const [updated] = await this.db.update(milestones).set(updates).where(eq(milestones.id, milestone.id)).returning();

    await this.logActivity(this.db, project, userId, milestone.id, 'UPDATED', { updatedFields: Object.keys(dto) });
    this.broadcast(milestone.projectId, milestone.id);
    const [summary] = await this.summarize(milestone.projectId, [updated]);
    return summary;
  }

  /** Deleting a milestone unassigns its issues (FK ON DELETE SET NULL); the issues themselves remain. */
  async deleteMilestone(userId: string, milestoneId: string): Promise<{ success: boolean; message: string }> {
    const { milestone, project } = await this.loadWithAccess(userId, milestoneId);

    await this.db.transaction(async (tx) => {
      await tx.delete(milestones).where(eq(milestones.id, milestone.id));
      await this.logActivity(tx, project, userId, milestone.id, 'DELETED', { name: milestone.name });
    });

    this.broadcast(milestone.projectId, milestone.id);
    return { success: true, message: `${milestone.name} deleted; its issues are no longer tied to a milestone.` };
  }

  /** Summaries for specific milestones of a project; used by release readiness. */
  async summarizeByIds(projectId: string, milestoneIds: string[]): Promise<MilestoneSummary[]> {
    if (milestoneIds.length === 0) return [];
    const rows = await this.db
      .select()
      .from(milestones)
      .where(and(eq(milestones.projectId, projectId), inArray(milestones.id, milestoneIds)));
    return this.summarize(projectId, rows);
  }

  private async summarize(projectId: string, rows: MilestoneRecord[]): Promise<MilestoneSummary[]> {
    if (rows.length === 0) return [];
    const [progress, velocity] = await Promise.all([
      loadWorkProgress(this.db, 'milestoneId', rows.map((r) => r.id)),
      this.sprintsService.computeVelocity(projectId),
    ]);
    return rows.map((row) => toSummary(row, progress.get(row.id) ?? EMPTY_WORK_PROGRESS, velocity));
  }

  private async loadWithAccess(userId: string, milestoneId: string) {
    const [milestone] = await this.db.select().from(milestones).where(eq(milestones.id, milestoneId)).limit(1);
    if (!milestone) {
      throw new NotFoundException(`Milestone '${milestoneId}' not found.`);
    }
    const project = await this.projectAccess.assertProjectAccess(userId, milestone.projectId);
    return { milestone, project };
  }

  private async logActivity(
    executor: Executor,
    project: ProjectRecord,
    userId: string,
    milestoneId: string,
    action: string,
    details: Record<string, unknown>,
  ) {
    await executor.insert(activities).values({
      organizationId: project.organizationId,
      projectId: project.id,
      userId,
      entityType: 'MILESTONE',
      entityId: milestoneId,
      action,
      details,
    });
  }

  private broadcast(projectId: string, milestoneId: string) {
    this.eventsGateway?.broadcastPlanningUpdated(projectId, 'milestone', milestoneId);
  }
}

function toSummary(row: MilestoneRecord, progress: WorkProgress, velocity: SprintVelocity): MilestoneSummary {
  const assessment = assessMilestoneHealth(row.targetDate, progress, velocity);
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    description: row.description,
    targetDate: row.targetDate?.toISOString() ?? null,
    progress,
    health: assessment.health,
    healthReason: assessment.healthReason,
    projectedCompletionDate: assessment.projectedCompletionDate?.toISOString() ?? null,
    slipDays: assessment.slipDays,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
