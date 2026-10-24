import { pgTable, uuid, varchar, text, integer, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import type { ReleaseStatus } from '@projectflow/types';
import { projects } from './projects';

/**
 * Shippable versions. Membership lives on `issues.release_id` (an issue ships in at most one
 * release). Shipping snapshots what went out; unfinished issues are carried over or unassigned.
 */
export const releases = pgTable('releases', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .references(() => projects.id, { onDelete: 'cascade' })
    .notNull(),
  version: varchar('version', { length: 50 }).notNull(), // e.g. "v1.0.0"
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 50 }).$type<ReleaseStatus>().default('PLANNED').notNull(), // PLANNED, IN_PROGRESS, READY_FOR_RELEASE, RELEASED
  targetDate: timestamp('target_date', { withTimezone: true }),
  releaseNotes: text('release_notes'),
  // Snapshot taken when the release ships
  releasedAt: timestamp('released_at', { withTimezone: true }),
  shippedIssueCount: integer('shipped_issue_count'),
  carriedOverIssueCount: integer('carried_over_issue_count'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('releases_project_id_version_idx').on(table.projectId, table.version),
  index('releases_project_id_status_idx').on(table.projectId, table.status),
]).enableRLS();
