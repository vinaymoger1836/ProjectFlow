'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Plus, AlertCircle, FolderKanban, GitFork, ChevronDown } from 'lucide-react';
import { api } from '@/lib/api';
import { IssuePriority, IssueType } from '@projectflow/types';

interface CreateIssueModalProps {
  projectId: string;
  projectName?: string;
  projectKey?: string;
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (issueKey: string) => void;
}

export function CreateIssueModal({
  projectId,
  projectName = 'Payment Integration Platform',
  projectKey = 'PAY',
  isOpen,
  onClose,
  onCreated,
}: CreateIssueModalProps) {
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<IssueType>('TASK');
  const [priority, setPriority] = useState<IssuePriority>('P2');
  const [parentIssueId, setParentIssueId] = useState<string>('');
  const [showParentSelector, setShowParentSelector] = useState(false);
  const [storyPoints, setStoryPoints] = useState<string>('');
  const [estimateHours, setEstimateHours] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch project issues to allow selecting a parent task/epic/story
  const { data: issuesData } = useQuery({
    queryKey: ['issues', projectId],
    queryFn: async () => {
      try {
        const res = await api.listIssues(projectId);
        return res?.items || [];
      } catch {
        return [];
      }
    },
    enabled: isOpen,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        type,
        priority,
        status: 'TODO',
        parentIssueId: parentIssueId || undefined,
        storyPoints: storyPoints ? parseInt(storyPoints, 10) : undefined,
        estimateHours: estimateHours ? parseInt(estimateHours, 10) : undefined,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      };
      return api.createIssue(projectId, payload);
    },
    onSuccess: (newIssue) => {
      queryClient.invalidateQueries({ queryKey: ['issues', projectId] });
      // Reset form
      setTitle('');
      setDescription('');
      setType('TASK');
      setPriority('P2');
      setParentIssueId('');
      setShowParentSelector(false);
      setStoryPoints('');
      setEstimateHours('');
      setDueDate('');
      setErrorMessage(null);
      onClose();
      if (onCreated && newIssue.issueKey) {
        onCreated(newIssue.issueKey);
      }
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Failed to create issue. Please check your inputs.');
    },
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMessage('Please enter an issue title.');
      return;
    }
    if (type === 'SUBTASK' && !parentIssueId) {
      setErrorMessage('A subtask must be linked to a parent task or story.');
      return;
    }
    setErrorMessage(null);
    createMutation.mutate();
  };

  const handleTypeChange = (newType: IssueType) => {
    setType(newType);
    if (newType === 'SUBTASK') {
      setShowParentSelector(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-fade-in"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative z-50 w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-fade-in max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-primary/20 text-primary flex items-center justify-center">
              <Plus className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-semibold text-base leading-tight">Create New Issue</h3>
              <p className="text-[11px] text-muted-foreground">Add a new task, bug, or story to your project backlog</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {errorMessage && (
            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Project Indicator (Explicit Hierarchy Confirmation) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <FolderKanban className="h-3.5 w-3.5 text-primary" />
                <span>Project</span>
              </span>
              <span className="text-[10px] text-muted-foreground font-normal">
                Issue will be scoped under this project
              </span>
            </label>
            <div className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-muted/40 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-md bg-primary/20 text-primary font-bold text-xs flex items-center justify-center font-mono">
                  {projectKey}
                </div>
                <div>
                  <div className="font-semibold text-foreground">{projectName}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    Key Prefix: <span className="font-semibold text-foreground">{projectKey}</span> (e.g. {projectKey}-1)
                  </div>
                </div>
              </div>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                Active Project
              </span>
            </div>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Title <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Implement webhook idempotency key verification"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Type & Priority Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Type</label>
              <select
                value={type}
                onChange={(e) => handleTypeChange(e.target.value as IssueType)}
                className="w-full px-3 py-2 text-xs bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                <option value="TASK">Task</option>
                <option value="BUG">Bug</option>
                <option value="STORY">Story</option>
                <option value="EPIC">Epic</option>
                <option value="SUBTASK">Subtask (Child Task)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as IssuePriority)}
                className="w-full px-3 py-2 text-xs bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                <option value="P0">P0 - Urgent</option>
                <option value="P1">P1 - High</option>
                <option value="P2">P2 - Medium</option>
                <option value="P3">P3 - Low</option>
                <option value="P4">P4 - None</option>
              </select>
            </div>
          </div>

          {/* Parent Issue Hierarchy Selector */}
          {type === 'SUBTASK' || showParentSelector || parentIssueId ? (
            <div className="space-y-1.5 p-3 rounded-lg border border-primary/30 bg-primary/5 animate-fade-in text-xs">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-foreground flex items-center gap-1.5">
                  <GitFork className="h-3.5 w-3.5 text-primary" />
                  <span>Parent Issue</span>
                  {type === 'SUBTASK' ? (
                    <span className="text-destructive">* (Required for subtask)</span>
                  ) : (
                    <span className="text-muted-foreground font-normal">(Optional child linkage)</span>
                  )}
                </label>
                {type !== 'SUBTASK' && (
                  <button
                    type="button"
                    onClick={() => {
                      setParentIssueId('');
                      setShowParentSelector(false);
                    }}
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    Remove link
                  </button>
                )}
              </div>
              <select
                value={parentIssueId}
                onChange={(e) => setParentIssueId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                <option value="">Select parent task / story...</option>
                {(issuesData || [])
                  .filter((i) => i.type !== 'SUBTASK')
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      [{i.issueKey}] {i.title} ({i.type})
                    </option>
                  ))}
              </select>
            </div>
          ) : (
            <div>
              <button
                type="button"
                onClick={() => setShowParentSelector(true)}
                className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1.5 transition-colors py-1 font-medium"
              >
                <GitFork className="h-3.5 w-3.5" />
                <span>+ Attach as child subtask to an existing issue</span>
              </button>
            </div>
          )}

          {/* Story Points & Due Date Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Story Points</label>
              <input
                type="number"
                min="0"
                max="100"
                placeholder="e.g. 5"
                value={storyPoints}
                onChange={(e) => setStoryPoints(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Description</label>
            <textarea
              rows={3}
              placeholder="Add details, acceptance criteria, or reproduction steps..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 text-xs bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-border flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-md border border-border hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-2 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Issue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
