import { pgTable, uuid, varchar, text, jsonb, integer, timestamp } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { users } from './users';

export const activities = pgTable('activities', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  projectId: uuid('project_id'),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'set null' }),
  entityType: varchar('entity_type', { length: 50 }).notNull(), // PROJECT, ISSUE, SPRINT, MILESTONE, RELEASE
  entityId: uuid('entity_id').notNull(),
  action: varchar('action', { length: 100 }).notNull(), // CREATED, UPDATED, DELETED, STATUS_CHANGED, ASSIGNED
  details: jsonb('details').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  action: varchar('action', { length: 100 }).notNull(),
  resource: varchar('resource', { length: 100 }).notNull(),
  payload: jsonb('payload').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const aiAuditTrail = pgTable('ai_audit_trail', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  projectId: uuid('project_id'),
  userPrompt: text('user_prompt').notNull(),
  toolsCalled: jsonb('tools_called').default([]).notNull(),
  modelName: varchar('model_name', { length: 100 }).notNull(),
  promptTokens: integer('prompt_tokens'),
  completionTokens: integer('completion_tokens'),
  latencyMs: integer('latency_ms'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
