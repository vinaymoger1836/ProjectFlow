'use client';

import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, X } from 'lucide-react';
import { api } from '@/lib/api';
import { ProjectHealthCard, TrendSparkline } from './project-health-card';
import { HEALTH_STATUS_META } from './health-utils';
import { cn } from '@/lib/utils';

/**
 * Overview tile for the deterministic project health; opens the full health dashboard card.
 */
export function HealthStatusCard({ projectId, onOpenIssue }: { projectId: string; onOpenIssue: (issueKey: string) => void }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: report, isLoading } = useQuery({
    queryKey: ['project-health', projectId],
    queryFn: () => api.getProjectHealth(projectId),
    staleTime: 30_000,
  });

  const recompute = useMutation({
    mutationFn: () => api.recomputeProjectHealth(projectId),
    onSuccess: (fresh) => queryClient.setQueryData(['project-health', projectId], fresh),
  });

  const meta = report ? HEALTH_STATUS_META[report.status] : null;
  const top = report?.factors.filter((f) => f.severity !== 'info').slice(0, 2) ?? [];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!report}
        className="p-5 rounded-lg border border-border bg-card shadow-sm space-y-2 text-left hover:border-primary/40 transition-colors"
      >
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Health Status</span>
          <Activity className={cn('h-4 w-4', meta?.text ?? 'text-primary')} />
        </div>
        {isLoading || !report || !meta ? (
          <div className="h-8 w-32 rounded bg-muted/50 animate-pulse" />
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <div className={cn('text-2xl font-bold tracking-tight', meta.text)}>
                {meta.label.toUpperCase()}
                <span className="ml-2 text-sm font-mono text-muted-foreground">{report.score}</span>
              </div>
              <TrendSparkline points={report.trend} stroke={meta.stroke} width={72} height={24} />
            </div>
            <p className="text-xs text-muted-foreground line-clamp-1">
              {top.length > 0 ? top.map((f) => f.label).join(' • ') : 'No active risk factors'}
            </p>
          </>
        )}
      </button>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-fade-in" />
          <Dialog.Content className="fixed left-1/2 top-[8vh] z-50 w-[calc(100vw-2rem)] max-w-2xl max-h-[84vh] overflow-y-auto -translate-x-1/2 rounded-xl data-[state=open]:animate-fade-in focus:outline-none">
            <Dialog.Title className="sr-only">Project health</Dialog.Title>
            <Dialog.Description className="sr-only">Deterministic project health evaluation and its drivers</Dialog.Description>
            <Dialog.Close className="absolute right-3 top-3 z-10 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Dialog.Close>
            {report && (
              <ProjectHealthCard
                report={report}
                onRecompute={() => recompute.mutate()}
                isRecomputing={recompute.isPending}
                onOpenIssue={(key) => {
                  setOpen(false);
                  onOpenIssue(key);
                }}
              />
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
