'use client';

import React from 'react';
import {
  CheckCircle2,
  Bug,
  Clock,
  TrendingUp,
  AlertTriangle,
  User,
  Target,
  Activity,
  Sparkles,
} from 'lucide-react';
import { CopilotStatGridBlock, CopilotStatCard } from '@/lib/api';
import { cn } from '@/lib/utils';

interface GenerativeStatGridProps {
  block: CopilotStatGridBlock;
}

const ICON_MAP = {
  check: CheckCircle2,
  bug: Bug,
  clock: Clock,
  trending: TrendingUp,
  alert: AlertTriangle,
  user: User,
  target: Target,
  activity: Activity,
};

const VARIANT_STYLES: Record<
  NonNullable<CopilotStatCard['variant']>,
  { bg: string; text: string; border: string; iconColor: string }
> = {
  default: {
    bg: 'bg-muted/30 hover:bg-muted/50',
    text: 'text-foreground',
    border: 'border-border/70',
    iconColor: 'text-muted-foreground',
  },
  healthy: {
    bg: 'bg-emerald-500/10 hover:bg-emerald-500/15',
    text: 'text-emerald-500 dark:text-emerald-400',
    border: 'border-emerald-500/30',
    iconColor: 'text-emerald-500 dark:text-emerald-400',
  },
  warning: {
    bg: 'bg-amber-500/10 hover:bg-amber-500/15',
    text: 'text-amber-500 dark:text-amber-400',
    border: 'border-amber-500/30',
    iconColor: 'text-amber-500 dark:text-amber-400',
  },
  critical: {
    bg: 'bg-rose-500/10 hover:bg-rose-500/15',
    text: 'text-rose-500 dark:text-rose-400',
    border: 'border-rose-500/30',
    iconColor: 'text-rose-500 dark:text-rose-400',
  },
  primary: {
    bg: 'bg-primary/10 hover:bg-primary/15',
    text: 'text-primary',
    border: 'border-primary/30',
    iconColor: 'text-primary',
  },
};

export function GenerativeStatGrid({ block }: GenerativeStatGridProps) {
  const { title, stats } = block;

  if (!stats || stats.length === 0) return null;

  return (
    <div className="rounded-xl border border-border/80 bg-card/95 shadow-sm p-3 space-y-2.5 text-xs animate-fade-in my-1.5">
      {title && (
        <div className="flex items-center gap-1.5 font-semibold text-foreground text-xs pb-1 border-b border-border/50">
          <Sparkles className="h-3 w-3 text-primary" />
          <span>{title}</span>
        </div>
      )}

      <div
        className={cn(
          'grid gap-2',
          stats.length === 1
            ? 'grid-cols-1'
            : stats.length === 2
            ? 'grid-cols-2'
            : 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-4',
        )}
      >
        {stats.map((stat, idx) => {
          const variant = stat.variant || 'default';
          const style = VARIANT_STYLES[variant];
          const IconComponent = stat.icon ? ICON_MAP[stat.icon] : null;

          return (
            <div
              key={`${stat.label}-${idx}`}
              className={cn(
                'rounded-lg border p-2.5 flex flex-col justify-between transition-colors duration-150',
                style.bg,
                style.border,
              )}
            >
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                <span className="font-medium truncate pr-1">{stat.label}</span>
                {IconComponent && <IconComponent className={cn('h-3.5 w-3.5 shrink-0', style.iconColor)} />}
              </div>

              <div className="flex items-baseline gap-1.5">
                <span className={cn('text-base font-bold font-mono tracking-tight', style.text)}>
                  {stat.value}
                </span>
                {stat.subtext && (
                  <span className="text-[9px] text-muted-foreground font-medium truncate">
                    {stat.subtext}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
