import { pgTable, uuid, varchar, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { projects } from './projects';
import { issues } from './issues';

export const sprints = pgTable('sprints', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .references(() => projects.id, { onDelete: 'cascade' })
    .notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  goal: text('goal'),
  status: varchar('status', { length: 50 }).default('PLANNED').notNull(), // PLANNED, ACTIVE, COMPLETED, CANCELLED
  capacityPoints: integer('capacity_points'),
  startDate: timestamp('start_date', { withTimezone: true }),
  endDate: timestamp('end_date', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const sprintIssues = pgTable('sprint_issues', {
  id: uuid('id').defaultRandom().primaryKey(),
  sprintId: uuid('sprint_id')
    .references(() => sprints.id, { onDelete: 'cascade' })
    .notNull(),
  issueId: uuid('issue_id')
    .references(() => issues.id, { onDelete: 'cascade' })
    .notNull(),
  orderIndex: integer('order_index').default(0).notNull(),
  addedAt: timestamp('added_at', { withTimezone: true }).defaultNow().notNull(),
});
