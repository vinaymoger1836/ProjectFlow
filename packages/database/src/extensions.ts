import * as dotenv from 'dotenv';
import * as path from 'path';

// Load root .env
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

import { getDbPool } from './index';

/**
 * Enables PostgreSQL extensions the schema depends on. `drizzle-kit push` does not
 * manage extensions, so this must run once per database before pushing the schema.
 */
async function enableExtensions() {
  const pool = getDbPool(process.env.DIRECT_URL || process.env.DATABASE_URL);

  await pool.query('CREATE EXTENSION IF NOT EXISTS vector');
  const { rows } = await pool.query<{ extversion: string }>(
    "SELECT extversion FROM pg_extension WHERE extname = 'vector'",
  );

  console.log(`✅ pgvector extension enabled (v${rows[0]?.extversion ?? 'unknown'})`);
  await pool.end();
}

enableExtensions().catch((err) => {
  console.error('❌ Failed to enable database extensions:', err);
  process.exit(1);
});
