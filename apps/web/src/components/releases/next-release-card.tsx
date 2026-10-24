'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Rocket } from 'lucide-react';
import { api } from '@/lib/api';
import { daysRemaining } from '../sprints/sprint-utils';
import { VERDICT_META, formatDate } from './release-utils';
import { cn } from '@/lib/utils';

/**
 * Overview metric tile for the next unreleased version and its readiness.
 */
export function NextReleaseCard({ projectId, onOpen }: { projectId: string; onOpen?: () => void }) {
  const { data: releases = [], isLoading } = useQuery({
    queryKey: ['releases', projectId],
    queryFn: () => api.listReleases(projectId),
  });
  // The API lists unreleased versions first, closest to shipping
  const next = releases.find((r) => r.status !== 'RELEASED');

  const { data: readiness } = useQuery({
    queryKey: ['releases', projectId, 'readiness', next?.id],
    queryFn: () => api.getReleaseReadiness(next!.id),
    enabled: Boolean(next),
    staleTime: 30_000,
  });

  const remaining = next ? daysRemaining(next.targetDate) : null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="p-5 rounded-lg border border-border bg-card shadow-sm space-y-2 text-left hover:border-primary/40 transition-colors"
    >
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="truncate">{isLoading ? 'Next release' : next ? `Target Release ${next.version}` : 'No release planned'}</span>
        <Rocket className={cn('h-4 w-4 shrink-0', readiness ? VERDICT_META[readiness.verdict].className : 'text-primary')} />
      </div>
      {isLoading ? (
        <div className="h-8 w-32 rounded bg-muted/50 animate-pulse" />
      ) : next ? (
        <>
          <div className="text-2xl font-bold">{formatDate(next.targetDate) ?? 'No target date'}</div>
          <p className="text-xs text-muted-foreground">
            {next.milestoneCount} milestone{next.milestoneCount === 1 ? '' : 's'} •{' '}
            {readiness ? (
              <span className={VERDICT_META[readiness.verdict].className}>{readiness.score}% readiness</span>
            ) : (
              'checking readiness…'
            )}
            {remaining !== null && (remaining < 0 ? ` • ${Math.abs(remaining)}d overdue` : ` • ${remaining}d left`)}
          </p>
        </>
      ) : (
        <>
          <div className="text-2xl font-bold text-muted-foreground">—</div>
          <p className="text-xs text-muted-foreground">Create a release in Releases &amp; Milestones.</p>
        </>
      )}
    </button>
  );
}
