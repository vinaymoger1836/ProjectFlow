import { Injectable, Inject, Logger } from '@nestjs/common';
import { and, eq, ne, gte, desc, inArray, sql, cosineDistance, SQL } from 'drizzle-orm';
import { aliasedTable } from 'drizzle-orm';
import {
  Database,
  issues,
  issueComments,
  contentEmbeddings,
  users,
} from '@projectflow/database';
import {
  IssuePriority,
  IssueType,
  IssueSearchResponse,
  IssueSearchResult,
  SearchMatchSource,
  SimilarIssue,
  SimilarIssuesResponse,
} from '@projectflow/types';
import { DRIZZLE_DB } from '../database/database.module';
import { ProjectAccessService } from '../auth/project-access.service';
import { EmbeddingsService } from './embeddings.service';
import {
  SEARCH_MIN_SIMILARITY,
  DUPLICATE_MIN_SIMILARITY,
  RRF_K,
} from './search.constants';
import { SimilarIssuesDto } from './dto/similar-issues.dto';

const assigneeUser = aliasedTable(users, 'assignee_user');

const ISSUE_KEY_PATTERN = /^[A-Z0-9]+-\d+$/i;
const CANDIDATES_PER_RETRIEVER = 30;
const MAX_QUERY_TOKENS = 8;
const MIN_SEMANTIC_QUERY_LENGTH = 3;
const SNIPPET_LENGTH = 140;

