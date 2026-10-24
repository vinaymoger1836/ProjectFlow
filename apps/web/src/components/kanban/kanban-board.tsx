'use client';

import React, { useState, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Filter,
  Plus,
  Users,
  Radio,
  SlidersHorizontal,
  RefreshCw,
  Target,
  CalendarRange,
  ArrowRight,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useProjectSocket } from '@/lib/use-socket';
import { KanbanColumn, ColumnDefinition } from './kanban-column';
import { KanbanCard, KanbanIssueItem } from './kanban-card';
import { CapacityBar } from '../sprints/capacity-bar';
import { formatSprintDateRange, daysRemaining } from '../sprints/sprint-utils';
import { cn } from '@/lib/utils';

const DEFAULT_COLUMNS: ColumnDefinition[] = [
  {
    id: 'BACKLOG',
    title: 'Backlog',
    dotColor: 'bg-slate-400',
    badgeBg: 'bg-slate-500/10 text-slate-500 border border-slate-500/20',
  },
  {
    id: 'TODO',
    title: 'To Do',
    dotColor: 'bg-sky-500',
    badgeBg: 'bg-sky-500/10 text-sky-500 border border-sky-500/20',
  },
  {
    id: 'IN_PROGRESS',
    title: 'In Progress',
    dotColor: 'bg-amber-500',
    badgeBg: 'bg-amber-500/10 text-amber-500 border border-amber-500/20',
  },
  {
    id: 'IN_REVIEW',
    title: 'In Review',
    dotColor: 'bg-indigo-500',
    badgeBg: 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20',
  },
  {
    id: 'DONE',
    title: 'Done',
    dotColor: 'bg-emerald-500',
    badgeBg: 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20',
  },
];

interface KanbanBoardProps {
  projectId: string;
  onSelectIssue: (issueKey: string) => void;
  onOpenCreateModal: (defaultStatus?: string) => void;
  /** Navigates to Backlog & Sprints (shown when no sprint is active). */
  onOpenBacklog?: () => void;
}

