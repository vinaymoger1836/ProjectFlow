'use client';

import React, { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CalendarRange,
  Check,
  ChevronDown,
  Info,
  AlertTriangle,
  OctagonAlert,
  Sparkles,
  Lock,
  Trash2,
} from 'lucide-react';
import { api, SprintPlanIssue, SprintPlanProposal, SprintPlanWarning, SprintSummary } from '@/lib/api';
import { IssueTypeBadge, IssuePriorityBadge } from '../issues/badge-helpers';
import { CapacityBar } from '../sprints/capacity-bar';
import { formatSprintDateRange } from '../sprints/sprint-utils';
import { cn } from '@/lib/utils';

const COLLAPSED_ROWS = 5;

interface GenerativeSprintPlanCardProps {
  plan: SprintPlanProposal;
  onApplied?: (sprint: SprintSummary) => void;
  onOpenIssue?: (issueKey: string) => void;
  onDiscard?: () => void;
}

export function GenerativeSprintPlanCard({ plan, onApplied, onOpenIssue, onDiscard }: GenerativeSprintPlanCardProps) {
  const queryClient = useQueryClient();

  const [name, setName] = useState(plan.sprintName);
  const [goal, setGoal] = useState(plan.goal);
  const [capacity, setCapacity] = useState(plan.capacityPoints);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(plan.issues.map((i) => i.id)));
  const [isReviewing, setIsReviewing] = useState(false);
  const [appliedSprint, setAppliedSprint] = useState<SprintSummary | null>(null);

  const candidates = useMemo(() => [...plan.issues, ...plan.alternates], [plan]);
  const existingPoints = plan.existingIssues.reduce((sum, i) => sum + i.plannedPoints, 0);
  const selected = candidates.filter((i) => selectedIds.has(i.id));
  const totalPoints = existingPoints + selected.reduce((sum, i) => sum + i.plannedPoints, 0);
  const isOver = totalPoints > capacity;

  const composition = useMemo(() => {
    const counts = new Map<string, number>();
    for (const issue of [...plan.existingIssues, ...selected]) {
      counts.set(issue.type, (counts.get(issue.type) ?? 0) + 1);
    }
    return [...counts.entries()];
  }, [plan.existingIssues, selected]);

  const toggle = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const applyMutation = useMutation({
    mutationFn: () =>
      api.applySprintPlan({
        projectId: plan.projectId,
        sprintId: plan.targetSprintId ?? undefined,
        name: name.trim() || plan.sprintName,
        goal: goal.trim() || undefined,
        capacityPoints: capacity,
        startDate: plan.suggestedStartDate,
        endDate: plan.suggestedEndDate,
        issueIds: selected.map((i) => i.id),
      }),
    onSuccess: (sprint) => {
      setAppliedSprint(sprint);
      queryClient.invalidateQueries({ queryKey: ['sprints', plan.projectId] });
      queryClient.invalidateQueries({ queryKey: ['issues', plan.projectId] });
      onApplied?.(sprint);
    },
  });

  if (appliedSprint) {
    return (
      <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 space-y-2 animate-fade-in text-xs">
        <div className="flex items-center gap-2 font-semibold text-emerald-400">
          <Check className="h-4 w-4 stroke-[3]" />
          <span>{appliedSprint.name} is ready</span>
        </div>
        <p className="text-muted-foreground">
          {appliedSprint.progress.issueCount} issues · {appliedSprint.progress.totalPoints} pts planned. Review it in
          Backlog &amp; Sprints and start it when the team is ready.
        </p>
      </div>
    );
  }

  const visibleCandidates = isReviewing ? candidates : plan.issues.slice(0, COLLAPSED_ROWS);
  const hiddenCount = plan.issues.length - COLLAPSED_ROWS;

  return (
    <div className="rounded-xl border border-primary/40 bg-card p-4 shadow-lg space-y-3 text-xs animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-2.5">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded bg-primary/20 text-primary flex items-center justify-center">
            <Sparkles className="h-3 w-3" />
          </div>
          <span className="font-semibold text-foreground">AI Sprint Plan</span>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
          {plan.modelUsed}
        </span>
      </div>

      {/* Sprint identity */}
      <div className="space-y-1.5">
        {isReviewing ? (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Sprint name"
            className="w-full px-2 py-1 bg-background border border-input rounded text-sm font-bold focus:outline-none focus:ring-1 focus:ring-primary"
          />
        ) : (
          <h4 className="text-sm font-bold">{name}</h4>
        )}
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <CalendarRange className="h-3 w-3" />
          <span>{formatSprintDateRange(plan.suggestedStartDate, plan.suggestedEndDate)}</span>
          {plan.averageVelocity !== null && <span>· avg velocity {plan.averageVelocity} pts</span>}
        </div>
        {isReviewing ? (
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            rows={2}
            aria-label="Sprint goal"
            className="w-full p-2 bg-background border border-input rounded text-[11px] resize-none focus:outline-none focus:ring-1 focus:ring-primary"
          />
        ) : (
          <p className="text-[11px] text-foreground/90 bg-muted/30 px-2.5 py-1.5 rounded border border-border/40">
            🎯 {goal}
          </p>
        )}
      </div>

      {/* Capacity */}
      <div className="rounded-lg border border-border bg-muted/20 p-2.5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold">
            {plan.existingIssues.length + selected.length} issues
            {composition.length > 0 && (
              <span className="font-normal text-muted-foreground">
                {' · '}
                {composition.map(([type, count]) => `${count} ${type.toLowerCase()}${count === 1 ? '' : 's'}`).join(', ')}
              </span>
            )}
          </span>
          {isReviewing ? (
            <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
              Capacity
              <input
                type="number"
                min={0}
                max={1000}
                value={capacity}
                onChange={(e) => setCapacity(Math.max(0, Number(e.target.value) || 0))}
                className="w-14 px-1.5 py-0.5 bg-background border border-input rounded text-[11px] font-mono"
              />
            </label>
          ) : null}
        </div>
        <CapacityBar points={totalPoints} capacity={capacity} />
        {isOver && (
          <p className="text-[11px] text-red-400">Over capacity by {totalPoints - capacity} pts. Remove issues or raise capacity.</p>
        )}
      </div>

      {/* Warnings */}
      {plan.warnings.length > 0 && (
        <ul className="space-y-1">
          {plan.warnings.map((w, idx) => (
            <WarningRow key={idx} warning={w} onOpenIssue={onOpenIssue} />
          ))}
        </ul>
      )}

      {/* Scope */}
      <div className="space-y-1">
        {plan.existingIssues.map((issue) => (
          <PlanIssueRow key={issue.id} issue={issue} locked onOpenIssue={onOpenIssue} />
        ))}
        {visibleCandidates.map((issue, idx) => {
          const isAlternate = idx >= plan.issues.length;
          return (
            <React.Fragment key={issue.id}>
              {isReviewing && isAlternate && idx === plan.issues.length && (
                <div className="pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Didn&apos;t fit — add if needed
                </div>
              )}
              <PlanIssueRow
                issue={issue}
                selectable={isReviewing}
                checked={selectedIds.has(issue.id)}
                onToggle={() => toggle(issue.id)}
                onOpenIssue={onOpenIssue}
              />
            </React.Fragment>
          );
        })}
        {!isReviewing && hiddenCount > 0 && (
          <p className="text-[11px] text-muted-foreground px-2">+{hiddenCount} more</p>
        )}
        {plan.issues.length === 0 && plan.existingIssues.length === 0 && (
          <p className="text-[11px] text-muted-foreground px-2 py-2">No backlog issues are ready to plan.</p>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground italic">💡 {plan.rationale}</p>

      {applyMutation.error && (
        <p className="text-[11px] text-destructive">
          {applyMutation.error instanceof Error ? applyMutation.error.message : 'Failed to apply plan.'}
        </p>
      )}

      {/* Actions */}
      <div className="pt-2 border-t border-border flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsReviewing((v) => !v)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ChevronDown className={cn('h-3 w-3 transition-transform', isReviewing && 'rotate-180')} />
            <span>{isReviewing ? 'Done reviewing' : 'Review'}</span>
          </button>
          {onDiscard && (
            <button
              type="button"
              onClick={onDiscard}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="h-3 w-3" />
              <span>Discard</span>
            </button>
          )}
        </div>

        <button
          type="button"
          disabled={applyMutation.isPending || isOver || (selected.length === 0 && plan.existingIssues.length === 0)}
          onClick={() => applyMutation.mutate()}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 disabled:opacity-50 transition-all shadow-sm"
        >
          <Check className="h-3.5 w-3.5 stroke-[3]" />
          <span>
            {applyMutation.isPending ? 'Saving…' : plan.targetSprintId ? `Update ${plan.sprintName}` : 'Create Sprint'}
          </span>
        </button>
      </div>
    </div>
  );
}

function WarningRow({ warning, onOpenIssue }: { warning: SprintPlanWarning; onOpenIssue?: (key: string) => void }) {
  const Icon = warning.level === 'critical' ? OctagonAlert : warning.level === 'warning' ? AlertTriangle : Info;
  return (
    <li
      className={cn(
        'flex items-start gap-1.5 rounded px-2 py-1.5 text-[11px] border',
        warning.level === 'critical' && 'bg-red-500/10 border-red-500/20 text-red-300',
        warning.level === 'warning' && 'bg-amber-500/10 border-amber-500/20 text-amber-300',
        warning.level === 'info' && 'bg-muted/30 border-border/40 text-muted-foreground',
      )}
    >
      <Icon className="h-3 w-3 mt-0.5 shrink-0" />
      <span>
        {warning.message}
        {warning.issueKeys && warning.issueKeys.length > 0 && (
          <>
            {' '}
            {warning.issueKeys.map((key, idx) => (
              <React.Fragment key={key}>
                {idx > 0 && ', '}
                <button
                  type="button"
                  onClick={() => onOpenIssue?.(key)}
                  disabled={!onOpenIssue}
                  className="font-mono font-semibold underline-offset-2 hover:underline disabled:no-underline"
                >
                  {key}
                </button>
              </React.Fragment>
            ))}
          </>
        )}
      </span>
    </li>
  );
}

function PlanIssueRow({
  issue,
  locked,
  selectable,
  checked,
  onToggle,
  onOpenIssue,
}: {
  issue: SprintPlanIssue;
  locked?: boolean;
  selectable?: boolean;
  checked?: boolean;
  onToggle?: () => void;
  onOpenIssue?: (key: string) => void;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors',
        selectable && !checked ? 'opacity-60 hover:opacity-100' : '',
        'hover:bg-muted/40',
      )}
      title={issue.reason}
    >
      {locked ? (
        <Lock className="h-3 w-3 text-muted-foreground shrink-0" aria-label="Already in sprint" />
      ) : selectable ? (
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          aria-label={`Include ${issue.issueKey}`}
          className="h-3.5 w-3.5 shrink-0 accent-[hsl(var(--primary))]"
        />
      ) : null}
      <button
        type="button"
        onClick={() => onOpenIssue?.(issue.issueKey)}
        disabled={!onOpenIssue}
        className="font-mono text-[10px] font-semibold text-muted-foreground hover:text-primary shrink-0"
      >
        {issue.issueKey}
      </button>
      <span className="truncate flex-1 text-[11px]">{issue.title}</span>
      <IssueTypeBadge type={issue.type} className="text-[9px] py-0 px-1.5 shrink-0" />
      <IssuePriorityBadge priority={issue.priority} className="text-[9px] py-0 px-1.5 shrink-0" />
      <span
        className={cn(
          'font-mono text-[10px] w-10 text-right shrink-0',
          issue.estimateAssumed ? 'text-amber-400' : 'text-muted-foreground',
        )}
        title={issue.estimateAssumed ? 'No estimate: assumed for planning' : undefined}
      >
        {issue.plannedPoints}
        {issue.estimateAssumed ? '?' : ''} pt
      </span>
    </div>
  );
}
