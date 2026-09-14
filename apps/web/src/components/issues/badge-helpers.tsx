import React from 'react';
import { IssuePriority, IssueType } from '@projectflow/types';
import {
  CheckSquare,
  Bug,
  BookOpen,
  Zap,
  GitCommit,
  AlertCircle,
  Clock,
  ArrowUp,
  ArrowDown,
  Minus,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function IssueTypeBadge({ type, className }: { type: IssueType; className?: string }) {
  switch (type) {
    case 'BUG':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20',
            className,
          )}
        >
          <Bug className="h-3 w-3 text-red-400 shrink-0" />
          <span>Bug</span>
        </span>
      );
    case 'STORY':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
            className,
          )}
        >
          <BookOpen className="h-3 w-3 text-emerald-400 shrink-0" />
          <span>Story</span>
        </span>
      );
    case 'EPIC':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20',
            className,
          )}
        >
          <Zap className="h-3 w-3 text-purple-400 shrink-0" />
          <span>Epic</span>
        </span>
      );
    case 'SUBTASK':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-zinc-500/10 text-zinc-400 border border-zinc-500/20',
            className,
          )}
        >
          <GitCommit className="h-3 w-3 text-zinc-400 shrink-0" />
          <span>Subtask</span>
        </span>
      );
    case 'TASK':
    default:
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20',
            className,
          )}
        >
          <CheckSquare className="h-3 w-3 text-blue-400 shrink-0" />
          <span>Task</span>
        </span>
      );
  }
}

export function IssuePriorityBadge({
  priority,
  className,
}: {
  priority: IssuePriority;
  className?: string;
}) {
  switch (priority) {
    case 'P0':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-rose-600/20 text-rose-300 border border-rose-600/30',
            className,
          )}
        >
          <AlertCircle className="h-3 w-3 text-rose-400 shrink-0" />
          <span>P0 Urgent</span>
        </span>
      );
    case 'P1':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-orange-500/15 text-orange-300 border border-orange-500/30',
            className,
          )}
        >
          <ArrowUp className="h-3 w-3 text-orange-400 shrink-0" />
          <span>P1 High</span>
        </span>
      );
    case 'P2':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30',
            className,
          )}
        >
          <Minus className="h-3 w-3 text-amber-400 shrink-0" />
          <span>P2 Medium</span>
        </span>
      );
    case 'P3':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-sky-500/15 text-sky-300 border border-sky-500/30',
            className,
          )}
        >
          <ArrowDown className="h-3 w-3 text-sky-400 shrink-0" />
          <span>P3 Low</span>
        </span>
      );
    case 'P4':
    default:
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-zinc-500/10 text-zinc-400 border border-zinc-500/20',
            className,
          )}
        >
          <Minus className="h-3 w-3 text-zinc-400 shrink-0" />
          <span>P4 None</span>
        </span>
      );
  }
}

export function IssueStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const norm = status.toUpperCase();

  if (norm === 'DONE' || norm === 'COMPLETED' || norm === 'RESOLVED') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
          className,
        )}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        <span>Done</span>
      </span>
    );
  }

  if (norm === 'IN_PROGRESS' || norm === 'IN PROGRESS') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/15 text-blue-300 border border-blue-500/30',
          className,
        )}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
        <span>In Progress</span>
      </span>
    );
  }

  if (norm === 'IN_REVIEW' || norm === 'IN REVIEW') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-500/15 text-purple-300 border border-purple-500/30',
          className,
        )}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
        <span>In Review</span>
      </span>
    );
  }

  if (norm === 'BACKLOG') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-500/15 text-zinc-400 border border-zinc-500/30',
          className,
        )}
      >
        <Clock className="h-3 w-3 text-zinc-400" />
        <span>Backlog</span>
      </span>
    );
  }

  // Default TODO
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30',
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
      <span>Todo</span>
    </span>
  );
}
