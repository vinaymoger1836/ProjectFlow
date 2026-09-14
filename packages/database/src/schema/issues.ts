import { pgTable, uuid, varchar, text, integer, timestamp, boolean } from 'drizzle-orm/pg-core';
import { projects } from './projects';
import { users } from './users';

export const issues = pgTable('issues', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .references(() => projects.id, { onDelete: 'cascade' })
    .notNull(),
  issueKey: varchar('issue_key', { length: 50 }).notNull(), // e.g. "PROJ-1"
  keyNumber: integer('key_number').notNull(), // 1, 2, 3... sequential per project
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  type: varchar('type', { length: 50 }).notNull(), // TASK, BUG, STORY, EPIC, SUBTASK
  status: varchar('status', { length: 50 }).default('TODO').notNull(), // Default to TODO
  priority: varchar('priority', { length: 10 }).notNull(), // P0, P1, P2, P3, P4
  assigneeId: uuid('assignee_id').references(() => users.id, { onDelete: 'set null' }),
  reporterId: uuid('reporter_id')
    .references(() => users.id, { onDelete: 'restrict' })
    .notNull(),
  parentIssueId: uuid('parent_issue_id'),
  sprintId: uuid('sprint_id'),
  milestoneId: uuid('milestone_id'),
  releaseId: uuid('release_id'),
  storyPoints: integer('story_points'),
  estimateHours: integer('estimate_hours'),
  dueDate: timestamp('due_date', { withTimezone: true }),
  isArchived: boolean('is_archived').default(false).notNull(), // Soft delete flag
  deletedAt: timestamp('deleted_at', { withTimezone: true }), // Soft delete timestamp
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  closedAt: timestamp('closed_at', { withTimezone: true }),
});

export const issueComments = pgTable('issue_comments', {
  id: uuid('id').defaultRandom().primaryKey(),
  issueId: uuid('issue_id')
    .references(() => issues.id, { onDelete: 'cascade' })
    .notNull(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const labels = pgTable('labels', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .references(() => projects.id, { onDelete: 'cascade' })
    .notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  color: varchar('color', { length: 20 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const issueLabels = pgTable('issue_labels', {
  id: uuid('id').defaultRandom().primaryKey(),
  issueId: uuid('issue_id')
    .references(() => issues.id, { onDelete: 'cascade' })
    .notNull(),
  labelId: uuid('label_id')
    .references(() => labels.id, { onDelete: 'cascade' })
    .notNull(),
});

export const issueDependencies = pgTable('issue_dependencies', {
  id: uuid('id').defaultRandom().primaryKey(),
  sourceIssueId: uuid('source_issue_id')
    .references(() => issues.id, { onDelete: 'cascade' })
    .notNull(),
  targetIssueId: uuid('target_issue_id')
    .references(() => issues.id, { onDelete: 'cascade' })
    .notNull(),
  relationType: varchar('relation_type', { length: 50 }).notNull(), // BLOCKS, BLOCKED_BY, RELATES_TO, DUPLICATES
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const issueAttachments = pgTable('issue_attachments', {
  id: uuid('id').defaultRandom().primaryKey(),
  issueId: uuid('issue_id')
    .references(() => issues.id, { onDelete: 'cascade' })
    .notNull(),
  uploaderId: uuid('uploader_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  fileSize: integer('file_size').notNull(),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  s3Key: text('s3_key').notNull(),
  s3Url: text('s3_url').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
