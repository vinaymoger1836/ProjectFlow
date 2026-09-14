import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export * from './schema';

let pool: Pool | null = null;

export function getDbPool(connectionString?: string) {
  if (!pool) {
    pool = new Pool({
      connectionString: connectionString || process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/projectflow',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }
  return pool;
}

export function createDb(connectionString?: string) {
  const p = getDbPool(connectionString);
  return drizzle(p, { schema });
}

export type Database = ReturnType<typeof createDb>;
