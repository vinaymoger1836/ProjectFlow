'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Loader2, ArrowUpRight } from 'lucide-react';
import { api, SimilarIssue } from '@/lib/api';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { IssueStatusBadge } from '../issues/badge-helpers';

const DRAFT_DEBOUNCE_MS = 600;
const MIN_TITLE_LENGTH = 3;

interface DuplicateIssueWarningProps {
  projectId: string;
  title: string;
  description?: string;
  onOpenIssue?: (issueKey: string) => void;
}

/**
 * Background duplicate check for an unsaved issue draft. Never blocks creation;
 * re-checks (debounced) as the draft is edited.
 */
export function DuplicateIssueWarning({ projectId, title, description, onOpenIssue }: DuplicateIssueWarningProps) {
  // Debounce primitives, not an object literal, so the debounced value is referentially stable
  const draft = {
    title: useDebouncedValue(title.trim(), DRAFT_DEBOUNCE_MS),
    description: useDebouncedValue(description?.trim() ?? '', DRAFT_DEBOUNCE_MS),
  };

  const { data, isFetching } = useQuery({
    queryKey: ['similar-issues', projectId, draft.title, draft.description],
    queryFn: ({ signal }) =>
      api.findSimilarIssues(
        projectId,
        { title: draft.title, description: draft.description || undefined },
        signal,
      ),
    enabled: draft.title.length >= MIN_TITLE_LENGTH,
    staleTime: 60_000,
    retry: false,
  });

  if (draft.title.length < MIN_TITLE_LENGTH) return null;

  if (!data) {
    return isFetching ? (
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground px-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Checking for similar issues…</span>
      </div>
    ) : null;
  }

  // Semantic search not configured or temporarily unavailable: stay silent rather than imply "no duplicates"
  if (!data.semanticEnabled) return null;

  if (data.matches.length === 0) {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground px-1">
        <CheckCircle2 className="h-3 w-3 text-emerald-400" />
        <span>No similar issues found in this project</span>
      </div>
    );
  }

  const [top, ...others] = data.matches;

  return (
    <div
      role="status"
      className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 space-y-2 animate-fade-in"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-400 mt-0.5 shrink-0" />
        <div className="space-y-0.5 min-w-0">
          <p className="text-[11px] font-semibold text-amber-300">
            Possible duplicate of{' '}
            <span className="font-mono">{top.issueKey}</span> ({formatMatch(top)} match)
          </p>
          <p className="text-[11px] text-foreground/80 truncate">{top.title}</p>
        </div>
      </div>

      <ul className="space-y-1">
        {[top, ...others].map((match) => (
          <li key={match.id}>
            <button
              type="button"
              onClick={() => onOpenIssue?.(match.issueKey)}
              disabled={!onOpenIssue}
              className="w-full flex items-center gap-2 px-2 py-1 rounded text-left text-[11px] hover:bg-amber-500/10 disabled:cursor-default transition-colors group"
            >
              <span className="font-mono font-semibold text-muted-foreground shrink-0">{match.issueKey}</span>
              <span className="truncate flex-1">{match.title}</span>
              <IssueStatusBadge status={match.status} className="text-[10px] py-0 shrink-0" />
              <span className="font-mono text-amber-300 shrink-0">{formatMatch(match)}</span>
              {onOpenIssue && (
                <ArrowUpRight className="h-3 w-3 text-muted-foreground group-hover:text-foreground shrink-0" />
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatMatch(match: SimilarIssue): string {
  return `${Math.round(match.similarity * 100)}%`;
}
