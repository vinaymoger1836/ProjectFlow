import { customType } from 'drizzle-orm/pg-core';

/**
 * PostgreSQL full-text search document. Only ever populated as a generated column.
 */
export const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector';
  },
});
