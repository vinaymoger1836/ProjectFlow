'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { capacityState } from './sprint-utils';

interface CapacityBarProps {
  points: number;
  capacity: number | null;
  /** Optional completed points, drawn as a solid segment inside the planned fill. */
  donePoints?: number;
  className?: string;
  showLabel?: boolean;
}

const FILL_CLASS = {
  empty: 'bg-muted-foreground/30',
  healthy: 'bg-primary',
  full: 'bg-amber-500',
  over: 'bg-red-500',
} as const;

export function CapacityBar({ points, capacity, donePoints, className, showLabel = true }: CapacityBarProps) {
  const state = capacityState(points, capacity);
  const scale = Math.max(capacity ?? 0, points, 1);
  const plannedPct = Math.min(100, (points / scale) * 100);
  const donePct = donePoints !== undefined ? Math.min(plannedPct, (donePoints / scale) * 100) : 0;

  return (
    <div className={cn('flex items-center gap-2 min-w-0', className)}>
      <div
        className="relative h-1.5 flex-1 rounded-full bg-muted overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={capacity ?? points}
        aria-valuenow={points}
        aria-label="Planned points versus capacity"
      >
        <div
          className={cn('absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out', FILL_CLASS[state], donePoints !== undefined && 'opacity-40')}
          style={{ width: `${plannedPct}%` }}
        />
        {donePoints !== undefined && (
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-emerald-500 transition-all duration-500 ease-out"
            style={{ width: `${donePct}%` }}
          />
        )}
        {capacity !== null && points > capacity && (
          <div
            className="absolute inset-y-0 w-px bg-foreground/70"
            style={{ left: `${(capacity / scale) * 100}%` }}
            title={`Capacity: ${capacity} pts`}
          />
        )}
      </div>
      {showLabel && (
        <span
          className={cn(
            'text-[11px] font-mono font-semibold shrink-0 tabular-nums',
            state === 'over' ? 'text-red-400' : state === 'full' ? 'text-amber-400' : 'text-muted-foreground',
          )}
        >
          {donePoints !== undefined ? `${donePoints}/` : ''}
          {points}
          {capacity !== null ? ` / ${capacity}` : ''} pts
        </span>
      )}
    </div>
  );
}
