import type { HealthFactorSeverity, ProjectHealthStatus } from '@projectflow/types';

export const HEALTH_STATUS_META: Record<
  ProjectHealthStatus,
  { label: string; text: string; badge: string; ring: string; stroke: string }
> = {
  HEALTHY: {
    label: 'Healthy',
    text: 'text-emerald-400',
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    ring: 'stroke-emerald-500',
    stroke: '#10b981',
  },
  AT_RISK: {
    label: 'At risk',
    text: 'text-amber-400',
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    ring: 'stroke-amber-500',
    stroke: '#f59e0b',
  },
  CRITICAL: {
    label: 'Critical',
    text: 'text-red-400',
    badge: 'bg-red-500/10 text-red-400 border-red-500/30',
    ring: 'stroke-red-500',
    stroke: '#ef4444',
  },
};

export const SEVERITY_META: Record<HealthFactorSeverity, { label: string; dot: string; text: string }> = {
  critical: { label: 'Critical', dot: 'bg-red-500', text: 'text-red-400' },
  warning: { label: 'Warning', dot: 'bg-amber-500', text: 'text-amber-400' },
  info: { label: 'Info', dot: 'bg-sky-500', text: 'text-sky-400' },
};

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

export function formatRelativeTime(iso: string, now = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return relative.format(seconds, 'second');
  if (abs < 3600) return relative.format(Math.round(seconds / 60), 'minute');
  if (abs < 86400) return relative.format(Math.round(seconds / 3600), 'hour');
  return relative.format(Math.round(seconds / 86400), 'day');
}
