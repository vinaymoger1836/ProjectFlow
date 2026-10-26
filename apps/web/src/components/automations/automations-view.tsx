'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Zap,
  Plus,
  Pencil,
  Trash2,
  Play,
  History,
  ChevronDown,
  CalendarClock,
  FilePlus2,
  Bell,
  Filter,
  AlertTriangle,
  CheckCircle2,
  X,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { api, AutomationRunSummary, AutomationSummary } from '@/lib/api';
import { formatRelativeTime } from '../health/health-utils';
import { AutomationFormDialog } from './automation-form-dialog';
import {
  AI_CATEGORY_OPTIONS,
  RUN_STATUS_META,
  describeCondition,
  describeRecipients,
  describeTrigger,
} from './automation-utils';
import { cn } from '@/lib/utils';

const AI_LABELS = new Map<string, string>(AI_CATEGORY_OPTIONS.map((o) => [o.value, o.label]));

interface AutomationsViewProps {
  projectId: string;
}

export function AutomationsView({ projectId }: AutomationsViewProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<{ open: boolean; automation: AutomationSummary | null }>({ open: false, automation: null });

  const { data: automations = [], isLoading } = useQuery({
    queryKey: ['automations', projectId],
    queryFn: () => api.listAutomations(projectId),
  });
  const { data: members = [] } = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => api.listProjectMembers(projectId),
  });
  const memberName = (id: string) => members.find((m) => m.id === id)?.name ?? 'Unknown member';

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['automations', projectId] });

  const toggle = useMutation({
    mutationFn: (input: { id: string; enabled: boolean }) => api.updateAutomation(input.id, { enabled: input.enabled }),
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: (id: string) => api.deleteAutomation(id), onSuccess: invalidate });

  const pageError = toggle.error ?? remove.error;
  const enabledCount = automations.filter((a) => a.enabled).length;

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card/70 border border-border/80 rounded-xl p-3.5">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>
            <span className="font-semibold text-foreground">{automations.length}</span> automation{automations.length === 1 ? '' : 's'}
          </span>
          <span>
            <span className="font-semibold text-foreground">{enabledCount}</span> enabled
          </span>
          {automations.some((a) => a.lastRun?.status === 'FAILED') && (
            <span className="inline-flex items-center gap-1 text-red-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              {automations.filter((a) => a.lastRun?.status === 'FAILED').length} last run failed
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setForm({ open: true, automation: null })}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-2xs"
        >
          <Plus className="h-3.5 w-3.5" />
          New automation
        </button>
      </div>

      {pageError && (
        <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span className="flex-1">{pageError instanceof Error ? pageError.message : 'Something went wrong.'}</span>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => {
              toggle.reset();
              remove.reset();
            }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl border border-border/60 bg-muted/20 animate-pulse" />
          ))}
        </div>
      ) : automations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/40 px-6 py-10 text-center space-y-2">
          <Zap className="h-6 w-6 text-primary mx-auto" />
          <p className="text-sm font-medium">No automations yet</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Notify people when a matching issue is created, or send them a daily or weekly digest of the issues that need attention.
          </p>
          <button
            type="button"
            onClick={() => setForm({ open: true, automation: null })}
            className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-md border border-border bg-card text-xs font-semibold hover:bg-muted transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Create your first automation
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {automations.map((automation) => (
            <AutomationCard
              key={automation.id}
              automation={automation}
              memberName={memberName}
              toggling={toggle.isPending && toggle.variables?.id === automation.id}
              onToggle={(enabled) => toggle.mutate({ id: automation.id, enabled })}
              onEdit={() => setForm({ open: true, automation })}
              onDelete={() => remove.mutate(automation.id)}
              onRan={invalidate}
            />
          ))}
        </div>
      )}

      <AutomationFormDialog
        projectId={projectId}
        open={form.open}
        automation={form.automation}
        onOpenChange={(open) => setForm((prev) => ({ ...prev, open }))}
      />
    </div>
  );
}

