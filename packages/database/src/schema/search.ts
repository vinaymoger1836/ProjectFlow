import { pgTable, uuid, varchar, timestamp, vector, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { projects } from './projects';
import { issues } from './issues';

/**
 * Output dimensionality requested from the embedding model (gemini-embedding-001 supports 128–3072).
 */
export const EMBEDDING_DIMENSIONS = 768;

/**
 * Semantic vectors for searchable content. One row per embedded entity (an issue's
 * title + description, or a single comment), always resolvable back to its issue.
 */
export const contentEmbeddings = pgTable('content_embeddings', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .references(() => projects.id, { onDelete: 'cascade' })
    .notNull(),
  issueId: uuid('issue_id')
    .references(() => issues.id, { onDelete: 'cascade' })
    .notNull(),
  entityType: varchar('entity_type', { length: 20 }).notNull(), // ISSUE, COMMENT
  entityId: uuid('entity_id').notNull(),
  contentHash: varchar('content_hash', { length: 64 }).notNull(), // SHA-256 of embedded text; skips unchanged re-embeds
  model: varchar('model', { length: 100 }).notNull(),
  embedding: vector('embedding', { dimensions: EMBEDDING_DIMENSIONS }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('content_embeddings_entity_idx').on(table.entityType, table.entityId),
  index('content_embeddings_project_id_idx').on(table.projectId),
  index('content_embeddings_embedding_hnsw_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
]);
