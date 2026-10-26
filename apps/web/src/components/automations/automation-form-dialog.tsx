'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Zap, Plus, X, CalendarClock, FilePlus2, Bell, Sparkles, Loader2, AlertTriangle } from 'lucide-react';
import type {
  AutomationCondition,
  AutomationConditionField,
  AutomationRecipient,
  AutomationTrigger,
} from '@projectflow/types';
import { api, AutomationDraft, AutomationInput, AutomationSummary } from '@/lib/api';
import {
  DialogShell,
  ErrorNote,
  PrimaryButton,
  CancelButton,
  inputClass,
  labelClass,
} from '../common/dialog-primitives';
import {
  WEEKDAY_LABELS,
  TYPE_OPTIONS,
  PRIORITY_OPTIONS,
  STATUS_OPTIONS,
  AI_CATEGORY_OPTIONS,
  browserTimeZone,
  timeZoneOptions,
} from './automation-utils';
import { cn } from '@/lib/utils';

type DraftOperator = 'IN' | 'NOT_IN' | 'UNASSIGNED' | 'ANY_OF';

interface DraftCondition {
  field: AutomationConditionField;
  operator: DraftOperator;
  values: string[];
}

interface ScheduleDraft {
  frequency: 'DAILY' | 'WEEKLY';
  time: string;
  weekdays: number[];
  timezone: string;
}

const FIELD_ORDER: { field: AutomationConditionField; label: string }[] = [
  { field: 'type', label: 'Type' },
  { field: 'priority', label: 'Priority' },
  { field: 'status', label: 'Status' },
  { field: 'assignee', label: 'Assignee' },
  { field: 'ai', label: 'AI detects' },
];

const MESSAGE_LIMIT = 500;
const OPEN_WORK: DraftCondition = { field: 'status', operator: 'NOT_IN', values: ['DONE', 'CANCELLED'] };

function defaultSchedule(): ScheduleDraft {
  return { frequency: 'WEEKLY', time: '09:00', weekdays: [1], timezone: browserTimeZone() };
}

function toDraftConditions(conditions: AutomationCondition[]): DraftCondition[] {
  return conditions.map((c) => ({ field: c.field, operator: c.operator, values: [...c.values] }));
}

function toCondition(draft: DraftCondition): AutomationCondition | null {
  switch (draft.field) {
    case 'assignee':
      if (draft.operator === 'UNASSIGNED') return { field: 'assignee', operator: 'UNASSIGNED', values: [] };
      return draft.values.length > 0 ? { field: 'assignee', operator: 'IN', values: draft.values } : null;
    case 'ai':
      return draft.values.length > 0 ? ({ field: 'ai', operator: 'ANY_OF', values: draft.values } as AutomationCondition) : null;
    case 'type':
    case 'priority':
    case 'status': {
      if ((draft.operator !== 'IN' && draft.operator !== 'NOT_IN') || draft.values.length === 0) return null;
      return { field: draft.field, operator: draft.operator, values: draft.values } as AutomationCondition;
    }
  }
}

