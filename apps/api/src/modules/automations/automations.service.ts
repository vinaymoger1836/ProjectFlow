import { randomUUID } from 'crypto';
import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { Database, activities, automations, automationRuns, issues, userRoles, users } from '@projectflow/database';
import { AutomationRunSummary, AutomationSummary } from '@projectflow/types';
import { DRIZZLE_DB } from '../database/database.module';
import { ProjectAccessService, ProjectRecord } from '../auth/project-access.service';
import {
  AutomationDefinition,
  AutomationDefinitionError,
  parseAutomationDefinition,
  referencedUserIds,
} from './automation-definition';
import { AutomationEngineService, toRunSummary } from './automation-engine.service';
import { AutomationSchedulerService } from './automation-scheduler.service';
import { DEFAULT_RUN_HISTORY } from './automations.constants';
import { CreateAutomationDto, UpdateAutomationDto } from './dto/automation.dto';

type AutomationRecord = typeof automations.$inferSelect;
type Executor = Pick<Database, 'insert'>;

@Injectable()
export class AutomationsService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly projectAccess: ProjectAccessService,
    private readonly engine: AutomationEngineService,
    private readonly scheduler: AutomationSchedulerService,
  ) {}

  async listAutomations(userId: string, projectId: string): Promise<AutomationSummary[]> {
    await this.projectAccess.assertProjectAccess(userId, projectId);

    const [rows, lastRuns] = await Promise.all([
      this.db
        .select({ automation: automations, creatorName: users.name })
        .from(automations)
        .leftJoin(users, eq(users.id, automations.createdById))
        .where(eq(automations.projectId, projectId))
        .orderBy(desc(automations.createdAt)),
      // Latest run of every automation in the project, in the same round trip
      this.db
        .selectDistinctOn([automationRuns.automationId], { run: automationRuns, issueKey: issues.issueKey })
        .from(automationRuns)
        .leftJoin(issues, eq(issues.id, automationRuns.issueId))
        .where(eq(automationRuns.projectId, projectId))
        .orderBy(automationRuns.automationId, desc(automationRuns.startedAt)),
    ]);

    const lastRunById = new Map(lastRuns.map((r) => [r.run.automationId, toRunSummary(r.run, r.issueKey)]));
    return rows.map((r) => toSummary(r.automation, r.creatorName, lastRunById.get(r.automation.id) ?? null));
  }

  async createAutomation(userId: string, projectId: string, dto: CreateAutomationDto): Promise<AutomationSummary> {
    const project = await this.projectAccess.assertProjectAccess(userId, projectId);
    const definition = parseDefinition({ trigger: dto.trigger, conditions: dto.conditions ?? [], actions: dto.actions });
    await this.assertMembers(project, definition);

    const [created] = await this.db
      .insert(automations)
      .values({
        projectId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        enabled: dto.enabled ?? true,
        triggerType: definition.trigger.type,
        trigger: definition.trigger,
        conditions: definition.conditions,
        actions: definition.actions,
        createdById: userId,
      })
      .returning();

    await Promise.all([
      this.logActivity(this.db, project, userId, created.id, 'CREATED', { name: created.name, trigger: created.triggerType }),
      this.scheduler.sync(created),
    ]);
    return this.getSummary(created.id);
  }

  async updateAutomation(userId: string, automationId: string, dto: UpdateAutomationDto): Promise<AutomationSummary> {
    const { automation, project } = await this.loadWithAccess(userId, automationId);

    const updates: Partial<typeof automations.$inferInsert> = { updatedAt: new Date() };
    if (dto.name !== undefined) updates.name = dto.name.trim();
    if (dto.description !== undefined) updates.description = dto.description?.trim() || null;
    if (dto.enabled !== undefined) updates.enabled = dto.enabled;

    if (dto.trigger !== undefined || dto.conditions !== undefined || dto.actions !== undefined) {
      // Validate the definition as a whole, so a partial edit cannot leave it inconsistent
      const definition = parseDefinition({
        trigger: dto.trigger ?? automation.trigger,
        conditions: dto.conditions ?? automation.conditions,
        actions: dto.actions ?? automation.actions,
      });
      await this.assertMembers(project, definition);
      Object.assign(updates, {
        triggerType: definition.trigger.type,
        trigger: definition.trigger,
        conditions: definition.conditions,
        actions: definition.actions,
      });
    }

    const [updated] = await this.db.update(automations).set(updates).where(eq(automations.id, automation.id)).returning();

    await Promise.all([
      this.logActivity(this.db, project, userId, automation.id, 'UPDATED', { updatedFields: Object.keys(dto) }),
      this.scheduler.sync(updated),
    ]);
    return this.getSummary(updated.id);
  }

  async deleteAutomation(userId: string, automationId: string): Promise<{ success: boolean; message: string }> {
    const { automation, project } = await this.loadWithAccess(userId, automationId);

    await this.db.transaction(async (tx) => {
      await tx.delete(automations).where(eq(automations.id, automation.id));
      await this.logActivity(tx, project, userId, automation.id, 'DELETED', { name: automation.name });
    });
    await this.scheduler.remove(automation.id);

    return { success: true, message: `Automation "${automation.name}" deleted.` };
  }

  async listRuns(userId: string, automationId: string, limit = DEFAULT_RUN_HISTORY): Promise<AutomationRunSummary[]> {
    const { automation } = await this.loadWithAccess(userId, automationId);
    const rows = await this.db
      .select({ run: automationRuns, issueKey: issues.issueKey })
      .from(automationRuns)
      .leftJoin(issues, eq(issues.id, automationRuns.issueId))
      .where(eq(automationRuns.automationId, automation.id))
      .orderBy(desc(automationRuns.startedAt))
      .limit(limit);
    return rows.map((r) => toRunSummary(r.run, r.issueKey));
  }

  /** Runs a scheduled automation immediately (even while disabled), e.g. to check who it would notify. */
  async runNow(userId: string, automationId: string): Promise<AutomationRunSummary> {
    const { automation, project } = await this.loadWithAccess(userId, automationId);
    if (automation.triggerType !== 'SCHEDULE') {
      throw new BadRequestException('Only scheduled automations can be run on demand; issue-created rules run when an issue is created.');
    }

    const run = await this.engine.runScheduled(automation, `manual-${randomUUID()}`, true);
    if (!run) throw new NotFoundException(`Automation '${automationId}' could not be run.`);

    await this.logActivity(this.db, project, userId, automation.id, 'RUN', {
      runId: run.id,
      status: run.status,
      matchedCount: run.matchedCount,
      notifiedCount: run.notifiedCount,
    });
    return run;
  }

  private async getSummary(automationId: string): Promise<AutomationSummary> {
    const [[row], [lastRun]] = await Promise.all([
      this.db
        .select({ automation: automations, creatorName: users.name })
        .from(automations)
        .leftJoin(users, eq(users.id, automations.createdById))
        .where(eq(automations.id, automationId))
        .limit(1),
      this.db
        .select({ run: automationRuns, issueKey: issues.issueKey })
        .from(automationRuns)
        .leftJoin(issues, eq(issues.id, automationRuns.issueId))
        .where(eq(automationRuns.automationId, automationId))
        .orderBy(desc(automationRuns.startedAt))
        .limit(1),
    ]);
    if (!row) throw new NotFoundException(`Automation '${automationId}' not found.`);
    return toSummary(row.automation, row.creatorName, lastRun ? toRunSummary(lastRun.run, lastRun.issueKey) : null);
  }

  private async loadWithAccess(userId: string, automationId: string) {
    const [automation] = await this.db.select().from(automations).where(eq(automations.id, automationId)).limit(1);
    if (!automation) {
      throw new NotFoundException(`Automation '${automationId}' not found.`);
    }
    const project = await this.projectAccess.assertProjectAccess(userId, automation.projectId);
    return { automation, project };
  }

  /** Assignee conditions may only reference members of the project's organization. */
  private async assertMembers(project: ProjectRecord, definition: AutomationDefinition) {
    const ids = referencedUserIds(definition.conditions);
    if (ids.length === 0) return;

    const members = await this.db
      .selectDistinct({ userId: userRoles.userId })
      .from(userRoles)
      .where(and(eq(userRoles.organizationId, project.organizationId), inArray(userRoles.userId, ids)));
    const known = new Set(members.map((m) => m.userId));
    const unknown = ids.filter((id) => !known.has(id));
    if (unknown.length > 0) {
      throw new BadRequestException(`Assignee condition references users outside this organization: ${unknown.join(', ')}.`);
    }
  }

  private async logActivity(
    executor: Executor,
    project: ProjectRecord,
    userId: string,
    automationId: string,
    action: string,
    details: Record<string, unknown>,
  ) {
    await executor.insert(activities).values({
      organizationId: project.organizationId,
      projectId: project.id,
      userId,
      entityType: 'AUTOMATION',
      entityId: automationId,
      action,
      details,
    });
  }
}

function parseDefinition(input: { trigger: unknown; conditions: unknown; actions: unknown }): AutomationDefinition {
  try {
    return parseAutomationDefinition(input);
  } catch (err) {
    if (err instanceof AutomationDefinitionError) {
      throw new BadRequestException({
        message: err.message,
        problems: err.problems,
        error: 'Bad Request',
        statusCode: 400,
        code: 'INVALID_AUTOMATION',
      });
    }
    throw err;
  }
}

function toSummary(row: AutomationRecord, creatorName: string | null, lastRun: AutomationRunSummary | null): AutomationSummary {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    description: row.description,
    enabled: row.enabled,
    trigger: row.trigger,
    conditions: row.conditions,
    actions: row.actions,
    createdBy: row.createdById ? { id: row.createdById, name: creatorName ?? 'Unknown' } : null,
    lastRun,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