function AutomationCard({
  automation,
  memberName,
  toggling,
  onToggle,
  onEdit,
  onDelete,
  onRan,
}: {
  automation: AutomationSummary;
  memberName: (id: string) => string;
  toggling: boolean;
  onToggle: (enabled: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onRan: () => void;
}) {
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const scheduled = automation.trigger.type === 'SCHEDULE';
  const notify = automation.actions.find((a) => a.type === 'NOTIFY');

  const runNow = useMutation({
    mutationFn: () => api.runAutomation(automation.id),
    onSuccess: async () => {
      onRan();
      await queryClient.invalidateQueries({ queryKey: ['automations', automation.projectId, 'runs', automation.id] });
    },
  });

  return (
    <div
      className={cn(
        'rounded-xl border bg-card shadow-sm transition-colors',
        automation.enabled ? 'border-border' : 'border-border/60 opacity-75',
      )}
    >
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={cn(
                'h-8 w-8 rounded-lg flex items-center justify-center shrink-0',
                automation.enabled ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
              )}
            >
              <Zap className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-semibold truncate">{automation.name}</h4>
              {automation.description && <p className="text-xs text-muted-foreground truncate">{automation.description}</p>}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {confirmDelete ? (
              <>
                <span className="text-[11px] text-muted-foreground mr-1">Delete with its history?</span>
                <button
                  type="button"
                  onClick={onDelete}
                  className="px-2 py-1 rounded text-[11px] font-semibold bg-destructive/15 text-destructive hover:bg-destructive/25"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="px-2 py-1 rounded text-[11px] text-muted-foreground hover:bg-muted"
                >
                  Keep
                </button>
              </>
            ) : (
              <>
                {scheduled && (
                  <button
                    type="button"
                    onClick={() => runNow.mutate()}
                    disabled={runNow.isPending}
                    title="Run now: evaluate and send the digest immediately"
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                  >
                    {runNow.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                    Run now
                  </button>
                )}
                <IconButton title="Edit automation" onClick={onEdit}>
                  <Pencil className="h-3.5 w-3.5" />
                </IconButton>
                <IconButton title="Delete automation" danger onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </IconButton>
                <Switch
                  checked={automation.enabled}
                  pending={toggling}
                  label={automation.enabled ? 'Disable automation' : 'Enable automation'}
                  onChange={onToggle}
                />
              </>
            )}
          </div>
        </div>

        {/* Rule summary: WHEN → IF → THEN */}
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <RuleChip tone="sky" icon={scheduled ? <CalendarClock className="h-3 w-3" /> : <FilePlus2 className="h-3 w-3" />}>
            {describeTrigger(automation.trigger)}
          </RuleChip>
          {automation.conditions.map((condition) => (
            <RuleChip key={condition.field} tone="violet" icon={<Filter className="h-3 w-3" />}>
              {describeCondition(condition, memberName)}
            </RuleChip>
          ))}
          {notify && (
            <RuleChip tone="emerald" icon={<Bell className="h-3 w-3" />}>
              {describeRecipients(notify.recipients)}
            </RuleChip>
          )}
        </div>
        {notify?.message && <p className="text-xs text-muted-foreground italic">“{notify.message}”</p>}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/60">
          <LastRunLine run={automation.lastRun} scheduled={scheduled} />
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <History className="h-3.5 w-3.5" />
            Run history
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showHistory && 'rotate-180')} />
          </button>
        </div>

        {runNow.error && (
          <p className="text-xs text-destructive">{runNow.error instanceof Error ? runNow.error.message : 'Run failed.'}</p>
        )}
        {runNow.data && !runNow.isPending && (
          <p className="flex items-center gap-1.5 text-xs text-emerald-400 animate-fade-in">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Matched {runNow.data.matchedCount} issue{runNow.data.matchedCount === 1 ? '' : 's'}; notified{' '}
            {runNow.data.notifiedCount} {runNow.data.notifiedCount === 1 ? 'person' : 'people'}.
          </p>
        )}
      </div>

      {showHistory && <RunHistory automation={automation} />}
    </div>
  );
}

function RunHistory({ automation }: { automation: AutomationSummary }) {
  const { data: runs = [], isLoading } = useQuery({
    queryKey: ['automations', automation.projectId, 'runs', automation.id],
    queryFn: () => api.listAutomationRuns(automation.id),
  });

  return (
    <div className="border-t border-border bg-muted/10 px-4 py-3 animate-fade-in">
      {isLoading ? (
        <div className="h-10 rounded-md bg-muted/30 animate-pulse" />
      ) : runs.length === 0 ? (
        <p className="text-xs text-muted-foreground">No runs yet.</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {runs.map((run) => (
            <li key={run.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5 text-[11px]">
              <span className={cn('px-1.5 py-0.5 rounded border font-semibold', RUN_STATUS_META[run.status].className)}>
                {RUN_STATUS_META[run.status].label}
              </span>
              <span className="text-muted-foreground w-24" title={new Date(run.startedAt).toLocaleString()}>
                {formatRelativeTime(run.startedAt)}
              </span>
              <span className="text-muted-foreground">
                {run.manual ? 'Run now' : run.triggerType === 'SCHEDULE' ? 'Scheduled' : run.issueKey ? `${run.issueKey} created` : 'Issue created'}
              </span>
              <span>
                {run.matchedCount} matched · {run.notifiedCount} notified
              </span>
              {run.details?.ai && (
                <span
                  title={run.details.ai.reason ?? undefined}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary font-medium"
                >
                  <Sparkles className="h-3 w-3" />
                  {run.details.ai.categories.map((c) => AI_LABELS.get(c) ?? c).join(', ')}
                  <span className="text-muted-foreground font-normal">
                    · {run.details.ai.source === 'llm' ? run.details.ai.model : 'keywords'}
                  </span>
                </span>
              )}
              {run.error && <span className="text-red-400 truncate max-w-full">{run.error}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LastRunLine({ run, scheduled }: { run: AutomationRunSummary | null; scheduled: boolean }) {
  if (!run) {
    return (
      <span className="text-[11px] text-muted-foreground">
        {scheduled ? 'Not run yet. Use Run now to preview who it notifies.' : 'Not triggered yet.'}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
      <span className={cn('px-1.5 py-0.5 rounded border font-semibold', RUN_STATUS_META[run.status].className)}>
        {RUN_STATUS_META[run.status].label}
      </span>
      Last run {formatRelativeTime(run.startedAt)} · {run.matchedCount} matched · {run.notifiedCount} notified
    </span>
  );
}

const CHIP_TONES = {
  sky: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
  violet: 'bg-violet-500/10 text-violet-400 border-violet-500/30',
  emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
} as const;

function RuleChip({ tone, icon, children }: { tone: keyof typeof CHIP_TONES; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-md border font-medium', CHIP_TONES[tone])}>
      {icon}
      {children}
    </span>
  );
}

function Switch({
  checked,
  pending,
  label,
  onChange,
}: {
  checked: boolean;
  pending: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={pending}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative ml-1 h-5 w-9 rounded-full border transition-colors disabled:opacity-60',
        checked ? 'bg-primary border-primary' : 'bg-muted border-border',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-[18px]' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

function IconButton({
  title,
  onClick,
  danger,
  children,
}: {
  title: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cn(
        'p-1.5 rounded-md text-muted-foreground transition-colors',
        danger ? 'hover:text-destructive hover:bg-destructive/10' : 'hover:text-foreground hover:bg-muted',
      )}
    >
      {children}
    </button>
  );
}
