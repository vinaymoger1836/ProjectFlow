import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { OnEvent } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';
import {
  DomainEvents,
  IssueCreatedEvent,
  IssueUpdatedEvent,
  CommentCreatedEvent,
} from '../../common/events/domain-events';
import { EmbeddingsService } from './embeddings.service';
import { EmbeddingIndexerService } from './embedding-indexer.service';
import { EMBEDDING_QUEUE, EmbeddingJobs, EmbedEntityJobData } from './search.constants';

/** Issue fields whose change alters the embedded text. */
const EMBEDDED_ISSUE_FIELDS = new Set(['title', 'description']);

/**
 * Translates domain events into embedding jobs. Enqueueing is fire-and-forget:
 * a Redis outage degrades search freshness but never fails an issue mutation.
 */
@Injectable()
export class EmbeddingQueueService implements OnApplicationBootstrap {
  private readonly logger = new Logger(EmbeddingQueueService.name);

  constructor(
    @InjectQueue(EMBEDDING_QUEUE) private readonly queue: Queue<EmbedEntityJobData>,
    private readonly embeddings: EmbeddingsService,
    private readonly indexer: EmbeddingIndexerService,
  ) {}

  /**
   * Backfills anything created before Phase 4 or missed while the queue was down.
   * Not awaited, so an unreachable Redis cannot stall application startup.
   */
  onApplicationBootstrap() {
    if (!this.embeddings.isEnabled()) return;

    void this.indexer
      .findUnindexed()
      .then(async (pending) => {
        if (pending.length === 0) return;
        await Promise.all(pending.map((data) => this.enqueue(data)));
        this.logger.log(`Queued ${pending.length} unindexed issues/comments for embedding`);
      })
      .catch((err: unknown) => {
        this.logger.warn(`Embedding backfill sweep failed: ${errorMessage(err)}`);
      });
  }

  @OnEvent(DomainEvents.IssueCreated, { async: true })
  async onIssueCreated(event: IssueCreatedEvent) {
    await this.enqueue({ entityType: 'ISSUE', entityId: event.issueId });
  }

  @OnEvent(DomainEvents.IssueUpdated, { async: true })
  async onIssueUpdated(event: IssueUpdatedEvent) {
    if (event.updatedFields.some((field) => EMBEDDED_ISSUE_FIELDS.has(field))) {
      await this.enqueue({ entityType: 'ISSUE', entityId: event.issueId });
    }
  }

  @OnEvent(DomainEvents.CommentCreated, { async: true })
  async onCommentCreated(event: CommentCreatedEvent) {
    await this.enqueue({ entityType: 'COMMENT', entityId: event.commentId });
  }

  private async enqueue(data: EmbedEntityJobData) {
    if (!this.embeddings.isEnabled()) return;

    const jobName = data.entityType === 'ISSUE' ? EmbeddingJobs.EmbedIssue : EmbeddingJobs.EmbedComment;
    try {
      await this.queue.add(jobName, data, {
        // One job per entity at a time; an edit landing mid-processing queues exactly one follow-up
        deduplication: { id: `${data.entityType}:${data.entityId}`, keepLastIfActive: true },
      });
    } catch (err) {
      this.logger.warn(`Failed to enqueue ${data.entityType} ${data.entityId}: ${errorMessage(err)}`);
    }
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
