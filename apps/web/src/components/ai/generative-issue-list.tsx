'use client';

import React from 'react';
import {
  ExternalLink,
  Layers,
  User as UserIcon,
  ChevronRight,
  Clock,
  Hash,
} from 'lucide-react';
import { CopilotIssueListWidget, CopilotIssueItem } from '@/lib/api';
import { IssueTypeBadge, IssuePriorityBadge, IssueStatusBadge } from '../issues/badge-helpers';
import { cn } from '@/lib/utils';

interface GenerativeIssueListProps {
  widget: CopilotIssueListWidget;
  onOpenIssueInDrawer?: (issueKey: string) => void;
}

export function GenerativeIssueList({
  widget,
  onOpenIssueInDrawer,
}: GenerativeIssueListProps) {
  const issues = widget.issues || [];

  return (
    <div className="rounded-xl border border-border/80 bg-card/95 shadow-md overflow-hidden text-xs animate-fade-in my-1.5">
      {/* Widget Header */}
      <div className="px-3.5 py-2.5 bg-muted/40 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded bg-primary/15 text-primary flex items-center justify-center">
            <Layers className="h-3 w-3" />
          </div>
          <span className="font-semibold text-foreground text-xs">{widget.title}</span>
        </div>
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
          {widget.totalCount} {widget.totalCount === 1 ? 'issue' : 'issues'}
        </span>
      </div>

      {/* Issues List */}
      {issues.length === 0 ? (
        <div className="p-4 text-center text-muted-foreground text-xs">
          No matching issues found for this query.
        </div>
      ) : (
        <div className="divide-y divide-border/40 max-h-[300px] overflow-y-auto">
          {issues.map((issue) => (
            <div
              key={issue.id}
              onClick={() => onOpenIssueInDrawer && onOpenIssueInDrawer(issue.issueKey)}
              className={cn(
                'p-2.5 transition-colors duration-150 flex flex-col gap-1.5 group',
                onOpenIssueInDrawer ? 'hover:bg-muted/50 cursor-pointer' : '',
              )}
            >
              {/* Row 1: Key, Type, Priority, Status */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-mono font-bold text-[11px] text-primary group-hover:underline flex items-center gap-0.5 bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
                    {issue.issueKey}
                    <ExternalLink className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </span>
                  <IssueTypeBadge type={issue.type} className="text-[10px] py-0 px-1.5 h-5" />
                  <IssuePriorityBadge priority={issue.priority} className="text-[10px] py-0 px-1.5 h-5" />
                </div>
                <div className="shrink-0">
                  <IssueStatusBadge status={issue.status} className="text-[10px] py-0 px-2 h-5" />
                </div>
              </div>

              {/* Row 2: Title */}
              <p className="font-medium text-foreground text-xs line-clamp-2 group-hover:text-primary transition-colors">
                {issue.title}
              </p>

              {/* Row 3: Assignee & Estimates */}
              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
                <div className="flex items-center gap-1.5">
                  <div className="h-4 w-4 rounded-full bg-muted border border-border flex items-center justify-center text-[9px] font-bold text-muted-foreground">
                    {issue.assignee ? (
                      issue.assignee.name.slice(0, 2).toUpperCase()
                    ) : (
                      <UserIcon className="h-2.5 w-2.5" />
                    )}
                  </div>
                  <span className="truncate max-w-[120px]">
                    {issue.assignee ? issue.assignee.name : 'Unassigned'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {typeof issue.storyPoints === 'number' && (
                    <span className="flex items-center gap-0.5 text-[10px] bg-muted/60 px-1.5 py-0.5 rounded">
                      <Hash className="h-2.5 w-2.5" />
                      <span>{issue.storyPoints} pts</span>
                    </span>
                  )}
                  {typeof issue.estimateHours === 'number' && (
                    <span className="flex items-center gap-0.5 text-[10px] bg-muted/60 px-1.5 py-0.5 rounded">
                      <Clock className="h-2.5 w-2.5" />
                      <span>{issue.estimateHours}h</span>
                    </span>
                  )}
                  {onOpenIssueInDrawer && (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer Helper */}
      {issues.length > 0 && onOpenIssueInDrawer && (
        <div className="px-3 py-1.5 bg-muted/20 border-t border-border/40 text-[10px] text-muted-foreground flex items-center justify-between">
          <span>Click any issue to view & edit in drawer</span>
          <span className="font-mono text-[9px] opacity-75">ProjectFlow UI</span>
        </div>
      )}
    </div>
  );
}
