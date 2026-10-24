'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sparkles,
  RefreshCw,
  Wand2,
  GitCompareArrows,
  Loader2,
} from 'lucide-react';
import { api, ReadinessCheck, ReadinessSuggestion, ReleaseSummary } from '@/lib/api';
import { DialogShell, ErrorNote, CancelButton } from '../common/dialog-primitives';
import { BulkDiffDialog } from '../issues/bulk-diff-dialog';
import { VERDICT_META } from './release-utils';
import { cn } from '@/lib/utils';

const CHECK_ICON = {
  PASS: { icon: CheckCircle2, className: 'text-emerald-400' },
  WARN: { icon: AlertTriangle, className: 'text-amber-400' },
  FAIL: { icon: XCircle, className: 'text-red-400' },
} as const;

interface ReleaseReadinessDialogProps {
  projectId: string;
  release: ReleaseSummary | null;
  onOpenChange: (open: boolean) => void;
  onOpenIssue: (issueKey: string) => void;
}

export function ReleaseReadinessDialog({ projectId, release, onOpenChange, onOpenIssue }: ReleaseReadinessDialogProps) {
  const [reviewing, setReviewing] = useState<ReadinessSuggestion | null>(null);
  const appliedRef = useRef(false);

  const assess = useMutation({
    mutationFn: (releaseId: string) => api.assessReleaseReadiness(releaseId),
  });

  useEffect(() => {
    if (release) assess.mutate(release.id);
    else assess.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [release?.id]);

  const report = assess.data;
  const warnings = report?.checks.filter((c) => c.status === 'WARN').length ?? 0;

  return (
    <>
      <DialogShell
        open={Boolean(release)}
        onOpenChange={onOpenChange}
        size="lg"
        icon={<ShieldCheck className="h-4 w-4" />}
        title={`Release readiness · ${release?.version ?? ''}`}
        description="Deterministic checks decide pass or fail. AI explains the delivery risk and recommends fixes you can review before applying."
        footer={
          <>
            <button
              type="button"
              onClick={() => release && assess.mutate(release.id)}
              disabled={assess.isPending || !release}
              className="mr-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', assess.isPending && 'animate-spin')} />
              Re-run
            </button>
            <CancelButton onClick={() => onOpenChange(false)} label="Close" />
          </>
        }
      >
        {assess.isPending && !report ? (
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Evaluating checks and asking AI for a risk assessment…
            </div>
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 rounded-lg bg-muted/30 animate-pulse" />
            ))}
          </div>
        ) : assess.error ? (
          <ErrorNote error={assess.error} />
        ) : report ? (
          <div className={cn('space-y-4 transition-opacity', assess.isPending && 'opacity-60')}>
            {/* Score + verdict */}
            <div className="flex items-center gap-4 rounded-xl border border-border bg-muted/20 p-4">
              <ScoreRing score={report.score} ringClass={VERDICT_META[report.verdict].ring} />
              <div className="space-y-1 min-w-0">
                <div className={cn('text-lg font-bold', VERDICT_META[report.verdict].className)}>
                  {VERDICT_META[report.verdict].label}
                </div>
                <p className="text-xs text-muted-foreground">
                  {report.criticalFailureCount} critical failure{report.criticalFailureCount === 1 ? '' : 's'} · {warnings} warning
                  {warnings === 1 ? '' : 's'}
                </p>
                <p className="text-[10px] font-mono text-muted-foreground/80">{report.modelUsed}</p>
              </div>
            </div>

            {/* AI narrative */}
            {report.narrative && (
              <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  Risk assessment
                </div>
                <p className="text-sm leading-relaxed text-foreground/90">{report.narrative}</p>
                {report.risks.length > 0 && (
                  <ul className="space-y-1 pt-1">
                    {report.risks.map((risk, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <AlertTriangle className="h-3 w-3 text-amber-400 mt-0.5 shrink-0" />
                        {risk}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Checks */}
            <div className="space-y-1.5">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Checks</h4>
              <ul className="rounded-xl border border-border divide-y divide-border/60">
                {report.checks.map((check) => (
                  <CheckRow key={check.id} check={check} onOpenIssue={onOpenIssue} />
                ))}
              </ul>
            </div>

            {/* Suggested fixes */}
            {report.suggestions.length > 0 && (
              <div className="space-y-1.5">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Suggested fixes</h4>
                <div className="space-y-2">
                  {report.suggestions.map((suggestion) => (
                    <div
                      key={suggestion.id}
                      className={cn(
                        'flex items-start justify-between gap-3 rounded-lg border p-3',
                        suggestion.recommended ? 'border-primary/40 bg-primary/5' : 'border-border bg-card',
                      )}
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Wand2 className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="text-sm font-medium">{suggestion.title}</span>
                          {suggestion.recommended && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">
                              AI recommended
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{suggestion.reason}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setReviewing(suggestion)}
                        className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-2xs"
                      >
                        <GitCompareArrows className="h-3.5 w-3.5" />
                        Review {suggestion.operations.length}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </DialogShell>

      <BulkDiffDialog
        projectId={projectId}
        open={Boolean(reviewing)}
        onOpenChange={(open) => {
          if (open) return;
          setReviewing(null);
          // Re-evaluate once the applied change is reflected, so the checks show the new state
          if (appliedRef.current && release) {
            appliedRef.current = false;
            assess.mutate(release.id);
          }
        }}
        operations={reviewing?.operations ?? []}
        source="AI_READINESS"
        title={reviewing?.title ?? ''}
        description={reviewing?.reason}
        onApplied={() => {
          appliedRef.current = true;
        }}
      />
    </>
  );
}

function CheckRow({ check, onOpenIssue }: { check: ReadinessCheck; onOpenIssue: (key: string) => void }) {
  const { icon: Icon, className } = CHECK_ICON[check.status];
  return (
    <li className="flex items-start gap-3 px-3 py-2.5">
      <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', className)} />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{check.label}</span>
          {check.critical && (
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              Critical
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{check.detail}</p>
        {check.status !== 'PASS' && check.issueKeys.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {check.issueKeys.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => onOpenIssue(key)}
                className="font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted hover:bg-primary/15 hover:text-primary border border-border transition-colors"
              >
                {key}
              </button>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

export function ScoreRing({ score, ringClass, size = 64 }: { score: number; ringClass: string; size?: number }) {
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} className="fill-none stroke-muted" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - score / 100)}
          className={cn('fill-none transition-all duration-700 ease-out', ringClass)}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums">{score}</span>
    </div>
  );
}
