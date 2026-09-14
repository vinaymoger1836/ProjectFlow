import { Pool } from 'pg';
import * as schema from './schema';
export * from './schema';
export declare function normalizeConnectionString(rawUrl?: string): string;
export declare function getDbPool(connectionString?: string): Pool;
export declare function createDb(connectionString?: string): import("node_modules/drizzle-orm/node-postgres").NodePgDatabase<typeof schema> & {
    $client: Pool;
};
export type Database = ReturnType<typeof createDb>;
