'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Clock, User, CheckSquare, Layers } from 'lucide-react';
import { IssuePriorityBadge, IssueTypeBadge } from '../issues/badge-helpers';
import { cn } from '@/lib/utils';
import { Issue } from '@projectflow/types';

export interface KanbanIssueItem extends Issue {
  assignee?: { id: string; name: string; email: string; avatarUrl?: string | null } | null;
  reporter: { id: string; name: string; email: string; avatarUrl?: string | null };
  labels?: { id: string; name: string; color: string }[];
  subtasks?: any[];
  subtaskStats?: { total: number; completed: number };
}

interface KanbanCardProps {
  issue: KanbanIssueItem;
  onSelectIssue: (issueKey: string) => void;
  isOverlay?: boolean;
}

export function KanbanCard({ issue, onSelectIssue, isOverlay = false }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: issue.id,
    data: {
      type: 'Issue',
      issue,
    },
    disabled: isOverlay,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const subtaskStats = issue.subtaskStats || {
    total: issue.subtasks?.length || 0,
    completed: issue.subtasks?.filter((s) => s.status === 'DONE').length || 0,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        // Prevent click if dragging
        if (!isDragging) {
          onSelectIssue(issue.issueKey);
        }
      }}
      className={cn(
        'group relative bg-card/90 hover:bg-card border border-border/80 hover:border-primary/50 rounded-lg p-3.5 shadow-xs hover:shadow-md transition-all cursor-grab active:cursor-grabbing select-none space-y-3',
        isDragging && 'opacity-40 border-dashed border-primary scale-[0.98]',
        isOverlay && 'shadow-2xl border-primary scale-105 rotate-1 bg-card z-50 ring-2 ring-primary/20',
      )}
    >
      {/* Top Header: Key, Type, Priority */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-foreground/80 group-hover:text-primary transition-colors">
            {issue.issueKey}
          </span>
          <IssueTypeBadge type={issue.type as any} />
        </div>
        <IssuePriorityBadge priority={issue.priority as any} />
      </div>

      {/* Title */}
      <h4 className="text-xs font-semibold leading-snug text-foreground/95 line-clamp-2">
        {issue.title}
      </h4>

      {/* Subtasks Progress Indicator (if subtasks exist) */}
      {subtaskStats.total > 0 && (
        <div className="space-y-1 pt-0.5">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
            <span className="flex items-center gap-1">
              <CheckSquare className="h-3 w-3 text-primary" />
              <span>Subtasks</span>
            </span>
            <span>
              {subtaskStats.completed}/{subtaskStats.total}
            </span>
          </div>
          <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300 rounded-full"
              style={{
                width: `${(subtaskStats.completed / subtaskStats.total) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Card Footer: Points, Estimate, Assignee */}
      <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
        <div className="flex items-center gap-2.5">
          {issue.storyPoints !== null && issue.storyPoints !== undefined && (
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted font-medium">
              {issue.storyPoints} pts
            </span>
          )}

          {issue.estimateHours && (
            <span className="flex items-center gap-1 text-[10px] font-mono">
              <Clock className="h-3 w-3 text-muted-foreground/70" />
              <span>{issue.estimateHours}h</span>
            </span>
          )}
        </div>

        {/* Assignee Avatar */}
        <div className="flex items-center">
          {issue.assignee ? (
            <div
              title={issue.assignee.name}
              className="h-5 w-5 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-[9px] border border-primary/30"
            >
              {issue.assignee.name.charAt(0).toUpperCase()}
            </div>
          ) : (
            <div
              title="Unassigned"
              className="h-5 w-5 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground border border-dashed border-border"
            >
              <User className="h-2.5 w-2.5" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
