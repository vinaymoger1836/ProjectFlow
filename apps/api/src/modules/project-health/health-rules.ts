import {
  HealthFactor,
  IssuePriority,
  IssueType,
  MilestoneHealth,
  ProjectHealthMetrics,
  ProjectHealthStatus,
} from '@projectflow/types';

/**
 * Fixed health thresholds (ADR-022). Per-project tuning via project_settings is deferred.
 * The score starts at 100; each rule subtracts a capped penalty.
 */
export const HEALTH_THRESHOLDS = {
  /** Status cut-offs on the 0–100 score. */
  criticalBelow: 50,
  atRiskBelow: 85,
  /** Days an open bug may age before it counts as overdue for its priority. */
  bugSlaDays: { P0: 2, P1: 7, P2: 30, P3: 60, P4: 90 } satisfies Record<IssuePriority, number>,
  /** Share of open work that is blocked before blocking becomes critical. */
  criticalBlockedRatio: 0.3,
  /** Releases are checked when they are due within this many days (or overdue). */
  releaseHorizonDays: 14,
  releaseCriticalDays: 7,
  /** A sprint is behind when, past half-time, done points trail elapsed time by this margin. */
  sprintBehindMargin: 0.25,
  slowCycleTimeDays: 14,
  minCycleTimeSamples: 3,
} as const;

