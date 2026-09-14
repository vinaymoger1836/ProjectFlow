'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  ExternalLink,
  Copy,
  Check,
  Calendar,
  User,
  Hash,
  MessageSquare,
  Send,
  Trash2,
  Clock,
  Sparkles,
} from 'lucide-react';
import { api, IssueCommentItem } from '@/lib/api';
import { IssueTypeBadge, IssuePriorityBadge, IssueStatusBadge } from './badge-helpers';
import { IssuePriority, IssueType } from '@projectflow/types';

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
      queryClient.invalidateQueries({ queryKey: ['issues'] });
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

  return (
    <div className="fixed inset-0 z-50 flex justify-end overflow-hidden">
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-fade-in"
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

            {/* Quick Properties Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-lg bg-muted/40 border border-border/80">
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
                    <option value="TODO">Todo</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="IN_REVIEW">In Review</option>
                    <option value="DONE">Done</option>
                  </select>
                </div>
              </div>

              {/* Priority Selector */}
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Priority
                </span>
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

            {/* Discussion & Comments */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <MessageSquare className="h-4 w-4 text-primary" />
                <span>Activity & Comments ({comments.length})</span>
              </div>

              {/* Comment list */}
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
              </div>

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
                    placeholder="Leave a comment or update..."
                    className="w-full p-3 text-xs bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-primary pr-20"
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
          </div>
        )}
      </div>
    </div>
  );
}
