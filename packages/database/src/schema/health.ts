import { pgTable, uuid, varchar, integer, date, jsonb, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import type { HealthFactor, ProjectHealthMetrics, ProjectHealthStatus } from '@projectflow/types';
import { projects } from './projects';

/**
 * One row per project per day, overwritten by every recompute that day, so the latest
 * evaluation of each day forms the health trend line.
 */
export const projectHealthSnapshots = pgTable('project_health_snapshots', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .references(() => projects.id, { onDelete: 'cascade' })
    .notNull(),
  snapshotDate: date('snapshot_date', { mode: 'string' }).notNull(), // UTC calendar day, YYYY-MM-DD
  status: varchar('status', { length: 20 }).$type<ProjectHealthStatus>().notNull(),
  score: integer('score').notNull(),
  factors: jsonb('factors').$type<HealthFactor[]>().default([]).notNull(),
  metrics: jsonb('metrics').$type<ProjectHealthMetrics>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('project_health_snapshots_project_date_idx').on(table.projectId, table.snapshotDate),
]).enableRLS();
