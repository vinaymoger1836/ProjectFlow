import type {
  AutomationAction,
  AutomationCondition,
  AutomationRecipient,
  AutomationSetOperator,
  AutomationTrigger,
  IssuePriority,
  IssueType,
  ScheduleTrigger,
  StandardIssueStatus,
} from '@projectflow/types';
import { UUID_REGEX } from '../../common/validators/is-entity-id.decorator';

/**
 * Validation of automation definitions (trigger, conditions, actions). The stored JSON is always
 * rebuilt from these parsers, so unknown keys never reach the database. Pure: no I/O.
 */

export const ISSUE_TYPES: readonly IssueType[] = ['TASK', 'BUG', 'STORY', 'EPIC', 'SUBTASK'];
export const ISSUE_PRIORITIES: readonly IssuePriority[] = ['P0', 'P1', 'P2', 'P3', 'P4'];
export const ISSUE_STATUSES: readonly StandardIssueStatus[] = [
  'BACKLOG',
  'TODO',
  'IN_PROGRESS',
  'IN_REVIEW',
  'BLOCKED',
  'DONE',
  'CANCELLED',
];
const RECIPIENTS: readonly AutomationRecipient[] = ['ASSIGNEE', 'REPORTER'];
const SET_OPERATORS: readonly AutomationSetOperator[] = ['IN', 'NOT_IN'];

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MAX_ASSIGNEES = 50;
export const MAX_MESSAGE_LENGTH = 500;

export interface AutomationDefinition {
  trigger: AutomationTrigger;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
}

/** Carries every problem found, so the client can show them together. */
export class AutomationDefinitionError extends Error {
  constructor(readonly problems: string[]) {
    super(problems.join(' '));
    this.name = 'AutomationDefinitionError';
  }
}

export function parseAutomationDefinition(input: {
  trigger: unknown;
  conditions: unknown;
  actions: unknown;
}): AutomationDefinition {
  const problems: string[] = [];
  const trigger = parseTrigger(input.trigger, problems);
  const conditions = parseConditions(input.conditions, problems);
  const actions = parseActions(input.actions, problems);

  if (problems.length > 0 || !trigger) throw new AutomationDefinitionError(problems);
  return { trigger, conditions, actions };
}

export function parseTrigger(value: unknown, problems: string[]): AutomationTrigger | null {
  if (!isRecord(value)) {
    problems.push('trigger must be an object.');
    return null;
  }
  if (value.type === 'ISSUE_CREATED') return { type: 'ISSUE_CREATED' };
  if (value.type !== 'SCHEDULE') {
    problems.push('trigger.type must be ISSUE_CREATED or SCHEDULE.');
    return null;
  }

  const before = problems.length;
  const frequency = value.frequency;
  if (frequency !== 'DAILY' && frequency !== 'WEEKLY') problems.push('trigger.frequency must be DAILY or WEEKLY.');
  if (typeof value.time !== 'string' || !TIME_PATTERN.test(value.time)) {
    problems.push('trigger.time must be a 24-hour "HH:MM" time.');
  }
  if (typeof value.timezone !== 'string' || !isValidTimeZone(value.timezone)) {
    problems.push('trigger.timezone must be an IANA timezone such as "Asia/Kolkata" or "UTC".');
  }

  let weekdays: number[] = [];
  if (frequency === 'WEEKLY') {
    const raw = value.weekdays;
    if (!Array.isArray(raw) || raw.length === 0 || !raw.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) {
      problems.push('trigger.weekdays must list at least one day (0 = Sunday … 6 = Saturday) for a weekly schedule.');
    } else {
      weekdays = [...new Set(raw as number[])].sort((a, b) => a - b);
    }
  }

  if (problems.length > before) return null;
  return {
    type: 'SCHEDULE',
    frequency: frequency as ScheduleTrigger['frequency'],
    time: value.time as string,
    weekdays,
    timezone: value.timezone as string,
  };
}

