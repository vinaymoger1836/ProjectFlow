import { pgTable, uuid, varchar, text, boolean, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import type { NotificationType } from '@projectflow/types';
import { users } from './users';
import { organizations } from './organizations';
import { projects } from './projects';

/** In-app notification inbox, one row per recipient. */
export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  organizationId: uuid('organization_id')
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 50 }).$type<NotificationType>().notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  body: text('body'),
  entityType: varchar('entity_type', { length: 50 }), // ISSUE, RELEASE, ...
  entityId: uuid('entity_id'),
  link: text('link'), // relative app link, e.g. "/?issue=PAY-12"
  actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('notifications_user_created_idx').on(table.userId, table.createdAt),
  index('notifications_user_unread_idx').on(table.userId, table.readAt),
]).enableRLS();

/** Per-user, per-type channel opt-outs. A missing row means the type's defaults apply. */
export const notificationPreferences = pgTable('notification_preferences', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  type: varchar('type', { length: 50 }).$type<NotificationType>().notNull(),
  inApp: boolean('in_app').notNull(),
  email: boolean('email').notNull(),
  push: boolean('push').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('notification_preferences_user_type_idx').on(table.userId, table.type),
]).enableRLS();

/** Web Push subscriptions (one per browser/device). */
export const pushSubscriptions = pgTable('push_subscriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  endpoint: text('endpoint').notNull(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  userAgent: varchar('user_agent', { length: 500 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
}, (table) => [
  uniqueIndex('push_subscriptions_endpoint_idx').on(table.endpoint),
  index('push_subscriptions_user_idx').on(table.userId),
]).enableRLS();
