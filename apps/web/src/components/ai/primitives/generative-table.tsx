'use client';

import React from 'react';
import { Table, ExternalLink, User as UserIcon } from 'lucide-react';
import { CopilotTableBlock } from '@/lib/api';
import { IssueTypeBadge, IssuePriorityBadge, IssueStatusBadge } from '../../issues/badge-helpers';
import { cn } from '@/lib/utils';

interface GenerativeTableProps {
  block: CopilotTableBlock;
  onOpenIssueInDrawer?: (issueKey: string) => void;
}

export function GenerativeTable({ block, onOpenIssueInDrawer }: GenerativeTableProps) {
  const { title, issues = [] } = block;
  const count = block.totalCount !== undefined ? block.totalCount : issues.length;

  if (!issues || issues.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-border/80 bg-card/95 shadow-sm overflow-hidden text-xs animate-fade-in my-1.5">
      {/* Table Header */}
      <div className="px-3.5 py-2.5 bg-muted/40 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded bg-primary/15 text-primary flex items-center justify-center">
            <Table className="h-3 w-3" />
          </div>
          <span className="font-semibold text-foreground text-xs">{title}</span>
        </div>
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
          {count} {count === 1 ? 'item' : 'items'}
        </span>
      </div>

      {/* Table Body */}
      <div className="overflow-x-auto max-h-[320px]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border/50 bg-muted/20 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              <th className="py-2 px-3">Key</th>
              <th className="py-2 px-2">Type</th>
              <th className="py-2 px-2">Priority</th>
              <th className="py-2 px-3">Title</th>
              <th className="py-2 px-2 text-center">Status</th>
              <th className="py-2 px-3">Assignee</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {issues.map((issue) => (
              <tr
                key={issue.id}
                onClick={() => onOpenIssueInDrawer && onOpenIssueInDrawer(issue.issueKey)}
                className={cn(
                  'transition-colors duration-150 group text-xs',
                  onOpenIssueInDrawer ? 'hover:bg-muted/60 cursor-pointer' : '',
                )}
              >
                {/* Key */}
                <td className="py-2 px-3 font-mono font-bold text-[11px] text-primary whitespace-nowrap">
                  <span className="inline-flex items-center gap-1 group-hover:underline">
                    {issue.issueKey}
                    <ExternalLink className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </span>
                </td>

                {/* Type */}
                <td className="py-2 px-2 whitespace-nowrap">
                  <IssueTypeBadge type={issue.type} className="text-[10px] py-0 px-1.5 h-4.5" />
                </td>

                {/* Priority */}
                <td className="py-2 px-2 whitespace-nowrap">
                  <IssuePriorityBadge priority={issue.priority} className="text-[10px] py-0 px-1.5 h-4.5" />
                </td>

                {/* Title */}
                <td className="py-2 px-3 max-w-[200px] truncate font-medium text-foreground group-hover:text-primary transition-colors">
                  {issue.title}
                </td>

                {/* Status */}
                <td className="py-2 px-2 text-center whitespace-nowrap">
                  <IssueStatusBadge status={issue.status} className="text-[10px] py-0 px-2 h-5" />
                </td>

                {/* Assignee */}
                <td className="py-2 px-3 whitespace-nowrap text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <div className="h-4 w-4 rounded-full bg-muted border border-border flex items-center justify-center text-[9px] font-bold text-muted-foreground">
                      {issue.assignee?.name ? (
                        issue.assignee.name.slice(0, 2).toUpperCase()
                      ) : (
                        <UserIcon className="h-2.5 w-2.5" />
                      )}
                    </div>
                    <span className="truncate max-w-[100px]">
                      {issue.assignee?.name || 'Unassigned'}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
