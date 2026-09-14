"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectSettings = exports.projectMembers = exports.projects = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const organizations_1 = require("./organizations");
const teams_1 = require("./teams");
const users_1 = require("./users");
exports.projects = (0, pg_core_1.pgTable)('projects', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    organizationId: (0, pg_core_1.uuid)('organization_id')
        .references(() => organizations_1.organizations.id, { onDelete: 'cascade' })
        .notNull(),
    teamId: (0, pg_core_1.uuid)('team_id').references(() => teams_1.teams.id, { onDelete: 'set null' }),
    key: (0, pg_core_1.varchar)('key', { length: 20 }).notNull(),
    name: (0, pg_core_1.varchar)('name', { length: 255 }).notNull(),
    description: (0, pg_core_1.text)('description'),
    leadId: (0, pg_core_1.uuid)('lead_id')
        .references(() => users_1.users.id, { onDelete: 'restrict' })
        .notNull(),
    healthStatus: (0, pg_core_1.varchar)('health_status', { length: 50 }).default('HEALTHY').notNull(),
    issueCounter: (0, pg_core_1.integer)('issue_counter').default(0).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
exports.projectMembers = (0, pg_core_1.pgTable)('project_members', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    projectId: (0, pg_core_1.uuid)('project_id')
        .references(() => exports.projects.id, { onDelete: 'cascade' })
        .notNull(),
    userId: (0, pg_core_1.uuid)('user_id')
        .references(() => users_1.users.id, { onDelete: 'cascade' })
        .notNull(),
    role: (0, pg_core_1.varchar)('role', { length: 50 }).default('CONTRIBUTOR').notNull(),
    joinedAt: (0, pg_core_1.timestamp)('joined_at', { withTimezone: true }).defaultNow().notNull(),
});
exports.projectSettings = (0, pg_core_1.pgTable)('project_settings', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    projectId: (0, pg_core_1.uuid)('project_id')
        .references(() => exports.projects.id, { onDelete: 'cascade' })
        .notNull()
        .unique(),
    workflowStatuses: (0, pg_core_1.jsonb)('workflow_statuses').notNull(),
    issueTypes: (0, pg_core_1.jsonb)('issue_types').notNull(),
    settingsJson: (0, pg_core_1.jsonb)('settings_json').default({}).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
//# sourceMappingURL=projects.js.map