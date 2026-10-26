import { Injectable, Inject, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { Database, aiAuditTrail, userRoles, users } from '@projectflow/database';
import { AutomationDraft } from '@projectflow/types';
import { DRIZZLE_DB } from '../database/database.module';
import { ProjectAccessService } from '../auth/project-access.service';
import { LlmService } from '../llm/llm.service';
import { DRAFT_SYSTEM_PROMPT, DraftContext, buildDraftPrompt, draftFromLlm, draftHeuristically } from './automation-draft';
import { DraftAutomationDto } from './dto/automation.dto';

/**
 * Drafts an automation from plain English for the builder to show; nothing is saved here.
 * The LLM only proposes JSON, which is rebuilt by the same parsers as saved automations.
 */
@Injectable()
export class AutomationDraftService {
  private readonly logger = new Logger(AutomationDraftService.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly projectAccess: ProjectAccessService,
    private readonly llm: LlmService,
  ) {}

  async draft(userId: string, projectId: string, dto: DraftAutomationDto): Promise<AutomationDraft> {
    const startedAt = Date.now();
    const project = await this.projectAccess.assertProjectAccess(userId, projectId);

    const members = await this.db
      .selectDistinct({ id: users.id, name: users.name })
      .from(userRoles)
      .innerJoin(users, eq(users.id, userRoles.userId))
      .where(eq(userRoles.organizationId, project.organizationId));
    const ctx: DraftContext = { members, currentUserId: userId, timezone: validTimeZone(dto.timezone) ?? 'UTC' };

    const result = await this.llm.completeJson(DRAFT_SYSTEM_PROMPT, buildDraftPrompt(dto.prompt, ctx), 0);
    const fromLlm = result ? draftFromLlm(result.data, dto.prompt, ctx) : null;
    const draft: AutomationDraft = fromLlm && result
      ? { ...fromLlm, modelUsed: result.model }
      : { ...draftHeuristically(dto.prompt, ctx), modelUsed: 'keyword-heuristic' };

    await this.db
      .insert(aiAuditTrail)
      .values({
        organizationId: project.organizationId,
        projectId: project.id,
        userId,
        userPrompt: dto.prompt.slice(0, 2000),
        toolsCalled: ['draft_automation', `trigger:${draft.trigger.type}`, ...draft.conditions.map((c) => `condition:${c.field}`)],
        modelName: draft.modelUsed,
        promptTokens: fromLlm ? (result?.promptTokens ?? null) : null,
        completionTokens: fromLlm ? (result?.completionTokens ?? null) : null,
        latencyMs: Date.now() - startedAt,
      })
      .catch((err: unknown) => this.logger.warn(`Could not audit automation draft: ${err instanceof Error ? err.message : String(err)}`));

    return draft;
  }
}

function validTimeZone(timeZone: string | undefined): string | null {
  if (!timeZone) return null;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return timeZone;
  } catch {
    return null;
  }
}
