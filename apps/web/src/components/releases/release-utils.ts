import type { MilestoneHealth, ReadinessVerdict, ReleaseStatus } from '@projectflow/types';

export const RELEASE_STATUS_META: Record<ReleaseStatus, { label: string; className: string }> = {
  PLANNED: { label: 'Planned', className: 'bg-sky-500/10 text-sky-400 border-sky-500/30' },
  IN_PROGRESS: { label: 'In progress', className: 'bg-violet-500/10 text-violet-400 border-violet-500/30' },
  READY_FOR_RELEASE: { label: 'Ready', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  RELEASED: { label: 'Released', className: 'bg-muted text-muted-foreground border-border' },
};

export const MILESTONE_HEALTH_META: Record<MilestoneHealth, { label: string; className: string; bar: string }> = {
  ON_TRACK: { label: 'On track', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', bar: 'bg-emerald-500' },
  AT_RISK: { label: 'At risk', className: 'bg-amber-500/10 text-amber-400 border-amber-500/30', bar: 'bg-amber-500' },
  OVERDUE: { label: 'Overdue', className: 'bg-red-500/10 text-red-400 border-red-500/30', bar: 'bg-red-500' },
  NO_TARGET: { label: 'No target', className: 'bg-muted text-muted-foreground border-border', bar: 'bg-primary' },
  COMPLETED: { label: 'Completed', className: 'bg-primary/10 text-primary border-primary/30', bar: 'bg-primary' },
};

export const VERDICT_META: Record<ReadinessVerdict, { label: string; className: string; ring: string }> = {
  READY: { label: 'Ready', className: 'text-emerald-400', ring: 'stroke-emerald-500' },
  AT_RISK: { label: 'At risk', className: 'text-amber-400', ring: 'stroke-amber-500' },
  NOT_READY: { label: 'Not ready', className: 'text-red-400', ring: 'stroke-red-500' },
};

/** Next forward step offered on a release card. */
export const NEXT_STATUS: Partial<Record<ReleaseStatus, { status: Exclude<ReleaseStatus, 'RELEASED'>; label: string }>> = {
  PLANNED: { status: 'IN_PROGRESS', label: 'Start' },
  IN_PROGRESS: { status: 'READY_FOR_RELEASE', label: 'Mark ready' },
};

const longDate = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export function formatDate(iso: string | null | undefined): string | null {
  return iso ? longDate.format(new Date(iso)) : null;
}
