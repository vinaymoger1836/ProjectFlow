'use client';

import React from 'react';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Clock,
  Bug,
  TrendingUp,
} from 'lucide-react';
import { CopilotMetricsWidget } from '@/lib/api';
import { cn } from '@/lib/utils';

interface GenerativeMetricsCardProps {
  widget: CopilotMetricsWidget;
}

export function GenerativeMetricsCard({ widget }: GenerativeMetricsCardProps) {
  const {
    title,
    totalIssues,
    completedIssues,
    pendingIssues,
    completionRate,
    bugCount,
    bugRate,
    statusBreakdown,
    priorityBreakdown,
    healthStatus,
    healthSummary,
  } = widget;

  // Calculate percentages for pipeline bar
  const total = totalIssues > 0 ? totalIssues : 1;
  const donePct = Math.round(((statusBreakdown?.done || 0) / total) * 100);
  const reviewPct = Math.round(((statusBreakdown?.inReview || 0) / total) * 100);
  const progressPct = Math.round(((statusBreakdown?.inProgress || 0) / total) * 100);
  const todoPct = Math.round(((statusBreakdown?.todo || 0) / total) * 100);
  const backlogPct = Math.round(((statusBreakdown?.backlog || 0) / total) * 100);

  const getHealthBadge = () => {
    switch (healthStatus) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
            <AlertOctagon className="h-3 w-3 text-rose-400" />
            <span>Critical</span>
          </span>
        );
      case 'AT_RISK':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <AlertTriangle className="h-3 w-3 text-amber-400" />
            <span>At Risk</span>
          </span>
        );
      case 'ON_TRACK':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
            <TrendingUp className="h-3 w-3 text-blue-400" />
            <span>On Track</span>
          </span>
        );
      case 'HEALTHY':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
            <span>Healthy</span>
          </span>
        );
    }
  };

  return (
    <div className="rounded-xl border border-border/80 bg-card/95 shadow-md overflow-hidden text-xs animate-fade-in my-1.5 space-y-3 p-3.5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 pb-2">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded bg-primary/15 text-primary flex items-center justify-center">
            <Activity className="h-3 w-3" />
          </div>
          <span className="font-semibold text-foreground text-xs">{title}</span>
        </div>
        {getHealthBadge()}
      </div>

      {/* 3-Card KPI Summary Grid */}
      <div className="grid grid-cols-3 gap-2 text-center">
        {/* Completion Rate */}
        <div className="p-2 rounded-lg bg-muted/40 border border-border/50 flex flex-col items-center justify-center">
          <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Completion</span>
          <span className="text-lg font-bold text-foreground font-mono mt-0.5">{completionRate}%</span>
          <span className="text-[10px] text-muted-foreground">
            {completedIssues}/{totalIssues} done
          </span>
        </div>

        {/* Bug Rate */}
        <div className="p-2 rounded-lg bg-muted/40 border border-border/50 flex flex-col items-center justify-center">
          <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Bug Rate</span>
          <span
            className={cn(
              'text-lg font-bold font-mono mt-0.5',
              bugRate === 0
                ? 'text-emerald-400'
                : bugRate < 25
                ? 'text-amber-400'
                : 'text-rose-400',
            )}
          >
            {bugRate}%
          </span>
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Bug className="h-2.5 w-2.5" />
            <span>{bugCount} {bugCount === 1 ? 'bug' : 'bugs'}</span>
          </span>
        </div>

        {/* Pending Issues */}
        <div className="p-2 rounded-lg bg-muted/40 border border-border/50 flex flex-col items-center justify-center">
          <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Pending</span>
          <span className="text-lg font-bold text-foreground font-mono mt-0.5">{pendingIssues}</span>
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Clock className="h-2.5 w-2.5" />
            <span>in backlog</span>
          </span>
        </div>
      </div>

      {/* Visual Status Pipeline Progress Bar */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground font-medium">Status Distribution</span>
          <span className="font-mono text-[10px] text-muted-foreground">{totalIssues} total issues</span>
        </div>

        {/* Segmented Bar */}
        <div className="h-2.5 w-full rounded-full bg-muted/80 overflow-hidden flex">
          {donePct > 0 && (
            <div
              style={{ width: `${donePct}%` }}
              className="bg-emerald-500 h-full transition-all duration-300"
              title={`Done: ${statusBreakdown?.done} (${donePct}%)`}
            />
          )}
          {reviewPct > 0 && (
            <div
              style={{ width: `${reviewPct}%` }}
              className="bg-purple-500 h-full transition-all duration-300"
              title={`In Review: ${statusBreakdown?.inReview} (${reviewPct}%)`}
            />
          )}
          {progressPct > 0 && (
            <div
              style={{ width: `${progressPct}%` }}
              className="bg-blue-500 h-full transition-all duration-300"
              title={`In Progress: ${statusBreakdown?.inProgress} (${progressPct}%)`}
            />
          )}
          {todoPct > 0 && (
            <div
              style={{ width: `${todoPct}%` }}
              className="bg-amber-500 h-full transition-all duration-300"
              title={`To Do: ${statusBreakdown?.todo} (${todoPct}%)`}
            />
          )}
          {backlogPct > 0 && (
            <div
              style={{ width: `${backlogPct}%` }}
              className="bg-zinc-500 h-full transition-all duration-300"
              title={`Backlog: ${statusBreakdown?.backlog} (${backlogPct}%)`}
            />
          )}
        </div>

        {/* Legend Chips */}
        <div className="flex items-center gap-1.5 flex-wrap text-[10px] pt-1">
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span>Done: {statusBreakdown?.done || 0}</span>
          </span>
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
            <span>In Progress: {statusBreakdown?.inProgress || 0}</span>
          </span>
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            <span>To Do: {statusBreakdown?.todo || 0}</span>
          </span>
          {(statusBreakdown?.inReview || 0) > 0 && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
              <span>Review: {statusBreakdown?.inReview}</span>
            </span>
          )}
        </div>
      </div>

      {/* Priority Breakdown Pills */}
      <div className="flex items-center gap-1.5 text-[10px] border-t border-border/40 pt-2 text-muted-foreground">
        <span className="font-medium">Priority:</span>
        <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-300 font-mono">
          P0: {priorityBreakdown?.p0 || 0}
        </span>
        <span className="px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-300 font-mono">
          P1: {priorityBreakdown?.p1 || 0}
        </span>
        <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 font-mono">
          P2: {priorityBreakdown?.p2 || 0}
        </span>
        <span className="px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-300 font-mono">
          P3: {priorityBreakdown?.p3 || 0}
        </span>
      </div>

      {/* Health Assessment */}
      {healthSummary && (
        <div className="p-2 rounded-lg bg-muted/30 border border-border/50 text-[11px] text-muted-foreground flex items-start gap-2">
          <Activity className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
          <span>{healthSummary}</span>
        </div>
      )}
    </div>
  );
}
