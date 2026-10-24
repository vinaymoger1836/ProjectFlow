import { Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job, UnrecoverableError } from 'bullmq';
import { EmbeddingIndexerService, IndexOutcome } from './embedding-indexer.service';
import { EmbeddingProviderError } from './embeddings.service';
import { EMBEDDING_QUEUE, EMBEDDING_WORKER_LIMITER, EmbedEntityJobData } from './search.constants';

/** Provider responses that will not succeed on retry (bad request, auth, permission). */
const NON_RETRYABLE_STATUSES = new Set([400, 401, 403, 404]);

@Processor(EMBEDDING_QUEUE, { concurrency: 2, limiter: EMBEDDING_WORKER_LIMITER })
export class EmbeddingProcessor extends WorkerHost {
  private readonly logger = new Logger(EmbeddingProcessor.name);

  constructor(private readonly indexer: EmbeddingIndexerService) {
    super();
  }

  async process(job: Job<EmbedEntityJobData>): Promise<IndexOutcome> {
    try {
      return await this.indexer.index(job.data.entityType, job.data.entityId);
    } catch (err) {
      if (err instanceof EmbeddingProviderError && err.status && NON_RETRYABLE_STATUSES.has(err.status)) {
        throw new UnrecoverableError(err.message);
      }
      // Rate limits (429), provider 5xx and transient DB errors retry with backoff
      throw err;
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<EmbedEntityJobData> | undefined, err: Error) {
    if (!job) return;
    const attempts = job.opts.attempts ?? 1;
    this.logger.warn(
      `Embedding ${job.data.entityType} ${job.data.entityId} failed (attempt ${job.attemptsMade}/${attempts}): ${err.message}`,
    );
  }
}
