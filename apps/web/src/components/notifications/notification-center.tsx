'use client';

import React, { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, Settings2, Inbox, Loader2 } from 'lucide-react';
import { api, NotificationItem } from '@/lib/api';
import { formatRelativeTime } from '../health/health-utils';
import { NotificationSettingsDialog } from './notification-settings-dialog';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 15;

/**
 * Header bell: unread badge, notification inbox popover, and access to channel preferences.
 * Real-time updates arrive through the socket's per-user room (see use-socket).
 */
export function NotificationCenter({ onOpenIssue }: { onOpenIssue: (issueKey: string) => void }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { data: unread } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api.getUnreadNotificationCount(),
    refetchInterval: 60_000,
  });

  const inbox = useInfiniteQuery({
    queryKey: ['notifications', 'inbox'],
    queryFn: ({ pageParam }) => api.listNotifications({ before: pageParam, limit: PAGE_SIZE }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: open,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['notifications'] });

  const markRead = useMutation({ mutationFn: (id: string) => api.markNotificationRead(id), onSuccess: refresh });
  const markAll = useMutation({ mutationFn: () => api.markAllNotificationsRead(), onSuccess: refresh });

  const unreadCount = unread?.unreadCount ?? 0;
  const items = inbox.data?.pages.flatMap((p) => p.items) ?? [];

  const handleOpen = (item: NotificationItem) => {
    if (!item.readAt) markRead.mutate(item.id);
    const issueKey = item.link ? new URLSearchParams(item.link.split('?')[1] ?? '').get('issue') : null;
    if (issueKey) {
      setOpen(false);
      onOpenIssue(issueKey);
    }
  };

  return (
    <>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
            className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground relative transition-colors"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center animate-fade-in">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="end"
            sideOffset={8}
            className="z-50 w-[380px] max-w-[calc(100vw-1rem)] rounded-xl border border-border bg-card shadow-2xl data-[state=open]:animate-fade-in focus:outline-none"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">{unreadCount} new</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => markAll.mutate()}
                  disabled={unreadCount === 0 || markAll.isPending}
                  title="Mark all as read"
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 transition-colors"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setSettingsOpen(true);
                  }}
                  title="Notification settings"
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="max-h-[420px] overflow-y-auto">
              {inbox.isLoading ? (
                <div className="p-3 space-y-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-12 rounded-lg bg-muted/30 animate-pulse" />
                  ))}
                </div>
              ) : items.length === 0 ? (
                <div className="px-6 py-10 text-center space-y-2">
                  <Inbox className="h-6 w-6 text-muted-foreground mx-auto" />
                  <p className="text-sm font-medium">You&apos;re all caught up</p>
                  <p className="text-xs text-muted-foreground">Issues assigned to you by teammates show up here.</p>
                </div>
              ) : (
                <ul className="divide-y divide-border/60">
                  {items.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => handleOpen(item)}
                        className={cn(
                          'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40',
                          !item.readAt && 'bg-primary/5',
                        )}
                      >
                        <span className="h-7 w-7 rounded-full bg-primary/15 text-primary text-[11px] font-bold flex items-center justify-center shrink-0 border border-primary/20">
                          {item.actor?.name.charAt(0).toUpperCase() ?? 'P'}
                        </span>
                        <span className="min-w-0 flex-1 space-y-0.5">
                          <span className={cn('block text-sm truncate', !item.readAt ? 'font-semibold' : 'text-foreground/90')}>
                            {item.title}
                          </span>
                          {item.body && <span className="block text-xs text-muted-foreground truncate">{item.body}</span>}
                          <span className="block text-[10px] text-muted-foreground/80">{formatRelativeTime(item.createdAt)}</span>
                        </span>
                        {!item.readAt && <span className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" aria-label="Unread" />}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {inbox.hasNextPage && (
                <button
                  type="button"
                  onClick={() => inbox.fetchNextPage()}
                  disabled={inbox.isFetchingNextPage}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground border-t border-border transition-colors"
                >
                  {inbox.isFetchingNextPage && <Loader2 className="h-3 w-3 animate-spin" />}
                  Load older
                </button>
              )}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      <NotificationSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
