import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EMBEDDING_DIMENSIONS } from '@projectflow/database';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/** gemini-embedding-001 accepts up to 2048 input tokens; ~4 chars per token keeps us safely below. */
const MAX_INPUT_CHARS = 8000;

const QUERY_CACHE_MAX_ENTRIES = 500;

/**
 * Gemini task types. Documents are embedded for retrieval; free-text search
 * input is embedded as a query so it lands near the documents that answer it.
 */
export type EmbeddingTaskType = 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY';

interface GeminiEmbedResponse {
  embedding?: { values?: number[] };
  error?: { message?: string };
}

export class EmbeddingProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'EmbeddingProviderError';
  }
}

@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);
  private readonly apiKey: string | undefined;
  readonly model: string;

  // Search-as-you-type re-issues identical queries; caching them protects the free-tier quota
  private readonly queryCache = new Map<string, number[]>();

  constructor(configService: ConfigService) {
    this.apiKey = configService.get<string>('GEMINI_API_KEY') || undefined;
    this.model = configService.get<string>('GEMINI_EMBEDDING_MODEL', 'gemini-embedding-001');

    if (!this.apiKey) {
      this.logger.warn('GEMINI_API_KEY is not set: semantic search and duplicate detection are disabled.');
    }
  }

  isEnabled(): boolean {
    return Boolean(this.apiKey);
  }

  async embedDocument(text: string, title?: string): Promise<number[]> {
    return this.embed(text, 'RETRIEVAL_DOCUMENT', title);
  }

  async embedQuery(text: string): Promise<number[]> {
    const key = text.trim().toLowerCase();
    const cached = this.queryCache.get(key);
    if (cached) {
      // Refresh recency so the Map's insertion order behaves as an LRU
      this.queryCache.delete(key);
      this.queryCache.set(key, cached);
      return cached;
    }

    const vector = await this.embed(text, 'RETRIEVAL_QUERY');
    this.queryCache.set(key, vector);
    if (this.queryCache.size > QUERY_CACHE_MAX_ENTRIES) {
      const oldestKey = this.queryCache.keys().next().value;
      if (oldestKey !== undefined) this.queryCache.delete(oldestKey);
    }
    return vector;
  }

  private async embed(text: string, taskType: EmbeddingTaskType, title?: string): Promise<number[]> {
    if (!this.apiKey) {
      throw new EmbeddingProviderError('Embedding provider is not configured (GEMINI_API_KEY missing).');
    }

    const res = await fetch(`${GEMINI_API_BASE}/${this.model}:embedContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.apiKey,
      },
      body: JSON.stringify({
        model: `models/${this.model}`,
        content: { parts: [{ text: text.slice(0, MAX_INPUT_CHARS) }] },
        taskType,
        // Title context is only valid for document embeddings
        ...(taskType === 'RETRIEVAL_DOCUMENT' && title ? { title } : {}),
        outputDimensionality: EMBEDDING_DIMENSIONS,
      }),
    });

    const json = (await res.json().catch(() => ({}))) as GeminiEmbedResponse;

    if (!res.ok) {
      throw new EmbeddingProviderError(
        `Gemini embedding request failed (${res.status}): ${json.error?.message ?? res.statusText}`,
        res.status,
      );
    }

    const values = json.embedding?.values;
    if (!values || values.length !== EMBEDDING_DIMENSIONS) {
      throw new EmbeddingProviderError(
        `Gemini returned an unexpected embedding shape (${values?.length ?? 0} dimensions).`,
      );
    }

    return normalize(values);
  }
}

/**
 * Truncated (Matryoshka) Gemini embeddings below 3072 dimensions are not unit-length;
 * normalizing keeps cosine similarity scores comparable across vectors.
 */
function normalize(values: number[]): number[] {
  const magnitude = Math.sqrt(values.reduce((sum, v) => sum + v * v, 0));
  return magnitude === 0 ? values : values.map((v) => v / magnitude);
}
