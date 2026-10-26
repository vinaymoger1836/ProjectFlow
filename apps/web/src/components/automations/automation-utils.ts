import type {
  AiIssueCategory,
  AutomationCondition,
  AutomationRecipient,
  AutomationRunStatus,
  AutomationTrigger,
  IssuePriority,
  IssueType,
  StandardIssueStatus,
} from '@projectflow/types';

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export const TYPE_OPTIONS: { value: IssueType; label: string }[] = [
  { value: 'BUG', label: 'Bug' },
  { value: 'TASK', label: 'Task' },
  { value: 'STORY', label: 'Story' },
  { value: 'EPIC', label: 'Epic' },
  { value: 'SUBTASK', label: 'Subtask' },
];

export const PRIORITY_OPTIONS: { value: IssuePriority; label: string }[] = (['P0', 'P1', 'P2', 'P3', 'P4'] as const).map((p) => ({
  value: p,
  label: p,
}));

export const STATUS_OPTIONS: { value: StandardIssueStatus; label: string }[] = [
  { value: 'BACKLOG', label: 'Backlog' },
  { value: 'TODO', label: 'To Do' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'IN_REVIEW', label: 'In Review' },
  { value: 'BLOCKED', label: 'Blocked' },
  { value: 'DONE', label: 'Done' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export const AI_CATEGORY_OPTIONS: { value: AiIssueCategory; label: string; hint: string }[] = [
  { value: 'URGENT', label: 'Urgent', hint: 'Outages, production down, data loss, explicit urgency' },
  { value: 'SECURITY', label: 'Security', hint: 'Vulnerabilities, leaks, auth or permission flaws' },
  { value: 'CUSTOMER_IMPACT', label: 'Customer impact', hint: 'Failed payments, broken checkout, complaints' },
  { value: 'NEGATIVE_SENTIMENT', label: 'Negative sentiment', hint: 'Frustrated or angry reporter or customer' },
];

export const RECIPIENT_LABELS: Record<AutomationRecipient, string> = {
  ASSIGNEE: 'assignee',
  REPORTER: 'reporter',
};

export const RUN_STATUS_META: Record<AutomationRunStatus, { label: string; className: string }> = {
  SUCCESS: { label: 'Success', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  FAILED: { label: 'Failed', className: 'bg-red-500/10 text-red-400 border-red-500/30' },
  RUNNING: { label: 'Running', className: 'bg-sky-500/10 text-sky-400 border-sky-500/30' },
};

const FIELD_LABELS: Record<AutomationCondition['field'], string> = {
  type: 'Type',
  priority: 'Priority',
  status: 'Status',
  assignee: 'Assignee',
  ai: 'AI detects',
};

const OPTION_LABELS = new Map<string, string>([...TYPE_OPTIONS, ...STATUS_OPTIONS, ...AI_CATEGORY_OPTIONS].map((o) => [o.value, o.label]));

export function describeTrigger(trigger: AutomationTrigger): string {
  if (trigger.type === 'ISSUE_CREATED') return 'When an issue is created';
  const days =
    trigger.frequency === 'DAILY'
      ? 'Every day'
      : trigger.weekdays.length === 7
        ? 'Every day'
        : `Every ${trigger.weekdays.map((d) => WEEKDAY_LABELS[d]).join(', ')}`;
  return `${days} at ${trigger.time} (${trigger.timezone})`;
}

export function describeCondition(condition: AutomationCondition, memberName: (id: string) => string): string {
  const field = FIELD_LABELS[condition.field];
  if (condition.field === 'ai') {
    return `${field} ${condition.values.map((v) => OPTION_LABELS.get(v) ?? v).join(' or ')}`;
  }
  if (condition.field === 'assignee') {
    return condition.operator === 'UNASSIGNED'
      ? 'Unassigned'
      : `${field} is ${condition.values.map(memberName).join(' or ')}`;
  }
  const values = condition.values.map((v: string) => OPTION_LABELS.get(v) ?? v).join(' or ');
  return `${field} ${condition.operator === 'IN' ? 'is' : 'is not'} ${values}`;
}

export function describeRecipients(recipients: AutomationRecipient[]): string {
  return `Notify ${recipients.map((r) => RECIPIENT_LABELS[r]).join(' and ')}`;
}

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Every IANA zone the browser knows, with the current one and UTC guaranteed to be present. */
export function timeZoneOptions(current: string): string[] {
  let zones: string[] = [];
  try {
    zones = Intl.supportedValuesOf('timeZone');
  } catch {
    zones = [];
  }
  return [...new Set(['UTC', current, ...zones])];
}
