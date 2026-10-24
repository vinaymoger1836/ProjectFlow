import { MilestoneHealth, SprintVelocity, WorkProgress } from '@projectflow/types';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Sprint length assumed for velocity-per-day when completed sprints carry no dates. */
const FALLBACK_SPRINT_LENGTH_DAYS = 14;
/** Effort assumed for each open, unestimated issue when forecasting. */
export const ASSUMED_POINTS_PER_UNESTIMATED_ISSUE = 3;
/** Without velocity history, a milestone this close to its target and below the bar is at risk. */
const NO_HISTORY_WARNING_DAYS = 7;
const NO_HISTORY_MIN_COMPLETION = 75;

export interface MilestoneHealthAssessment {
  health: MilestoneHealth;
  healthReason: string;
  projectedCompletionDate: Date | null;
  slipDays: number | null;
}

/**
 * Deterministic slip detection: forecast the finish date from remaining points and the
 * team's recent velocity, then compare it with the target date.
 */
export function assessMilestoneHealth(
  targetDate: Date | null,
  progress: WorkProgress,
  velocity: SprintVelocity,
  now = new Date(),
): MilestoneHealthAssessment {
  const openCount = progress.issueCount - progress.doneIssueCount;

  if (progress.issueCount > 0 && openCount === 0) {
    return { health: 'COMPLETED', healthReason: `All ${progress.issueCount} issues are done.`, projectedCompletionDate: null, slipDays: null };
  }

  const remainingPoints =
    progress.totalPoints - progress.donePoints + progress.unestimatedCount * ASSUMED_POINTS_PER_UNESTIMATED_ISSUE;
  const assumedNote =
    progress.unestimatedCount > 0
      ? ` (assumes ${ASSUMED_POINTS_PER_UNESTIMATED_ISSUE} pts for ${progress.unestimatedCount} unestimated issue${progress.unestimatedCount === 1 ? '' : 's'})`
      : '';

  const sprintLength = velocity.averageSprintLengthDays ?? FALLBACK_SPRINT_LENGTH_DAYS;
  const pointsPerDay = velocity.averageVelocity && velocity.averageVelocity > 0 ? velocity.averageVelocity / sprintLength : null;
  const projectedCompletionDate =
    pointsPerDay && progress.issueCount > 0 ? new Date(now.getTime() + Math.ceil(remainingPoints / pointsPerDay) * DAY_MS) : null;

  if (progress.issueCount === 0) {
    if (targetDate && targetDate.getTime() < now.getTime()) {
      return { health: 'OVERDUE', healthReason: 'Target date passed and no issues are assigned.', projectedCompletionDate: null, slipDays: daysBetween(targetDate, now) };
    }
    return {
      health: targetDate ? 'ON_TRACK' : 'NO_TARGET',
      healthReason: 'No issues assigned yet.',
      projectedCompletionDate: null,
      slipDays: null,
    };
  }

  if (!targetDate) {
    return {
      health: 'NO_TARGET',
      healthReason: `No target date. ${progress.completionPercentage}% done, ${remainingPoints} pts remaining${assumedNote}.`,
      projectedCompletionDate,
      slipDays: null,
    };
  }

  const daysLeft = (targetDate.getTime() - now.getTime()) / DAY_MS;
  if (daysLeft < 0) {
    return {
      health: 'OVERDUE',
      healthReason: `Target date passed ${Math.ceil(-daysLeft)} day(s) ago with ${openCount} open issue${openCount === 1 ? '' : 's'}.`,
      projectedCompletionDate,
      slipDays: projectedCompletionDate ? daysBetween(targetDate, projectedCompletionDate) : Math.ceil(-daysLeft),
    };
  }

  if (projectedCompletionDate) {
    const slip = daysBetween(targetDate, projectedCompletionDate);
    if (slip > 0) {
      return {
        health: 'AT_RISK',
        healthReason: `At ${velocity.averageVelocity} pts per sprint, the remaining ${remainingPoints} pts${assumedNote} finish about ${slip} day(s) after the target.`,
        projectedCompletionDate,
        slipDays: slip,
      };
    }
    return {
      health: 'ON_TRACK',
      healthReason: `Forecast finishes ${Math.abs(slip)} day(s) before the target at ${velocity.averageVelocity} pts per sprint.`,
      projectedCompletionDate,
      slipDays: slip,
    };
  }

  if (daysLeft <= NO_HISTORY_WARNING_DAYS && progress.completionPercentage < NO_HISTORY_MIN_COMPLETION) {
    return {
      health: 'AT_RISK',
      healthReason: `${Math.ceil(daysLeft)} day(s) left with ${progress.completionPercentage}% done. No velocity history yet to forecast.`,
      projectedCompletionDate: null,
      slipDays: null,
    };
  }

  return {
    health: 'ON_TRACK',
    healthReason: `${Math.ceil(daysLeft)} day(s) left, ${progress.completionPercentage}% done. Forecasts appear after the first completed sprint.`,
    projectedCompletionDate: null,
    slipDays: null,
  };
}

/** Whole days from `a` to `b` (positive when `b` is later). */
function daysBetween(a: Date, b: Date): number {
  return Math.ceil((b.getTime() - a.getTime()) / DAY_MS);
}
