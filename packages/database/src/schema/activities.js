"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiAuditTrail = exports.auditLogs = exports.activities = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const organizations_1 = require("./organizations");
const users_1 = require("./users");
exports.activities = (0, pg_core_1.pgTable)('activities', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    organizationId: (0, pg_core_1.uuid)('organization_id')
        .references(() => organizations_1.organizations.id, { onDelete: 'cascade' })
        .notNull(),
    projectId: (0, pg_core_1.uuid)('project_id'),
    userId: (0, pg_core_1.uuid)('user_id')
        .references(() => users_1.users.id, { onDelete: 'set null' }),
    entityType: (0, pg_core_1.varchar)('entity_type', { length: 50 }).notNull(),
    entityId: (0, pg_core_1.uuid)('entity_id').notNull(),
    action: (0, pg_core_1.varchar)('action', { length: 100 }).notNull(),
    details: (0, pg_core_1.jsonb)('details').default({}).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
});
exports.auditLogs = (0, pg_core_1.pgTable)('audit_logs', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    organizationId: (0, pg_core_1.uuid)('organization_id')
        .references(() => organizations_1.organizations.id, { onDelete: 'cascade' })
        .notNull(),
    userId: (0, pg_core_1.uuid)('user_id').references(() => users_1.users.id, { onDelete: 'set null' }),
    ipAddress: (0, pg_core_1.varchar)('ip_address', { length: 45 }),
    userAgent: (0, pg_core_1.text)('user_agent'),
    action: (0, pg_core_1.varchar)('action', { length: 100 }).notNull(),
    resource: (0, pg_core_1.varchar)('resource', { length: 100 }).notNull(),
    payload: (0, pg_core_1.jsonb)('payload').default({}).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
});
exports.aiAuditTrail = (0, pg_core_1.pgTable)('ai_audit_trail', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    organizationId: (0, pg_core_1.uuid)('organization_id')
        .references(() => organizations_1.organizations.id, { onDelete: 'cascade' })
        .notNull(),
    userId: (0, pg_core_1.uuid)('user_id').references(() => users_1.users.id, { onDelete: 'set null' }),
    projectId: (0, pg_core_1.uuid)('project_id'),
    userPrompt: (0, pg_core_1.text)('user_prompt').notNull(),
    toolsCalled: (0, pg_core_1.jsonb)('tools_called').default([]).notNull(),
    modelName: (0, pg_core_1.varchar)('model_name', { length: 100 }).notNull(),
    promptTokens: (0, pg_core_1.integer)('prompt_tokens'),
    completionTokens: (0, pg_core_1.integer)('completion_tokens'),
    latencyMs: (0, pg_core_1.integer)('latency_ms'),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
});
//# sourceMappingURL=activities.js.map