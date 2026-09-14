"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.issueAttachments = exports.issueDependencies = exports.issueLabels = exports.labels = exports.issueComments = exports.issues = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const projects_1 = require("./projects");
const users_1 = require("./users");
exports.issues = (0, pg_core_1.pgTable)('issues', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    projectId: (0, pg_core_1.uuid)('project_id')
        .references(() => projects_1.projects.id, { onDelete: 'cascade' })
        .notNull(),
    issueKey: (0, pg_core_1.varchar)('issue_key', { length: 50 }).notNull(),
    keyNumber: (0, pg_core_1.integer)('key_number').notNull(),
    title: (0, pg_core_1.varchar)('title', { length: 500 }).notNull(),
    description: (0, pg_core_1.text)('description'),
    type: (0, pg_core_1.varchar)('type', { length: 50 }).notNull(),
    status: (0, pg_core_1.varchar)('status', { length: 50 }).default('TODO').notNull(),
    priority: (0, pg_core_1.varchar)('priority', { length: 10 }).notNull(),
    assigneeId: (0, pg_core_1.uuid)('assignee_id').references(() => users_1.users.id, { onDelete: 'set null' }),
    reporterId: (0, pg_core_1.uuid)('reporter_id')
        .references(() => users_1.users.id, { onDelete: 'restrict' })
        .notNull(),
    parentIssueId: (0, pg_core_1.uuid)('parent_issue_id'),
    sprintId: (0, pg_core_1.uuid)('sprint_id'),
    milestoneId: (0, pg_core_1.uuid)('milestone_id'),
    releaseId: (0, pg_core_1.uuid)('release_id'),
    storyPoints: (0, pg_core_1.integer)('story_points'),
    estimateHours: (0, pg_core_1.integer)('estimate_hours'),
    dueDate: (0, pg_core_1.timestamp)('due_date', { withTimezone: true }),
    isArchived: (0, pg_core_1.boolean)('is_archived').default(false).notNull(),
    deletedAt: (0, pg_core_1.timestamp)('deleted_at', { withTimezone: true }),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
    resolvedAt: (0, pg_core_1.timestamp)('resolved_at', { withTimezone: true }),
    closedAt: (0, pg_core_1.timestamp)('closed_at', { withTimezone: true }),
});
exports.issueComments = (0, pg_core_1.pgTable)('issue_comments', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    issueId: (0, pg_core_1.uuid)('issue_id')
        .references(() => exports.issues.id, { onDelete: 'cascade' })
        .notNull(),
    userId: (0, pg_core_1.uuid)('user_id')
        .references(() => users_1.users.id, { onDelete: 'cascade' })
        .notNull(),
    content: (0, pg_core_1.text)('content').notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
exports.labels = (0, pg_core_1.pgTable)('labels', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    projectId: (0, pg_core_1.uuid)('project_id')
        .references(() => projects_1.projects.id, { onDelete: 'cascade' })
        .notNull(),
    name: (0, pg_core_1.varchar)('name', { length: 100 }).notNull(),
    color: (0, pg_core_1.varchar)('color', { length: 20 }).notNull(),
    description: (0, pg_core_1.text)('description'),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
});
exports.issueLabels = (0, pg_core_1.pgTable)('issue_labels', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    issueId: (0, pg_core_1.uuid)('issue_id')
        .references(() => exports.issues.id, { onDelete: 'cascade' })
        .notNull(),
    labelId: (0, pg_core_1.uuid)('label_id')
        .references(() => exports.labels.id, { onDelete: 'cascade' })
        .notNull(),
});
exports.issueDependencies = (0, pg_core_1.pgTable)('issue_dependencies', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    sourceIssueId: (0, pg_core_1.uuid)('source_issue_id')
        .references(() => exports.issues.id, { onDelete: 'cascade' })
        .notNull(),
    targetIssueId: (0, pg_core_1.uuid)('target_issue_id')
        .references(() => exports.issues.id, { onDelete: 'cascade' })
        .notNull(),
    relationType: (0, pg_core_1.varchar)('relation_type', { length: 50 }).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
});
exports.issueAttachments = (0, pg_core_1.pgTable)('issue_attachments', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    issueId: (0, pg_core_1.uuid)('issue_id')
        .references(() => exports.issues.id, { onDelete: 'cascade' })
        .notNull(),
    uploaderId: (0, pg_core_1.uuid)('uploader_id')
        .references(() => users_1.users.id, { onDelete: 'cascade' })
        .notNull(),
    fileName: (0, pg_core_1.varchar)('file_name', { length: 255 }).notNull(),
    fileSize: (0, pg_core_1.integer)('file_size').notNull(),
    mimeType: (0, pg_core_1.varchar)('mime_type', { length: 100 }).notNull(),
    s3Key: (0, pg_core_1.text)('s3_key').notNull(),
    s3Url: (0, pg_core_1.text)('s3_url').notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
});
//# sourceMappingURL=issues.js.map