export function KanbanBoard({
  projectId,
  onSelectIssue,
  onOpenCreateModal,
  onOpenBacklog,
}: KanbanBoardProps) {
  const queryClient = useQueryClient();
  const [activeIssue, setActiveIssue] = useState<KanbanIssueItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [pickedSprintId, setPickedSprintId] = useState<string | null>(null);

  // Real-time WebSockets synchronization and presence tracking
  const { isConnected, presence } = useProjectSocket(projectId);

  // The board shows one active sprint at a time; several may run in parallel
  const { data: sprints = [], isLoading: sprintsLoading } = useQuery({
    queryKey: ['sprints', projectId],
    queryFn: () => api.listSprints(projectId),
  });
  const activeSprints = useMemo(() => sprints.filter((s) => s.status === 'ACTIVE'), [sprints]);
  const selectedSprint = activeSprints.find((s) => s.id === pickedSprintId) ?? activeSprints[0] ?? null;

  const boardQueryKey = ['issues', projectId, 'board', selectedSprint?.id ?? null] as const;

  // Fetch live issues of the selected sprint
  const {
    data: issues = [],
    isLoading: issuesLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: boardQueryKey,
    queryFn: async () => {
      const res = await api.listIssues(projectId, { sprintId: selectedSprint!.id, limit: 100 });
      return (res?.items || []) as KanbanIssueItem[];
    },
    enabled: Boolean(selectedSprint),
  });
  const isLoading = sprintsLoading || (Boolean(selectedSprint) && issuesLoading);

  // Filter issues based on search and filters
  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      // Exclude subtasks from primary kanban columns (they display nested inside parent cards and drawer)
      if (issue.type === 'SUBTASK') return false;

      if (priorityFilter !== 'ALL' && issue.priority !== priorityFilter) {
        return false;
      }
      if (typeFilter !== 'ALL' && issue.type !== typeFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesKey = issue.issueKey.toLowerCase().includes(query);
        const matchesTitle = issue.title.toLowerCase().includes(query);
        if (!matchesKey && !matchesTitle) return false;
      }
      return true;
    });
  }, [issues, searchQuery, priorityFilter, typeFilter]);

  // Group issues into column buckets
  const columnIssuesMap = useMemo(() => {
    const map = new Map<string, KanbanIssueItem[]>();
    for (const col of DEFAULT_COLUMNS) {
      map.set(col.id, []);
    }
    for (const issue of filteredIssues) {
      const status = issue.status || 'TODO';
      if (map.has(status)) {
        map.get(status)!.push(issue);
      } else {
        // Fallback for custom or unknown status -> TODO
        if (!map.has('TODO')) map.set('TODO', []);
        map.get('TODO')!.push(issue);
      }
    }
    return map;
  }, [filteredIssues]);

  // Mutation for updating issue status on drop
  const updateStatusMutation = useMutation({
    mutationFn: ({ issueId, status }: { issueId: string; status: string }) => {
      return api.updateIssue(issueId, { status });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['issues', projectId] });
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['issue', updated.issueKey], updated);
      queryClient.setQueryData(['issue', updated.id], updated);
      // Moving to/from DONE changes the sprint's completed points
      queryClient.invalidateQueries({ queryKey: ['sprints', projectId] });
    },
  });

  // Sensors for dragging
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px movement needed before drag activates
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const issue = issues.find((i) => i.id === active.id);
    if (issue) {
      setActiveIssue(issue);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    // Optional live column reordering if needed in future
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveIssue(null);

    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const draggedIssue = issues.find((i) => i.id === activeId);
    if (!draggedIssue) return;

    // Determine target column ID:
    // Case 1: dropped directly on column container (overId matches column id)
    // Case 2: dropped over another card (overId is another issue's id)
    let targetStatus: string | null = null;
    if (DEFAULT_COLUMNS.some((col) => col.id === overId)) {
      targetStatus = overId;
    } else {
      const overIssue = issues.find((i) => i.id === overId);
      if (overIssue) {
        targetStatus = overIssue.status;
      }
    }

    if (targetStatus && targetStatus !== draggedIssue.status) {
      // Optimistic cache update
      queryClient.setQueryData<KanbanIssueItem[]>(boardQueryKey, (old = []) => {
        return old.map((item) =>
          item.id === activeId ? { ...item, status: targetStatus! } : item,
        );
      });

      // Trigger mutation to persist in database & broadcast via WebSockets
      updateStatusMutation.mutate({ issueId: activeId, status: targetStatus });
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Board Controls & Filters Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card/70 border border-border/80 rounded-xl p-3.5 shadow-2xs backdrop-blur-xs shrink-0">
        <div className="flex items-center gap-3 flex-wrap flex-1">
          {/* Search Bar */}
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search board cards..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
            />
          </div>

          {/* Priority Filter */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-muted-foreground font-medium hidden sm:inline">Priority:</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="text-xs bg-background border border-input rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer shadow-2xs"
            >
              <option value="ALL">All Priorities</option>
              <option value="P0">P0 - Urgent</option>
              <option value="P1">P1 - High</option>
              <option value="P2">P2 - Medium</option>
              <option value="P3">P3 - Low</option>
              <option value="P4">P4 - None</option>
            </select>
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-muted-foreground font-medium hidden sm:inline">Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="text-xs bg-background border border-input rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer shadow-2xs"
            >
              <option value="ALL">All Types</option>
              <option value="TASK">Task</option>
              <option value="BUG">Bug</option>
              <option value="STORY">Story</option>
              <option value="EPIC">Epic</option>
            </select>
          </div>
        </div>

        {/* Right Action & Presence Bar */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Real-time Presence Indicator */}
          <div
            className={cn(
              'flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-medium border shadow-2xs transition-colors',
              isConnected
                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                : 'bg-muted text-muted-foreground border-border',
            )}
            title={
              isConnected
                ? `Live WebSockets Connected. ${presence.count} active collaborator(s) online.`
                : 'Connecting to real-time events...'
            }
          >
            <span className="relative flex h-2 w-2">
              {isConnected && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={cn(
                  'relative inline-flex rounded-full h-2 w-2',
                  isConnected ? 'bg-emerald-500' : 'bg-muted-foreground',
                )}
              />
            </span>
            <span className="font-semibold">
              {isConnected ? 'Live Sync' : 'Connecting...'}
            </span>
            {presence.count > 0 && (
              <span className="font-mono text-[10px] px-1 rounded-full bg-background/60">
                {presence.count}
              </span>
            )}
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isRefetching}
            title="Refresh Board"
            className="p-1.5 rounded-md border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw
              className={cn('h-3.5 w-3.5', isRefetching && 'animate-spin text-primary')}
            />
          </button>

          {/* Quick Create Button */}
          <button
            type="button"
            onClick={() => onOpenCreateModal()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-2xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Issue</span>
          </button>
        </div>
      </div>

      {/* Active Sprint Header */}
      {selectedSprint && (
        <div className="flex flex-col md:flex-row md:items-center gap-3 bg-card border border-emerald-500/25 rounded-xl px-4 py-3 shrink-0 animate-fade-in">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              {activeSprints.length > 1 ? (
                <select
                  value={selectedSprint.id}
                  onChange={(e) => setPickedSprintId(e.target.value)}
                  aria-label="Active sprint"
                  className="text-sm font-semibold bg-background border border-input rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  {activeSprints.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              ) : (
                <h3 className="text-sm font-semibold">{selectedSprint.name}</h3>
              )}
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Active
              </span>
              <SprintTimeline start={selectedSprint.startDate} end={selectedSprint.endDate} />
            </div>
            {selectedSprint.goal && (
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <Target className="h-3 w-3 mt-0.5 shrink-0" />
                <span className="truncate">{selectedSprint.goal}</span>
              </p>
            )}
          </div>
          <div className="w-full md:w-72 space-y-1">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>
                {selectedSprint.progress.doneIssueCount}/{selectedSprint.progress.issueCount} issues done
              </span>
              <span>Committed {selectedSprint.committedPoints ?? 0} pts</span>
            </div>
            <CapacityBar
              points={selectedSprint.progress.totalPoints}
              donePoints={selectedSprint.progress.donePoints}
              capacity={selectedSprint.capacityPoints}
            />
          </div>
        </div>
      )}

      {!sprintsLoading && !selectedSprint ? (
        <div className="p-12 text-center rounded-xl border border-dashed border-border bg-card/40 space-y-3">
          <Target className="h-8 w-8 text-primary mx-auto" />
          <h3 className="font-semibold text-base">No active sprint</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            The board shows the work of an active sprint. Plan a sprint in the backlog, then start it to begin tracking
            progress here.
          </p>
          {onOpenBacklog && (
            <button
              type="button"
              onClick={onOpenBacklog}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Go to Backlog &amp; Sprints
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ) : (
      <div className="flex-1 overflow-x-auto pb-4">
        {isLoading ? (
          <div className="flex gap-4">
            {DEFAULT_COLUMNS.map((col) => (
              <div
                key={col.id}
                className="w-80 h-[500px] bg-muted/20 border border-border/60 rounded-xl p-4 space-y-3 animate-pulse"
              >
                <div className="h-5 bg-muted/60 rounded w-1/3" />
                <div className="h-28 bg-muted/40 rounded-lg" />
                <div className="h-28 bg-muted/40 rounded-lg" />
              </div>
            ))}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-4 items-start select-none min-w-max">
              {DEFAULT_COLUMNS.map((col) => (
                <KanbanColumn
                  key={col.id}
                  column={col}
                  issues={columnIssuesMap.get(col.id) || []}
                  onSelectIssue={onSelectIssue}
                  onQuickAdd={(status) => onOpenCreateModal(status)}
                />
              ))}
            </div>

            {/* Ghost Drag Overlay while actively dragging a card */}
            <DragOverlay dropAnimation={{ duration: 150, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
              {activeIssue ? (
                <KanbanCard
                  issue={activeIssue}
                  isOverlay
                  onSelectIssue={() => {}}
                />
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>
      )}
    </div>
  );
}

function SprintTimeline({ start, end }: { start: string | null; end: string | null }) {
  const range = formatSprintDateRange(start, end);
  const remaining = daysRemaining(end);
  if (!range) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
      <CalendarRange className="h-3 w-3" />
      {range}
      {remaining !== null && (
        <span className={cn('ml-1', remaining < 0 ? 'text-red-400' : remaining <= 2 ? 'text-amber-400' : '')}>
          · {remaining < 0 ? `${Math.abs(remaining)}d overdue` : `${remaining}d left`}
        </span>
      )}
    </span>
  );
}
