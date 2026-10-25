'use client';

import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { CopilotRiskReportBlock } from '@/lib/api';
import { HEALTH_STATUS_META, SEVERITY_META } from './health-utils';
import { cn } from '@/lib/utils';

/**
 * Generative RiskReport: per-project status chips and the highest-severity risk factors,
 * with drill-down into the affected issues.
 */
export function RiskReportCard({ block, onOpenIssue }: { block: CopilotRiskReportBlock; onOpenIssue?: (issueKey: string) => void }) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <ShieldAlert className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">{block.title}</h3>
      </div>

      <div className="flex flex-wrap gap-2 px-4 py-3 border-b border-border">
        {block.projects.map((p) => {
          const meta = HEALTH_STATUS_META[p.status];
          return (
            <span
              key={p.projectId}
              title={p.projectName}
              className={cn('inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-lg border', meta.badge)}
            >
              <span className="font-mono">{p.projectKey}</span>
              <span>{meta.label}</span>
              <span className="font-mono opacity-80">{p.score}</span>
            </span>
          );
        })}
      </div>

      {block.risks.length === 0 ? (
        <p className="px-4 py-4 text-xs text-emerald-400">No warnings or critical risks across these projects.</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {block.risks.map((risk, i) => {
            const sev = SEVERITY_META[risk.severity];
            return (
              <li key={`${risk.projectKey}-${risk.label}-${i}`} className="flex items-start gap-3 px-4 py-2.5">
                <span className={cn('h-2 w-2 rounded-full mt-1.5 shrink-0', sev.dot)} />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-semibold text-muted-foreground">{risk.projectKey}</span>
                    <span className="text-xs font-semibold">{risk.label}</span>
                    <span className={cn('text-[10px] font-semibold', sev.text)}>{sev.label}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{risk.detail}</p>
                  {risk.issueKeys.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {risk.issueKeys.slice(0, 8).map((key) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => onOpenIssue?.(key)}
                          disabled={!onOpenIssue}
                          className="font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted hover:bg-primary/15 hover:text-primary border border-border transition-colors"
                        >
                          {key}
                        </button>
                      ))}
                      {risk.issueKeys.length > 8 && (
                        <span className="text-[10px] text-muted-foreground self-center">+{risk.issueKeys.length - 8} more</span>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