export function AutomationFormDialog({
  projectId,
  open,
  automation,
  onOpenChange,
}: {
  projectId: string;
  open: boolean;
  automation: AutomationSummary | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState<AutomationTrigger['type']>('ISSUE_CREATED');
  const [schedule, setSchedule] = useState<ScheduleDraft>(defaultSchedule);
  const [conditions, setConditions] = useState<DraftCondition[]>([]);
  const [recipients, setRecipients] = useState<AutomationRecipient[]>(['ASSIGNEE']);
  const [message, setMessage] = useState('');
  const [describe, setDescribe] = useState('');
  const [drafted, setDrafted] = useState<Pick<AutomationDraft, 'warnings' | 'modelUsed'> | null>(null);

  const { data: members = [] } = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => api.listProjectMembers(projectId),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    const trigger = automation?.trigger;
    const notify = automation?.actions.find((a) => a.type === 'NOTIFY');
    setName(automation?.name ?? '');
    setDescription(automation?.description ?? '');
    setTriggerType(trigger?.type ?? 'ISSUE_CREATED');
    setSchedule(
      trigger?.type === 'SCHEDULE'
        ? { frequency: trigger.frequency, time: trigger.time, weekdays: trigger.weekdays, timezone: trigger.timezone }
        : defaultSchedule(),
    );
    setConditions(automation ? toDraftConditions(automation.conditions) : []);
    setRecipients(notify?.recipients ?? ['ASSIGNEE']);
    setMessage(notify?.message ?? '');
    setDescribe('');
    setDrafted(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, automation?.id]);

  const zones = useMemo(() => timeZoneOptions(schedule.timezone), [schedule.timezone]);
  const builtConditions = conditions.map(toCondition);
  const incompleteCondition = builtConditions.some((c) => c === null);
  const scheduleInvalid = triggerType === 'SCHEDULE' && schedule.frequency === 'WEEKLY' && schedule.weekdays.length === 0;
  const aiOnSchedule = triggerType === 'SCHEDULE' && conditions.some((c) => c.field === 'ai');
  const canSave =
    name.trim().length > 0 &&
    recipients.length > 0 &&
    !incompleteCondition &&
    !scheduleInvalid &&
    !aiOnSchedule &&
    Boolean(schedule.time);

  // Fills the builder with a drafted rule; nothing is saved until the user presses Create
  const draftMutation = useMutation({
    mutationFn: () => api.draftAutomation(projectId, { prompt: describe.trim(), timezone: browserTimeZone() }),
    onSuccess: (draft) => {
      const notify = draft.actions.find((a) => a.type === 'NOTIFY');
      setName(draft.name);
      setTriggerType(draft.trigger.type);
      if (draft.trigger.type === 'SCHEDULE') {
        const { frequency, time, weekdays, timezone } = draft.trigger;
        setSchedule({ frequency, time, weekdays, timezone });
      }
      setConditions(toDraftConditions(draft.conditions));
      setRecipients(notify?.recipients ?? ['ASSIGNEE']);
      setMessage(notify?.message ?? '');
      setDrafted({ warnings: draft.warnings, modelUsed: draft.modelUsed });
    },
  });

  const mutation = useMutation({
    mutationFn: () => {
      const trigger: AutomationTrigger =
        triggerType === 'ISSUE_CREATED'
          ? { type: 'ISSUE_CREATED' }
          : {
              type: 'SCHEDULE',
              frequency: schedule.frequency,
              time: schedule.time,
              weekdays: schedule.frequency === 'WEEKLY' ? schedule.weekdays : [],
              timezone: schedule.timezone,
            };
      const payload: AutomationInput = {
        name: name.trim(),
        description: description.trim() || null,
        trigger,
        conditions: builtConditions.filter((c): c is AutomationCondition => c !== null),
        actions: [{ type: 'NOTIFY', recipients, message: message.trim() || null }],
      };
      return automation ? api.updateAutomation(automation.id, payload) : api.createAutomation(projectId, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['automations', projectId] });
      onOpenChange(false);
    },
  });

  const chooseTrigger = (type: AutomationTrigger['type']) => {
    setTriggerType(type);
    // A digest of every issue ever filed is rarely wanted: start scheduled rules on open work
    if (type === 'SCHEDULE' && !automation && !conditions.some((c) => c.field === 'status')) {
      setConditions((prev) => [...prev, OPEN_WORK]);
    }
  };

  const unusedFields = FIELD_ORDER.filter(
    (f) => !conditions.some((c) => c.field === f.field) && (f.field !== 'ai' || triggerType === 'ISSUE_CREATED'),
  );
  const updateCondition = (index: number, patch: Partial<DraftCondition>) =>
    setConditions((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));

  return (
    <DialogShell
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          mutation.reset();
          draftMutation.reset();
        }
        onOpenChange(next);
      }}
      size="lg"
      icon={<Zap className="h-4 w-4" />}
      title={automation ? `Edit “${automation.name}”` : 'Create automation'}
      description="When something happens, check the conditions, then act. People are never notified about issues they created themselves."
      footer={
        <>
          <CancelButton onClick={() => onOpenChange(false)} />
          <PrimaryButton pending={mutation.isPending} disabled={!canSave} onClick={() => mutation.mutate()}>
            {automation ? 'Save changes' : 'Create automation'}
          </PrimaryButton>
        </>
      }
    >
      {!automation && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-primary" htmlFor="automation-describe">
            <Sparkles className="h-3.5 w-3.5" />
            Describe it
          </label>
          <div className="flex gap-2">
            <textarea
              id="automation-describe"
              value={describe}
              onChange={(e) => setDescribe(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && describe.trim().length >= 3) draftMutation.mutate();
              }}
              rows={2}
              maxLength={1000}
              placeholder="e.g. Every Monday at 9am, send assignees their open P0 and P1 bugs. Or: when a new issue looks security-related, tell the reporter."
              className={cn(inputClass, 'resize-none')}
            />
            <button
              type="button"
              onClick={() => draftMutation.mutate()}
              disabled={describe.trim().length < 3 || draftMutation.isPending}
              className="self-stretch shrink-0 inline-flex items-center gap-1.5 px-3 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {draftMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Draft
            </button>
          </div>
          {drafted && (
            <div className="space-y-1 animate-fade-in">
              <p className="text-[11px] text-muted-foreground">
                Drafted by <span className="font-mono">{drafted.modelUsed}</span>. Review below, then create.
              </p>
              {drafted.warnings.map((w) => (
                <p key={w} className="flex items-start gap-1.5 text-[11px] text-amber-400">
                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                  {w}
                </p>
              ))}
            </div>
          )}
          <ErrorNote error={draftMutation.error} />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className={labelClass} htmlFor="automation-name">Name</label>
          <input
            id="automation-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Weekly P0 / P1 review"
            maxLength={120}
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <label className={labelClass} htmlFor="automation-description">Description</label>
          <input
            id="automation-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional"
            maxLength={1000}
            className={inputClass}
          />
        </div>
      </div>

      {/* WHEN */}
      <BuilderStep label="When" tone="sky">
        <div className="grid grid-cols-2 gap-2">
          <ChoiceCard
            active={triggerType === 'ISSUE_CREATED'}
            onClick={() => chooseTrigger('ISSUE_CREATED')}
            icon={<FilePlus2 className="h-4 w-4" />}
            title="An issue is created"
            text="Runs once for each new issue."
          />
          <ChoiceCard
            active={triggerType === 'SCHEDULE'}
            onClick={() => chooseTrigger('SCHEDULE')}
            icon={<CalendarClock className="h-4 w-4" />}
            title="On a schedule"
            text="Daily or weekly digest of matching issues."
          />
        </div>

        {triggerType === 'SCHEDULE' && (
          <div className="mt-3 space-y-3 animate-fade-in">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <span className={labelClass}>Repeat</span>
                <div className="flex rounded-md border border-border overflow-hidden">
                  {(['DAILY', 'WEEKLY'] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setSchedule((s) => ({ ...s, frequency: f }))}
                      className={cn(
                        'px-3 py-1.5 text-xs font-medium transition-colors',
                        schedule.frequency === f ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted',
                      )}
                    >
                      {f === 'DAILY' ? 'Daily' : 'Weekly'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className={labelClass} htmlFor="automation-time">At</label>
                <input
                  id="automation-time"
                  type="time"
                  value={schedule.time}
                  onChange={(e) => setSchedule((s) => ({ ...s, time: e.target.value }))}
                  className={cn(inputClass, 'w-28')}
                />
              </div>
              <div className="space-y-1.5 flex-1 min-w-[12rem]">
                <label className={labelClass} htmlFor="automation-tz">Timezone</label>
                <select
                  id="automation-tz"
                  value={schedule.timezone}
                  onChange={(e) => setSchedule((s) => ({ ...s, timezone: e.target.value }))}
                  className={inputClass}
                >
                  {zones.map((z) => (
                    <option key={z} value={z}>{z}</option>
                  ))}
                </select>
              </div>
            </div>
            {schedule.frequency === 'WEEKLY' && (
              <div className="space-y-1.5">
                <span className={labelClass}>On</span>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAY_LABELS.map((label, day) => (
                    <TogglePill
                      key={label}
                      active={schedule.weekdays.includes(day)}
                      onClick={() =>
                        setSchedule((s) => ({
                          ...s,
                          weekdays: s.weekdays.includes(day)
                            ? s.weekdays.filter((d) => d !== day)
                            : [...s.weekdays, day].sort((a, b) => a - b),
                        }))
                      }
                    >
                      {label}
                    </TogglePill>
                  ))}
                </div>
                {scheduleInvalid && <p className="text-[11px] text-amber-400">Pick at least one day.</p>}
              </div>
            )}
          </div>
        )}
      </BuilderStep>

      {/* IF */}
      <BuilderStep label="If" tone="violet">
        {conditions.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No conditions: {triggerType === 'ISSUE_CREATED' ? 'every new issue matches.' : 'every issue in the project matches.'}
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground">All of these must match.</p>
            {conditions.map((condition, index) => (
              <ConditionRow
                key={condition.field}
                condition={condition}
                members={members}
                onChange={(patch) => updateCondition(index, patch)}
                onRemove={() => setConditions((prev) => prev.filter((_, i) => i !== index))}
              />
            ))}
          </div>
        )}
        {aiOnSchedule && (
          <p className="text-[11px] text-amber-400 mt-2">
            AI conditions only work with “An issue is created”. Remove it or change the trigger.
          </p>
        )}
        {unusedFields.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-3">
            <span className="text-[11px] text-muted-foreground mr-1">Add condition:</span>
            {unusedFields.map((f) => (
              <button
                key={f.field}
                type="button"
                onClick={() =>
                  setConditions((prev) => [
                    ...prev,
                    {
                      field: f.field,
                      operator: f.field === 'assignee' ? 'UNASSIGNED' : f.field === 'ai' ? 'ANY_OF' : 'IN',
                      values: [],
                    },
                  ])
                }
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-dashed border-border text-[11px] font-medium text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
              >
                <Plus className="h-3 w-3" />
                {f.label}
              </button>
            ))}
          </div>
        )}
      </BuilderStep>

      {/* THEN */}
      <BuilderStep label="Then" tone="emerald">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Bell className="h-4 w-4 text-emerald-400" />
          Notify
          <div className="flex gap-1.5 ml-1">
            {(['ASSIGNEE', 'REPORTER'] as const).map((r) => (
              <TogglePill
                key={r}
                active={recipients.includes(r)}
                onClick={() => setRecipients((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]))}
              >
                {r === 'ASSIGNEE' ? 'Assignee' : 'Reporter'}
              </TogglePill>
            ))}
          </div>
        </div>
        {recipients.length === 0 && <p className="text-[11px] text-amber-400 mt-1.5">Choose who to notify.</p>}
        <div className="space-y-1.5 mt-3">
          <label className={labelClass} htmlFor="automation-message">Message (optional)</label>
          <textarea
            id="automation-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={MESSAGE_LIMIT}
            rows={2}
            placeholder={triggerType === 'SCHEDULE' ? 'Please update these before stand-up.' : 'Please triage within 2 hours.'}
            className={cn(inputClass, 'resize-none')}
          />
          <p className="text-[11px] text-muted-foreground">
            {triggerType === 'SCHEDULE'
              ? 'Each person gets one in-app, email and push digest of their matching issues, per their notification settings.'
              : 'Sent in-app, by email and by push, per each person’s notification settings.'}
          </p>
        </div>
      </BuilderStep>

      <ErrorNote error={mutation.error} />
    </DialogShell>
  );
}

