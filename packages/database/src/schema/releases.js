"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.releaseIssues = exports.releases = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const projects_1 = require("./projects");
const issues_1 = require("./issues");
exports.releases = (0, pg_core_1.pgTable)('releases', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    projectId: (0, pg_core_1.uuid)('project_id')
        .references(() => projects_1.projects.id, { onDelete: 'cascade' })
        .notNull(),
    version: (0, pg_core_1.varchar)('version', { length: 50 }).notNull(),
    name: (0, pg_core_1.varchar)('name', { length: 255 }).notNull(),
    description: (0, pg_core_1.text)('description'),
    status: (0, pg_core_1.varchar)('status', { length: 50 }).default('PLANNED').notNull(),
    targetDate: (0, pg_core_1.timestamp)('target_date', { withTimezone: true }),
    releaseNotes: (0, pg_core_1.text)('release_notes'),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
exports.releaseIssues = (0, pg_core_1.pgTable)('release_issues', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    releaseId: (0, pg_core_1.uuid)('release_id')
        .references(() => exports.releases.id, { onDelete: 'cascade' })
        .notNull(),
    issueId: (0, pg_core_1.uuid)('issue_id')
        .references(() => issues_1.issues.id, { onDelete: 'cascade' })
        .notNull(),
    addedAt: (0, pg_core_1.timestamp)('added_at', { withTimezone: true }).defaultNow().notNull(),
});
//# sourceMappingURL=releases.js.map