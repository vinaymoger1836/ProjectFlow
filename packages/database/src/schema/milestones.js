"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.milestoneIssues = exports.milestones = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const projects_1 = require("./projects");
const issues_1 = require("./issues");
exports.milestones = (0, pg_core_1.pgTable)('milestones', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    projectId: (0, pg_core_1.uuid)('project_id')
        .references(() => projects_1.projects.id, { onDelete: 'cascade' })
        .notNull(),
    name: (0, pg_core_1.varchar)('name', { length: 255 }).notNull(),
    description: (0, pg_core_1.text)('description'),
    targetDate: (0, pg_core_1.timestamp)('target_date', { withTimezone: true }),
    completionPercentage: (0, pg_core_1.integer)('completion_percentage').default(0).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
exports.milestoneIssues = (0, pg_core_1.pgTable)('milestone_issues', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    milestoneId: (0, pg_core_1.uuid)('milestone_id')
        .references(() => exports.milestones.id, { onDelete: 'cascade' })
        .notNull(),
    issueId: (0, pg_core_1.uuid)('issue_id')
        .references(() => issues_1.issues.id, { onDelete: 'cascade' })
        .notNull(),
    addedAt: (0, pg_core_1.timestamp)('added_at', { withTimezone: true }).defaultNow().notNull(),
});
//# sourceMappingURL=milestones.js.map