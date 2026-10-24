'use client';

import React, { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  closestCenter,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import * as Dialog from '@radix-ui/react-dialog';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Sparkles,
  Play,
  CheckCircle2,
  Pencil,
  Trash2,
  CalendarRange,
  Target,
  ChevronDown,
  Inbox,
  Loader2,
  AlertTriangle,
  X,
  History,
} from 'lucide-react';
import { api, PaginatedIssues, SprintPlanProposal, SprintSummary } from '@/lib/api';
import { useProjectSocket } from '@/lib/use-socket';
import { IssueTypeBadge, IssuePriorityBadge, IssueStatusBadge } from '../issues/badge-helpers';
import { GenerativeSprintPlanCard } from '../ai/generative-sprint-plan-card';
import { CapacityBar } from './capacity-bar';
import { SprintFormDialog, StartSprintDialog, CompleteSprintDialog } from './sprint-dialogs';
import { formatSprintDateRange, daysRemaining } from './sprint-utils';
import { cn } from '@/lib/utils';

type BacklogIssue = PaginatedIssues['items'][number];

const BACKLOG_ID = 'backlog';
const RESOLVED = new Set(['DONE', 'CANCELLED']);
const PRIORITY_ORDER: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4 };
const RECENT_COMPLETED_LIMIT = 5;

const containerId = (sprintId: string | null) => (sprintId ? `sprint:${sprintId}` : BACKLOG_ID);

function sortIssues(list: BacklogIssue[]): BacklogIssue[] {
  return [...list].sort(
    (a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9) || a.keyNumber - b.keyNumber,
  );
}

interface BacklogViewProps {
  projectId: string;
  onSelectIssue: (issueKey: string) => void;
}

