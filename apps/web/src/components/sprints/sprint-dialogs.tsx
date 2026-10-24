'use client';

import React, { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Play, CheckCircle2, AlertTriangle, Loader2, Gauge } from 'lucide-react';
import { api, SprintSummary } from '@/lib/api';
import { cn } from '@/lib/utils';
import { CapacityBar } from './capacity-bar';
import { toDateInputValue, fromDateInputValue, addDaysToInputValue } from './sprint-utils';

const DEFAULT_SPRINT_LENGTH_DAYS = 14;

const inputClass =
  'w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-shadow';
const labelClass = 'text-xs font-semibold text-muted-foreground';

function DialogShell({
  open,
  onOpenChange,
  title,
  description,
  icon,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card shadow-2xl data-[state=open]:animate-fade-in focus:outline-none">
          <div className="flex items-start justify-between gap-4 px-5 pt-5">
            <div className="flex items-start gap-3">
              {icon && (
                <div className="h-8 w-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
                  {icon}
                </div>
              )}
              <div>
                <Dialog.Title className="text-base font-semibold">{title}</Dialog.Title>
                {description ? (
                  <Dialog.Description className="text-xs text-muted-foreground mt-0.5">{description}</Dialog.Description>
                ) : (
                  <Dialog.Description className="sr-only">{title}</Dialog.Description>
                )}
              </div>
            </div>
            <Dialog.Close className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Dialog.Close>
          </div>
          <div className="px-5 py-4 space-y-4">{children}</div>
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-muted/20 rounded-b-xl">
            {footer}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p className="flex items-start gap-1.5 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      <span>{error instanceof Error ? error.message : 'Something went wrong.'}</span>
    </p>
  );
}

function PrimaryButton({
  children,
  pending,
  disabled,
  onClick,
  tone = 'primary',
}: {
  children: React.ReactNode;
  pending?: boolean;
  disabled?: boolean;
  onClick: () => void;
  tone?: 'primary' | 'success';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || pending}
      className={cn(
        'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold shadow-sm transition-colors disabled:opacity-50',
        tone === 'success'
          ? 'bg-emerald-500 text-black hover:bg-emerald-400'
          : 'bg-primary text-primary-foreground hover:bg-primary/90',
      )}
    >
      {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </button>
  );
}

function CancelButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
    >
      Cancel
    </button>
  );
}

// ---------------------------------------------------------------------------
// Create / edit
// ---------------------------------------------------------------------------

interface SprintFormDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing; absent when creating. */
  sprint?: SprintSummary | null;
  averageVelocity: number | null;
}

