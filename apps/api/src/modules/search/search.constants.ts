export const EMBEDDING_QUEUE = 'embeddings';

export const EmbeddingJobs = {
  EmbedIssue: 'embed-issue',
  EmbedComment: 'embed-comment',
} as const;

export type EmbeddableEntityType = 'ISSUE' | 'COMMENT';

export interface EmbedEntityJobData {
  entityType: EmbeddableEntityType;
  entityId: string;
}

/**
 * Worker throughput cap, kept under the Gemini free-tier embedding quota (~100 RPM)
 * with headroom for interactive query embeddings issued by search requests.
 */
export const EMBEDDING_WORKER_LIMITER = { max: 60, duration: 60_000 };

/** Minimum cosine similarity for a vector-only hit to appear in search results. */
export const SEARCH_MIN_SIMILARITY = 0.55;

/** Minimum cosine similarity for an existing issue to be flagged as a possible duplicate. */
export const DUPLICATE_MIN_SIMILARITY = 0.8;

/** Reciprocal Rank Fusion constant (Cormack et al.); dampens the weight of top ranks. */
export const RRF_K = 60;
