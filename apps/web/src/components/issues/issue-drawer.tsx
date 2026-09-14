'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Copy,
  Check,
  Calendar,
  User,
  MessageSquare,
  Send,
  Trash2,
  Clock,
  Sparkles,
  CheckSquare,
  Square,
  Plus,
  History,
  Bot,
  ChevronRight,
  ArrowRight,
  Loader2,
  CheckCircle2,
  Paperclip,
  ShieldAlert,
} from 'lucide-react';
import { api, IssueCommentItem, ActivityItem } from '@/lib/api';
import { IssueTypeBadge, IssuePriorityBadge } from './badge-helpers';
import { IssuePriority, IssueType } from '@projectflow/types';
import { cn } from '@/lib/utils';

interface IssueDrawerProps {
  issueIdentifier: string | null;
  onClose: () => void;
}

export function IssueDrawer({ issueIdentifier, onClose }: IssueDrawerProps) {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editedDesc, setEditedDesc] = useState('');
  const [activeDiscussionTab, setActiveDiscussionTab] = useState<'comments' | 'activity'>('comments');

  // Subtask local states
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [isAiSuggestingSubtasks, setIsAiSuggestingSubtasks] = useState(false);
  const [aiSubtaskSuggestions, setAiSubtaskSuggestions] = useState<
    { title: string; priority: string; estimateHours: number }[] | null
  >(null);

  // AI Discussion summary state
  const [isSummarizingThread, setIsSummarizingThread] = useState(false);
  const [aiSummary, setAiSummary] = useState<{
    summary: string;
    decisions: string[];
    nextSteps: string[];
    modelUsed: string;
  } | null>(null);

  // AI Triage state
  const [isTriaging, setIsTriaging] = useState(false);
  const [aiTriage, setAiTriage] = useState<{
    suggestedPriority: string;
    priorityReason: string;
    suggestedAssigneeId: string | null;
    suggestedAssigneeName: string;
    assigneeReason: string;
    modelUsed: string;
  } | null>(null);

  // Fetch issue details by UUID or human key (e.g. PAY-1)
  const {
    data: issue,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['issue', issueIdentifier],
    queryFn: () => (issueIdentifier ? api.getIssue(issueIdentifier) : null),
    enabled: !!issueIdentifier,
  });

  // Fetch comments
  const { data: comments = [], isLoading: isLoadingComments } = useQuery({
    queryKey: ['issue-comments', issue?.id],
    queryFn: () => (issue?.id ? api.listComments(issue.id) : []),
    enabled: !!issue?.id,
  });

  // Fetch subtasks
  const { data: subtasks = [], isLoading: isLoadingSubtasks } = useQuery({
    queryKey: ['issue-subtasks', issue?.id],
    queryFn: () => (issue?.id ? api.listSubtasks(issue.id) : []),
    enabled: !!issue?.id,
  });

  // Fetch activities
  const { data: activities = [], isLoading: isLoadingActivities } = useQuery({
    queryKey: ['issue-activity', issue?.id],
    queryFn: () => (issue?.id ? api.listActivities(issue.id) : []),
    enabled: !!issue?.id && activeDiscussionTab === 'activity',
  });

  // Fetch project members for assignee selection
  const { data: projectMembers = [] } = useQuery({
    queryKey: ['project-members', issue?.projectId],
    queryFn: () => (issue?.projectId ? api.listProjectMembers(issue.projectId) : []),
    enabled: !!issue?.projectId,
  });

  // Sync title and description state on load
  useEffect(() => {
    if (issue) {
      setEditedTitle(issue.title);
      setEditedDesc(issue.description || '');
    }
  }, [issue]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Mutations
  const updateMutation = useMutation({
    mutationFn: (payload: any) => {
      if (!issue?.id) throw new Error('Issue not found');
      return api.updateIssue(issue.id, payload);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['issue', issueIdentifier], updated);
      queryClient.setQueryData(['issue', updated.id], updated);
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      queryClient.invalidateQueries({ queryKey: ['issue-activity', issue?.id] });
    },
  });

  const commentMutation = useMutation({
    mutationFn: (content: string) => {
      if (!issue?.id) throw new Error('Issue not found');
      return api.addComment(issue.id, content);
    },
    onSuccess: (newCommentItem) => {
      setNewComment('');
      queryClient.setQueryData<IssueCommentItem[]>(['issue-comments', issue?.id], (old = []) => [
        ...old,
        newCommentItem,
      ]);
      queryClient.invalidateQueries({ queryKey: ['issue', issueIdentifier] });
      queryClient.invalidateQueries({ queryKey: ['issue-activity', issue?.id] });
    },
  });

  const createSubtaskMutation = useMutation({
    mutationFn: (title: string) => {
      if (!issue?.id) throw new Error('Issue not found');
      return api.createSubtask(issue.id, { title, priority: issue.priority });
    },
    onSuccess: () => {
      setNewSubtaskTitle('');
      setIsAddingSubtask(false);
      queryClient.invalidateQueries({ queryKey: ['issue-subtasks', issue?.id] });
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      queryClient.invalidateQueries({ queryKey: ['issue-activity', issue?.id] });
    },
  });

  const toggleSubtaskMutation = useMutation({
    mutationFn: ({ subtaskId, newStatus }: { subtaskId: string; newStatus: string }) => {
      return api.updateIssue(subtaskId, { status: newStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue-subtasks', issue?.id] });
      queryClient.invalidateQueries({ queryKey: ['issues'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!issue?.id) throw new Error('Issue not found');
      return api.deleteIssue(issue.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      onClose();
    },
  });

  if (!issueIdentifier) return null;

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('issue', issue?.issueKey || issueIdentifier);
      navigator.clipboard.writeText(url.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSaveTitle = () => {
    if (editedTitle.trim() && editedTitle !== issue?.title) {
      updateMutation.mutate({ title: editedTitle.trim() });
    }
    setIsEditingTitle(false);
  };

  const handleSaveDesc = () => {
    if (editedDesc !== issue?.description) {
      updateMutation.mutate({ description: editedDesc });
    }
    setIsEditingDesc(false);
  };

  // AI Handlers
  const handleSuggestSubtasks = async () => {
    if (!issue?.id) return;
    setIsAiSuggestingSubtasks(true);
    try {
      const res = await api.suggestSubtasks(issue.id);
      setAiSubtaskSuggestions(res.subtasks || []);
    } catch (err: any) {
      alert(err.message || 'Failed to suggest subtasks');
    } finally {
      setIsAiSuggestingSubtasks(false);
    }
  };

  const handleApplyAiSubtasks = async () => {
    if (!issue?.id || !aiSubtaskSuggestions?.length) return;
    try {
      for (const s of aiSubtaskSuggestions) {
        await api.createSubtask(issue.id, {
          title: s.title,
          priority: s.priority,
          estimateHours: s.estimateHours,
        });
      }
      setAiSubtaskSuggestions(null);
      queryClient.invalidateQueries({ queryKey: ['issue-subtasks', issue.id] });
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      queryClient.invalidateQueries({ queryKey: ['issue-activity', issue.id] });
    } catch (err: any) {
      alert(err.message || 'Error adding subtasks');
    }
  };

  const handleSummarizeThread = async () => {
    if (!issue?.id) return;
    setIsSummarizingThread(true);
    try {
      const res = await api.summarizeThread(issue.id);
      setAiSummary(res);
    } catch (err: any) {
      alert(err.message || 'Failed to summarize thread');
    } finally {
      setIsSummarizingThread(false);
    }
  };

  const handleSuggestTriage = async () => {
    if (!issue?.id) return;
    setIsTriaging(true);
    try {
      const res = await api.suggestTriage(issue.id);
      setAiTriage(res);
    } catch (err: any) {
      alert(err.message || 'Failed to generate triage suggestions');
    } finally {
      setIsTriaging(false);
    }
  };

  const handleApplyTriage = () => {
    if (!aiTriage) return;
    const payload: any = {
      priority: aiTriage.suggestedPriority,
    };
    if (aiTriage.suggestedAssigneeId) {
      payload.assigneeId = aiTriage.suggestedAssigneeId;
    }
    updateMutation.mutate(payload);
    setAiTriage(null);
  };

  const completedSubtasksCount = subtasks.filter((s: any) => s.status === 'DONE').length;
  const subtasksProgress = subtasks.length > 0 ? (completedSubtasksCount / subtasks.length) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end overflow-hidden">
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-fade-in"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div className="relative z-50 w-full max-w-2xl bg-card border-l border-border shadow-2xl flex flex-col h-full overflow-hidden animate-slide-in-right">
        {/* Drawer Header */}
        <div className="h-14 px-6 border-b border-border flex items-center justify-between shrink-0 bg-card/80 backdrop-blur-md">
          <div className="flex items-center gap-3">
            {issue && <IssueTypeBadge type={issue.type} />}
            <span className="font-mono text-sm font-semibold text-primary">
              {issue?.issueKey || issueIdentifier}
            </span>
            <button
              type="button"
              onClick={handleCopyLink}
              title="Copy issue link"
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Are you sure you want to archive ${issue?.issueKey}?`)) {
                  deleteMutation.mutate();
                }
              }}
              title="Archive Issue"
              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Close Drawer (Esc)"
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Drawer Body */}
        {isLoading ? (
          <div className="flex-1 p-8 space-y-6 animate-pulse">
            <div className="h-8 bg-muted rounded w-3/4" />
            <div className="h-24 bg-muted rounded" />
            <div className="grid grid-cols-2 gap-4">
              <div className="h-10 bg-muted rounded" />
              <div className="h-10 bg-muted rounded" />
            </div>
          </div>
        ) : isError || !issue ? (
          <div className="flex-1 p-8 flex flex-col items-center justify-center text-center space-y-3">
            <p className="text-sm text-destructive font-medium">Failed to load issue details.</p>
            <p className="text-xs text-muted-foreground">The issue may have been removed or archived.</p>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-muted hover:bg-accent"
            >
              Back to list
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Title */}
            <div>
              {isEditingTitle ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveTitle();
                      if (e.key === 'Escape') setIsEditingTitle(false);
                    }}
                    autoFocus
                    className="flex-1 px-2.5 py-1.5 text-lg font-semibold bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={handleSaveTitle}
                    className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <h2
                  onClick={() => setIsEditingTitle(true)}
                  className="text-xl font-bold tracking-tight hover:text-primary/90 cursor-pointer rounded px-1 -mx-1 transition-colors group flex items-baseline justify-between"
                >
                  <span>{issue.title}</span>
                  <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 font-normal ml-2">
                    Click to edit
                  </span>
                </h2>
              )}
            </div>

            {/* AI Triage Banner / Recommendation Card */}
            {aiTriage && (
              <div className="p-4 rounded-lg bg-primary/10 border border-primary/30 space-y-3 animate-fade-in shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                    <span className="text-xs font-bold text-primary tracking-wide uppercase">
                      AI Triage Recommendation
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                      {aiTriage.modelUsed}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAiTriage(null)}
                    className="text-muted-foreground hover:text-foreground p-0.5"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 rounded bg-background/70 border border-border/60 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground font-medium">Recommended Priority:</span>
                      <IssuePriorityBadge priority={aiTriage.suggestedPriority as any} />
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      {aiTriage.priorityReason}
                    </p>
                  </div>

                  <div className="p-2.5 rounded bg-background/70 border border-border/60 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground font-medium">Recommended Assignee:</span>
                      <span className="font-semibold text-foreground">
                        {aiTriage.suggestedAssigneeName}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      {aiTriage.assigneeReason}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setAiTriage(null)}
                    className="px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Dismiss
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyTriage}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-xs"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>Apply AI Recommendation</span>
                  </button>
                </div>
              </div>
            )}

            {/* Quick Properties Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 p-4 rounded-lg bg-muted/40 border border-border/80">
              {/* Status Selector */}
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </span>
                <div>
                  <select
                    value={issue.status}
                    onChange={(e) => updateMutation.mutate({ status: e.target.value })}
                    className="w-full text-xs font-medium bg-background border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value="BACKLOG">Backlog</option>
                    <option value="TODO">To Do</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="IN_REVIEW">In Review</option>
                    <option value="DONE">Done</option>
                  </select>
                </div>
              </div>

              {/* Priority Selector with AI Triage trigger */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Priority
                  </span>
                  <button
                    type="button"
                    onClick={handleSuggestTriage}
                    disabled={isTriaging}
                    title="Ask AI to triage priority and assignee"
                    className="text-[10px] text-primary hover:underline flex items-center gap-1 disabled:opacity-50"
                  >
                    <Sparkles className="h-2.5 w-2.5" />
                    <span>{isTriaging ? 'Triaging...' : 'Triage'}</span>
                  </button>
                </div>
                <div>
                  <select
                    value={issue.priority}
                    onChange={(e) =>
                      updateMutation.mutate({ priority: e.target.value as IssuePriority })
                    }
                    className="w-full text-xs font-medium bg-background border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value="P0">P0 - Urgent</option>
                    <option value="P1">P1 - High</option>
                    <option value="P2">P2 - Medium</option>
                    <option value="P3">P3 - Low</option>
                    <option value="P4">P4 - None</option>
                  </select>
                </div>
              </div>

              {/* Assignee Selector */}
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Assignee
                </span>
                <div>
                  <select
                    value={issue.assignee?.id || ''}
                    onChange={(e) =>
                      updateMutation.mutate({
                        assigneeId: e.target.value ? e.target.value : null,
                      })
                    }
                    className="w-full text-xs font-medium bg-background border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer truncate"
                  >
                    <option value="">Unassigned</option>
                    {projectMembers.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Type Selector */}
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Type
                </span>
                <div>
                  <select
                    value={issue.type}
                    onChange={(e) => updateMutation.mutate({ type: e.target.value as IssueType })}
                    className="w-full text-xs font-medium bg-background border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value="TASK">Task</option>
                    <option value="BUG">Bug</option>
                    <option value="STORY">Story</option>
                    <option value="EPIC">Epic</option>
                    <option value="SUBTASK">Subtask</option>
                  </select>
                </div>
              </div>

              {/* Story Points */}
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Points
                </span>
                <div>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={issue.storyPoints ?? ''}
                    placeholder="—"
                    onChange={(e) => {
                      const val = e.target.value === '' ? null : parseInt(e.target.value, 10);
                      updateMutation.mutate({ storyPoints: val });
                    }}
                    className="w-full text-xs font-medium bg-background border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            </div>

            {/* Description Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <span>Description</span>
                {!isEditingDesc && (
                  <button
                    type="button"
                    onClick={() => setIsEditingDesc(true)}
                    className="text-primary hover:underline lowercase text-xs font-normal"
                  >
                    Edit
                  </button>
                )}
              </div>

              {isEditingDesc ? (
                <div className="space-y-2">
                  <textarea
                    rows={6}
                    value={editedDesc}
                    onChange={(e) => setEditedDesc(e.target.value)}
                    placeholder="Add a detailed description, acceptance criteria, or context..."
                    className="w-full p-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  />
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setIsEditingDesc(false)}
                      className="px-3 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-muted"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveDesc}
                      className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground"
                    >
                      Save Description
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => setIsEditingDesc(true)}
                  className="min-h-[90px] p-3 text-sm bg-muted/20 border border-border/60 rounded-md hover:border-primary/50 cursor-pointer transition-colors whitespace-pre-wrap leading-relaxed text-foreground/90"
                >
                  {issue.description ? (
                    issue.description
                  ) : (
                    <span className="text-muted-foreground italic">
                      No description provided. Click to add details...
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Subtasks Section (Interactive Checklist + AI Breakdown) */}
            <div className="space-y-3 p-4 rounded-xl bg-card border border-border/80 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-primary" />
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground/90">
                    Subtasks ({completedSubtasksCount}/{subtasks.length})
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSuggestSubtasks}
                    disabled={isAiSuggestingSubtasks}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md bg-primary/10 hover:bg-primary/20 text-primary font-semibold border border-primary/20 disabled:opacity-50 transition-colors"
                  >
                    {isAiSuggestingSubtasks ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                    <span>AI Break Down</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsAddingSubtask(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-muted hover:bg-muted/80 text-foreground font-medium border border-border transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Add</span>
                  </button>
                </div>
              </div>

              {/* Progress Bar */}
              {subtasks.length > 0 && (
                <div className="space-y-1">
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300 rounded-full"
                      style={{ width: `${subtasksProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* AI Subtask Suggestions Preview Card */}
              {aiSubtaskSuggestions && (
                <div className="p-3.5 rounded-lg bg-primary/5 border border-primary/30 space-y-2.5 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Suggested Breakdown ({aiSubtaskSuggestions.length} subtasks)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAiSubtaskSuggestions(null)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    {aiSubtaskSuggestions.map((s, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 rounded bg-background/90 border border-border/70 text-xs"
                      >
                        <span className="font-medium text-foreground">{s.title}</span>
                        <div className="flex items-center gap-2">
                          <IssuePriorityBadge priority={s.priority as any} />
                          <span className="text-[10px] font-mono text-muted-foreground">
                            {s.estimateHours}h
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setAiSubtaskSuggestions(null)}
                      className="px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleApplyAiSubtasks}
                      className="px-3 py-1 rounded bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 shadow-2xs"
                    >
                      Create All Subtasks
                    </button>
                  </div>
                </div>
              )}

              {/* Existing Subtasks List */}
              <div className="space-y-1.5">
                {isLoadingSubtasks ? (
                  <p className="text-xs text-muted-foreground">Loading subtasks...</p>
                ) : subtasks.length === 0 && !isAddingSubtask && !aiSubtaskSuggestions ? (
                  <p className="text-xs text-muted-foreground italic py-2">
                    No subtasks yet. Click "AI Break Down" to automatically generate tasks or "+ Add" to create one manually.
                  </p>
                ) : (
                  subtasks.map((subtask: any) => {
                    const isDone = subtask.status === 'DONE';
                    return (
                      <div
                        key={subtask.id}
                        className="flex items-center justify-between p-2 rounded-md hover:bg-muted/40 border border-transparent hover:border-border/60 transition-colors text-xs group"
                      >
                        <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
                          <button
                            type="button"
                            onClick={() =>
                              toggleSubtaskMutation.mutate({
                                subtaskId: subtask.id,
                                newStatus: isDone ? 'TODO' : 'DONE',
                              })
                            }
                            className="text-muted-foreground hover:text-primary transition-colors shrink-0"
                          >
                            {isDone ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <Square className="h-4 w-4" />
                            )}
                          </button>
                          <span className="font-mono text-[11px] text-muted-foreground font-semibold shrink-0">
                            {subtask.issueKey}
                          </span>
                          <span
                            className={cn(
                              'font-medium text-foreground truncate',
                              isDone && 'line-through text-muted-foreground',
                            )}
                          >
                            {subtask.title}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <IssuePriorityBadge priority={subtask.priority} />
                          {subtask.estimateHours && (
                            <span className="text-[10px] font-mono text-muted-foreground">
                              {subtask.estimateHours}h
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Inline Subtask Composer */}
              {isAddingSubtask && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newSubtaskTitle.trim()) {
                        createSubtaskMutation.mutate(newSubtaskTitle.trim());
                      }
                      if (e.key === 'Escape') setIsAddingSubtask(false);
                    }}
                    placeholder="Enter subtask title..."
                    autoFocus
                    className="flex-1 px-3 py-1.5 text-xs bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
                  />
                  <button
                    type="button"
                    disabled={!newSubtaskTitle.trim() || createSubtaskMutation.isPending}
                    onClick={() => createSubtaskMutation.mutate(newSubtaskTitle.trim())}
                    className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 shadow-2xs"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingSubtask(false)}
                    className="px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {/* Details Meta Table */}
            <div className="grid grid-cols-2 gap-4 text-xs py-2 border-y border-border/80">
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-3.5 w-3.5" />
                <span>Assignee:</span>
                <span className="font-medium text-foreground">
                  {issue.assignee ? issue.assignee.name : 'Unassigned'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-3.5 w-3.5" />
                <span>Reporter:</span>
                <span className="font-medium text-foreground">{issue.reporter.name}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                <span>Due Date:</span>
                <span className="font-medium text-foreground">
                  {issue.dueDate ? new Date(issue.dueDate).toLocaleDateString() : 'No due date'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>Created:</span>
                <span className="font-medium text-foreground">
                  {new Date(issue.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Discussion, Activity & AI Summarizer Tabs */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div className="flex items-center gap-4 text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveDiscussionTab('comments')}
                    className={cn(
                      'flex items-center gap-1.5 pb-1 font-semibold transition-colors relative',
                      activeDiscussionTab === 'comments'
                        ? 'text-primary border-b-2 border-primary -mb-2.5 pb-2'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>Comments ({comments.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveDiscussionTab('activity')}
                    className={cn(
                      'flex items-center gap-1.5 pb-1 font-semibold transition-colors relative',
                      activeDiscussionTab === 'activity'
                        ? 'text-primary border-b-2 border-primary -mb-2.5 pb-2'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <History className="h-3.5 w-3.5" />
                    <span>Activity History</span>
                  </button>
                </div>

                {activeDiscussionTab === 'comments' && (
                  <button
                    type="button"
                    onClick={handleSummarizeThread}
                    disabled={isSummarizingThread || comments.length === 0}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md bg-primary/10 hover:bg-primary/20 text-primary font-semibold border border-primary/20 disabled:opacity-50 transition-colors shadow-2xs"
                  >
                    {isSummarizingThread ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                    <span>AI Thread Summary</span>
                  </button>
                )}
              </div>

              {/* AI Thread Summary Card */}
              {aiSummary && (
                <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/30 space-y-3 animate-fade-in shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-indigo-400 animate-pulse" />
                      <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                        Executive Thread Summary
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                        {aiSummary.modelUsed}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAiSummary(null)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <p className="text-xs text-foreground/90 leading-relaxed font-medium">
                    {aiSummary.summary}
                  </p>

                  {aiSummary.decisions && aiSummary.decisions.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider">
                        Key Decisions:
                      </span>
                      <ul className="text-xs space-y-1 text-foreground/80 pl-4 list-disc">
                        {aiSummary.decisions.map((d, i) => (
                          <li key={i}>{d}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {aiSummary.nextSteps && aiSummary.nextSteps.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider">
                        Actionable Next Steps:
                      </span>
                      <ul className="text-xs space-y-1 text-foreground/80 pl-4 list-disc">
                        {aiSummary.nextSteps.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Comments View */}
              {activeDiscussionTab === 'comments' && (
                <div className="space-y-3">
                  {isLoadingComments ? (
                    <p className="text-xs text-muted-foreground">Loading comments...</p>
                  ) : comments.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic bg-muted/20 p-4 rounded text-center">
                      No comments yet. Start the discussion below.
                    </p>
                  ) : (
                    comments.map((comment) => (
                      <div
                        key={comment.id}
                        className="p-3.5 rounded-lg border border-border bg-card/60 space-y-1.5 text-xs"
                      >
                        <div className="flex items-center justify-between text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <span className="h-5 w-5 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-[10px]">
                              {comment.author.name[0]?.toUpperCase() || 'U'}
                            </span>
                            <span className="font-semibold text-foreground">
                              {comment.author.name}
                            </span>
                          </div>
                          <span>{new Date(comment.createdAt).toLocaleString()}</span>
                        </div>
                        <p className="text-foreground/90 whitespace-pre-wrap pl-7 leading-relaxed">
                          {comment.content}
                        </p>
                      </div>
                    ))
                  )}

                  {/* Comment Composer */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (newComment.trim()) {
                        commentMutation.mutate(newComment.trim());
                      }
                    }}
                    className="space-y-2 pt-2"
                  >
                    <div className="relative">
                      <textarea
                        rows={3}
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Leave a comment or technical update..."
                        className="w-full p-3 text-xs bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-primary pr-20 shadow-2xs font-mono"
                      />
                      <button
                        type="submit"
                        disabled={!newComment.trim() || commentMutation.isPending}
                        className="absolute right-2.5 bottom-3.5 inline-flex items-center gap-1.5 px-3 py-1 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm"
                      >
                        <Send className="h-3 w-3" />
                        <span>Send</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Activity History Timeline View */}
              {activeDiscussionTab === 'activity' && (
                <div className="space-y-3 pt-1">
                  {isLoadingActivities ? (
                    <p className="text-xs text-muted-foreground">Loading audit history...</p>
                  ) : activities.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic bg-muted/20 p-4 rounded text-center">
                      No activity history recorded yet.
                    </p>
                  ) : (
                    <div className="relative pl-6 space-y-4 border-l border-border/70 ml-3">
                      {activities.map((act: ActivityItem) => (
                        <div key={act.id} className="relative space-y-1 text-xs">
                          <span className="absolute -left-[31px] top-0.5 h-4 w-4 rounded-full bg-background border-2 border-primary flex items-center justify-center">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                          </span>

                          <div className="flex items-center justify-between text-muted-foreground">
                            <span className="font-semibold text-foreground">
                              {act.user?.name || 'System User'}
                            </span>
                            <span className="text-[11px] font-mono">
                              {new Date(act.createdAt).toLocaleString()}
                            </span>
                          </div>

                          <p className="text-muted-foreground font-mono text-[11px]">
                            {act.action === 'CREATED' && 'Created this issue.'}
                            {act.action === 'STATUS_CHANGED' &&
                              `Changed status to ${act.details?.newStatus || 'new state'}.`}
                            {act.action === 'UPDATED' &&
                              `Updated issue fields: ${act.details?.updatedFields?.join(', ') || 'attributes'}.`}
                            {act.action === 'COMMENT_ADDED' && 'Added a comment to discussion.'}
                            {act.action === 'ATTACHMENT_ADDED' &&
                              `Attached file: ${act.details?.fileName || 'file'}.`}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