const PENALTY = {
  p0Bug: 20,
  p1Bug: 6,
  criticalBugsCap: 40,
  agingBug: 4,
  agingBugsCap: 16,
  blockedIssue: 4,
  blockedCap: 16,
  criticalBlocked: 25,
  overdueIssue: 3,
  overdueCap: 15,
  overdueMilestone: 15,
  atRiskMilestone: 8,
  milestonesCap: 30,
  criticalRelease: 20,
  atRiskRelease: 8,
  releasesCap: 30,
  sprintBehind: 8,
  sprintsCap: 16,
  slowCycleTime: 4,
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_KEYS = 20;

export interface OpenIssueInput {
  issueKey: string;
  type: IssueType;
  priority: IssuePriority;
  status: string;
  createdAt: Date;
  dueDate: Date | null;
}

export interface HealthInputs {
  now: Date;
  openIssues: OpenIssueInput[];
  /** Open issues with status BLOCKED or an unresolved blocker. */
  blockedIssueKeys: string[];
  milestones: { name: string; health: MilestoneHealth }[];
  releasesAtRisk: { version: string; critical: boolean; detail: string }[];
  activeSprintCount: number;
  sprintsBehind: { name: string; detail: string }[];
  cycleTime: { medianDays: number | null; resolvedCount: number };
}

export interface HealthEvaluation {
  status: ProjectHealthStatus;
  score: number;
  factors: HealthFactor[];
  metrics: ProjectHealthMetrics;
}

export function scoreProjectHealth(input: HealthInputs): HealthEvaluation {
  const factors: HealthFactor[] = [];
  const open = input.openIssues;

  // Critical bugs
  const openBugs = open.filter((i) => i.type === 'BUG');
  const p0 = openBugs.filter((i) => i.priority === 'P0');
  const p1 = openBugs.filter((i) => i.priority === 'P1');
  if (p0.length + p1.length > 0) {
    factors.push({
      id: 'CRITICAL_BUGS',
      label: 'Open P0/P1 bugs',
      severity: p0.length > 0 ? 'critical' : 'warning',
      penalty: Math.min(PENALTY.criticalBugsCap, p0.length * PENALTY.p0Bug + p1.length * PENALTY.p1Bug),
      detail: [p0.length ? `${p0.length} P0` : '', p1.length ? `${p1.length} P1` : ''].filter(Boolean).join(' and ') + ' bug(s) open.',
      issueKeys: keys([...p0, ...p1]),
    });
  }

  // Bug aging against per-priority SLAs
  const aging = openBugs.filter((i) => ageDays(i.createdAt, input.now) > HEALTH_THRESHOLDS.bugSlaDays[i.priority]);
  if (aging.length > 0) {
    factors.push({
      id: 'AGING_BUGS',
      label: 'Bugs past their age limit',
      severity: 'warning',
      penalty: Math.min(PENALTY.agingBugsCap, aging.length * PENALTY.agingBug),
      detail: `${aging.length} bug(s) open longer than their priority allows (P0 ${HEALTH_THRESHOLDS.bugSlaDays.P0}d, P1 ${HEALTH_THRESHOLDS.bugSlaDays.P1}d, P2 ${HEALTH_THRESHOLDS.bugSlaDays.P2}d).`,
      issueKeys: keys(aging),
    });
  }

  // Blocked work
  const blockedRatio = open.length > 0 ? input.blockedIssueKeys.length / open.length : 0;
  if (input.blockedIssueKeys.length > 0) {
    const critical = blockedRatio >= HEALTH_THRESHOLDS.criticalBlockedRatio;
    factors.push({
      id: 'BLOCKED_WORK',
      label: 'Blocked work',
      severity: critical ? 'critical' : 'warning',
      penalty: critical
        ? PENALTY.criticalBlocked
        : Math.min(PENALTY.blockedCap, input.blockedIssueKeys.length * PENALTY.blockedIssue),
      detail: `${input.blockedIssueKeys.length} of ${open.length} open issue(s) blocked (${Math.round(blockedRatio * 100)}%).`,
      issueKeys: input.blockedIssueKeys.slice(0, MAX_KEYS),
    });
  }

  // Overdue issues
  const overdue = open.filter((i) => i.dueDate && i.dueDate.getTime() < input.now.getTime());
  if (overdue.length > 0) {
    factors.push({
      id: 'OVERDUE_ISSUES',
      label: 'Overdue issues',
      severity: 'warning',
      penalty: Math.min(PENALTY.overdueCap, overdue.length * PENALTY.overdueIssue),
      detail: `${overdue.length} open issue(s) are past their due date.`,
      issueKeys: keys(overdue),
    });
  }

  // Milestone slip
  const overdueMilestones = input.milestones.filter((m) => m.health === 'OVERDUE');
  const atRiskMilestones = input.milestones.filter((m) => m.health === 'AT_RISK');
  if (overdueMilestones.length + atRiskMilestones.length > 0) {
    factors.push({
      id: 'MILESTONE_SLIP',
      label: 'Milestones slipping',
      severity: overdueMilestones.length > 0 ? 'critical' : 'warning',
      penalty: Math.min(
        PENALTY.milestonesCap,
        overdueMilestones.length * PENALTY.overdueMilestone + atRiskMilestones.length * PENALTY.atRiskMilestone,
      ),
      detail: [
        ...overdueMilestones.map((m) => `${m.name} is overdue`),
        ...atRiskMilestones.map((m) => `${m.name} is at risk`),
      ].join('; ') + '.',
      issueKeys: [],
    });
  }

  // Release readiness near the target date
  if (input.releasesAtRisk.length > 0) {
    const critical = input.releasesAtRisk.filter((r) => r.critical);
    factors.push({
      id: 'RELEASE_RISK',
      label: 'Releases not ready near target',
      severity: critical.length > 0 ? 'critical' : 'warning',
      penalty: Math.min(
        PENALTY.releasesCap,
        critical.length * PENALTY.criticalRelease + (input.releasesAtRisk.length - critical.length) * PENALTY.atRiskRelease,
      ),
      detail: input.releasesAtRisk.map((r) => `${r.version}: ${r.detail}`).join('; '),
      issueKeys: [],
    });
  }

  // Sprints running behind
  if (input.sprintsBehind.length > 0) {
    factors.push({
      id: 'SPRINT_BEHIND',
      label: 'Sprints behind schedule',
      severity: 'warning',
      penalty: Math.min(PENALTY.sprintsCap, input.sprintsBehind.length * PENALTY.sprintBehind),
      detail: input.sprintsBehind.map((s) => `${s.name}: ${s.detail}`).join('; '),
      issueKeys: [],
    });
  }

  // Cycle time (informational)
  const { medianDays, resolvedCount } = input.cycleTime;
  if (
    medianDays !== null &&
    resolvedCount >= HEALTH_THRESHOLDS.minCycleTimeSamples &&
    medianDays > HEALTH_THRESHOLDS.slowCycleTimeDays
  ) {
    factors.push({
      id: 'CYCLE_TIME',
      label: 'Slow cycle time',
      severity: 'info',
      penalty: PENALTY.slowCycleTime,
      detail: `Median ${medianDays} days from creation to done over the last 30 days (limit ${HEALTH_THRESHOLDS.slowCycleTimeDays}).`,
      issueKeys: [],
    });
  }

  const score = Math.max(0, 100 - factors.reduce((sum, f) => sum + f.penalty, 0));
  const status: ProjectHealthStatus =
    factors.some((f) => f.severity === 'critical') || score < HEALTH_THRESHOLDS.criticalBelow
      ? 'CRITICAL'
      : score < HEALTH_THRESHOLDS.atRiskBelow
        ? 'AT_RISK'
        : 'HEALTHY';

  const severityRank = { critical: 0, warning: 1, info: 2 } as const;
  factors.sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || b.penalty - a.penalty);

  return {
    status,
    score,
    factors,
    metrics: {
      openIssueCount: open.length,
      openCriticalBugCount: p0.length + p1.length,
      agingBugCount: aging.length,
      blockedCount: input.blockedIssueKeys.length,
      overdueIssueCount: overdue.length,
      atRiskMilestoneCount: atRiskMilestones.length,
      overdueMilestoneCount: overdueMilestones.length,
      releasesAtRiskCount: input.releasesAtRisk.length,
      activeSprintCount: input.activeSprintCount,
      sprintsBehindCount: input.sprintsBehind.length,
      resolvedLast30Days: resolvedCount,
      medianCycleTimeDays: medianDays,
    },
  };
}

function ageDays(createdAt: Date, now: Date): number {
  return (now.getTime() - createdAt.getTime()) / DAY_MS;
}

function keys(list: { issueKey: string }[]): string[] {
  return list.slice(0, MAX_KEYS).map((i) => i.issueKey);
}