interface Candidate {
  issueId: string;
  score: number;
  sources: Set<SearchMatchSource>;
  similarity: number | null;
  matchedComment: { id: string; snippet: string } | null;
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly projectAccess: ProjectAccessService,
    private readonly embeddings: EmbeddingsService,
  ) {}

  /**
   * Hybrid issue search: exact key lookup, prefix full-text search over issues and
   * comments, and vector similarity, merged with Reciprocal Rank Fusion so neither
   * retriever's raw score scale dominates.
   */
  async searchIssues(userId: string, projectId: string, rawQuery: string, limit = 10): Promise<IssueSearchResponse> {
    await this.projectAccess.assertProjectAccess(userId, projectId);

    const query = rawQuery.trim();
    const candidates = new Map<string, Candidate>();
    const candidate = (issueId: string): Candidate => {
      let c = candidates.get(issueId);
      if (!c) {
        c = { issueId, score: 0, sources: new Set(), similarity: null, matchedComment: null };
        candidates.set(issueId, c);
      }
      return c;
    };

    // 1. Exact issue key ("PAY-12") always ranks first
    if (ISSUE_KEY_PATTERN.test(query)) {
      const [exact] = await this.db
        .select({ id: issues.id })
        .from(issues)
        .where(
          and(
            eq(issues.projectId, projectId),
            eq(issues.isArchived, false),
            eq(sql`UPPER(${issues.issueKey})`, query.toUpperCase()),
          ),
        )
        .limit(1);
      if (exact) {
        const c = candidate(exact.id);
        c.score += 1;
        c.sources.add('KEY');
      }
    }

    // 2. Lexical retrieval (issues + comments) with prefix matching for search-as-you-type
    const tsQuery = buildPrefixTsQuery(query);
    if (tsQuery) {
      const issueRank = sql<number>`ts_rank(${issues.searchVector}, ${tsQuery})`;
      const lexicalIssues = await this.db
        .select({ id: issues.id })
        .from(issues)
        .where(
          and(
            eq(issues.projectId, projectId),
            eq(issues.isArchived, false),
            sql`${issues.searchVector} @@ ${tsQuery}`,
          ),
        )
        .orderBy(desc(issueRank))
        .limit(CANDIDATES_PER_RETRIEVER);

      lexicalIssues.forEach((row, index) => {
        const c = candidate(row.id);
        c.score += rrf(index);
        c.sources.add('KEYWORD');
      });

      const commentRank = sql<number>`ts_rank(${issueComments.searchVector}, ${tsQuery})`;
      const lexicalComments = await this.db
        .select({ id: issueComments.id, issueId: issueComments.issueId, content: issueComments.content })
        .from(issueComments)
        .innerJoin(issues, eq(issueComments.issueId, issues.id))
        .where(
          and(
            eq(issues.projectId, projectId),
            eq(issues.isArchived, false),
            sql`${issueComments.searchVector} @@ ${tsQuery}`,
          ),
        )
        .orderBy(desc(commentRank))
        .limit(CANDIDATES_PER_RETRIEVER);

      bestPerIssue(lexicalComments).forEach((row, index) => {
        const c = candidate(row.issueId);
        c.score += rrf(index);
        c.sources.add('KEYWORD');
        c.matchedComment ??= { id: row.id, snippet: buildSnippet(row.content, query) };
      });
    }

    // 3. Semantic retrieval; degrades to lexical-only if the provider is unavailable
    let semanticEnabled = this.embeddings.isEnabled() && query.length >= MIN_SEMANTIC_QUERY_LENGTH;
    if (semanticEnabled) {
      try {
        const queryVector = await this.embeddings.embedQuery(query);
        const distance = cosineDistance(contentEmbeddings.embedding, queryVector);
        const similarity = sql<number>`1 - (${distance})`;

        const semanticHits = await this.db
          .select({
            issueId: contentEmbeddings.issueId,
            entityType: contentEmbeddings.entityType,
            entityId: contentEmbeddings.entityId,
            similarity,
          })
          .from(contentEmbeddings)
          .innerJoin(issues, eq(contentEmbeddings.issueId, issues.id))
          .where(
            and(
              eq(contentEmbeddings.projectId, projectId),
              eq(issues.isArchived, false),
              gte(similarity, SEARCH_MIN_SIMILARITY),
            ),
          )
          .orderBy(distance)
          .limit(CANDIDATES_PER_RETRIEVER);

        const commentIds = semanticHits.filter((h) => h.entityType === 'COMMENT').map((h) => h.entityId);
        const commentContent = await this.loadCommentContent(commentIds);

        bestPerIssue(semanticHits).forEach((hit, index) => {
          const c = candidate(hit.issueId);
          c.score += rrf(index);
          c.sources.add('SEMANTIC');
          c.similarity = Math.max(c.similarity ?? 0, Number(hit.similarity));
          const content = commentContent.get(hit.entityId);
          if (hit.entityType === 'COMMENT' && content) {
            c.matchedComment ??= { id: hit.entityId, snippet: buildSnippet(content, query) };
          }
        });
      } catch (err) {
        semanticEnabled = false;
        this.logger.warn(`Semantic search unavailable, using keyword results only: ${errorMessage(err)}`);
      }
    }

    const ranked = [...candidates.values()].sort((a, b) => b.score - a.score).slice(0, limit);
    const details = await this.loadIssueSummaries(ranked.map((c) => c.issueId));

    const results: IssueSearchResult[] = [];
    for (const c of ranked) {
      const issue = details.get(c.issueId);
      if (!issue) continue;
      results.push({
        ...issue,
        score: Number(c.score.toFixed(4)),
        matchSources: [...c.sources],
        similarity: c.similarity === null ? null : Number(c.similarity.toFixed(4)),
        matchedComment: c.matchedComment,
      });
    }

    return { query, results, semanticEnabled };
  }

  /**
   * Finds existing issues semantically close to a draft, for duplicate warnings
   * before the draft is created.
   */
  async findSimilarIssues(userId: string, projectId: string, dto: SimilarIssuesDto): Promise<SimilarIssuesResponse> {
    await this.projectAccess.assertProjectAccess(userId, projectId);

    if (!this.embeddings.isEnabled()) {
      return { matches: [], semanticEnabled: false };
    }

    const text = `${dto.title.trim()}\n\n${dto.description?.trim() ?? ''}`.trim();

    try {
      // Drafts are embedded as documents so they compare symmetrically with stored issues
      const draftVector = await this.embeddings.embedDocument(text, dto.title.trim());
      const distance = cosineDistance(contentEmbeddings.embedding, draftVector);
      const similarity = sql<number>`1 - (${distance})`;

      const conditions: SQL[] = [
        eq(contentEmbeddings.projectId, projectId),
        eq(contentEmbeddings.entityType, 'ISSUE'),
        eq(issues.isArchived, false),
        gte(similarity, DUPLICATE_MIN_SIMILARITY),
      ];
      if (dto.excludeIssueId) {
        conditions.push(ne(issues.id, dto.excludeIssueId));
      }

      const rows = await this.db
        .select({
          id: issues.id,
          issueKey: issues.issueKey,
          title: issues.title,
          type: issues.type,
          status: issues.status,
          priority: issues.priority,
          similarity,
        })
        .from(contentEmbeddings)
        .innerJoin(issues, eq(contentEmbeddings.issueId, issues.id))
        .where(and(...conditions))
        .orderBy(distance)
        .limit(dto.limit ?? 3);

      const matches: SimilarIssue[] = rows.map((r) => ({
        id: r.id,
        issueKey: r.issueKey,
        title: r.title,
        type: r.type as IssueType,
        status: r.status,
        priority: r.priority as IssuePriority,
        similarity: Number(Number(r.similarity).toFixed(4)),
      }));

      return { matches, semanticEnabled: true };
    } catch (err) {
      this.logger.warn(`Duplicate detection unavailable: ${errorMessage(err)}`);
      return { matches: [], semanticEnabled: false };
    }
  }

  private async loadCommentContent(commentIds: string[]): Promise<Map<string, string>> {
    if (commentIds.length === 0) return new Map();
    const rows = await this.db
      .select({ id: issueComments.id, content: issueComments.content })
      .from(issueComments)
      .where(inArray(issueComments.id, commentIds));
    return new Map(rows.map((r) => [r.id, r.content]));
  }

  private async loadIssueSummaries(issueIds: string[]) {
    type Summary = Omit<IssueSearchResult, 'score' | 'matchSources' | 'similarity' | 'matchedComment'>;
    const summaries = new Map<string, Summary>();
    if (issueIds.length === 0) return summaries;

    const rows = await this.db
      .select({
        id: issues.id,
        issueKey: issues.issueKey,
        title: issues.title,
        type: issues.type,
        status: issues.status,
        priority: issues.priority,
        assigneeId: assigneeUser.id,
        assigneeName: assigneeUser.name,
        assigneeAvatarUrl: assigneeUser.avatarUrl,
      })
      .from(issues)
      .leftJoin(assigneeUser, eq(issues.assigneeId, assigneeUser.id))
      .where(inArray(issues.id, issueIds));

    for (const r of rows) {
      summaries.set(r.id, {
        id: r.id,
        issueKey: r.issueKey,
        title: r.title,
        type: r.type as IssueType,
        status: r.status,
        priority: r.priority as IssuePriority,
        assignee: r.assigneeId
          ? { id: r.assigneeId, name: r.assigneeName ?? 'Unknown', avatarUrl: r.assigneeAvatarUrl }
          : null,
      });
    }
    return summaries;
  }
}

