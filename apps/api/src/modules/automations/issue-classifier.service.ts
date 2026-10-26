import { Injectable, Inject, Logger } from '@nestjs/common';
import { Database, aiAuditTrail } from '@projectflow/database';
import { AiIssueClassification } from '@projectflow/types';
import { DRIZZLE_DB } from '../database/database.module';
import { LlmService } from '../llm/llm.service';
import {
  CLASSIFIER_SYSTEM_PROMPT,
  ClassifiableIssue,
  buildClassifierPrompt,
  classifyHeuristically,
  parseClassification,
} from './issue-classification';

export interface ClassificationContext {
  organizationId: string;
  projectId: string;
  issueKey: string;
  /** The person whose action triggered the classification (issue creator). */
  actorId: string | null;
}

/**
 * Classifies an issue for AI conditions: LLM first, keyword fallback when no provider is
 * configured or the answer is unusable. Read-only; every call is recorded in `ai_audit_trail`.
 */
@Injectable()
export class IssueClassifierService {
  private readonly logger = new Logger(IssueClassifierService.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly llm: LlmService,
  ) {}

  async classify(issue: ClassifiableIssue, context: ClassificationContext): Promise<AiIssueClassification> {
    const startedAt = Date.now();
    let classification = classifyHeuristically(issue);
    let usage: { promptTokens: number | null; completionTokens: number | null } = { promptTokens: null, completionTokens: null };

    const result = await this.llm.completeJson(CLASSIFIER_SYSTEM_PROMPT, buildClassifierPrompt(issue), 0);
    const parsed = result ? parseClassification(result.data) : null;
    if (result && parsed) {
      classification = { ...parsed, source: 'llm', model: result.model };
      usage = { promptTokens: result.promptTokens, completionTokens: result.completionTokens };
    }

    await this.db
      .insert(aiAuditTrail)
      .values({
        organizationId: context.organizationId,
        projectId: context.projectId,
        userId: context.actorId,
        userPrompt: `automation:classify ${context.issueKey}`,
        toolsCalled: ['classify_issue', ...classification.categories.map((c) => `category:${c}`)],
        modelName: classification.model,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        latencyMs: Date.now() - startedAt,
      })
      .catch((err: unknown) => this.logger.warn(`Could not audit classification of ${context.issueKey}: ${err instanceof Error ? err.message : String(err)}`));

    return classification;
  }
}
