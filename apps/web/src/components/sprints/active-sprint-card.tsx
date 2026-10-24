'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock } from 'lucide-react';
import { api } from '@/lib/api';
import { CapacityBar } from './capacity-bar';
import { daysRemaining } from './sprint-utils';

/**
 * Overview metric tile for the project's active sprint(s).
 */
export function ActiveSprintCard({ projectId, onOpen }: { projectId: string; onOpen?: () => void }) {
  const { data: sprints = [], isLoading } = useQuery({
    queryKey: ['sprints', projectId],
    queryFn: () => api.listSprints(projectId),
  });

  const active = sprints.filter((s) => s.status === 'ACTIVE');
  const primary = active[0];
  const remaining = primary ? daysRemaining(primary.endDate) : null;
  const pct =
    primary && primary.progress.totalPoints > 0
      ? Math.round((primary.progress.donePoints / primary.progress.totalPoints) * 100)
      : 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="p-5 rounded-lg border border-border bg-card shadow-sm space-y-2 text-left hover:border-primary/40 transition-colors"
    >
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="truncate">
          {isLoading ? 'Active sprint' : primary ? `Active · ${primary.name}` : 'No active sprint'}
          {active.length > 1 && ` (+${active.length - 1} more)`}
        </span>
        <Clock className="h-4 w-4 text-primary shrink-0" />
      </div>
      {isLoading ? (
        <div className="h-8 w-32 rounded bg-muted/50 animate-pulse" />
      ) : primary ? (
        <>
          <div className="text-2xl font-bold">
            {primary.progress.donePoints} / {primary.progress.totalPoints} Pts
          </div>
          <CapacityBar
            points={primary.progress.totalPoints}
            donePoints={primary.progress.donePoints}
            capacity={primary.capacityPoints}
            showLabel={false}
          />
          <p className="text-xs text-muted-foreground">
            {remaining === null
              ? 'No end date'
              : remaining < 0
                ? `${Math.abs(remaining)} days overdue`
                : `${remaining} days remaining`}{' '}
            • {pct}% completed
          </p>
        </>
      ) : (
        <>
          <div className="text-2xl font-bold text-muted-foreground">—</div>
          <p className="text-xs text-muted-foreground">Plan and start a sprint in Backlog &amp; Sprints.</p>
        </>
      )}
    </button>
  );
}
