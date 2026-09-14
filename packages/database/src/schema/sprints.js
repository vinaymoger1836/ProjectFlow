"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sprintIssues = exports.sprints = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const projects_1 = require("./projects");
const issues_1 = require("./issues");
exports.sprints = (0, pg_core_1.pgTable)('sprints', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    projectId: (0, pg_core_1.uuid)('project_id')
        .references(() => projects_1.projects.id, { onDelete: 'cascade' })
        .notNull(),
    name: (0, pg_core_1.varchar)('name', { length: 255 }).notNull(),
    goal: (0, pg_core_1.text)('goal'),
    status: (0, pg_core_1.varchar)('status', { length: 50 }).default('PLANNED').notNull(),
    capacityPoints: (0, pg_core_1.integer)('capacity_points'),
    startDate: (0, pg_core_1.timestamp)('start_date', { withTimezone: true }),
    endDate: (0, pg_core_1.timestamp)('end_date', { withTimezone: true }),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
exports.sprintIssues = (0, pg_core_1.pgTable)('sprint_issues', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    sprintId: (0, pg_core_1.uuid)('sprint_id')
        .references(() => exports.sprints.id, { onDelete: 'cascade' })
        .notNull(),
    issueId: (0, pg_core_1.uuid)('issue_id')
        .references(() => issues_1.issues.id, { onDelete: 'cascade' })
        .notNull(),
    orderIndex: (0, pg_core_1.integer)('order_index').default(0).notNull(),
    addedAt: (0, pg_core_1.timestamp)('added_at', { withTimezone: true }).defaultNow().notNull(),
});
//# sourceMappingURL=sprints.js.map