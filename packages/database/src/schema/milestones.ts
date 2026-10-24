import { pgTable, uuid, varchar, text, timestamp, index } from 'drizzle-orm/pg-core';
import { projects } from './projects';

/**
 * Cross-sprint goals. Membership lives on `issues.milestone_id` (an issue counts toward at
 * most one milestone); completion and slip status are computed live from those issues.
 */
export const milestones = pgTable('milestones', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .references(() => projects.id, { onDelete: 'cascade' })
    .notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  targetDate: timestamp('target_date', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('milestones_project_id_idx').on(table.projectId),
]).enableRLS();
