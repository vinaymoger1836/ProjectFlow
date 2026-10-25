import { Injectable, Inject, Logger, Optional } from '@nestjs/common';
import { and, asc, eq, gte, inArray, isNotNull, lte, ne, notInArray, sql } from 'drizzle-orm';
import {
  Database,
  issues,
  issueDependencies,
  projects,
  projectHealthSnapshots,
  releases,
  sprints,
  userRoles,
} from '@projectflow/database';
import { ProjectHealthReport, ProjectHealthTrendPoint } from '@projectflow/types';
import { DRIZZLE_DB } from '../database/database.module';
import { ProjectAccessService, ProjectRecord } from '../auth/project-access.service';
import { EventsGateway } from '../events/events.gateway';
import { SprintsService } from '../sprints/sprints.service';
import { MilestonesService } from '../milestones/milestones.service';
import { ReleaseReadinessService } from '../releases/release-readiness.service';
import { HEALTH_THRESHOLDS, HealthEvaluation, HealthInputs, scoreProjectHealth } from './health-rules';

const DAY_MS = 24 * 60 * 60 * 1000;
const RESOLVED_STATUSES = ['DONE', 'CANCELLED'];
const TREND_DAYS = 30;
const CYCLE_TIME_WINDOW_DAYS = 30;

export type ProjectHealthEvaluation = Omit<ProjectHealthReport, 'trend'>;

/**
 * Deterministic Project Health Engine (ADR-022): gathers project signals, scores them with
 * fixed rules, and persists the current status plus one snapshot per day for trend lines.
 * The LLM never computes health; it may only explain an evaluation.
 */
@Injectable()
export class ProjectHealthService {
  private readonly logger = new Logger(ProjectHealthService.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly projectAccess: ProjectAccessService,
    private readonly sprintsService: SprintsService,
    private readonly milestonesService: MilestonesService,
    private readonly readiness: ReleaseReadinessService,
    @Optional() private readonly eventsGateway?: EventsGateway,
  ) {}

  /** Live evaluation plus the stored trend, for dashboards and the command bar. */
  async getReport(userId: string, projectId: string): Promise<ProjectHealthReport> {
    const project = await this.projectAccess.assertProjectAccess(userId, projectId);
    return this.buildReport(project);
  }

  async buildReport(project: ProjectRecord): Promise<ProjectHealthReport> {
    const [evaluation, trend] = await Promise.all([this.evaluate(project), this.loadTrend(project.id)]);
    return { ...evaluation, trend };
  }

  /** Projects in every organization the user belongs to (cross-project scope). */
  async listAccessibleProjects(userId: string): Promise<ProjectRecord[]> {
    const rows = await this.db
      .select({ project: projects })
      .from(projects)
      .innerJoin(userRoles, and(eq(userRoles.organizationId, projects.organizationId), eq(userRoles.userId, userId)))
      .orderBy(asc(projects.key));
    // A user may hold several roles in one organization; keep each project once
    return [...new Map(rows.map((r) => [r.project.id, r.project])).values()];
  }

  async listAllProjectIds(): Promise<string[]> {
    return (await this.db.select({ id: projects.id }).from(projects)).map((r) => r.id);
  }

  async findProjectsWithoutSnapshotToday(): Promise<string[]> {
    const today = utcDay(new Date());
    const rows = await this.db
      .select({ id: projects.id })
      .from(projects)
      .leftJoin(
        projectHealthSnapshots,
        and(eq(projectHealthSnapshots.projectId, projects.id), eq(projectHealthSnapshots.snapshotDate, today)),
      )
      .where(sql`${projectHealthSnapshots.id} is null`);
    return rows.map((r) => r.id);
  }

