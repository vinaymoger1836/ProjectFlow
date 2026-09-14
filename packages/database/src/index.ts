import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export * from './schema';

let pool: Pool | null = null;

export function normalizeConnectionString(rawUrl?: string): string {
  if (!rawUrl) return 'postgres://postgres:postgres@localhost:5432/projectflow';
  const protoIdx = rawUrl.indexOf('://');
  if (protoIdx === -1) return rawUrl;
  const rest = rawUrl.substring(protoIdx + 3);
  const lastAt = rest.lastIndexOf('@');
  if (lastAt === -1) return rawUrl;
  const userPass = rest.substring(0, lastAt);
  const hostPart = rest.substring(lastAt + 1);
  const colonIdx = userPass.indexOf(':');
  if (colonIdx === -1) return rawUrl;
  const user = userPass.substring(0, colonIdx);
  const pass = userPass.substring(colonIdx + 1);
  return `${rawUrl.substring(0, protoIdx + 3)}${user}:${encodeURIComponent(decodeURIComponent(pass))}@${hostPart}`;
}

export function getDbPool(connectionString?: string) {
  if (!pool) {
    const connStr = normalizeConnectionString(
      connectionString || process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/projectflow',
    );
    pool = new Pool({
      connectionString: connStr,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}

export function createDb(connectionString?: string) {
  const p = getDbPool(connectionString);
  return drizzle(p, { schema });
}

export type Database = ReturnType<typeof createDb>;
