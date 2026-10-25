'use client';

import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, Mail, Monitor, Smartphone, Loader2, CheckCircle2 } from 'lucide-react';
import { api, NotificationPreference, NotificationSettings } from '@/lib/api';
import { enablePush, disablePush, getCurrentSubscription, getPushSupport, PushSupport } from '@/lib/web-push';
import { DialogShell, ErrorNote, PrimaryButton, CancelButton } from '../common/dialog-primitives';
import { cn } from '@/lib/utils';

type Channel = 'inApp' | 'email' | 'push';

const CHANNELS: { key: Channel; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'inApp', label: 'In-app', icon: Monitor },
  { key: 'email', label: 'Email', icon: Mail },
  { key: 'push', label: 'Push', icon: Smartphone },
];

export function NotificationSettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<NotificationPreference[]>([]);
  const [pushSupport, setPushSupport] = useState<PushSupport>('unsupported');
  const [browserSubscribed, setBrowserSubscribed] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['notifications', 'settings'],
    queryFn: () => api.getNotificationSettings(),
    enabled: open,
  });

  useEffect(() => {
    if (!open || !settings) return;
    setDraft(settings.preferences);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, settings?.preferences]);

  useEffect(() => {
    if (!open) return;
    setPushSupport(getPushSupport());
    void getCurrentSubscription().then((sub) => setBrowserSubscribed(Boolean(sub)));
  }, [open]);

  const save = useMutation({
    mutationFn: () => api.updateNotificationPreferences(draft.map(({ type, inApp, email, push }) => ({ type, inApp, email, push }))),
    onSuccess: (fresh) => {
      queryClient.setQueryData(['notifications', 'settings'], fresh);
      onOpenChange(false);
    },
  });

  const togglePush = useMutation({
    mutationFn: async () => {
      if (browserSubscribed) {
        await disablePush();
      } else {
        if (!settings?.pushPublicKey) throw new Error('Web push is not configured on the server.');
        await enablePush(settings.pushPublicKey);
      }
    },
    onSuccess: async () => {
      setBrowserSubscribed((v) => !v);
      setPushSupport(getPushSupport());
      await queryClient.invalidateQueries({ queryKey: ['notifications', 'settings'] });
    },
  });

  const channelAvailable = (key: Channel, s: NotificationSettings | undefined) =>
    key === 'inApp' || (key === 'email' ? Boolean(s?.channels.email) : Boolean(s?.channels.push));

  const dirty = settings ? JSON.stringify(draft) !== JSON.stringify(settings.preferences) : false;

  return (
    <DialogShell
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          save.reset();
          togglePush.reset();
        }
        onOpenChange(next);
      }}
      icon={<BellRing className="h-4 w-4" />}
      title="Notification settings"
      description="Choose where each kind of notification reaches you. You are never notified about your own actions."
      footer={
        <>
          <CancelButton onClick={() => onOpenChange(false)} />
          <PrimaryButton pending={save.isPending} disabled={!dirty} onClick={() => save.mutate()}>
            Save preferences
          </PrimaryButton>
        </>
      }
    >
      {isLoading || !settings ? (
        <div className="h-24 rounded-lg bg-muted/30 animate-pulse" />
      ) : (
        <>
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="grid grid-cols-[1fr_repeat(3,64px)] items-center gap-2 px-3 py-2 bg-muted/30 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <span>Notify me when</span>
              {CHANNELS.map((c) => (
                <span key={c.key} className="flex items-center justify-center gap-1">
                  <c.icon className="h-3 w-3" />
                  {c.label}
                </span>
              ))}
            </div>
            {draft.map((pref, index) => (
              <div key={pref.type} className="grid grid-cols-[1fr_repeat(3,64px)] items-center gap-2 px-3 py-3 border-t border-border">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{pref.label}</div>
                  <div className="text-[11px] text-muted-foreground">{pref.description}</div>
                </div>
                {CHANNELS.map((c) => {
                  const available = channelAvailable(c.key, settings);
                  return (
                    <label key={c.key} className="flex justify-center" title={available ? undefined : 'Not configured on the server'}>
                      <input
                        type="checkbox"
                        aria-label={`${pref.label}: ${c.label}`}
                        checked={pref[c.key] && available}
                        disabled={!available}
                        onChange={(e) =>
                          setDraft((prev) => prev.map((p, i) => (i === index ? { ...p, [c.key]: e.target.checked } : p)))
                        }
                        className="h-4 w-4 accent-[hsl(var(--primary))] cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                      />
                    </label>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-border p-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <Smartphone className="h-3.5 w-3.5 text-primary" />
                  Push on this browser
                  {browserSubscribed && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {!settings.channels.push
                    ? 'Web push is not configured on the server (VAPID keys missing).'
                    : pushSupport === 'unsupported'
                      ? 'This browser does not support web push.'
                      : pushSupport === 'denied'
                        ? 'Notifications are blocked for this site in your browser settings.'
                        : browserSubscribed
                          ? `This browser receives push notifications (${settings.pushSubscriptionCount} device${settings.pushSubscriptionCount === 1 ? '' : 's'} registered).`
                          : 'Get notified even when ProjectFlow is in the background.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => togglePush.mutate()}
                disabled={!settings.channels.push || pushSupport !== 'supported' || togglePush.isPending}
                className={cn(
                  'shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors disabled:opacity-50',
                  browserSubscribed
                    ? 'border border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90',
                )}
              >
                {togglePush.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {browserSubscribed ? 'Turn off' : 'Enable push'}
              </button>
            </div>
          </div>

          {!settings.channels.email && (
            <p className="text-[11px] text-muted-foreground">Email is not configured on the server (SMTP_HOST missing).</p>
          )}
        </>
      )}

      <ErrorNote error={save.error ?? togglePush.error} />
    </DialogShell>
  );
}
