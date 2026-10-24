'use client';

import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export const inputClass =
  'w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-shadow';
export const labelClass = 'text-xs font-semibold text-muted-foreground';

const SIZE_CLASS = {
  md: 'max-w-lg',
  lg: 'max-w-2xl',
} as const;

export function DialogShell({
  open,
  onOpenChange,
  title,
  description,
  icon,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer: React.ReactNode;
  size?: keyof typeof SIZE_CLASS;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-fade-in" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-h-[88vh] flex flex-col -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card shadow-2xl data-[state=open]:animate-fade-in focus:outline-none',
            SIZE_CLASS[size],
          )}
        >
          <div className="flex items-start justify-between gap-4 px-5 pt-5">
            <div className="flex items-start gap-3">
              {icon && (
                <div className="h-8 w-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
                  {icon}
                </div>
              )}
              <div>
                <Dialog.Title className="text-base font-semibold">{title}</Dialog.Title>
                {description ? (
                  <Dialog.Description className="text-xs text-muted-foreground mt-0.5">{description}</Dialog.Description>
                ) : (
                  <Dialog.Description className="sr-only">{title}</Dialog.Description>
                )}
              </div>
            </div>
            <Dialog.Close className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Dialog.Close>
          </div>
          <div className="px-5 py-4 space-y-4 overflow-y-auto">{children}</div>
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-muted/20 rounded-b-xl shrink-0">
            {footer}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p className="flex items-start gap-1.5 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      <span>{error instanceof Error ? error.message : 'Something went wrong.'}</span>
    </p>
  );
}

export function PrimaryButton({
  children,
  pending,
  disabled,
  onClick,
  tone = 'primary',
}: {
  children: React.ReactNode;
  pending?: boolean;
  disabled?: boolean;
  onClick: () => void;
  tone?: 'primary' | 'success' | 'danger';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || pending}
      className={cn(
        'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold shadow-sm transition-colors disabled:opacity-50',
        tone === 'success' && 'bg-emerald-500 text-black hover:bg-emerald-400',
        tone === 'danger' && 'bg-amber-500 text-black hover:bg-amber-400',
        tone === 'primary' && 'bg-primary text-primary-foreground hover:bg-primary/90',
      )}
    >
      {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </button>
  );
}

export function CancelButton({ onClick, label = 'Cancel' }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
    >
      {label}
    </button>
  );
}