export function parseConditions(value: unknown, problems: string[]): AutomationCondition[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    problems.push('conditions must be an array.');
    return [];
  }

  const seen = new Set<string>();
  const result: AutomationCondition[] = [];
  value.forEach((raw, index) => {
    const at = `conditions[${index}]`;
    if (!isRecord(raw)) {
      problems.push(`${at} must be an object.`);
      return;
    }
    const field = raw.field;
    if (typeof field === 'string' && seen.has(field)) {
      problems.push(`${at}: only one condition per field (${field}).`);
      return;
    }
    if (typeof field === 'string') seen.add(field);

    switch (field) {
      case 'type': {
        const set = parseSetCondition(raw, ISSUE_TYPES, at, problems);
        if (set) result.push({ field, ...set });
        return;
      }
      case 'priority': {
        const set = parseSetCondition(raw, ISSUE_PRIORITIES, at, problems);
        if (set) result.push({ field, ...set });
        return;
      }
      case 'status': {
        const set = parseSetCondition(raw, ISSUE_STATUSES, at, problems);
        if (set) result.push({ field, ...set });
        return;
      }
      case 'assignee': {
        if (raw.operator === 'UNASSIGNED') {
          result.push({ field, operator: 'UNASSIGNED', values: [] });
          return;
        }
        if (raw.operator !== 'IN') {
          problems.push(`${at}.operator must be IN or UNASSIGNED for assignee.`);
          return;
        }
        const ids = raw.values;
        if (
          !Array.isArray(ids) ||
          ids.length === 0 ||
          ids.length > MAX_ASSIGNEES ||
          !ids.every((id) => typeof id === 'string' && UUID_REGEX.test(id))
        ) {
          problems.push(`${at}.values must list 1–${MAX_ASSIGNEES} member IDs.`);
          return;
        }
        result.push({ field, operator: 'IN', values: [...new Set(ids as string[])] });
        return;
      }
      default:
        problems.push(`${at}.field must be one of type, priority, status, assignee.`);
    }
  });
  return result;
}

export function parseActions(value: unknown, problems: string[]): AutomationAction[] {
  if (!Array.isArray(value) || value.length === 0) {
    problems.push('actions must contain at least one action.');
    return [];
  }

  const seen = new Set<string>();
  const result: AutomationAction[] = [];
  value.forEach((raw, index) => {
    const at = `actions[${index}]`;
    if (!isRecord(raw) || raw.type !== 'NOTIFY') {
      problems.push(`${at}.type must be NOTIFY.`);
      return;
    }
    if (seen.has(raw.type)) {
      problems.push(`${at}: each action type can be used once.`);
      return;
    }
    seen.add(raw.type);

    const recipients = raw.recipients;
    if (
      !Array.isArray(recipients) ||
      recipients.length === 0 ||
      !recipients.every((r) => RECIPIENTS.includes(r as AutomationRecipient))
    ) {
      problems.push(`${at}.recipients must include ASSIGNEE and/or REPORTER.`);
      return;
    }

    let message: string | null = null;
    if (raw.message !== undefined && raw.message !== null) {
      if (typeof raw.message !== 'string' || raw.message.trim().length > MAX_MESSAGE_LENGTH) {
        problems.push(`${at}.message must be text of at most ${MAX_MESSAGE_LENGTH} characters.`);
        return;
      }
      message = raw.message.trim() || null;
    }

    result.push({ type: 'NOTIFY', recipients: [...new Set(recipients as AutomationRecipient[])], message });
  });
  return result;
}

/** Cron pattern (minute hour day month weekday) for BullMQ's job scheduler; evaluated in `trigger.timezone`. */
export function scheduleToCron(trigger: ScheduleTrigger): string {
  const [hours, minutes] = trigger.time.split(':').map(Number);
  const days = trigger.frequency === 'WEEKLY' ? trigger.weekdays.join(',') : '*';
  return `${minutes} ${hours} * * ${days}`;
}

/** Member IDs referenced by conditions; the service checks they belong to the organization. */
export function referencedUserIds(conditions: AutomationCondition[]): string[] {
  return conditions.flatMap((c) => (c.field === 'assignee' && c.operator === 'IN' ? c.values : []));
}

function parseSetCondition<T extends string>(
  raw: Record<string, unknown>,
  allowed: readonly T[],
  at: string,
  problems: string[],
): { operator: AutomationSetOperator; values: T[] } | null {
  const operator = raw.operator as AutomationSetOperator;
  if (!SET_OPERATORS.includes(operator)) {
    problems.push(`${at}.operator must be IN or NOT_IN.`);
    return null;
  }
  const values = raw.values;
  if (!Array.isArray(values) || values.length === 0 || !values.every((v) => allowed.includes(v as T))) {
    problems.push(`${at}.values must list one or more of ${allowed.join(', ')}.`);
    return null;
  }
  return { operator, values: [...new Set(values as T[])] };
}

function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
