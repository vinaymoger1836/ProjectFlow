import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq, and } from 'drizzle-orm';
import {
  Database,
  projects,
  userRoles,
  aiAuditTrail,
} from '@projectflow/database';
import { DRIZZLE_DB } from '../database/database.module';
import { IssuesService } from '../issues/issues.service';
import { ParseIssueDto } from './dto/parse-issue.dto';
import { ExecuteAiToolDto } from './dto/execute-tool.dto';
import { IssuePriority, IssueType } from '@projectflow/types';

export interface ParsedIssueDraft {
  title: string;
  type: IssueType;
  priority: IssuePriority;
  status: string;
  estimateHours?: number | null;
  storyPoints?: number | null;
  description: string;
  suggestedDueDate?: string | null;
  explanation: string;
  modelUsed: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly configService: ConfigService,
    private readonly issuesService: IssuesService,
  ) {}

  /**
   * Parses natural language into a structured issue draft using free-tier LLM providers
   * (Groq / Google Gemini 2.0 Flash) with a reliable heuristic fallback.
   * Logs telemetry and audit tokens into the ai_audit_trail table.
   */
  async parseIssueFromText(
    userId: string,
    dto: ParseIssueDto,
  ): Promise<ParsedIssueDraft> {
    const project = await this.getProjectAndVerifyAccess(userId, dto.projectId);
    const startTime = Date.now();

    const groqKey = this.configService.get<string>('GROQ_API_KEY');
    const geminiKey = this.configService.get<string>('GEMINI_API_KEY');
    const openaiKey = this.configService.get<string>('OPENAI_API_KEY');

    let result: ParsedIssueDraft;
    let modelName = 'heuristic-fallback';
    let promptTokens = 0;
    let completionTokens = 0;

    if (groqKey) {
      // 1. High-speed free tier via Groq
      modelName = this.configService.get<string>('GROQ_MODEL', 'llama-3.3-70b-versatile');
      try {
        const response = await this.callOpenAiCompatibleApi({
          apiKey: groqKey,
          baseUrl: 'https://api.groq.com/openai/v1',
          model: modelName,
          prompt: dto.prompt,
        });
        result = response.draft;
        promptTokens = response.promptTokens;
        completionTokens = response.completionTokens;
      } catch (err: any) {
        this.logger.warn(`Groq request failed (${err.message}). Falling back to heuristic.`);
        result = this.heuristicFallback(dto.prompt);
      }
    } else if (geminiKey) {
      // 2. Free tier via Google Gemini 2.0 Flash
      modelName = this.configService.get<string>('GEMINI_MODEL', 'gemini-2.0-flash');
      try {
        const response = await this.callOpenAiCompatibleApi({
          apiKey: geminiKey,
          baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
          model: modelName,
          prompt: dto.prompt,
        });
        result = response.draft;
        promptTokens = response.promptTokens;
        completionTokens = response.completionTokens;
      } catch (err: any) {
        this.logger.warn(`Gemini request failed (${err.message}). Falling back to heuristic.`);
        result = this.heuristicFallback(dto.prompt);
      }
    } else if (openaiKey) {
      // 3. OpenAI compatible fallback
      modelName = 'gpt-4o-mini';
      try {
        const response = await this.callOpenAiCompatibleApi({
          apiKey: openaiKey,
          baseUrl: 'https://api.openai.com/v1',
          model: modelName,
          prompt: dto.prompt,
        });
        result = response.draft;
        promptTokens = response.promptTokens;
        completionTokens = response.completionTokens;
      } catch (err: any) {
        this.logger.warn(`OpenAI request failed (${err.message}). Falling back to heuristic.`);
        result = this.heuristicFallback(dto.prompt);
      }
    } else {
      // 4. Rule-based heuristic extraction if no LLM key provided
      result = this.heuristicFallback(dto.prompt);
    }

    const latency = Date.now() - startTime;

    // Record audit trail in database
    await this.db.insert(aiAuditTrail).values({
      organizationId: project.organizationId,
      projectId: dto.projectId,
      userId,
      userPrompt: dto.prompt,
      toolsCalled: ['parse_issue'],
      modelName,
      promptTokens,
      completionTokens,
      latencyMs: latency,
    });

    return {
      ...result,
      modelUsed: modelName,
    };
  }

  /**
   * Executes typed AI mutations with boundary validation and audit logging.
   */
  async executeTool(userId: string, dto: ExecuteAiToolDto) {
    const project = await this.getProjectAndVerifyAccess(userId, dto.projectId);
    const startTime = Date.now();

    if (dto.tool === 'create_issue') {
      const createdIssue = await this.issuesService.createIssue(
        userId,
        dto.projectId,
        dto.payload,
      );

      const latency = Date.now() - startTime;

      await this.db.insert(aiAuditTrail).values({
        organizationId: project.organizationId,
        projectId: dto.projectId,
        userId,
        userPrompt: `AI Tool Execution: create_issue (${createdIssue.issueKey})`,
        toolsCalled: ['create_issue'],
        modelName: 'tool-execution',
        promptTokens: 0,
        completionTokens: 0,
        latencyMs: latency,
      });

      return createdIssue;
    }

    throw new NotFoundException(`Unknown AI tool '${dto.tool}'`);
  }

  /**
   * Calls an OpenAI-compatible /v1/chat/completions endpoint (native to Groq, Gemini, OpenAI)
   * with zero external dependencies.
   */
  private async callOpenAiCompatibleApi({
    apiKey,
    baseUrl,
    model,
    prompt,
  }: {
    apiKey: string;
    baseUrl: string;
    model: string;
    prompt: string;
  }): Promise<{ draft: ParsedIssueDraft; promptTokens: number; completionTokens: number }> {
    const systemPrompt = `You are ProjectFlow's Issue Intelligence Assistant.
Your task is to analyze user natural language prompts and extract a structured project issue proposal.
Respond with ONLY a valid JSON object without markdown fences, matching this exact schema:
{
  "title": "Clear, concise action-oriented title (under 80 chars)",
  "type": "TASK" | "BUG" | "STORY" | "EPIC" | "SUBTASK",
  "priority": "P0" | "P1" | "P2" | "P3" | "P4",
  "status": "TODO",
  "estimateHours": number or null,
  "storyPoints": number or null,
  "description": "Comprehensive markdown description including context, reproduction steps (for bugs), or acceptance criteria (for stories/tasks)",
  "suggestedDueDate": "YYYY-MM-DD" or null,
  "explanation": "Brief 1-sentence explanation of why these fields were chosen"
}
Rules:
- If user mentions "crash", "bug", "broken", "fails", "error", type must be "BUG".
- If user mentions "critical", "blocking", "urgent", "production down", priority must be "P0" or "P1".
- Estimate hours or story points if indicated (e.g. "half day" -> 4 hours, 3 points; "quick fix" -> 1 hour, 1 point; "2 days" -> 16 hours, 8 points).
- Strict output: valid JSON only.`;

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`AI API error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from AI model');
    }

    const cleaned = content.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(cleaned);

    const draft: ParsedIssueDraft = {
      title: parsed.title || 'Untitled Issue',
      type: this.sanitizeType(parsed.type),
      priority: this.sanitizePriority(parsed.priority),
      status: 'TODO',
      estimateHours: typeof parsed.estimateHours === 'number' ? parsed.estimateHours : null,
      storyPoints: typeof parsed.storyPoints === 'number' ? parsed.storyPoints : null,
      description: parsed.description || prompt,
      suggestedDueDate: parsed.suggestedDueDate || null,
      explanation: parsed.explanation || 'Extracted automatically from your request.',
      modelUsed: model,
    };

    return {
      draft,
      promptTokens: data.usage?.prompt_tokens || 0,
      completionTokens: data.usage?.completion_tokens || 0,
    };
  }

  /**
   * Deterministic heuristic parser when no external API key is configured.
   */
  private heuristicFallback(prompt: string): ParsedIssueDraft {
    const lower = prompt.toLowerCase();

    // Detect Type
    let type: IssueType = 'TASK';
    if (lower.includes('bug') || lower.includes('crash') || lower.includes('broken') || lower.includes('error') || lower.includes('fail')) {
      type = 'BUG';
    } else if (lower.includes('story') || lower.includes('as a user') || lower.includes('feature')) {
      type = 'STORY';
    } else if (lower.includes('epic') || lower.includes('initiative')) {
      type = 'EPIC';
    }

    // Detect Priority
    let priority: IssuePriority = 'P2';
    if (lower.includes('p0') || lower.includes('critical') || lower.includes('blocking') || lower.includes('urgent') || lower.includes('prod down')) {
      priority = 'P0';
    } else if (lower.includes('p1') || lower.includes('high priority') || lower.includes('asap')) {
      priority = 'P1';
    } else if (lower.includes('p3') || lower.includes('low priority') || lower.includes('nice to have')) {
      priority = 'P3';
    }

    // Detect Hours
    let estimateHours: number | null = null;
    let storyPoints: number | null = null;
    const hourMatch = prompt.match(/(\d+)\s*(?:hours?|hrs?)/i);
    if (hourMatch) {
      estimateHours = parseInt(hourMatch[1], 10);
      storyPoints = Math.max(1, Math.round(estimateHours / 2));
    } else if (lower.includes('quick fix')) {
      estimateHours = 1;
      storyPoints = 1;
    } else if (lower.includes('half day')) {
      estimateHours = 4;
      storyPoints = 3;
    } else if (lower.includes('full day') || lower.includes('1 day')) {
      estimateHours = 8;
      storyPoints = 5;
    }

    // Generate Title
    let title = prompt.trim();
    if (title.length > 80) {
      const firstSentence = title.split(/[.?!]/)[0];
      title = firstSentence.length > 80 ? firstSentence.slice(0, 77) + '...' : firstSentence;
    }
    // Capitalize first character
    title = title.charAt(0).toUpperCase() + title.slice(1);

    return {
      title,
      type,
      priority,
      status: 'TODO',
      estimateHours,
      storyPoints,
      description: `### Context\n${prompt}\n\n### Acceptance Criteria\n- [ ] Implementation verified\n- [ ] Edge cases tested`,
      suggestedDueDate: null,
      explanation: `Parsed via heuristic analyzer: Detected ${type} with ${priority} priority based on key intent signals.`,
      modelUsed: 'heuristic-analyzer',
    };
  }

  private sanitizeType(val: any): IssueType {
    const valid: IssueType[] = ['TASK', 'BUG', 'STORY', 'EPIC', 'SUBTASK'];
    const upper = String(val || '').toUpperCase() as IssueType;
    return valid.includes(upper) ? upper : 'TASK';
  }

  private sanitizePriority(val: any): IssuePriority {
    const valid: IssuePriority[] = ['P0', 'P1', 'P2', 'P3', 'P4'];
    const upper = String(val || '').toUpperCase() as IssuePriority;
    return valid.includes(upper) ? upper : 'P2';
  }

  private async getProjectAndVerifyAccess(userId: string, projectId: string) {
    const [project] = await this.db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) {
      throw new NotFoundException(`Project with ID '${projectId}' not found.`);
    }

    const membership = await this.db
      .select({ id: userRoles.id })
      .from(userRoles)
      .where(and(eq(userRoles.userId, userId), eq(userRoles.organizationId, project.organizationId)))
      .limit(1);

    if (membership.length === 0) {
      throw new ForbiddenException(
        'Access denied: You do not have permission to execute AI workflows in this project.',
      );
    }

    return project;
  }
}
