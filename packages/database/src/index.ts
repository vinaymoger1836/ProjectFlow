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

import dns from 'node:dns';

// Ensure IPv4 lookup precedence on dual-stack environments (Windows / cloud hosts)
if (dns && typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

export function getDbPool(connectionString?: string) {
  if (!pool) {
    const connStr = normalizeConnectionString(
      connectionString || process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/projectflow',
    );
    const isRemote = connStr.includes('supabase.com') || connStr.includes('sslmode=require');
    pool = new Pool({
      connectionString: connStr,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: isRemote ? { rejectUnauthorized: false } : undefined,
    });
  }
  return pool;
}

export function createDb(connectionString?: string) {
  const p = getDbPool(connectionString);
  return drizzle(p, { schema });
}

export type Database = ReturnType<typeof createDb>;
