'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GitBranch, Plus, X, Loader2, Ban, Link2, Copy as CopyIcon, ShieldAlert } from 'lucide-react';
import { api, IssueDependencyLink, IssueLinkKind } from '@/lib/api';
import { IssueStatusBadge } from './badge-helpers';
import { cn } from '@/lib/utils';

const KIND_META: Record<IssueLinkKind, { label: string; icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  BLOCKED_BY: { label: 'Blocked by', icon: ShieldAlert, tone: 'text-red-400' },
  BLOCKS: { label: 'Blocks', icon: Ban, tone: 'text-amber-400' },
  RELATES_TO: { label: 'Relates to', icon: Link2, tone: 'text-sky-400' },
  DUPLICATES: { label: 'Duplicates', icon: CopyIcon, tone: 'text-muted-foreground' },
  DUPLICATED_BY: { label: 'Duplicated by', icon: CopyIcon, tone: 'text-muted-foreground' },
};

const KIND_ORDER: IssueLinkKind[] = ['BLOCKED_BY', 'BLOCKS', 'RELATES_TO', 'DUPLICATES', 'DUPLICATED_BY'];
const RESOLVED = new Set(['DONE', 'CANCELLED']);

interface IssueDependenciesPanelProps {
  issueId: string;
  issueKey: string;
  onSelectIssue?: (issueKey: string) => void;
}

export function IssueDependenciesPanel({ issueId, issueKey, onSelectIssue }: IssueDependenciesPanelProps) {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [kind, setKind] = useState<IssueLinkKind>('BLOCKED_BY');
  const [target, setTarget] = useState('');

  const queryKey = ['issue-dependencies', issueId];
  const { data: links = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => api.listDependencies(issueId),
  });

  const invalidate = (otherIssueId?: string) => {
    queryClient.invalidateQueries({ queryKey });
    if (otherIssueId) queryClient.invalidateQueries({ queryKey: ['issue-dependencies', otherIssueId] });
    queryClient.invalidateQueries({ queryKey: ['issue-activity', issueId] });
    queryClient.invalidateQueries({ queryKey: ['releases'] });
  };

  const addMutation = useMutation({
    mutationFn: () => api.addDependency(issueId, { kind, targetIssue: target.trim().toUpperCase() }),
    onSuccess: (link) => {
      setTarget('');
      setIsAdding(false);
      invalidate(link.issue.id);
    },
  });

  const removeMutation = useMutation({
    mutationFn: (link: IssueDependencyLink) => api.removeDependency(link.id),
    onSuccess: (_, link) => invalidate(link.issue.id),
  });

  const grouped = KIND_ORDER.map((k) => ({ kind: k, items: links.filter((l) => l.kind === k) })).filter(
    (g) => g.items.length > 0,
  );
  const openBlockers = links.filter((l) => l.kind === 'BLOCKED_BY' && !RESOLVED.has(l.issue.status)).length;

  return (
    <div className="space-y-3 p-4 rounded-xl bg-card border border-border/80 shadow-2xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-foreground/90">Dependencies ({links.length})</span>
          {openBlockers > 0 && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/25">
              {openBlockers} open blocker{openBlockers === 1 ? '' : 's'}
            </span>
          )}
        </div>
        {!isAdding && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-muted hover:bg-muted/80 text-foreground font-medium border border-border transition-colors"
          >
            <Plus className="h-3 w-3" />
            <span>Link</span>
          </button>
        )}
      </div>

      {isAdding && (
        <form
          className="flex flex-wrap items-center gap-2 animate-fade-in"
          onSubmit={(e) => {
            e.preventDefault();
            if (target.trim()) addMutation.mutate();
          }}
        >
          <span className="font-mono text-[11px] text-muted-foreground font-semibold">{issueKey}</span>
          <select
            aria-label="Link type"
            value={kind}
            onChange={(e) => setKind(e.target.value as IssueLinkKind)}
            className="text-xs bg-background border border-input rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {KIND_ORDER.map((k) => (
              <option key={k} value={k}>
                {KIND_META[k].label.toLowerCase()}
              </option>
            ))}
          </select>
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setIsAdding(false)}
            placeholder="Issue key, e.g. PAY-6"
            autoFocus
            className="flex-1 min-w-[140px] px-3 py-1.5 text-xs bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-primary font-mono uppercase placeholder:normal-case placeholder:font-sans"
          />
          <button
            type="submit"
            disabled={!target.trim() || addMutation.isPending}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 shadow-2xs"
          >
            {addMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
            Add
          </button>
          <button
            type="button"
            onClick={() => {
              setIsAdding(false);
              addMutation.reset();
            }}
            className="px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          {addMutation.error && (
            <p className="w-full text-[11px] text-destructive">
              {addMutation.error instanceof Error ? addMutation.error.message : 'Could not add link.'}
            </p>
          )}
        </form>
      )}

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading dependencies...</p>
      ) : grouped.length === 0 ? (
        !isAdding && (
          <p className="text-xs text-muted-foreground italic py-1">
            No linked issues. Link blockers so release readiness can flag them.
          </p>
        )
      ) : (
        <div className="space-y-2.5">
          {grouped.map(({ kind: groupKind, items }) => {
            const meta = KIND_META[groupKind];
            const Icon = meta.icon;
            return (
              <div key={groupKind} className="space-y-1">
                <div className={cn('flex items-center gap-1.5 text-[11px] font-semibold', meta.tone)}>
                  <Icon className="h-3 w-3" />
                  {meta.label}
                </div>
                {items.map((link) => {
                  const resolved = RESOLVED.has(link.issue.status);
                  return (
                    <div
                      key={link.id}
                      className="flex items-center justify-between gap-2 p-2 rounded-md hover:bg-muted/40 border border-transparent hover:border-border/60 transition-colors text-xs group"
                    >
                      <button
                        type="button"
                        onClick={() => onSelectIssue?.(link.issue.issueKey)}
                        className="flex items-center gap-2 min-w-0 text-left"
                      >
                        <span className="font-mono text-[11px] font-semibold text-muted-foreground shrink-0 group-hover:text-primary">
                          {link.issue.issueKey}
                        </span>
                        <span className={cn('truncate group-hover:text-primary', resolved && 'line-through text-muted-foreground')}>
                          {link.issue.title}
                        </span>
                      </button>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <IssueStatusBadge status={link.issue.status} className="text-[10px] py-0" />
                        <button
                          type="button"
                          onClick={() => removeMutation.mutate(link)}
                          disabled={removeMutation.isPending}
                          title="Remove link"
                          className="p-1 rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