function ConditionRow({
  condition,
  members,
  onChange,
  onRemove,
}: {
  condition: DraftCondition;
  members: { id: string; name: string }[];
  onChange: (patch: Partial<DraftCondition>) => void;
  onRemove: () => void;
}) {
  const isAssignee = condition.field === 'assignee';
  const isAi = condition.field === 'ai';
  const options: { value: string; label: string; hint?: string }[] =
    condition.field === 'ai'
      ? AI_CATEGORY_OPTIONS
      : condition.field === 'type'
      ? TYPE_OPTIONS
      : condition.field === 'priority'
        ? PRIORITY_OPTIONS
        : condition.field === 'status'
          ? STATUS_OPTIONS
          : members.map((m) => ({ value: m.id, label: m.name }));
  const showValues = !(isAssignee && condition.operator === 'UNASSIGNED');

  return (
    <div className="rounded-lg border border-border bg-background/60 p-2.5 space-y-2">
      <div className="flex items-center gap-2">
        <span className={cn('text-xs font-semibold', isAi ? 'inline-flex items-center gap-1 text-primary' : 'w-16')}>
          {isAi && <Sparkles className="h-3 w-3" />}
          {FIELD_ORDER.find((f) => f.field === condition.field)?.label}
        </span>
        {isAi ? (
          <span className="text-xs text-muted-foreground">any of</span>
        ) : (
          <select
            aria-label="Operator"
            value={condition.operator}
            onChange={(e) => onChange({ operator: e.target.value as DraftOperator })}
            className="text-xs bg-background border border-border rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {isAssignee ? (
              <>
                <option value="UNASSIGNED">is unassigned</option>
                <option value="IN">is one of</option>
              </>
            ) : (
              <>
                <option value="IN">is</option>
                <option value="NOT_IN">is not</option>
              </>
            )}
          </select>
        )}
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove condition"
          className="ml-auto p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {showValues && (
        <div className="flex flex-wrap gap-1.5">
          {options.map((o) => (
            <TogglePill
              key={o.value}
              title={o.hint}
              active={condition.values.includes(o.value)}
              onClick={() =>
                onChange({
                  values: condition.values.includes(o.value)
                    ? condition.values.filter((v) => v !== o.value)
                    : [...condition.values, o.value],
                })
              }
            >
              {o.label}
            </TogglePill>
          ))}
          {condition.values.length === 0 && <span className="text-[11px] text-amber-400 self-center">Pick at least one.</span>}
        </div>
      )}
      {isAi && (
        <p className="text-[11px] text-muted-foreground">
          Each new issue is classified once from its title and description: by the configured LLM, or by keyword rules when none is available.
        </p>
      )}
    </div>
  );
}

const STEP_TONES = {
  sky: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  violet: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
} as const;

function BuilderStep({ label, tone, children }: { label: string; tone: keyof typeof STEP_TONES; children: React.ReactNode }) {
  return (
    <section className="relative rounded-xl border border-border bg-muted/10 p-3.5 pt-4">
      <span
        className={cn(
          'absolute -top-2.5 left-3 px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider',
          STEP_TONES[tone],
        )}
      >
        {label}
      </span>
      {children}
    </section>
  );
}

function ChoiceCard({
  active,
  onClick,
  icon,
  title,
  text,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex items-start gap-2.5 rounded-lg border p-3 text-left transition-all',
        active ? 'border-primary bg-primary/10 shadow-sm' : 'border-border bg-background hover:border-primary/50',
      )}
    >
      <span className={cn('mt-0.5', active ? 'text-primary' : 'text-muted-foreground')}>{icon}</span>
      <span>
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-[11px] text-muted-foreground">{text}</span>
      </span>
    </button>
  );
}

function TogglePill({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={cn(
        'px-2.5 py-1 rounded-full border text-[11px] font-medium transition-colors',
        active ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:text-foreground hover:border-primary/50',
      )}
    >
      {children}
    </button>
  );
}
