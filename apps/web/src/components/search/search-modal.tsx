'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Search, Loader2, Sparkles, MessageSquare, CornerDownLeft, Hash, SearchX } from 'lucide-react';
import { api, IssueSearchResult } from '@/lib/api';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { IssueTypeBadge, IssuePriorityBadge, IssueStatusBadge } from '../issues/badge-helpers';
import { cn } from '@/lib/utils';

const SEARCH_DEBOUNCE_MS = 200;
const RESULT_LIMIT = 10;

interface SearchModalProps {
  projectId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectIssue: (issueKey: string) => void;
}

/**
 * Opens search with "/" from anywhere except while typing in a field.
 */
export function useSearchShortcut(onOpen: () => void) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;

      const target = e.target as HTMLElement | null;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        Boolean(target?.isContentEditable);
      if (isTyping) return;

      e.preventDefault();
      onOpen();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpen]);
}

export function SearchModal({ projectId, isOpen, onOpenChange, onSelectIssue }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const debouncedQuery = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);

  const { data, isFetching, isError, error } = useQuery({
    queryKey: ['search', projectId, debouncedQuery],
    queryFn: ({ signal }) => api.searchIssues(projectId, debouncedQuery, { limit: RESULT_LIMIT, signal }),
    enabled: isOpen && debouncedQuery.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const results = debouncedQuery.length > 0 ? (data?.results ?? []) : [];
  const isSettling = query.trim() !== debouncedQuery || isFetching;

  // Reset state each time the modal opens
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    setActiveIndex(0);
  }, [debouncedQuery]);

  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    active?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const openResult = (result: IssueSearchResult) => {
    onOpenChange(false);
    onSelectIssue(result.issueKey);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = results[activeIndex];
      if (selected) openResult(selected);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 rounded-xl border border-border bg-card shadow-2xl overflow-hidden data-[state=open]:animate-fade-in focus:outline-none"
        >
          <Dialog.Title className="sr-only">Search issues</Dialog.Title>

          {/* Query input */}
          <div className="flex items-center gap-3 px-4 h-14 border-b border-border">
            {isSettling && debouncedQuery.length > 0 ? (
              <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
            ) : (
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search by keyword, meaning, or key (e.g. PAY-12)…"
              aria-label="Search issues"
              aria-controls="search-results"
              aria-activedescendant={results[activeIndex] ? `search-result-${results[activeIndex].id}` : undefined}
              className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
            />
            <kbd className="text-[10px] bg-background px-1.5 py-0.5 rounded border border-border font-mono text-muted-foreground">
              esc
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-[60vh] overflow-y-auto">
            {debouncedQuery.length === 0 ? (
              <div className="px-6 py-10 text-center space-y-2">
                <Sparkles className="h-6 w-6 text-primary mx-auto" />
                <p className="text-sm font-medium">Search issues and discussions</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Matches titles, descriptions and comments by keyword, and finds related issues by meaning even when
                  they use different words.
                </p>
              </div>
            ) : isError ? (
              <div className="px-6 py-10 text-center text-xs text-destructive">
                Search failed: {error instanceof Error ? error.message : 'Unknown error'}
              </div>
            ) : results.length === 0 && !isSettling ? (
              <div className="px-6 py-10 text-center space-y-2">
                <SearchX className="h-6 w-6 text-muted-foreground mx-auto" />
                <p className="text-sm font-medium">No matching issues</p>
                <p className="text-xs text-muted-foreground">Try different wording or an issue key.</p>
              </div>
            ) : (
              <ul id="search-results" ref={listRef} role="listbox" className="p-2 space-y-0.5">
                {results.map((result, index) => (
                  <SearchResultRow
                    key={result.id}
                    result={result}
                    index={index}
                    isActive={index === activeIndex}
                    onHover={() => setActiveIndex(index)}
                    onSelect={() => openResult(result)}
                  />
                ))}
              </ul>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-4 px-4 py-2 border-t border-border bg-muted/20 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <kbd className="px-1 rounded border border-border bg-background font-mono">↑</kbd>
                <kbd className="px-1 rounded border border-border bg-background font-mono">↓</kbd>
                navigate
              </span>
              <span className="inline-flex items-center gap-1">
                <kbd className="px-1 rounded border border-border bg-background font-mono">
                  <CornerDownLeft className="h-2.5 w-2.5 inline" />
                </kbd>
                open
              </span>
            </div>
            {data && debouncedQuery.length > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <span
                  className={cn('h-1.5 w-1.5 rounded-full', data.semanticEnabled ? 'bg-emerald-400' : 'bg-zinc-500')}
                />
                {data.semanticEnabled ? 'Keyword + semantic' : 'Keyword only'}
              </span>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function SearchResultRow({
  result,
  index,
  isActive,
  onHover,
  onSelect,
}: {
  result: IssueSearchResult;
  index: number;
  isActive: boolean;
  onHover: () => void;
  onSelect: () => void;
}) {
  return (
    <li
      id={`search-result-${result.id}`}
      data-index={index}
      role="option"
      aria-selected={isActive}
      onMouseMove={onHover}
      onClick={onSelect}
      className={cn(
        'px-3 py-2.5 rounded-lg cursor-pointer transition-colors space-y-1.5',
        isActive ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-muted/50',
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="font-mono text-[11px] font-semibold text-muted-foreground shrink-0">{result.issueKey}</span>
        <span className="text-sm font-medium truncate flex-1">{result.title}</span>
        {result.matchSources.includes('KEY') && (
          <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
            <Hash className="h-2.5 w-2.5" />
            Key
          </span>
        )}
        {result.similarity !== null && (
          <span
            title="Semantic similarity"
            className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 shrink-0"
          >
            <Sparkles className="h-2.5 w-2.5" />
            {Math.round(result.similarity * 100)}%
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <IssueTypeBadge type={result.type} className="text-[10px] py-0" />
        <IssueStatusBadge status={result.status} className="text-[10px] py-0" />
        <IssuePriorityBadge priority={result.priority} className="text-[10px] py-0" />
        {result.assignee && (
          <span className="text-[11px] text-muted-foreground truncate">{result.assignee.name}</span>
        )}
      </div>

      {result.matchedComment && (
        <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground leading-relaxed">
          <MessageSquare className="h-3 w-3 mt-0.5 shrink-0" />
          <span className="line-clamp-2">{result.matchedComment.snippet}</span>
        </p>
      )}
    </li>
  );
}