export function BacklogView({ projectId, onSelectIssue }: BacklogViewProps) {
  const queryClient = useQueryClient();
  useProjectSocket(projectId);

  const issuesKey = ['issues', projectId, 'backlog-all'] as const;

  const { data: sprints = [], isLoading: sprintsLoading } = useQuery({
    queryKey: ['sprints', projectId],
    queryFn: () => api.listSprints(projectId),
  });

  const { data: velocity } = useQuery({
    queryKey: ['sprints', projectId, 'velocity'],
    queryFn: () => api.getSprintVelocity(projectId),
  });

  const { data: allIssues = [], isLoading: issuesLoading } = useQuery({
    queryKey: issuesKey,
    // Subtasks travel with their parent and are not planned individually
    queryFn: async () => (await api.listAllIssues(projectId)).filter((i) => i.type !== 'SUBTASK'),
  });

  const [activeIssue, setActiveIssue] = useState<BacklogIssue | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [formState, setFormState] = useState<{ open: boolean; sprint: SprintSummary | null }>({ open: false, sprint: null });
  const [startTarget, setStartTarget] = useState<SprintSummary | null>(null);
  const [completeTarget, setCompleteTarget] = useState<SprintSummary | null>(null);
  const [plan, setPlan] = useState<SprintPlanProposal | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  const openSprints = sprints.filter((s) => s.status === 'ACTIVE' || s.status === 'PLANNED');
  const completedSprints = sprints.filter((s) => s.status === 'COMPLETED').slice(0, RECENT_COMPLETED_LIMIT);

  const grouped = useMemo(() => {
    const map = new Map<string, BacklogIssue[]>();
    for (const issue of allIssues) {
      const key = containerId(issue.sprintId ?? null);
      // Finished work only matters inside sprints; the backlog shows what is left to plan
      if (key === BACKLOG_ID && RESOLVED.has(issue.status)) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(issue);
    }
    for (const [key, list] of map) map.set(key, sortIssues(list));
    return map;
  }, [allIssues]);

  const backlogIssues = grouped.get(BACKLOG_ID) ?? [];
  const backlogPoints = backlogIssues.reduce((sum, i) => sum + (i.storyPoints ?? 0), 0);

  const moveMutation = useMutation({
    mutationFn: ({ issueId, sprintId }: { issueId: string; sprintId: string | null }) =>
      api.updateIssue(issueId, { sprintId }),
    onMutate: ({ issueId, sprintId }) => {
      setMoveError(null);
      // Optimistic move so drag-and-drop feels instant
      queryClient.setQueryData<BacklogIssue[]>(issuesKey, (old = []) =>
        old.map((i) => (i.id === issueId ? { ...i, sprintId } : i)),
      );
    },
    onError: (err) => {
      setMoveError(err instanceof Error ? err.message : 'Could not move issue.');
      queryClient.invalidateQueries({ queryKey: issuesKey });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['sprints', projectId] });
    },
  });

  const planMutation = useMutation({
    mutationFn: (sprintId?: string) => api.planSprint({ projectId, sprintId }),
    onSuccess: (proposal) => setPlan(proposal),
  });

  const deleteMutation = useMutation({
    mutationFn: (sprintId: string) => api.deleteSprint(sprintId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprints', projectId] });
      queryClient.invalidateQueries({ queryKey: ['issues', projectId] });
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveIssue(allIssues.find((i) => i.id === event.active.id) ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveIssue(null);
    const { active, over } = event;
    if (!over) return;

    const issue = allIssues.find((i) => i.id === active.id);
    if (!issue) return;

    const targetSprintId = over.id === BACKLOG_ID ? null : String(over.id).replace('sprint:', '');
    if ((issue.sprintId ?? null) === targetSprintId) return;

    moveMutation.mutate({ issueId: issue.id, sprintId: targetSprintId });
  };

  const isLoading = sprintsLoading || issuesLoading;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card/70 border border-border/80 rounded-xl p-3.5">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>
            <span className="font-semibold text-foreground">{openSprints.length}</span> open sprint
            {openSprints.length === 1 ? '' : 's'}
          </span>
          <span>
            <span className="font-semibold text-foreground">{backlogIssues.length}</span> backlog issues ·{' '}
            {backlogPoints} pts
          </span>
          <span>
            Avg velocity:{' '}
            <span className="font-semibold text-foreground">
              {velocity?.averageVelocity !== null && velocity?.averageVelocity !== undefined
                ? `${velocity.averageVelocity} pts`
                : '—'}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => planMutation.mutate(undefined)}
            disabled={planMutation.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-60 transition-colors"
          >
            {planMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Plan next sprint with AI
          </button>
          <button
            type="button"
            onClick={() => setFormState({ open: true, sprint: null })}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-2xs"
          >
            <Plus className="h-3.5 w-3.5" />
            New sprint
          </button>
        </div>
      </div>

      {(moveError || planMutation.error || deleteMutation.error) && (
        <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span className="flex-1">
            {moveError ??
              (planMutation.error instanceof Error ? planMutation.error.message : null) ??
              (deleteMutation.error instanceof Error ? deleteMutation.error.message : 'Something went wrong.')}
          </span>
          <button
            type="button"
            onClick={() => {
              setMoveError(null);
              planMutation.reset();
              deleteMutation.reset();
            }}
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-36 rounded-xl border border-border/60 bg-muted/20 animate-pulse" />
          ))}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="space-y-3">
            {openSprints.map((sprint) => (
              <SprintContainer
                key={sprint.id}
                sprint={sprint}
                issues={grouped.get(containerId(sprint.id)) ?? []}
                onSelectIssue={onSelectIssue}
                onEdit={() => setFormState({ open: true, sprint })}
                onStart={() => setStartTarget(sprint)}
                onComplete={() => setCompleteTarget(sprint)}
                onDelete={() => deleteMutation.mutate(sprint.id)}
                onPlanWithAi={() => planMutation.mutate(sprint.id)}
                isPlanning={planMutation.isPending && planMutation.variables === sprint.id}
              />
            ))}

            {openSprints.length === 0 && (
              <div className="rounded-xl border border-dashed border-border bg-card/40 px-6 py-8 text-center space-y-2">
                <Target className="h-6 w-6 text-primary mx-auto" />
                <p className="text-sm font-medium">No open sprints</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Create a sprint and drag issues into it, or let AI propose a scope sized to your capacity.
                </p>
              </div>
            )}

            <DropZone id={BACKLOG_ID} className="rounded-xl border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <Inbox className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">Backlog</h3>
                  <span className="text-[11px] text-muted-foreground">
                    {backlogIssues.length} issues · {backlogPoints} pts
                  </span>
                </div>
              </div>
              <IssueList issues={backlogIssues} onSelectIssue={onSelectIssue} emptyText="The backlog is empty. Everything is planned." />
            </DropZone>

            {completedSprints.length > 0 && (
              <div className="rounded-xl border border-border/70 bg-card/50">
                <button
                  type="button"
                  onClick={() => setShowCompleted((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <History className="h-3.5 w-3.5" />
                    Completed sprints ({completedSprints.length})
                  </span>
                  <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showCompleted && 'rotate-180')} />
                </button>
                {showCompleted && (
                  <ul className="border-t border-border divide-y divide-border/60 animate-fade-in">
                    {completedSprints.map((s) => (
                      <li key={s.id} className="flex items-center gap-4 px-4 py-2.5 text-xs">
                        <span className="font-medium w-32 truncate">{s.name}</span>
                        <span className="text-muted-foreground w-36">{formatSprintDateRange(s.startDate, s.endDate)}</span>
                        <CapacityBar
                          className="flex-1"
                          points={s.committedPoints ?? 0}
                          donePoints={s.completedPoints ?? 0}
                          capacity={null}
                        />
                        <span className="text-muted-foreground w-28 text-right">
                          {s.carriedOverIssueCount ? `${s.carriedOverIssueCount} carried over` : 'All done'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <DragOverlay dropAnimation={{ duration: 150, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
            {activeIssue ? <IssueRowContent issue={activeIssue} isOverlay /> : null}
          </DragOverlay>
        </DndContext>
      )}

      <SprintFormDialog
        projectId={projectId}
        open={formState.open}
        sprint={formState.sprint}
        averageVelocity={velocity?.averageVelocity ?? null}
        onOpenChange={(open) => setFormState((s) => ({ ...s, open }))}
      />
      <StartSprintDialog projectId={projectId} sprint={startTarget} onOpenChange={(open) => !open && setStartTarget(null)} />
      <CompleteSprintDialog
        projectId={projectId}
        sprint={completeTarget}
        rolloverCandidates={openSprints.filter((s) => s.id !== completeTarget?.id)}
        onOpenChange={(open) => !open && setCompleteTarget(null)}
      />

      {/* AI plan review */}
      <Dialog.Root open={Boolean(plan)} onOpenChange={(open) => !open && setPlan(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-fade-in" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed left-1/2 top-[8vh] z-50 w-[calc(100vw-2rem)] max-w-xl max-h-[84vh] overflow-y-auto -translate-x-1/2 rounded-xl data-[state=open]:animate-fade-in focus:outline-none"
          >
            <Dialog.Title className="sr-only">AI sprint plan</Dialog.Title>
            {plan && (
              <GenerativeSprintPlanCard
                plan={plan}
                onOpenIssue={(key) => {
                  setPlan(null);
                  onSelectIssue(key);
                }}
                onDiscard={() => setPlan(null)}
                onApplied={() => setTimeout(() => setPlan(null), 1500)}
              />
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

// ---------------------------------------------------------------------------

function SprintContainer({
  sprint,
  issues,
  onSelectIssue,
  onEdit,
  onStart,
  onComplete,
  onDelete,
  onPlanWithAi,
  isPlanning,
}: {
  sprint: SprintSummary;
  issues: BacklogIssue[];
  onSelectIssue: (key: string) => void;
  onEdit: () => void;
  onStart: () => void;
  onComplete: () => void;
  onDelete: () => void;
  onPlanWithAi: () => void;
  isPlanning: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isActive = sprint.status === 'ACTIVE';
  const remaining = daysRemaining(sprint.endDate);
  const dateRange = formatSprintDateRange(sprint.startDate, sprint.endDate);

  return (
    <DropZone
      id={containerId(sprint.id)}
      className={cn('rounded-xl border bg-card shadow-sm', isActive ? 'border-emerald-500/30' : 'border-border')}
    >
      <div className="px-4 py-3 border-b border-border space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold">{sprint.name}</h3>
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border',
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-sky-500/10 text-sky-400 border-sky-500/30',
                )}
              >
                {isActive && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                {isActive ? 'Active' : 'Planned'}
              </span>
              {dateRange && (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <CalendarRange className="h-3 w-3" />
                  {dateRange}
                  {isActive && remaining !== null && (
                    <span className={cn('ml-1', remaining < 0 ? 'text-red-400' : remaining <= 2 ? 'text-amber-400' : '')}>
                      · {remaining < 0 ? `${Math.abs(remaining)}d overdue` : `${remaining}d left`}
                    </span>
                  )}
                </span>
              )}
            </div>
            {sprint.goal && (
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <Target className="h-3 w-3 mt-0.5 shrink-0" />
                <span className="line-clamp-2">{sprint.goal}</span>
              </p>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {confirmDelete ? (
              <>
                <span className="text-[11px] text-muted-foreground mr-1">Delete sprint?</span>
                <button type="button" onClick={onDelete} className="px-2 py-1 rounded text-[11px] font-semibold bg-destructive/15 text-destructive hover:bg-destructive/25">
                  Delete
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="px-2 py-1 rounded text-[11px] text-muted-foreground hover:bg-muted">
                  Keep
                </button>
              </>
            ) : (
              <>
                {!isActive && (
                  <button
                    type="button"
                    onClick={onPlanWithAi}
                    disabled={isPlanning}
                    title="Fill with AI"
                    className="p-1.5 rounded-md text-primary hover:bg-primary/10 disabled:opacity-60 transition-colors"
                  >
                    {isPlanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  </button>
                )}
                <button type="button" onClick={onEdit} title="Edit sprint" className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                {!isActive && (
                  <button type="button" onClick={() => setConfirmDelete(true)} title="Delete sprint" className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
                {isActive ? (
                  <button type="button" onClick={onComplete} className="ml-1 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Complete
                  </button>
                ) : (
                  <button type="button" onClick={onStart} className="ml-1 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                    <Play className="h-3.5 w-3.5" />
                    Start
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <CapacityBar
          points={sprint.progress.totalPoints}
          capacity={sprint.capacityPoints}
          donePoints={isActive ? sprint.progress.donePoints : undefined}
        />
        {(sprint.progress.unestimatedCount > 0 || sprint.progress.blockedCount > 0) && (
          <div className="flex items-center gap-3 text-[11px]">
            {sprint.progress.unestimatedCount > 0 && (
              <span className="text-amber-400">{sprint.progress.unestimatedCount} unestimated</span>
            )}
            {sprint.progress.blockedCount > 0 && (
              <span className="text-red-400">{sprint.progress.blockedCount} blocked</span>
            )}
          </div>
        )}
      </div>

      <IssueList issues={issues} onSelectIssue={onSelectIssue} emptyText="Drag issues here to plan this sprint." />
    </DropZone>
  );
}

function DropZone({ id, className, children }: { id: string; className?: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section
      ref={setNodeRef}
      className={cn(className, 'transition-all duration-150', isOver && 'ring-2 ring-primary/60 bg-primary/5')}
    >
      {children}
    </section>
  );
}

function IssueList({
  issues,
  onSelectIssue,
  emptyText,
}: {
  issues: BacklogIssue[];
  onSelectIssue: (key: string) => void;
  emptyText: string;
}) {
  if (issues.length === 0) {
    return <p className="px-4 py-6 text-center text-xs text-muted-foreground">{emptyText}</p>;
  }
  return (
    <ul className="p-1.5 space-y-0.5">
      {issues.map((issue) => (
        <DraggableIssueRow key={issue.id} issue={issue} onSelectIssue={onSelectIssue} />
      ))}
    </ul>
  );
}

function DraggableIssueRow({ issue, onSelectIssue }: { issue: BacklogIssue; onSelectIssue: (key: string) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: issue.id });
  return (
    <li
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onSelectIssue(issue.issueKey)}
      className={cn('rounded-lg cursor-grab active:cursor-grabbing outline-none focus-visible:ring-1 focus-visible:ring-primary', isDragging && 'opacity-30')}
    >
      <IssueRowContent issue={issue} />
    </li>
  );
}

function IssueRowContent({ issue, isOverlay }: { issue: BacklogIssue; isOverlay?: boolean }) {
  const isDone = issue.status === 'DONE';
  return (
    <div
      className={cn(
        'flex items-center gap-3 px-2.5 py-2 rounded-lg transition-colors',
        isOverlay ? 'bg-card border border-primary/40 shadow-2xl w-[min(720px,90vw)]' : 'hover:bg-muted/50',
      )}
    >
      <IssueTypeBadge type={issue.type} className="text-[10px] py-0 px-1.5 shrink-0" />
      <span className="font-mono text-[11px] font-semibold text-muted-foreground w-16 shrink-0">{issue.issueKey}</span>
      <span className={cn('text-sm truncate flex-1', isDone && 'line-through text-muted-foreground')}>{issue.title}</span>
      <IssueStatusBadge status={issue.status} className="text-[10px] py-0 shrink-0 hidden md:inline-flex" />
      <IssuePriorityBadge priority={issue.priority} className="text-[10px] py-0 px-1.5 shrink-0" />
      <span
        title={issue.assignee?.name ?? 'Unassigned'}
        className="h-5 w-5 rounded-full bg-primary/15 text-primary text-[9px] font-bold flex items-center justify-center shrink-0 border border-primary/20"
      >
        {issue.assignee?.name ? issue.assignee.name.charAt(0).toUpperCase() : '–'}
      </span>
      <span
        className={cn(
          'font-mono text-[11px] w-10 text-center rounded px-1 py-0.5 shrink-0',
          issue.storyPoints === null || issue.storyPoints === undefined
            ? 'text-muted-foreground/60 bg-muted/40'
            : 'bg-muted text-foreground',
        )}
        title={issue.storyPoints === null || issue.storyPoints === undefined ? 'Not estimated' : 'Story points'}
      >
        {issue.storyPoints ?? '–'}
      </span>
    </div>
  );
}
