import { pgTable, uuid, varchar, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { projects } from './projects';
import { issues } from './issues';

export const milestones = pgTable('milestones', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .references(() => projects.id, { onDelete: 'cascade' })
    .notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  targetDate: timestamp('target_date', { withTimezone: true }),
  completionPercentage: integer('completion_percentage').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const milestoneIssues = pgTable('milestone_issues', {
  id: uuid('id').defaultRandom().primaryKey(),
  milestoneId: uuid('milestone_id')
    .references(() => milestones.id, { onDelete: 'cascade' })
    .notNull(),
  issueId: uuid('issue_id')
    .references(() => issues.id, { onDelete: 'cascade' })
    .notNull(),
  addedAt: timestamp('added_at', { withTimezone: true }).defaultNow().notNull(),
});