function rrf(rankIndex: number): number {
  return 1 / (RRF_K + rankIndex + 1);
}

/**
 * Builds a safe prefix tsquery ("pay:* & webhook:*") from free text. Tokens are
 * restricted to letters/digits, so user input can never inject tsquery operators.
 */
function buildPrefixTsQuery(query: string): SQL | null {
  const tokens = (query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).slice(0, MAX_QUERY_TOKENS);
  if (tokens.length === 0) return null;
  const expression = tokens.map((t) => `${t}:*`).join(' & ');
  return sql`to_tsquery('english', ${expression})`;
}

/** Keeps the first (highest-ranked) row per issue, preserving order. */
function bestPerIssue<T extends { issueId: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.issueId)) return false;
    seen.add(row.issueId);
    return true;
  });
}

/** Extracts a short window of text around the first query term found. */
function buildSnippet(content: string, query: string): string {
  const flat = content.replace(/\s+/g, ' ').trim();
  if (flat.length <= SNIPPET_LENGTH) return flat;

  const lower = flat.toLowerCase();
  const tokens = query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const hit = tokens.map((t) => lower.indexOf(t)).filter((i) => i >= 0).sort((a, b) => a - b)[0];

  const start = hit === undefined ? 0 : Math.max(0, hit - 40);
  const window = flat.slice(start, start + SNIPPET_LENGTH);
  return `${start > 0 ? '…' : ''}${window}${start + SNIPPET_LENGTH < flat.length ? '…' : ''}`;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
