import { pgTable, uuid, varchar, text, boolean, integer, jsonb, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import type {
  AutomationAction,
  AutomationCondition,
  AutomationRunDetails,
  AutomationRunStatus,
  AutomationTrigger,
  AutomationTriggerType,
} from '@projectflow/types';
import { projects } from './projects';
import { users } from './users';
import { issues } from './issues';

/**
 * Project automation rule: Trigger → Conditions (AND) → Actions, stored as validated JSON (ADR-025).
 * `trigger_type` duplicates `trigger.type` so event lookups can filter without reading JSON.
 */
export const automations = pgTable('automations', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .references(() => projects.id, { onDelete: 'cascade' })
    .notNull(),
  name: varchar('name', { length: 120 }).notNull(),
  description: text('description'),
  enabled: boolean('enabled').default(true).notNull(),
  triggerType: varchar('trigger_type', { length: 30 }).$type<AutomationTriggerType>().notNull(),
  trigger: jsonb('trigger').$type<AutomationTrigger>().notNull(),
  conditions: jsonb('conditions').$type<AutomationCondition[]>().default([]).notNull(),
  actions: jsonb('actions').$type<AutomationAction[]>().notNull(),
  createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('automations_project_trigger_idx').on(table.projectId, table.triggerType),
]).enableRLS();

/**
 * One row per execution. `trigger_key` identifies the triggering occurrence (issue or schedule slot),
 * so a retried or duplicated job cannot notify twice.
 */
export const automationRuns = pgTable('automation_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  automationId: uuid('automation_id')
    .references(() => automations.id, { onDelete: 'cascade' })
    .notNull(),
  projectId: uuid('project_id')
    .references(() => projects.id, { onDelete: 'cascade' })
    .notNull(),
  triggerType: varchar('trigger_type', { length: 30 }).$type<AutomationTriggerType>().notNull(),
  triggerKey: varchar('trigger_key', { length: 200 }).notNull(),
  manual: boolean('manual').default(false).notNull(),
  issueId: uuid('issue_id').references(() => issues.id, { onDelete: 'set null' }),
  status: varchar('status', { length: 20 }).$type<AutomationRunStatus>().notNull(),
  matchedCount: integer('matched_count').default(0).notNull(),
  notifiedCount: integer('notified_count').default(0).notNull(),
  error: text('error'),
  details: jsonb('details').$type<AutomationRunDetails>(),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
}, (table) => [
  uniqueIndex('automation_runs_automation_trigger_key_idx').on(table.automationId, table.triggerKey),
  index('automation_runs_automation_started_idx').on(table.automationId, table.startedAt),
  index('automation_runs_project_started_idx').on(table.projectId, table.startedAt),
]).enableRLS();
