'use client';

import React from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { ProjectHealthReport } from '@/lib/api';
import { ScoreRing } from '../releases/release-readiness-dialog';
import { HEALTH_STATUS_META, SEVERITY_META, formatRelativeTime } from './health-utils';
import { cn } from '@/lib/utils';

interface ProjectHealthCardProps {
  report: ProjectHealthReport;
  onOpenIssue?: (issueKey: string) => void;
  onRecompute?: () => void;
  isRecomputing?: boolean;
}

/**
 * Generative ProjectHealthCard: deterministic status, score, trend, and the rules that fired.
 */
export function ProjectHealthCard({ report, onOpenIssue, onRecompute, isRecomputing }: ProjectHealthCardProps) {
  const meta = HEALTH_STATUS_META[report.status];
  const m = report.metrics;

  const stats: { label: string; value: string | number; warn?: boolean }[] = [
    { label: 'Open issues', value: m.openIssueCount },
    { label: 'P0/P1 bugs', value: m.openCriticalBugCount, warn: m.openCriticalBugCount > 0 },
    { label: 'Blocked', value: m.blockedCount, warn: m.blockedCount > 0 },
    { label: 'Overdue', value: m.overdueIssueCount, warn: m.overdueIssueCount > 0 },
    {
      label: 'Cycle time',
      value: m.medianCycleTimeDays !== null ? `${m.medianCycleTimeDays}d` : '—',
    },
    { label: 'Slipping milestones', value: m.atRiskMilestoneCount + m.overdueMilestoneCount, warn: m.atRiskMilestoneCount + m.overdueMilestoneCount > 0 },
  ];

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center gap-4 p-4 border-b border-border">
        <ScoreRing score={report.score} ringClass={meta.ring} size={56} />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Activity className="h-3.5 w-3.5 text-primary" />
            <span className="text-sm font-semibold truncate">{report.projectName}</span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
              {report.projectKey}
            </span>
            <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full border', meta.badge)}>{meta.label}</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Evaluated {formatRelativeTime(report.evaluatedAt)} · deterministic rules
          </p>
        </div>
        <TrendSparkline points={report.trend} stroke={meta.stroke} />
        {onRecompute && (
          <button
            type="button"
            onClick={onRecompute}
            disabled={isRecomputing}
            title="Re-evaluate now"
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isRecomputing && 'animate-spin')} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 divide-x divide-border/60 border-b border-border">
        {stats.map((s) => (
          <div key={s.label} className="px-3 py-2.5 text-center">
            <div className={cn('text-base font-bold tabular-nums', s.warn ? 'text-amber-400' : 'text-foreground')}>{s.value}</div>
            <div className="text-[10px] text-muted-foreground leading-tight">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="p-4 space-y-2">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">What is driving the score</h4>
        {report.factors.length === 0 ? (
          <p className="text-xs text-emerald-400">No risk rules fired. Nothing needs attention right now.</p>
        ) : (
          <ul className="space-y-1.5">
            {report.factors.map((factor) => {
              const sev = SEVERITY_META[factor.severity];
              return (
                <li key={factor.id} className="flex items-start gap-2.5 rounded-lg border border-border/70 bg-muted/10 px-3 py-2">
                  <span className={cn('h-2 w-2 rounded-full mt-1.5 shrink-0', sev.dot)} />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold">{factor.label}</span>
                      <span className="text-[10px] font-mono text-muted-foreground shrink-0">−{factor.penalty}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{factor.detail}</p>
                    {factor.issueKeys.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {factor.issueKeys.map((key) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => onOpenIssue?.(key)}
                            disabled={!onOpenIssue}
                            className="font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted hover:bg-primary/15 hover:text-primary border border-border transition-colors disabled:hover:bg-muted disabled:hover:text-inherit"
                          >
                            {key}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Daily score history (0–100); a single point renders as a dot. */
export function TrendSparkline({
  points,
  stroke,
  width = 96,
  height = 32,
}: {
  points: { date: string; score: number }[];
  stroke: string;
  width?: number;
  height?: number;
}) {
  if (points.length === 0) return null;
  const pad = 3;
  const x = (i: number) => (points.length === 1 ? width / 2 : pad + (i * (width - pad * 2)) / (points.length - 1));
  const y = (score: number) => pad + ((100 - score) * (height - pad * 2)) / 100;
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.score).toFixed(1)}`).join(' ');
  const last = points[points.length - 1];

  return (
    <svg
      width={width}
      height={height}
      className="shrink-0 hidden sm:block"
      role="img"
      aria-label={`Health score trend over ${points.length} day(s), latest ${last.score}`}
    >
      <title>{points.map((p) => `${p.date}: ${p.score}`).join('\n')}</title>
      {points.length > 1 && <path d={path} fill="none" stroke={stroke} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />}
      <circle cx={x(points.length - 1)} cy={y(last.score)} r={2.75} fill={stroke} />
    </svg>
  );
}
