'use client';

import React from 'react';
import { User, Sparkles } from 'lucide-react';
import { CopilotProfileCardBlock } from '@/lib/api';

interface GenerativeProfileCardProps {
  block: CopilotProfileCardBlock;
}

export function GenerativeProfileCard({ block }: GenerativeProfileCardProps) {
  const { title, subtitle, avatarText, badgeText } = block;

  return (
    <div className="rounded-xl border border-border/80 bg-linear-to-r from-primary/10 via-card to-card p-3 shadow-sm flex items-center justify-between gap-3 text-xs animate-fade-in my-1.5">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="h-9 w-9 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center font-bold text-primary text-xs shrink-0 shadow-xs">
          {avatarText || <User className="h-4 w-4" />}
        </div>
        <div className="min-w-0">
          <div className="font-bold text-foreground text-sm truncate flex items-center gap-1.5">
            <span>{title}</span>
            <Sparkles className="h-3 w-3 text-primary shrink-0" />
          </div>
          {subtitle && (
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>

      {badgeText && (
        <span className="shrink-0 text-[10px] font-medium px-2.5 py-1 rounded-full bg-primary/15 text-primary border border-primary/25">
          {badgeText}
        </span>
      )}
    </div>
  );
}
