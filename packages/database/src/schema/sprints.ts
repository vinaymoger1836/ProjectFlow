import { pgTable, uuid, varchar, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import type { SprintStatus } from '@projectflow/types';
import { projects } from './projects';

/**
 * Sprint membership lives on `issues.sprint_id` (an issue belongs to at most one sprint).
 * Commitment and completion are snapshotted here at start/complete so velocity survives
 * later scope changes and issue edits.
 */
export const sprints = pgTable('sprints', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .references(() => projects.id, { onDelete: 'cascade' })
    .notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  goal: text('goal'),
  status: varchar('status', { length: 50 }).$type<SprintStatus>().default('PLANNED').notNull(), // PLANNED, ACTIVE, COMPLETED, CANCELLED
  capacityPoints: integer('capacity_points'),
  startDate: timestamp('start_date', { withTimezone: true }),
  endDate: timestamp('end_date', { withTimezone: true }),
  // Snapshot taken when the sprint starts
  startedAt: timestamp('started_at', { withTimezone: true }),
  committedPoints: integer('committed_points'),
  committedIssueCount: integer('committed_issue_count'),
  // Snapshot taken when the sprint completes (completed points = velocity)
  completedAt: timestamp('completed_at', { withTimezone: true }),
  completedPoints: integer('completed_points'),
  completedIssueCount: integer('completed_issue_count'),
  carriedOverIssueCount: integer('carried_over_issue_count'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('sprints_project_id_status_idx').on(table.projectId, table.status),
]);