  /**
   * Evaluates and persists: current status on `projects`, today's snapshot (upserted), and a
   * real-time broadcast when the status changes.
   */
  async recompute(projectId: string): Promise<ProjectHealthEvaluation | null> {
    const [project] = await this.db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    if (!project) return null;

    const evaluation = await this.evaluate(project);
    const now = new Date(evaluation.evaluatedAt);

    await this.db.transaction(async (tx) => {
      await tx
        .update(projects)
        .set({ healthStatus: evaluation.status, healthScore: evaluation.score, healthEvaluatedAt: now })
        .where(eq(projects.id, project.id));

      await tx
        .insert(projectHealthSnapshots)
        .values({
          projectId: project.id,
          snapshotDate: utcDay(now),
          status: evaluation.status,
          score: evaluation.score,
          factors: evaluation.factors,
          metrics: evaluation.metrics,
        })
        .onConflictDoUpdate({
          target: [projectHealthSnapshots.projectId, projectHealthSnapshots.snapshotDate],
          set: {
            status: evaluation.status,
            score: evaluation.score,
            factors: evaluation.factors,
            metrics: evaluation.metrics,
            updatedAt: now,
          },
        });
    });

    if (project.healthStatus !== evaluation.status || project.healthScore !== evaluation.score) {
      this.eventsGateway?.broadcastProjectHealth(project.id, { status: evaluation.status, score: evaluation.score });
    }
    if (project.healthStatus !== evaluation.status) {
      this.logger.log(`${project.key} health ${project.healthStatus} → ${evaluation.status} (score ${evaluation.score})`);
    }
    return evaluation;
  }

  async evaluate(project: ProjectRecord, now = new Date()): Promise<ProjectHealthEvaluation> {
    const inputs = await this.gatherInputs(project, now);
    const result: HealthEvaluation = scoreProjectHealth(inputs);
    return {
      projectId: project.id,
      projectKey: project.key,
      projectName: project.name,
      ...result,
      evaluatedAt: now.toISOString(),
    };
  }

  private async gatherInputs(project: ProjectRecord, now: Date): Promise<HealthInputs> {
    const openIssues = await this.db
      .select({
        id: issues.id,
        issueKey: issues.issueKey,
        type: issues.type,
        priority: issues.priority,
        status: issues.status,
        createdAt: issues.createdAt,
        dueDate: issues.dueDate,
      })
      .from(issues)
      .where(
        and(
          eq(issues.projectId, project.id),
          eq(issues.isArchived, false),
          ne(issues.type, 'SUBTASK'),
          notInArray(issues.status, RESOLVED_STATUSES),
        ),
      );

    const [blockedByDependency, milestones, releasesAtRisk, sprintSignals, cycleTime] = await Promise.all([
      this.loadDependencyBlocked(openIssues.map((i) => i.id)),
      this.milestonesService.summarizeProject(project.id),
      this.loadReleasesAtRisk(project.id, now),
      this.loadSprintSignals(project.id, now),
      this.loadCycleTime(project.id, now),
    ]);

    const blockedIssueKeys = openIssues
      .filter((i) => i.status === 'BLOCKED' || blockedByDependency.has(i.id))
      .map((i) => i.issueKey);

    return {
      now,
      openIssues,
      blockedIssueKeys,
      milestones: milestones.map((m) => ({ name: m.name, health: m.health })),
      releasesAtRisk,
      activeSprintCount: sprintSignals.activeCount,
      sprintsBehind: sprintSignals.behind,
      cycleTime,
    };
  }

  /** Open issues with at least one unresolved, non-archived blocker. */
  private async loadDependencyBlocked(openIds: string[]): Promise<Set<string>> {
    if (openIds.length === 0) return new Set();
    const rows = await this.db
      .selectDistinct({ targetId: issueDependencies.targetIssueId })
      .from(issueDependencies)
      .innerJoin(issues, eq(issues.id, issueDependencies.sourceIssueId))
      .where(
        and(
          eq(issueDependencies.relationType, 'BLOCKS'),
          inArray(issueDependencies.targetIssueId, openIds),
          eq(issues.isArchived, false),
          notInArray(issues.status, RESOLVED_STATUSES),
        ),
      );
    return new Set(rows.map((r) => r.targetId));
  }

