import { pgTable, uuid, varchar, text, integer, timestamp, boolean, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { projects } from './projects';
import { users } from './users';
import { sprints } from './sprints';
import type { IssuePriority, IssueType } from '@projectflow/types';
import { tsvector } from './custom-types';

export const issues = pgTable('issues', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .references(() => projects.id, { onDelete: 'cascade' })
    .notNull(),
  issueKey: varchar('issue_key', { length: 50 }).notNull(), // e.g. "PROJ-1"
  keyNumber: integer('key_number').notNull(), // 1, 2, 3... sequential per project
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  type: varchar('type', { length: 50 }).$type<IssueType>().notNull(), // TASK, BUG, STORY, EPIC, SUBTASK
  status: varchar('status', { length: 50 }).default('TODO').notNull(), // Default to TODO
  priority: varchar('priority', { length: 10 }).$type<IssuePriority>().notNull(), // P0, P1, P2, P3, P4
  assigneeId: uuid('assignee_id').references(() => users.id, { onDelete: 'set null' }),
  reporterId: uuid('reporter_id')
    .references(() => users.id, { onDelete: 'restrict' })
    .notNull(),
  parentIssueId: uuid('parent_issue_id'),
  // Current sprint; null = backlog. Deleting a sprint returns its issues to the backlog.
  sprintId: uuid('sprint_id').references(() => sprints.id, { onDelete: 'set null' }),
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
  // Weighted full-text document: title (A) ranks above description (B)
  searchVector: tsvector('search_vector').generatedAlwaysAs(
    sql`setweight(to_tsvector('english', coalesce(title, '')), 'A') || setweight(to_tsvector('english', coalesce(description, '')), 'B')`,
  ),
}, (table) => [
  index('issues_project_id_idx').on(table.projectId),
  index('issues_sprint_id_idx').on(table.sprintId),
  index('issues_search_vector_idx').using('gin', table.searchVector),
]).enableRLS();

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
  searchVector: tsvector('search_vector').generatedAlwaysAs(
    sql`to_tsvector('english', coalesce(content, ''))`,
  ),
}, (table) => [
  index('issue_comments_issue_id_idx').on(table.issueId),
  index('issue_comments_search_vector_idx').using('gin', table.searchVector),
]).enableRLS();

export const labels = pgTable('labels', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .references(() => projects.id, { onDelete: 'cascade' })
    .notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  color: varchar('color', { length: 20 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}).enableRLS();

export const issueLabels = pgTable('issue_labels', {
  id: uuid('id').defaultRandom().primaryKey(),
  issueId: uuid('issue_id')
    .references(() => issues.id, { onDelete: 'cascade' })
    .notNull(),
  labelId: uuid('label_id')
    .references(() => labels.id, { onDelete: 'cascade' })
    .notNull(),
}).enableRLS();

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
}).enableRLS();

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
}).enableRLS();
