import { Injectable, Inject, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { and, eq, isNull, sql } from 'drizzle-orm';
import {
  Database,
  issues,
  issueComments,
  contentEmbeddings,
  EMBEDDING_DIMENSIONS,
} from '@projectflow/database';
import { DRIZZLE_DB } from '../database/database.module';
import { EmbeddingsService } from './embeddings.service';
import { EmbeddableEntityType, EmbedEntityJobData } from './search.constants';

interface EmbeddableContent {
  projectId: string;
  issueId: string;
  text: string;
  title?: string;
}

export type IndexOutcome = 'indexed' | 'unchanged' | 'skipped';

/**
 * Produces and persists semantic vectors for issues and comments. Always reads the
 * current database state, so queued jobs are idempotent and safe to retry or repeat.
 */
@Injectable()
export class EmbeddingIndexerService {
  private readonly logger = new Logger(EmbeddingIndexerService.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly embeddings: EmbeddingsService,
  ) {}

  async index(entityType: EmbeddableEntityType, entityId: string): Promise<IndexOutcome> {
    const content =
      entityType === 'ISSUE' ? await this.loadIssue(entityId) : await this.loadComment(entityId);

    // Entity was removed after the job was queued; FK cascades already cleaned up its vector
    if (!content || content.text.length === 0) {
      return 'skipped';
    }

    const contentHash = createHash('sha256')
      .update(`${this.embeddings.model}:${EMBEDDING_DIMENSIONS}:${content.text}`)
      .digest('hex');

    const [existing] = await this.db
      .select({ contentHash: contentEmbeddings.contentHash })
      .from(contentEmbeddings)
      .where(and(eq(contentEmbeddings.entityType, entityType), eq(contentEmbeddings.entityId, entityId)))
      .limit(1);

    if (existing?.contentHash === contentHash) {
      return 'unchanged';
    }

    const embedding = await this.embeddings.embedDocument(content.text, content.title);
    const now = new Date();

    await this.db
      .insert(contentEmbeddings)
      .values({
        projectId: content.projectId,
        issueId: content.issueId,
        entityType,
        entityId,
        contentHash,
        model: this.embeddings.model,
        embedding,
      })
      .onConflictDoUpdate({
        target: [contentEmbeddings.entityType, contentEmbeddings.entityId],
        set: {
          contentHash,
          model: this.embeddings.model,
          embedding,
          updatedAt: now,
        },
      });

    this.logger.debug(`Indexed ${entityType} ${entityId}`);
    return 'indexed';
  }

  /**
   * Lists issues and comments that have no vector yet (e.g. created while Redis or the
   * embedding provider was unavailable, or before Phase 4 shipped).
   */
  async findUnindexed(limit = 1000): Promise<EmbedEntityJobData[]> {
    const issueRows = await this.db
      .select({ id: issues.id })
      .from(issues)
      .leftJoin(
        contentEmbeddings,
        and(eq(contentEmbeddings.entityType, 'ISSUE'), eq(contentEmbeddings.entityId, issues.id)),
      )
      .where(and(isNull(contentEmbeddings.id), eq(issues.isArchived, false)))
      .limit(limit);

    const commentRows = await this.db
      .select({ id: issueComments.id })
      .from(issueComments)
      .innerJoin(issues, eq(issueComments.issueId, issues.id))
      .leftJoin(
        contentEmbeddings,
        and(eq(contentEmbeddings.entityType, 'COMMENT'), eq(contentEmbeddings.entityId, issueComments.id)),
      )
      .where(and(isNull(contentEmbeddings.id), eq(issues.isArchived, false)))
      .limit(limit);

    return [
      ...issueRows.map((r) => ({ entityType: 'ISSUE' as const, entityId: r.id })),
      ...commentRows.map((r) => ({ entityType: 'COMMENT' as const, entityId: r.id })),
    ];
  }

  private async loadIssue(issueId: string): Promise<EmbeddableContent | null> {
    const [row] = await this.db
      .select({
        id: issues.id,
        projectId: issues.projectId,
        title: issues.title,
        description: issues.description,
      })
      .from(issues)
      .where(eq(issues.id, issueId))
      .limit(1);

    if (!row) return null;

    return {
      projectId: row.projectId,
      issueId: row.id,
      title: row.title,
      text: `${row.title}\n\n${row.description ?? ''}`.trim(),
    };
  }

  private async loadComment(commentId: string): Promise<EmbeddableContent | null> {
    const [row] = await this.db
      .select({
        issueId: issueComments.issueId,
        content: issueComments.content,
        projectId: issues.projectId,
        issueTitle: issues.title,
      })
      .from(issueComments)
      .innerJoin(issues, eq(issueComments.issueId, issues.id))
      .where(eq(issueComments.id, commentId))
      .limit(1);

    if (!row) return null;

    return {
      projectId: row.projectId,
      issueId: row.issueId,
      // The parent title anchors short replies ("same here", "fixed in v2") to their topic
      title: row.issueTitle,
      text: row.content.trim(),
    };
  }
}

// Keeps the `sql` import tree-shaken out of type-only builds while documenting intent
void sql;
