"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeConnectionString = normalizeConnectionString;
exports.getDbPool = getDbPool;
exports.createDb = createDb;
const node_postgres_1 = require("drizzle-orm/node-postgres");
const pg_1 = require("pg");
const schema = require("./schema");
__exportStar(require("./schema"), exports);
let pool = null;
function normalizeConnectionString(rawUrl) {
    if (!rawUrl)
        return 'postgres://postgres:postgres@localhost:5432/projectflow';
    const protoIdx = rawUrl.indexOf('://');
    if (protoIdx === -1)
        return rawUrl;
    const rest = rawUrl.substring(protoIdx + 3);
    const lastAt = rest.lastIndexOf('@');
    if (lastAt === -1)
        return rawUrl;
    const userPass = rest.substring(0, lastAt);
    const hostPart = rest.substring(lastAt + 1);
    const colonIdx = userPass.indexOf(':');
    if (colonIdx === -1)
        return rawUrl;
    const user = userPass.substring(0, colonIdx);
    const pass = userPass.substring(colonIdx + 1);
    return `${rawUrl.substring(0, protoIdx + 3)}${user}:${encodeURIComponent(decodeURIComponent(pass))}@${hostPart}`;
}
function getDbPool(connectionString) {
    if (!pool) {
        const connStr = normalizeConnectionString(connectionString || process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/projectflow');
        pool = new pg_1.Pool({
            connectionString: connStr,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
        });
    }
    return pool;
}
function createDb(connectionString) {
    const p = getDbPool(connectionString);
    return (0, node_postgres_1.drizzle)(p, { schema });
}
//# sourceMappingURL=index.js.map