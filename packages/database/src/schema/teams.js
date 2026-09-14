"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.teamMembers = exports.teams = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const organizations_1 = require("./organizations");
const users_1 = require("./users");
exports.teams = (0, pg_core_1.pgTable)('teams', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    organizationId: (0, pg_core_1.uuid)('organization_id')
        .references(() => organizations_1.organizations.id, { onDelete: 'cascade' })
        .notNull(),
    name: (0, pg_core_1.varchar)('name', { length: 255 }).notNull(),
    key: (0, pg_core_1.varchar)('key', { length: 50 }).notNull(),
    description: (0, pg_core_1.text)('description'),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
exports.teamMembers = (0, pg_core_1.pgTable)('team_members', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    teamId: (0, pg_core_1.uuid)('team_id')
        .references(() => exports.teams.id, { onDelete: 'cascade' })
        .notNull(),
    userId: (0, pg_core_1.uuid)('userId')
        .references(() => users_1.users.id, { onDelete: 'cascade' })
        .notNull(),
    role: (0, pg_core_1.varchar)('role', { length: 50 }).default('MEMBER').notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
});
//# sourceMappingURL=teams.js.map