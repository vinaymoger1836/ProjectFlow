import { Injectable, Inject, Logger, NotFoundException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { aliasedTable, and, count, desc, eq, inArray, isNull, lt } from 'drizzle-orm';
import { Database, notifications, notificationPreferences, pushSubscriptions, users } from '@projectflow/database';
import {
  NotificationItem,
  NotificationPage,
  NotificationSettings,
  NotificationType,
} from '@projectflow/types';
import { DRIZZLE_DB } from '../database/database.module';
import { EventsGateway } from '../events/events.gateway';
import { EmailService } from './email.service';
import { PushService } from './push.service';
import {
  NOTIFICATION_CATALOG,
  NOTIFICATION_DELIVERY_QUEUE,
  NOTIFICATION_TYPES,
  DeliveryJobData,
} from './notifications.constants';
import {
  NotificationQueryDto,
  PushSubscriptionDto,
  UpdateNotificationPreferencesDto,
} from './dto/notification.dto';

const actor = aliasedTable(users, 'notification_actor');
const DEFAULT_PAGE_SIZE = 20;

export interface NotifyInput {
  recipientId: string;
  organizationId: string;
  projectId: string | null;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  entityType: string | null;
  entityId: string | null;
  actorId: string | null;
}

type ChannelPreferences = { inApp: boolean; email: boolean; push: boolean };

/**
 * Notification Engine: preference check → in-app row (+ real-time badge update) → email and
 * web push jobs on BullMQ. Channel failures never affect the action that triggered them.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly webUrl: string;

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    @InjectQueue(NOTIFICATION_DELIVERY_QUEUE) private readonly deliveryQueue: Queue<DeliveryJobData>,
    private readonly email: EmailService,
    private readonly push: PushService,
    config: ConfigService,
    @Optional() private readonly eventsGateway?: EventsGateway,
  ) {
    this.webUrl = config.get<string>('WEB_URL', 'http://localhost:3000').replace(/\/$/, '');
  }

  async notify(input: NotifyInput): Promise<void> {
    const prefs = await this.resolvePreferences(input.recipientId, input.type);

    if (prefs.inApp) {
      const [row] = await this.db
        .insert(notifications)
        .values({
          userId: input.recipientId,
          organizationId: input.organizationId,
          projectId: input.projectId,
          type: input.type,
          title: input.title,
          body: input.body,
          link: input.link,
          entityType: input.entityType,
          entityId: input.entityId,
          actorId: input.actorId,
        })
        .returning({ id: notifications.id });

      this.eventsGateway?.emitToUser(input.recipientId, 'notification:new', {
        id: row.id,
        title: input.title,
        unreadCount: await this.unreadCount(input.recipientId),
      });
    }

    const job = { recipientId: input.recipientId, notificationType: input.type, title: input.title, body: input.body, link: input.link };
    if (prefs.email && this.email.isEnabled()) await this.enqueue({ ...job, channel: 'EMAIL' });
    if (prefs.push && this.push.isEnabled()) await this.enqueue({ ...job, channel: 'PUSH' });
  }

  async list(userId: string, query: NotificationQueryDto): Promise<NotificationPage> {
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const rows = await this.db
      .select({
        id: notifications.id,
        type: notifications.type,
        title: notifications.title,
        body: notifications.body,
        link: notifications.link,
        projectId: notifications.projectId,
        entityType: notifications.entityType,
        entityId: notifications.entityId,
        readAt: notifications.readAt,
        createdAt: notifications.createdAt,
        actorId: actor.id,
        actorName: actor.name,
        actorAvatarUrl: actor.avatarUrl,
      })
      .from(notifications)
      .leftJoin(actor, eq(actor.id, notifications.actorId))
      .where(
        and(
          eq(notifications.userId, userId),
          query.before ? lt(notifications.createdAt, new Date(query.before)) : undefined,
          query.unreadOnly ? isNull(notifications.readAt) : undefined,
        ),
      )
      .orderBy(desc(notifications.createdAt))
      .limit(limit);

    const items: NotificationItem[] = rows.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      body: r.body,
      link: r.link,
      projectId: r.projectId,
      entityType: r.entityType,
      entityId: r.entityId,
      actor: r.actorId ? { id: r.actorId, name: r.actorName ?? 'Someone', avatarUrl: r.actorAvatarUrl } : null,
      readAt: r.readAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    }));

    return {
      items,
      unreadCount: await this.unreadCount(userId),
      nextCursor: items.length === limit ? items[items.length - 1].createdAt : null,
    };
  }

  async unreadCount(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
    return row?.value ?? 0;
  }

  async markRead(userId: string, notificationId: string): Promise<{ unreadCount: number }> {
    const [row] = await this.db
      .select({ id: notifications.id })
      .from(notifications)
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
      .limit(1);
    if (!row) throw new NotFoundException(`Notification '${notificationId}' not found.`);

    await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.id, notificationId), isNull(notifications.readAt)));
    return this.publishUnreadCount(userId);
  }

  async markAllRead(userId: string): Promise<{ unreadCount: number }> {
    await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
    return this.publishUnreadCount(userId);
  }

  async getSettings(userId: string): Promise<NotificationSettings> {
    const [stored, [subs]] = await Promise.all([
      this.db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId)),
      this.db.select({ value: count() }).from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId)),
    ]);
    const byType = new Map(stored.map((p) => [p.type, p]));

    return {
      preferences: NOTIFICATION_TYPES.map((type) => {
        const def = NOTIFICATION_CATALOG[type];
        const pref = byType.get(type);
        return {
          type,
          label: def.label,
          description: def.description,
          inApp: pref?.inApp ?? def.defaults.inApp,
          email: pref?.email ?? def.defaults.email,
          push: pref?.push ?? def.defaults.push,
        };
      }),
      channels: { email: this.email.isEnabled(), push: this.push.isEnabled() },
      pushPublicKey: this.push.publicKey,
      pushSubscriptionCount: subs?.value ?? 0,
    };
  }

  async updatePreferences(userId: string, dto: UpdateNotificationPreferencesDto): Promise<NotificationSettings> {
    const now = new Date();
    for (const pref of dto.preferences) {
      await this.db
        .insert(notificationPreferences)
        .values({ userId, type: pref.type, inApp: pref.inApp, email: pref.email, push: pref.push, updatedAt: now })
        .onConflictDoUpdate({
          target: [notificationPreferences.userId, notificationPreferences.type],
          set: { inApp: pref.inApp, email: pref.email, push: pref.push, updatedAt: now },
        });
    }
    return this.getSettings(userId);
  }

  /** Registers (or re-assigns) a browser's push subscription to the current user. */
  async savePushSubscription(userId: string, dto: PushSubscriptionDto): Promise<NotificationSettings> {
    await this.db
      .insert(pushSubscriptions)
      .values({
        userId,
        endpoint: dto.endpoint,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        userAgent: dto.userAgent ?? null,
      })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: { userId, p256dh: dto.keys.p256dh, auth: dto.keys.auth, userAgent: dto.userAgent ?? null },
      });
    return this.getSettings(userId);
  }

  async removePushSubscription(userId: string, endpoint: string): Promise<NotificationSettings> {
    await this.db
      .delete(pushSubscriptions)
      .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
    return this.getSettings(userId);
  }

  // ---------------------------------------------------------------------------
  // Channel delivery (called by the BullMQ worker)
  // ---------------------------------------------------------------------------

  async deliverEmail(job: DeliveryJobData): Promise<'sent' | 'skipped'> {
    const [recipient] = await this.db
      .select({ email: users.email, name: users.name, isActive: users.isActive })
      .from(users)
      .where(eq(users.id, job.recipientId))
      .limit(1);
    if (!recipient?.email || !recipient.isActive) return 'skipped';

    const url = job.link ? `${this.webUrl}${job.link}` : this.webUrl;
    await this.email.send({
      to: recipient.email,
      subject: job.title,
      text: [`Hi ${recipient.name},`, '', job.title, job.body ?? '', '', `Open in ProjectFlow: ${url}`].join('\n'),
      html: renderEmail(recipient.name, job.title, job.body, url),
    });
    return 'sent';
  }

  async deliverPush(job: DeliveryJobData): Promise<{ sent: number; removed: number }> {
    const subs = await this.db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, job.recipientId));
    let sent = 0;
    const gone: string[] = [];

    for (const sub of subs) {
      const outcome = await this.push.send(sub, {
        title: job.title,
        body: job.body,
        url: job.link,
        tag: `${job.notificationType}:${job.link ?? ''}`,
      });
      if (outcome === 'gone') gone.push(sub.id);
      else sent += 1;
    }

    if (gone.length > 0) {
      await this.db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, gone));
    }
    if (sent > 0) {
      await this.db
        .update(pushSubscriptions)
        .set({ lastUsedAt: new Date() })
        .where(and(eq(pushSubscriptions.userId, job.recipientId)));
    }
    return { sent, removed: gone.length };
  }

  private async resolvePreferences(userId: string, type: NotificationType): Promise<ChannelPreferences> {
    const [pref] = await this.db
      .select()
      .from(notificationPreferences)
      .where(and(eq(notificationPreferences.userId, userId), eq(notificationPreferences.type, type)))
      .limit(1);
    return pref ?? NOTIFICATION_CATALOG[type].defaults;
  }

  private async publishUnreadCount(userId: string): Promise<{ unreadCount: number }> {
    const unreadCount = await this.unreadCount(userId);
    this.eventsGateway?.emitToUser(userId, 'notification:read', { unreadCount });
    return { unreadCount };
  }

  private async enqueue(data: DeliveryJobData) {
    try {
      await this.deliveryQueue.add(data.channel, data);
    } catch (err) {
      this.logger.warn(`Failed to enqueue ${data.channel} notification: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

function renderEmail(name: string, title: string, body: string | null, url: string): string {
  return `<!doctype html><html><body style="margin:0;background:#0b0f19;font-family:Segoe UI,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:520px;background:#111827;border:1px solid #1f2937;border-radius:12px">
<tr><td style="padding:24px 28px;color:#e5e7eb">
<div style="font-size:13px;color:#60a5fa;font-weight:600;margin-bottom:12px">ProjectFlow</div>
<p style="margin:0 0 8px;font-size:14px;color:#9ca3af">Hi ${escapeHtml(name)},</p>
<h1 style="margin:0 0 8px;font-size:18px;color:#f9fafb">${escapeHtml(title)}</h1>
${body ? `<p style="margin:0 0 20px;font-size:14px;line-height:1.5;color:#d1d5db">${escapeHtml(body)}</p>` : ''}
<a href="${escapeHtml(url)}" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:10px 16px;border-radius:8px">Open in ProjectFlow</a>
<p style="margin:24px 0 0;font-size:11px;color:#6b7280">You can change which emails you receive in ProjectFlow notification settings.</p>
</td></tr></table></td></tr></table></body></html>`;
}