  /** Unreleased versions due soon (or overdue) whose readiness verdict is NOT_READY. */
  private async loadReleasesAtRisk(projectId: string, now: Date) {
    const horizon = new Date(now.getTime() + HEALTH_THRESHOLDS.releaseHorizonDays * DAY_MS);
    const due = await this.db
      .select()
      .from(releases)
      .where(
        and(
          eq(releases.projectId, projectId),
          ne(releases.status, 'RELEASED'),
          isNotNull(releases.targetDate),
          lte(releases.targetDate, horizon),
        ),
      );

    const atRisk: HealthInputs['releasesAtRisk'] = [];
    for (const release of due) {
      const report = await this.readiness.evaluate(release);
      if (report.verdict !== 'NOT_READY') continue;
      const daysLeft = Math.ceil(((release.targetDate as Date).getTime() - now.getTime()) / DAY_MS);
      atRisk.push({
        version: release.version,
        critical: daysLeft <= HEALTH_THRESHOLDS.releaseCriticalDays,
        detail: `${report.criticalFailureCount} critical readiness failure(s), ${
          daysLeft < 0 ? `${-daysLeft}d past target` : `${daysLeft}d to target`
        }`,
      });
    }
    return atRisk;
  }

  /** Active sprints and which of them trail their timeline. */
  private async loadSprintSignals(projectId: string, now: Date) {
    const active = await this.db
      .select()
      .from(sprints)
      .where(and(eq(sprints.projectId, projectId), eq(sprints.status, 'ACTIVE')));
    if (active.length === 0) return { activeCount: 0, behind: [] };

    const progress = await this.sprintsService.loadProgress(active.map((s) => s.id));
    const behind: HealthInputs['sprintsBehind'] = [];
    for (const sprint of active) {
      const start = sprint.startedAt ?? sprint.startDate;
      const end = sprint.endDate;
      const tally = progress.get(sprint.id);
      if (!start || !end || !tally || tally.totalPoints === 0 || end.getTime() <= start.getTime()) continue;

      const elapsed = Math.min(1, Math.max(0, (now.getTime() - start.getTime()) / (end.getTime() - start.getTime())));
      const done = tally.donePoints / tally.totalPoints;
      if (elapsed >= 0.5 && done < elapsed - HEALTH_THRESHOLDS.sprintBehindMargin) {
        behind.push({
          name: sprint.name,
          detail: `${Math.round(done * 100)}% of points done with ${Math.round(elapsed * 100)}% of the time elapsed`,
        });
      }
    }
    return { activeCount: active.length, behind };
  }

  private async loadCycleTime(projectId: string, now: Date) {
    const since = new Date(now.getTime() - CYCLE_TIME_WINDOW_DAYS * DAY_MS);
    const [row] = await this.db
      .select({
        resolvedCount: sql<number>`count(*)::int`,
        medianDays: sql<number | null>`percentile_cont(0.5) within group (order by extract(epoch from (${issues.resolvedAt} - ${issues.createdAt})) / 86400)`,
      })
      .from(issues)
      .where(
        and(
          eq(issues.projectId, projectId),
          eq(issues.isArchived, false),
          ne(issues.type, 'SUBTASK'),
          eq(issues.status, 'DONE'),
          gte(issues.resolvedAt, since),
        ),
      );

    const resolvedCount = row?.resolvedCount ?? 0;
    const median = row?.medianDays === null || row?.medianDays === undefined ? null : Number(row.medianDays);
    return {
      resolvedCount,
      medianDays: resolvedCount >= HEALTH_THRESHOLDS.minCycleTimeSamples && median !== null ? Math.round(median * 10) / 10 : null,
    };
  }

  private async loadTrend(projectId: string): Promise<ProjectHealthTrendPoint[]> {
    const since = utcDay(new Date(Date.now() - (TREND_DAYS - 1) * DAY_MS));
    const rows = await this.db
      .select({
        date: projectHealthSnapshots.snapshotDate,
        score: projectHealthSnapshots.score,
        status: projectHealthSnapshots.status,
      })
      .from(projectHealthSnapshots)
      .where(and(eq(projectHealthSnapshots.projectId, projectId), gte(projectHealthSnapshots.snapshotDate, since)))
      .orderBy(asc(projectHealthSnapshots.snapshotDate));
    return rows;
  }
}

/** UTC calendar day (YYYY-MM-DD); snapshots are keyed by it. */
function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}
