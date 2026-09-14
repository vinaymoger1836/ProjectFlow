import { pgTable, uuid, varchar, text, jsonb, timestamp, integer } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { teams } from './teams';
import { users } from './users';

export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'set null' }),
  key: varchar('key', { length: 20 }).notNull(), // e.g., "PROJ", "PAY"
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  leadId: uuid('lead_id')
    .references(() => users.id, { onDelete: 'restrict' })
    .notNull(),
  healthStatus: varchar('health_status', { length: 50 }).default('HEALTHY').notNull(),
  issueCounter: integer('issue_counter').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const projectMembers = pgTable('project_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .references(() => projects.id, { onDelete: 'cascade' })
    .notNull(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  role: varchar('role', { length: 50 }).default('CONTRIBUTOR').notNull(),
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
});

export const projectSettings = pgTable('project_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .references(() => projects.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  workflowStatuses: jsonb('workflow_statuses').notNull(), // List of custom status objects
  issueTypes: jsonb('issue_types').notNull(), // Custom types enabled
  settingsJson: jsonb('settings_json').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