export function SprintFormDialog({ projectId, open, onOpenChange, sprint, averageVelocity }: SprintFormDialogProps) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(sprint);

  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [capacity, setCapacity] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(sprint?.name ?? '');
    setGoal(sprint?.goal ?? '');
    setStartDate(toDateInputValue(sprint?.startDate));
    setEndDate(toDateInputValue(sprint?.endDate));
    // New sprints are prefilled with recent velocity, the most honest capacity estimate available
    setCapacity(
      sprint ? (sprint.capacityPoints?.toString() ?? '') : averageVelocity ? String(averageVelocity) : '',
    );
    // Re-initialise only when the dialog opens or targets another sprint, not on background refetches
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sprint?.id]);

  const mutation = useMutation({
    mutationFn: () => {
      const capacityPoints = capacity === '' ? undefined : Number(capacity);
      if (sprint) {
        return api.updateSprint(sprint.id, {
          name: name.trim() || sprint.name,
          goal: goal.trim() || null,
          capacityPoints: capacityPoints ?? null,
          startDate: fromDateInputValue(startDate) ?? null,
          endDate: fromDateInputValue(endDate) ?? null,
        });
      }
      return api.createSprint(projectId, {
        name: name.trim() || undefined,
        goal: goal.trim() || undefined,
        capacityPoints,
        startDate: fromDateInputValue(startDate),
        endDate: fromDateInputValue(endDate),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprints', projectId] });
      onOpenChange(false);
    },
  });

  const handleStartChange = (value: string) => {
    setStartDate(value);
    if (value && !endDate) setEndDate(addDaysToInputValue(value, DEFAULT_SPRINT_LENGTH_DAYS));
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={(next) => {
        if (!next) mutation.reset();
        onOpenChange(next);
      }}
      title={isEdit ? `Edit ${sprint?.name}` : 'Create sprint'}
      description={isEdit ? undefined : 'Plan a sprint, then drag backlog issues into it.'}
      footer={
        <>
          <CancelButton onClick={() => onOpenChange(false)} />
          <PrimaryButton pending={mutation.isPending} onClick={() => mutation.mutate()}>
            {isEdit ? 'Save changes' : 'Create sprint'}
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-1.5">
        <label className={labelClass} htmlFor="sprint-name">Name</label>
        <input
          id="sprint-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={isEdit ? undefined : 'Auto-named (e.g. Sprint 3)'}
          maxLength={255}
          className={inputClass}
        />
      </div>

      <div className="space-y-1.5">
        <label className={labelClass} htmlFor="sprint-goal">Sprint goal</label>
        <textarea
          id="sprint-goal"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          rows={2}
          maxLength={2000}
          placeholder="What does this sprint deliver?"
          className={cn(inputClass, 'resize-none')}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className={labelClass} htmlFor="sprint-start">Start date</label>
          <input id="sprint-start" type="date" value={startDate} onChange={(e) => handleStartChange(e.target.value)} className={inputClass} />
        </div>
        <div className="space-y-1.5">
          <label className={labelClass} htmlFor="sprint-end">End date</label>
          <input id="sprint-end" type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className={labelClass} htmlFor="sprint-capacity">Capacity (story points)</label>
        <input
          id="sprint-capacity"
          type="number"
          min={0}
          max={1000}
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          placeholder="e.g. 30"
          className={inputClass}
        />
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Gauge className="h-3 w-3" />
          {averageVelocity !== null
            ? `Average velocity over the last completed sprints: ${averageVelocity} pts`
            : 'No completed sprints yet. Velocity suggestions appear after your first sprint.'}
        </p>
      </div>

      <ErrorNote error={mutation.error} />
    </DialogShell>
  );
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

interface StartSprintDialogProps {
  projectId: string;
  sprint: SprintSummary | null;
  onOpenChange: (open: boolean) => void;
}

export function StartSprintDialog({ projectId, sprint, onOpenChange }: StartSprintDialogProps) {
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (!sprint) return;
    const start = toDateInputValue(sprint.startDate) || toDateInputValue(new Date().toISOString());
    setStartDate(start);
    setEndDate(toDateInputValue(sprint.endDate) || addDaysToInputValue(start, DEFAULT_SPRINT_LENGTH_DAYS));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sprint?.id]);

  const mutation = useMutation({
    mutationFn: () =>
      api.startSprint(sprint!.id, {
        startDate: fromDateInputValue(startDate),
        endDate: fromDateInputValue(endDate),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprints', projectId] });
      onOpenChange(false);
    },
  });

  const progress = sprint?.progress;

  return (
    <DialogShell
      open={Boolean(sprint)}
      onOpenChange={(next) => {
        if (!next) mutation.reset();
        onOpenChange(next);
      }}
      icon={<Play className="h-4 w-4" />}
      title={`Start ${sprint?.name ?? 'sprint'}`}
      description="The current scope is recorded as this sprint's commitment."
      footer={
        <>
          <CancelButton onClick={() => onOpenChange(false)} />
          <PrimaryButton
            pending={mutation.isPending}
            disabled={!progress || progress.issueCount === 0}
            onClick={() => mutation.mutate()}
          >
            <Play className="h-3.5 w-3.5" />
            Start sprint
          </PrimaryButton>
        </>
      }
    >
      {progress && (
        <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">
              {progress.issueCount} issue{progress.issueCount === 1 ? '' : 's'} committed
            </span>
            <span className="text-muted-foreground">
              {sprint?.capacityPoints !== null ? `Capacity ${sprint?.capacityPoints} pts` : 'No capacity set'}
            </span>
          </div>
          <CapacityBar points={progress.totalPoints} capacity={sprint?.capacityPoints ?? null} />
          {progress.unestimatedCount > 0 && (
            <p className="flex items-center gap-1.5 text-[11px] text-amber-400">
              <AlertTriangle className="h-3 w-3" />
              {progress.unestimatedCount} issue(s) have no estimate and are not counted in the commitment.
            </p>
          )}
          {progress.issueCount === 0 && (
            <p className="text-[11px] text-destructive">Add at least one issue before starting.</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className={labelClass} htmlFor="start-start">Start date</label>
          <input id="start-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
        </div>
        <div className="space-y-1.5">
          <label className={labelClass} htmlFor="start-end">End date</label>
          <input id="start-end" type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />
        </div>
      </div>

      <ErrorNote error={mutation.error} />
    </DialogShell>
  );
}

// ---------------------------------------------------------------------------
// Complete
// ---------------------------------------------------------------------------

interface CompleteSprintDialogProps {
  projectId: string;
  sprint: SprintSummary | null;
  /** Other PLANNED / ACTIVE sprints that can receive unfinished work. */
  rolloverCandidates: SprintSummary[];
  onOpenChange: (open: boolean) => void;
}

export function CompleteSprintDialog({ projectId, sprint, rolloverCandidates, onOpenChange }: CompleteSprintDialogProps) {
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<'BACKLOG' | 'SPRINT'>('BACKLOG');
  const [targetSprintId, setTargetSprintId] = useState('');

  useEffect(() => {
    if (!sprint) return;
    // Default to the next planned sprint when one exists, as agreed for rollover UX
    const nextPlanned = rolloverCandidates.find((s) => s.status === 'PLANNED') ?? rolloverCandidates[0];
    setTarget(nextPlanned ? 'SPRINT' : 'BACKLOG');
    setTargetSprintId(nextPlanned?.id ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sprint?.id]);

  const mutation = useMutation({
    mutationFn: () =>
      api.completeSprint(sprint!.id, {
        rolloverTo: target,
        rolloverSprintId: target === 'SPRINT' ? targetSprintId : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprints', projectId] });
      queryClient.invalidateQueries({ queryKey: ['issues', projectId] });
      onOpenChange(false);
    },
  });

  const progress = sprint?.progress;
  const unfinished = progress ? progress.issueCount - progress.doneIssueCount : 0;

  return (
    <DialogShell
      open={Boolean(sprint)}
      onOpenChange={(next) => {
        if (!next) mutation.reset();
        onOpenChange(next);
      }}
      icon={<CheckCircle2 className="h-4 w-4" />}
      title={`Complete ${sprint?.name ?? 'sprint'}`}
      description="Completed points are recorded as this sprint's velocity."
      footer={
        <>
          <CancelButton onClick={() => onOpenChange(false)} />
          <PrimaryButton
            tone="success"
            pending={mutation.isPending}
            disabled={target === 'SPRINT' && !targetSprintId}
            onClick={() => mutation.mutate()}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Complete sprint
          </PrimaryButton>
        </>
      }
    >
      {progress && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border border-border bg-muted/20 py-2.5">
            <div className="text-lg font-bold text-emerald-400">{progress.donePoints}</div>
            <div className="text-[10px] text-muted-foreground">pts done</div>
          </div>
          <div className="rounded-lg border border-border bg-muted/20 py-2.5">
            <div className="text-lg font-bold">{sprint?.committedPoints ?? '—'}</div>
            <div className="text-[10px] text-muted-foreground">pts committed</div>
          </div>
          <div className="rounded-lg border border-border bg-muted/20 py-2.5">
            <div className={cn('text-lg font-bold', unfinished > 0 ? 'text-amber-400' : '')}>{unfinished}</div>
            <div className="text-[10px] text-muted-foreground">unfinished</div>
          </div>
        </div>
      )}

      {unfinished > 0 ? (
        <fieldset className="space-y-2">
          <legend className={cn(labelClass, 'mb-1.5')}>Move {unfinished} unfinished issue(s) to</legend>

          <label
            className={cn(
              'flex items-start gap-2.5 rounded-lg border p-3 cursor-pointer transition-colors',
              target === 'SPRINT' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40',
              rolloverCandidates.length === 0 && 'opacity-50 cursor-not-allowed',
            )}
          >
            <input
              type="radio"
              name="rollover"
              checked={target === 'SPRINT'}
              disabled={rolloverCandidates.length === 0}
              onChange={() => setTarget('SPRINT')}
              className="mt-0.5 accent-[hsl(var(--primary))]"
            />
            <div className="flex-1 space-y-1.5">
              <span className="text-sm font-medium">Another sprint</span>
              {rolloverCandidates.length > 0 ? (
                <select
                  value={targetSprintId}
                  onChange={(e) => {
                    setTargetSprintId(e.target.value);
                    setTarget('SPRINT');
                  }}
                  className={cn(inputClass, 'py-1.5 text-xs')}
                >
                  {rolloverCandidates.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.status.toLowerCase()})
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-[11px] text-muted-foreground">No other open sprints. Create one first.</p>
              )}
            </div>
          </label>

          <label
            className={cn(
              'flex items-center gap-2.5 rounded-lg border p-3 cursor-pointer transition-colors',
              target === 'BACKLOG' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40',
            )}
          >
            <input
              type="radio"
              name="rollover"
              checked={target === 'BACKLOG'}
              onChange={() => setTarget('BACKLOG')}
              className="accent-[hsl(var(--primary))]"
            />
            <span className="text-sm font-medium">Backlog</span>
          </label>
        </fieldset>
      ) : (
        <p className="flex items-center gap-1.5 text-xs text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Every issue in this sprint is done.
        </p>
      )}

      <ErrorNote error={mutation.error} />
    </DialogShell>
  );
}
