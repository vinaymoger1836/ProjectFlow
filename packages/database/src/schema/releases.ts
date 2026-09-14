import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core';
import { projects } from './projects';
import { issues } from './issues';

export const releases = pgTable('releases', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .references(() => projects.id, { onDelete: 'cascade' })
    .notNull(),
  version: varchar('version', { length: 50 }).notNull(), // e.g. "v1.0.0"
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 50 }).default('PLANNED').notNull(), // PLANNED, IN_PROGRESS, READY_FOR_RELEASE, RELEASED
  targetDate: timestamp('target_date', { withTimezone: true }),
  releaseNotes: text('release_notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const releaseIssues = pgTable('release_issues', {
  id: uuid('id').defaultRandom().primaryKey(),
  releaseId: uuid('release_id')
    .references(() => releases.id, { onDelete: 'cascade' })
    .notNull(),
  issueId: uuid('issue_id')
    .references(() => issues.id, { onDelete: 'cascade' })
    .notNull(),
  addedAt: timestamp('added_at', { withTimezone: true }).defaultNow().notNull(),
});
