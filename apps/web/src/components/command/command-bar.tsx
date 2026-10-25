'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Sparkles,
  ArrowLeft,
  ArrowRight,
  CornerDownLeft,
  LayoutDashboard,
  ListTodo,
  Kanban,
  Calendar,
  Rocket,
  Plus,
  Bot,
  Activity,
  Search,
  Loader2,
  AlertTriangle,
  CircleDot,
} from 'lucide-react';
import { api, CommandBarResponse, IssueSearchResult } from '@/lib/api';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { GenerativeBlockRenderer } from '../ai/primitives/generative-block-renderer';
import { GenerativeMarkdown } from '../ai/generative-markdown';
import { cn } from '@/lib/utils';

export type CommandBarTab = 'overview' | 'issues' | 'board' | 'sprints' | 'releases';

type CommandItem =
  | { kind: 'ask'; id: string; label: string; prompt: string }
  | { kind: 'suggestion'; id: string; label: string; prompt: string }
  | { kind: 'action'; id: string; label: string; hint: string; icon: React.ComponentType<{ className?: string }>; keywords: string; run: () => void }
  | { kind: 'issue'; id: string; issue: IssueSearchResult };

const SUGGESTIONS = [
  'Which projects are at risk?',
  'Show all blocked issues across projects',
  'Show my open issues',
  'What are the top risks right now?',
];

interface CommandBarProps {
  projectId: string;
  projectKey: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (tab: CommandBarTab) => void;
  onSelectIssue: (issueKey: string) => void;
  onCreateIssue: () => void;
  onOpenCopilot: () => void;
}

/** Cmd/Ctrl+K opens the global command bar from anywhere (ADR-010 reserved it for Phase 7). */
export function useCommandBarShortcut(onOpen: () => void) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'k' || !(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
      e.preventDefault();
      onOpen();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpen]);
}

/**
 * Global AI Command Bar: navigation and actions, live issue search, and an "Ask AI" row that
 * answers with generative widgets (health, risk reports, cross-project issue tables).
 */
