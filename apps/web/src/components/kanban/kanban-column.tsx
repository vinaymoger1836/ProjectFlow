'use client';

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, MoreHorizontal } from 'lucide-react';
import { KanbanCard, KanbanIssueItem } from './kanban-card';
import { cn } from '@/lib/utils';

export interface ColumnDefinition {
  id: string; // e.g. 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'
  title: string;
  dotColor: string;
  badgeBg: string;
}

interface KanbanColumnProps {
  column: ColumnDefinition;
  issues: KanbanIssueItem[];
  onSelectIssue: (issueKey: string) => void;
  onQuickAdd?: (status: string) => void;
}

export function KanbanColumn({
  column,
  issues,
  onSelectIssue,
  onQuickAdd,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: {
      type: 'Column',
      columnId: column.id,
    },
  });

  const issueIds = issues.map((i) => i.id);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col w-80 shrink-0 bg-muted/30 border border-border/70 rounded-xl max-h-[calc(100vh-210px)] transition-colors duration-200 shadow-2xs',
        isOver && 'ring-2 ring-primary/40 bg-muted/60 border-primary/40',
      )}
    >
      {/* Column Header */}
      <div className="p-3.5 border-b border-border/60 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-2">
          <span className={cn('h-2.5 w-2.5 rounded-full', column.dotColor)} />
          <h3 className="text-xs font-bold tracking-wider uppercase text-foreground/90">
            {column.title}
          </h3>
          <span
            className={cn(
              'px-1.5 py-0.5 rounded-full text-[11px] font-mono font-semibold',
              column.badgeBg,
            )}
          >
            {issues.length}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {onQuickAdd && (
            <button
              type="button"
              onClick={() => onQuickAdd(column.id)}
              title={`Add issue to ${column.title}`}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-background/80 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Cards Container */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 min-h-[140px]">
        <SortableContext items={issueIds} strategy={verticalListSortingStrategy}>
          {issues.map((issue) => (
            <KanbanCard
              key={issue.id}
              issue={issue}
              onSelectIssue={onSelectIssue}
            />
          ))}
        </SortableContext>

        {issues.length === 0 && (
          <div
            className={cn(
              'h-28 rounded-lg border border-dashed border-border/70 flex flex-col items-center justify-center p-4 text-center transition-colors',
              isOver ? 'bg-primary/5 border-primary/40' : 'bg-card/20',
            )}
          >
            <p className="text-xs text-muted-foreground font-medium">No issues</p>
            <p className="text-[11px] text-muted-foreground/70 mt-0.5">
              Drag an issue here
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
