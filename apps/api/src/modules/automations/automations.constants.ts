export const AUTOMATIONS_QUEUE = 'automations';

export const AutomationJobs = {
  IssueCreated: 'issue-created',
  Scheduled: 'scheduled',
} as const;

export interface IssueCreatedJobData {
  issueId: string;
  projectId: string;
  actorId: string;
}

export interface ScheduledJobData {
  automationId: string;
}

/** BullMQ job scheduler id for a scheduled automation; one scheduler per automation. */
export const SCHEDULER_PREFIX = 'automation:';
export const schedulerId = (automationId: string) => `${SCHEDULER_PREFIX}${automationId}`;

/** Upper bound on issues a scheduled run evaluates, so one rule cannot flood the notification queue. */
export const SCHEDULED_MATCH_LIMIT = 500;

/** Issue keys listed in a digest notification body before "+N more". */
export const DIGEST_KEY_PREVIEW = 8;

export const DEFAULT_RUN_HISTORY = 20;
