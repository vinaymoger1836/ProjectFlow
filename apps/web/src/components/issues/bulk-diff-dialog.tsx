'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, GitCompareArrows, Loader2 } from 'lucide-react';
import { api, BulkChangeField, BulkChangePreview, BulkChangeSource, BulkIssueOperation } from '@/lib/api';
import { DialogShell, ErrorNote, PrimaryButton, CancelButton } from '../common/dialog-primitives';
import { IssueTypeBadge } from './badge-helpers';
import { cn } from '@/lib/utils';

const FIELD_LABEL: Record<BulkChangeField, string> = {
  status: 'Status',
  priority: 'Priority',
  assigneeId: 'Assignee',
  sprintId: 'Sprint',
  milestoneId: 'Milestone',
  releaseId: 'Release',
};

interface BulkDiffDialogProps {
  projectId: string;
  open: boolean;
  title: string;
  description?: string;
  operations: BulkIssueOperation[];
  source?: BulkChangeSource;
  onOpenChange: (open: boolean) => void;
  onApplied?: (result: BulkChangePreview) => void;
}

/**
 * Human-in-the-loop preview for multi-issue changes: the server computes a per-issue
 * before/after diff (dry run), the user deselects anything unwanted, then applies.
 */
export function BulkDiffDialog({
  projectId,
  open,
  title,
  description,
  operations,
  source = 'MANUAL',
  onOpenChange,
  onApplied,
}: BulkDiffDialogProps) {
  const queryClient = useQueryClient();
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [appliedCount, setAppliedCount] = useState<number | null>(null);
  const operationsKey = useMemo(() => JSON.stringify(operations), [operations]);

  useEffect(() => {
    if (!open) return;
    setExcluded(new Set());
    setAppliedCount(null);
  }, [open, operationsKey]);

  const preview = useQuery({
    queryKey: ['bulk-preview', projectId, operationsKey],
    queryFn: () => api.bulkUpdateIssues(projectId, { operations, dryRun: true, source }),
    enabled: open && operations.length > 0,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });

  const items = preview.data?.items ?? [];
  const selectedOperations = operations.filter(
    (op) => !excluded.has(op.issueId) && items.some((item) => item.issueId === op.issueId),
  );

  const applyMutation = useMutation({
    mutationFn: () => api.bulkUpdateIssues(projectId, { operations: selectedOperations, source }),
    onSuccess: async (result) => {
      setAppliedCount(result.items.length);
      // Close only after lists have refetched so the page never shows a half-applied state
      await Promise.all([
        ...['issues', 'releases', 'milestones', 'sprints'].map((key) =>
          queryClient.invalidateQueries({ queryKey: [key, projectId] }),
        ),
        queryClient.invalidateQueries({ queryKey: ['issue'] }),
      ]);
      onApplied?.(result);
      setTimeout(() => onOpenChange(false), 600);
    },
  });

  const toggle = (issueId: string) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(issueId)) next.delete(issueId);
      else next.add(issueId);
      return next;
    });

  return (
    <DialogShell
      open={open}
      onOpenChange={(next) => {
        if (!next) applyMutation.reset();
        onOpenChange(next);
      }}
      size="lg"
      icon={<GitCompareArrows className="h-4 w-4" />}
      title={title}
      description={description ?? 'Review every change before it is applied. Uncheck issues to leave them as they are.'}
      footer={
        appliedCount !== null ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 animate-fade-in">
            <CheckCircle2 className="h-4 w-4" />
            Updated {appliedCount} issue{appliedCount === 1 ? '' : 's'}
          </span>
        ) : (
          <>
            <CancelButton onClick={() => onOpenChange(false)} />
            <PrimaryButton
              pending={applyMutation.isPending}
              disabled={selectedOperations.length === 0 || preview.isLoading}
              onClick={() => applyMutation.mutate()}
            >
              Apply to {selectedOperations.length} issue{selectedOperations.length === 1 ? '' : 's'}
            </PrimaryButton>
          </>
        )
      }
    >
      {preview.isLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-6 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" />
          Computing changes…
        </div>
      ) : preview.error ? (
        <ErrorNote error={preview.error} />
      ) : (
        <>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              <span className="font-semibold text-foreground">{items.length}</span> issue{items.length === 1 ? '' : 's'} will change
            </span>
            {(preview.data?.unchangedIssueKeys.length ?? 0) > 0 && (
              <span title={preview.data?.unchangedIssueKeys.join(', ')}>
                · {preview.data?.unchangedIssueKeys.length} already up to date
              </span>
            )}
          </div>

          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">Nothing to change: every issue already matches.</p>
          ) : (
            <ul className="space-y-2">
              {items.map((item) => {
                const included = !excluded.has(item.issueId);
                return (
                  <li
                    key={item.issueId}
                    className={cn(
                      'rounded-lg border p-3 transition-colors',
                      included ? 'border-border bg-muted/20' : 'border-border/50 bg-transparent opacity-50',
                    )}
                  >
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={included}
                        onChange={() => toggle(item.issueId)}
                        disabled={applyMutation.isPending || appliedCount !== null}
                        className="accent-[hsl(var(--primary))]"
                      />
                      <IssueTypeBadge type={item.type} className="text-[10px] py-0 px-1.5" />
                      <span className="font-mono text-[11px] font-semibold text-muted-foreground">{item.issueKey}</span>
                      <span className="text-sm truncate">{item.title}</span>
                    </label>
                    <div className="mt-2 pl-6 space-y-1">
                      {item.diffs.map((diff) => (
                        <div key={diff.field} className="flex items-center gap-2 text-xs">
                          <span className="w-20 shrink-0 text-muted-foreground">{FIELD_LABEL[diff.field]}</span>
                          <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 line-through decoration-red-400/60">
                            {diff.fromLabel}
                          </span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-medium">
                            {diff.toLabel}
                          </span>
                        </div>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      <ErrorNote error={applyMutation.error} />
    </DialogShell>
  );
}
