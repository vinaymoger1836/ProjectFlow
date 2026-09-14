"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRoles = exports.users = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const organizations_1 = require("./organizations");
exports.users = (0, pg_core_1.pgTable)('users', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    email: (0, pg_core_1.varchar)('email', { length: 255 }).notNull().unique(),
    name: (0, pg_core_1.varchar)('name', { length: 255 }).notNull(),
    avatarUrl: (0, pg_core_1.text)('avatar_url'),
    isActive: (0, pg_core_1.boolean)('is_active').default(true).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
exports.userRoles = (0, pg_core_1.pgTable)('user_roles', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    userId: (0, pg_core_1.uuid)('user_id')
        .references(() => exports.users.id, { onDelete: 'cascade' })
        .notNull(),
    organizationId: (0, pg_core_1.uuid)('organization_id')
        .references(() => organizations_1.organizations.id, { onDelete: 'cascade' })
        .notNull(),
    roleId: (0, pg_core_1.uuid)('role_id')
        .references(() => organizations_1.roles.id, { onDelete: 'cascade' })
        .notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
});
//# sourceMappingURL=users.js.map