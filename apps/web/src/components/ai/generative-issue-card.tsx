'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  Edit2,
  Trash2,
  Sparkles,
  ExternalLink,
  Clock,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { api, ParsedIssueDraft } from '@/lib/api';
import { IssueTypeBadge, IssuePriorityBadge } from '../issues/badge-helpers';
import { IssuePriority, IssueType } from '@projectflow/types';

interface GenerativeIssueCardProps {
  projectId: string;
  initialDraft: ParsedIssueDraft;
  onIssueCreated?: (issueKey: string) => void;
  onDiscard?: () => void;
}

export function GenerativeIssueCard({
  projectId,
  initialDraft,
  onIssueCreated,
  onDiscard,
}: GenerativeIssueCardProps) {
  const queryClient = useQueryClient();

  const [draft, setDraft] = useState<ParsedIssueDraft>(initialDraft);
  const [isEditing, setIsEditing] = useState(false);
  const [createdIssueKey, setCreatedIssueKey] = useState<string | null>(null);

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: draft.title,
        description: draft.description,
        type: draft.type,
        priority: draft.priority,
        status: draft.status || 'TODO',
        storyPoints: draft.storyPoints ?? undefined,
        estimateHours: draft.estimateHours ?? undefined,
        dueDate: draft.suggestedDueDate ? new Date(draft.suggestedDueDate).toISOString() : undefined,
      };

      return api.executeAiTool('create_issue', projectId, payload);
    },
    onSuccess: (newIssue) => {
      setCreatedIssueKey(newIssue.issueKey);
      queryClient.invalidateQueries({ queryKey: ['issues', projectId] });
      if (onIssueCreated) {
        onIssueCreated(newIssue.issueKey);
      }
    },
  });

  if (createdIssueKey) {
    return (
      <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 space-y-3 animate-fade-in text-xs">
        <div className="flex items-center gap-2 font-semibold text-emerald-400">
          <Check className="h-4 w-4 stroke-[3]" />
          <span>Issue Created Successfully!</span>
        </div>
        <p className="text-muted-foreground">
          Created <span className="font-mono font-bold text-foreground">{createdIssueKey}</span> on Cloud Supabase with atomic key sequencing.
        </p>
        <button
          type="button"
          onClick={() => onIssueCreated && onIssueCreated(createdIssueKey)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-500 text-black font-semibold hover:bg-emerald-400 transition-colors shadow-sm"
        >
          <span>Open {createdIssueKey} in Drawer</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-primary/40 bg-card p-4 shadow-lg space-y-3 text-xs animate-fade-in">
      {/* Header with AI Pill */}
      <div className="flex items-center justify-between border-b border-border pb-2.5">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded bg-primary/20 text-primary flex items-center justify-center">
            <Sparkles className="h-3 w-3" />
          </div>
          <span className="font-semibold text-foreground">AI Proposed Issue</span>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
          {draft.modelUsed}
        </span>
      </div>

      {/* Target Project Indicator */}
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/20 px-2.5 py-1 rounded border border-border/30">
        <span>Project:</span>
        <span className="font-bold text-foreground font-mono bg-primary/15 text-primary px-1.5 py-0.5 rounded text-[10px]">
          PAY
        </span>
        <span className="truncate font-medium text-foreground">Payment Integration Platform</span>
      </div>

      {/* Explanation Banner */}
      {draft.explanation && (
        <p className="text-[11px] text-muted-foreground italic bg-muted/30 px-2.5 py-1.5 rounded border border-border/40">
          💡 {draft.explanation}
        </p>
      )}

      {/* Form / Preview Content */}
      {isEditing ? (
        <div className="space-y-3 pt-1">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground">Title</label>
            <input
              type="text"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              className="w-full px-2.5 py-1.5 bg-background border border-input rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground">Type</label>
              <select
                value={draft.type}
                onChange={(e) => setDraft({ ...draft, type: e.target.value as IssueType })}
                className="w-full px-2 py-1 bg-background border border-input rounded text-xs"
              >
                <option value="TASK">Task</option>
                <option value="BUG">Bug</option>
                <option value="STORY">Story</option>
                <option value="EPIC">Epic</option>
                <option value="SUBTASK">Subtask</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground">Priority</label>
              <select
                value={draft.priority}
                onChange={(e) => setDraft({ ...draft, priority: e.target.value as IssuePriority })}
                className="w-full px-2 py-1 bg-background border border-input rounded text-xs"
              >
                <option value="P0">P0 - Urgent</option>
                <option value="P1">P1 - High</option>
                <option value="P2">P2 - Medium</option>
                <option value="P3">P3 - Low</option>
                <option value="P4">P4 - None</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground">Story Points</label>
              <input
                type="number"
                min="0"
                max="100"
                value={draft.storyPoints ?? ''}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    storyPoints: e.target.value === '' ? null : parseInt(e.target.value, 10),
                  })
                }
                className="w-full px-2 py-1 bg-background border border-input rounded text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground">Est. Hours</label>
              <input
                type="number"
                min="0"
                max="1000"
                value={draft.estimateHours ?? ''}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    estimateHours: e.target.value === '' ? null : parseInt(e.target.value, 10),
                  })
                }
                className="w-full px-2 py-1 bg-background border border-input rounded text-xs"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground">Description</label>
            <textarea
              rows={4}
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              className="w-full p-2 bg-background border border-input rounded text-xs font-mono"
            />
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-3 py-1 text-xs font-medium rounded bg-secondary hover:bg-muted"
            >
              Done Editing
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5 pt-1">
          {/* Title */}
          <h4 className="font-bold text-sm text-foreground leading-snug">{draft.title}</h4>

          {/* Badges and Estimates */}
          <div className="flex flex-wrap items-center gap-2">
            <IssueTypeBadge type={draft.type} />
            <IssuePriorityBadge priority={draft.priority} />
            {draft.storyPoints !== null && draft.storyPoints !== undefined && (
              <span className="px-2 py-0.5 rounded bg-muted font-mono font-semibold text-[11px]">
                {draft.storyPoints} pts
              </span>
            )}
            {draft.estimateHours !== null && draft.estimateHours !== undefined && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{draft.estimateHours}h</span>
              </span>
            )}
          </div>

          {/* Description Preview */}
          <div className="p-2.5 rounded bg-muted/30 border border-border/50 text-[11px] text-foreground/90 whitespace-pre-wrap max-h-36 overflow-y-auto leading-relaxed">
            {draft.description}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="pt-2 border-t border-border flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {!isEditing && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Edit2 className="h-3 w-3" />
              <span>Edit</span>
            </button>
          )}
          {onDiscard && (
            <button
              type="button"
              onClick={onDiscard}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="h-3 w-3" />
              <span>Discard</span>
            </button>
          )}
        </div>

        <button
          type="button"
          disabled={confirmMutation.isPending}
          onClick={() => confirmMutation.mutate()}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 disabled:opacity-50 transition-all shadow-sm"
        >
          <Check className="h-3.5 w-3.5 stroke-[3]" />
          <span>{confirmMutation.isPending ? 'Creating...' : 'Confirm & Create Issue'}</span>
        </button>
      </div>
    </div>
  );
}