export function CommandBar({
  projectId,
  projectKey,
  open,
  onOpenChange,
  onNavigate,
  onSelectIssue,
  onCreateIssue,
  onOpenCopilot,
}: CommandBarProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [answer, setAnswer] = useState<{ prompt: string; response: CommandBarResponse } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const trimmed = query.trim();
  const debounced = useDebouncedValue(trimmed, 200);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setAnswer(null);
    setActiveIndex(0);
  }, [open]);

  const ask = useMutation({
    mutationFn: (prompt: string) => api.runCommand({ prompt, projectId }),
    onSuccess: (response, prompt) => setAnswer({ prompt, response }),
  });

  const { data: search, isFetching: searching } = useQuery({
    queryKey: ['command-search', projectId, debounced],
    queryFn: ({ signal }) => api.searchIssues(projectId, debounced, { limit: 6, signal }),
    enabled: open && !answer && debounced.length >= 2,
    staleTime: 15_000,
  });

  const close = () => onOpenChange(false);
  const runAndClose = (fn: () => void) => () => {
    fn();
    close();
  };

  const actions = useMemo<Extract<CommandItem, { kind: 'action' }>[]>(
    () => [
      { kind: 'action', id: 'go-overview', label: 'Go to Overview', hint: 'Navigate', icon: LayoutDashboard, keywords: 'home dashboard overview', run: runAndClose(() => onNavigate('overview')) },
      { kind: 'action', id: 'go-issues', label: 'Go to Issues', hint: 'Navigate', icon: ListTodo, keywords: 'issues table list backlog', run: runAndClose(() => onNavigate('issues')) },
      { kind: 'action', id: 'go-board', label: 'Go to Active Board', hint: 'Navigate', icon: Kanban, keywords: 'board kanban sprint', run: runAndClose(() => onNavigate('board')) },
      { kind: 'action', id: 'go-sprints', label: 'Go to Backlog & Sprints', hint: 'Navigate', icon: Calendar, keywords: 'sprints backlog planning velocity', run: runAndClose(() => onNavigate('sprints')) },
      { kind: 'action', id: 'go-releases', label: 'Go to Releases & Milestones', hint: 'Navigate', icon: Rocket, keywords: 'releases milestones readiness notes', run: runAndClose(() => onNavigate('releases')) },
      { kind: 'action', id: 'create-issue', label: 'Create issue', hint: 'Action', icon: Plus, keywords: 'new issue bug task story create add', run: runAndClose(onCreateIssue) },
      { kind: 'action', id: 'open-copilot', label: 'Open AI Copilot', hint: 'Action', icon: Bot, keywords: 'copilot chat ai assistant', run: runAndClose(onOpenCopilot) },
      {
        kind: 'action',
        id: 'project-health',
        label: `Project health for ${projectKey}`,
        hint: 'AI',
        icon: Activity,
        keywords: 'health status risk score',
        run: () => ask.mutate(`How is ${projectKey} doing?`),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectKey, onNavigate, onCreateIssue, onOpenCopilot],
  );

  const items = useMemo<CommandItem[]>(() => {
    const needle = trimmed.toLowerCase();
    const list: CommandItem[] = [];
    if (trimmed.length >= 2) list.push({ kind: 'ask', id: 'ask', label: trimmed, prompt: trimmed });
    if (!trimmed) {
      SUGGESTIONS.forEach((s, i) => list.push({ kind: 'suggestion', id: `suggestion-${i}`, label: s, prompt: s }));
    }
    list.push(...actions.filter((a) => !needle || `${a.label} ${a.keywords}`.toLowerCase().includes(needle)));
    if (trimmed.length >= 2) {
      for (const issue of search?.results ?? []) list.push({ kind: 'issue', id: `issue-${issue.id}`, issue });
    }
    return list;
  }, [trimmed, actions, search]);

  useEffect(() => setActiveIndex(0), [trimmed]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const execute = (item: CommandItem) => {
    switch (item.kind) {
      case 'ask':
      case 'suggestion':
        setQuery(item.prompt);
        ask.mutate(item.prompt);
        break;
      case 'action':
        item.run();
        break;
      case 'issue':
        close();
        onSelectIssue(item.issue.issueKey);
        break;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (answer || ask.isPending) {
      if (e.key === 'Enter' && trimmed && trimmed !== answer?.prompt) {
        e.preventDefault();
        ask.mutate(trimmed);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = items[activeIndex];
      if (item) execute(item);
    }
  };

  const backToPalette = () => {
    setAnswer(null);
    ask.reset();
    inputRef.current?.focus();
  };

  let index = -1;
  const row = (item: CommandItem, content: React.ReactNode) => {
    index += 1;
    const i = index;
    return (
      <button
        key={item.id}
        type="button"
        data-index={i}
        onMouseMove={() => setActiveIndex(i)}
        onClick={() => execute(item)}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm transition-colors',
          activeIndex === i ? 'bg-primary/10 text-foreground' : 'text-foreground/90 hover:bg-muted/50',
        )}
      >
        {content}
        {activeIndex === i && <CornerDownLeft className="h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0" />}
      </button>
    );
  };

  const askItems = items.filter((i) => i.kind === 'ask' || i.kind === 'suggestion');
  const actionItems = items.filter((i): i is Extract<CommandItem, { kind: 'action' }> => i.kind === 'action');
  const issueItems = items.filter((i): i is Extract<CommandItem, { kind: 'issue' }> => i.kind === 'issue');

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-fade-in" />
        <Dialog.Content
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
          className="fixed left-1/2 top-[10vh] z-50 w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 rounded-2xl border border-border bg-card shadow-2xl data-[state=open]:animate-fade-in focus:outline-none overflow-hidden"
        >
          <Dialog.Title className="sr-only">Command bar</Dialog.Title>
          <Dialog.Description className="sr-only">Navigate, search issues, or ask AI about your projects</Dialog.Description>

          <div className="flex items-center gap-3 px-4 border-b border-border">
            {answer ? (
              <button type="button" onClick={backToPalette} title="Back" className="p-1 -ml-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted">
                <ArrowLeft className="h-4 w-4" />
              </button>
            ) : (
              <Sparkles className="h-4 w-4 text-primary shrink-0" />
            )}
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (answer) setAnswer(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ask AI, search issues, or jump to…"
              aria-label="Command"
              className="flex-1 h-14 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground"
            />
            {(ask.isPending || searching) && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />}
            <kbd className="text-[10px] bg-background px-1.5 py-0.5 rounded border border-border font-mono text-muted-foreground">esc</kbd>
          </div>

          <div ref={listRef} className="max-h-[62vh] overflow-y-auto">
            {ask.isPending ? (
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse" />
                  Routing your request and running project tools…
                </div>
                <div className="h-20 rounded-lg bg-muted/30 animate-pulse" />
                <div className="h-32 rounded-lg bg-muted/20 animate-pulse" />
              </div>
            ) : ask.error ? (
              <div className="m-4 flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{ask.error instanceof Error ? ask.error.message : 'The command failed.'}</span>
              </div>
            ) : answer ? (
              <div className="p-4 space-y-3 animate-fade-in">
                <div className="flex items-start gap-2.5">
                  <div className="h-6 w-6 rounded-md bg-primary/15 text-primary flex items-center justify-center shrink-0">
                    <Sparkles className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <GenerativeMarkdown
                      content={answer.response.reply}
                      className="text-sm"
                      onOpenIssue={(key) => {
                        close();
                        onSelectIssue(key);
                      }}
                    />
                    <p className="text-[10px] font-mono text-muted-foreground/80">
                      {answer.response.intent.replace('_', ' ')} · {answer.response.scope.join(', ') || 'no project'} · {answer.response.modelUsed}
                    </p>
                  </div>
                </div>
                {answer.response.blocks.map((block, i) => (
                  <GenerativeBlockRenderer
                    key={i}
                    block={block}
                    projectId={projectId}
                    onOpenIssueInDrawer={(key) => {
                      close();
                      onSelectIssue(key);
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="p-2 space-y-2">
                {askItems.length > 0 && (
                  <Section title={trimmed ? 'Ask AI' : 'Try asking'}>
                    {askItems.map((item) =>
                      row(
                        item,
                        <>
                          <Sparkles className="h-4 w-4 text-primary shrink-0" />
                          <span className="truncate">
                            {item.kind === 'ask' ? (
                              <>
                                Ask AI: <span className="font-medium">&ldquo;{item.label}&rdquo;</span>
                              </>
                            ) : (
                              item.label
                            )}
                          </span>
                        </>,
                      ),
                    )}
                  </Section>
                )}

                {actionItems.length > 0 && (
                  <Section title="Actions">
                    {actionItems.map((item) =>
                      row(
                        item,
                        <>
                          <item.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="truncate">{item.label}</span>
                          <span className="text-[10px] text-muted-foreground ml-2 shrink-0">{item.hint}</span>
                        </>,
                      ),
                    )}
                  </Section>
                )}

                {issueItems.length > 0 && (
                  <Section title="Issues">
                    {issueItems.map((item) =>
                      row(
                        item,
                        <>
                          <CircleDot className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="font-mono text-[11px] font-semibold text-muted-foreground w-14 shrink-0">{item.issue.issueKey}</span>
                          <span className="truncate">{item.issue.title}</span>
                        </>,
                      ),
                    )}
                  </Section>
                )}

                {trimmed.length >= 2 && !searching && issueItems.length === 0 && actionItems.length === 0 && (
                  <p className="px-3 py-2 text-xs text-muted-foreground flex items-center gap-1.5">
                    <Search className="h-3.5 w-3.5" />
                    No matching issues or actions. Press Enter to ask AI.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 px-4 py-2 border-t border-border bg-muted/20 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="font-mono">↑↓</kbd> navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="font-mono">↵</kbd> {answer ? 'ask again' : 'select'}
              </span>
            </span>
            <span className="flex items-center gap-1">
              Answers use deterministic project tools
              <ArrowRight className="h-3 w-3" />
              AI explains
            </span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="px-3 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}
