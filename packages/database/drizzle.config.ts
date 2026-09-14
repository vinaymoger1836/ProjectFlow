import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

function normalizeConnectionString(rawUrl?: string): string {
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

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  schemaFilter: ['public'],
  dbCredentials: {
    url: normalizeConnectionString(process.env.DIRECT_URL || process.env.DATABASE_URL),
  },
  verbose: true,
  strict: false,
});
