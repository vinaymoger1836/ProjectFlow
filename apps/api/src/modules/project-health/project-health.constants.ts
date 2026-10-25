export const PROJECT_HEALTH_QUEUE = 'project-health';

export const HealthJobs = {
  Recompute: 'recompute',
  Sweep: 'sweep',
} as const;

export interface RecomputeHealthJobData {
  projectId: string;
}

/**
 * Changes within this window collapse into one recompute (BullMQ deduplication + delay),
 * so a bulk edit of 50 issues evaluates health once.
 */
export const HEALTH_RECOMPUTE_DEBOUNCE_MS = 15_000;

/** Daily sweep (UTC) so every project gets a snapshot even on days without changes. */
export const HEALTH_SWEEP_SCHEDULER_ID = 'daily-health-sweep';
export const HEALTH_SWEEP_CRON = '15 2 * * *';
