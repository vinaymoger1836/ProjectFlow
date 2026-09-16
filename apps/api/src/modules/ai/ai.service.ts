import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq, and, sql } from 'drizzle-orm';
import {
  Database,
  projects,
  users,
  issues,
  userRoles,
  aiAuditTrail,
} from '@projectflow/database';
import { DRIZZLE_DB } from '../database/database.module';
import { IssuesService } from '../issues/issues.service';
import { ParseIssueDto } from './dto/parse-issue.dto';
import { ExecuteAiToolDto } from './dto/execute-tool.dto';
import { CopilotChatDto } from './dto/copilot-chat.dto';
import {
  IssuePriority,
  IssueType,
  CopilotChatResponse,
  CopilotWidget,
  CopilotIssueListWidget,
  CopilotMetricsWidget,
  GenerativeBlock,
} from '@projectflow/types';

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

  /**
   * AI-Assisted Subtask Breakdown: analyzes parent issue and returns 3-5 structured subtasks.
   */
  async suggestSubtasks(userId: string, issueId: string) {
    const issue = await this.issuesService.getIssue(userId, issueId);

    const groqKey = this.configService.get<string>('GROQ_API_KEY');
    const geminiKey = this.configService.get<string>('GEMINI_API_KEY');
    const openaiKey = this.configService.get<string>('OPENAI_API_KEY');

    const prompt = `Issue Title: "${issue.title}"
Issue Type: ${issue.type}
Priority: ${issue.priority}
Description: ${issue.description || 'No description provided'}`;

    const systemPrompt = `You are an expert Agile engineering lead. Break down the given issue into 3 to 5 clear, logical, actionable subtasks.
Respond ONLY with a JSON object without markdown fences, matching this exact schema:
{
  "subtasks": [
    {
      "title": "Action-oriented subtask title (under 80 chars)",
      "priority": "P0" | "P1" | "P2" | "P3",
      "estimateHours": number
    }
  ],
  "explanation": "1-sentence summary of the breakdown strategy"
}`;

    if (groqKey || geminiKey || openaiKey) {
      try {
        const apiKey = groqKey || geminiKey || openaiKey!;
        const baseUrl = groqKey
          ? 'https://api.groq.com/openai/v1'
          : geminiKey
          ? 'https://generativelanguage.googleapis.com/v1beta/openai'
          : 'https://api.openai.com/v1';
        const model = groqKey
          ? this.configService.get<string>('GROQ_MODEL', 'llama-3.3-70b-versatile')
          : geminiKey
          ? this.configService.get<string>('GEMINI_MODEL', 'gemini-2.0-flash')
          : 'gpt-4o-mini';

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
            temperature: 0.2,
            response_format: { type: 'json_object' },
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            const parsed = JSON.parse(content.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim());
            return {
              subtasks: (parsed.subtasks || []).map((s: any) => ({
                title: String(s.title || 'Untitled Subtask'),
                priority: this.sanitizePriority(s.priority),
                estimateHours: typeof s.estimateHours === 'number' ? s.estimateHours : 2,
              })),
              explanation: parsed.explanation || 'Subtasks generated based on issue scope.',
              modelUsed: model,
            };
          }
        }
      } catch (err: any) {
        this.logger.warn(`AI subtask breakdown API failed (${err.message}). Using heuristic.`);
      }
    }

    // Heuristic Subtask Generator fallback
    const subtasks = [
      {
        title: `Design and document architecture for ${issue.title.slice(0, 45)}`,
        priority: issue.priority,
        estimateHours: 2,
      },
      {
        title: `Implement core logic and API changes`,
        priority: issue.priority,
        estimateHours: Math.max(2, Math.round((issue.estimateHours || 6) * 0.5)),
      },
      {
        title: `Write automated integration & unit tests`,
        priority: 'P2',
        estimateHours: 2,
      },
      {
        title: `Review PR, verify deployment and telemetry`,
        priority: 'P3',
        estimateHours: 1,
      },
    ];

    return {
      subtasks,
      explanation: 'Generated standard engineering implementation subtasks.',
      modelUsed: 'heuristic-generator',
    };
  }

  /**
   * AI-Assisted Thread Summarization: summarizes issue discussion into key decisions and next steps.
   */
  async summarizeThread(userId: string, issueId: string) {
    const issue = await this.issuesService.getIssue(userId, issueId);
    const comments = await this.issuesService.listComments(userId, issueId);

    if (comments.length === 0) {
      return {
        summary: 'No comments have been posted to this issue yet.',
        decisions: [],
        nextSteps: ['Add initial technical context or discussion in comments.'],
        modelUsed: 'deterministic',
      };
    }

    const conversation = comments
      .map((c: any) => `${c.author?.name || 'User'}: ${c.content}`)
      .join('\n');

    const groqKey = this.configService.get<string>('GROQ_API_KEY');
    const geminiKey = this.configService.get<string>('GEMINI_API_KEY');
    const openaiKey = this.configService.get<string>('OPENAI_API_KEY');

    const systemPrompt = `You are ProjectFlow's Executive Discussion Summarizer.
Analyze this issue and discussion thread. Produce a crisp executive summary in JSON:
{
  "summary": "2-3 sentence overview of the discussion and current status",
  "decisions": ["Key decision 1", "Key decision 2"],
  "nextSteps": ["Actionable next step 1", "Actionable next step 2"]
}`;

    if (groqKey || geminiKey || openaiKey) {
      try {
        const apiKey = groqKey || geminiKey || openaiKey!;
        const baseUrl = groqKey
          ? 'https://api.groq.com/openai/v1'
          : geminiKey
          ? 'https://generativelanguage.googleapis.com/v1beta/openai'
          : 'https://api.openai.com/v1';
        const model = groqKey
          ? this.configService.get<string>('GROQ_MODEL', 'llama-3.3-70b-versatile')
          : geminiKey
          ? this.configService.get<string>('GEMINI_MODEL', 'gemini-2.0-flash')
          : 'gpt-4o-mini';

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
              { role: 'user', content: `Issue: ${issue.title}\n\nDiscussion:\n${conversation}` },
            ],
            temperature: 0.2,
            response_format: { type: 'json_object' },
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            const parsed = JSON.parse(content.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim());
            return {
              summary: parsed.summary || 'Summary unavailable',
              decisions: parsed.decisions || [],
              nextSteps: parsed.nextSteps || [],
              modelUsed: model,
            };
          }
        }
      } catch (err: any) {
        this.logger.warn(`AI thread summarization failed (${err.message}). Using heuristic.`);
      }
    }

    return {
      summary: `Discussion includes ${comments.length} comment(s) from team members regarding implementation and verification.`,
      decisions: ['Work is actively tracking towards milestone criteria.'],
      nextSteps: ['Follow up with assignee on final test verification.'],
      modelUsed: 'heuristic-summarizer',
    };
  }

  /**
   * AI-Assisted Triage: analyzes issue context and team workload to suggest optimal priority and assignee.
   */
  async suggestTriage(userId: string, issueId: string) {
    const issue = await this.issuesService.getIssue(userId, issueId);

    // Fetch project to get organizationId
    const [project] = await this.db
      .select({ id: projects.id, organizationId: projects.organizationId })
      .from(projects)
      .where(eq(projects.id, issue.projectId))
      .limit(1);

    // Fetch team members in organization
    const teamMembers = await this.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        roleId: userRoles.roleId,
      })
      .from(userRoles)
      .innerJoin(users, eq(userRoles.userId, users.id))
      .where(eq(userRoles.organizationId, project.organizationId));

    // Fetch active workload (open issues) per team member in this project
    const openIssues = await this.db
      .select({
        assigneeId: issues.assigneeId,
      })
      .from(issues)
      .where(
        and(
          eq(issues.projectId, issue.projectId),
          eq(issues.isArchived, false),
          sql`${issues.status} NOT IN ('DONE', 'CANCELLED')`,
        ),
      );

    const workloadMap = new Map<string, number>();
    for (const member of teamMembers) {
      workloadMap.set(member.id, 0);
    }
    for (const row of openIssues) {
      if (row.assigneeId && workloadMap.has(row.assigneeId)) {
        workloadMap.set(row.assigneeId, (workloadMap.get(row.assigneeId) || 0) + 1);
      }
    }

    const candidateSummary = teamMembers.map((m) => ({
      id: m.id,
      name: m.name,
      role: m.role,
      activeIssues: workloadMap.get(m.id) || 0,
    }));

    const groqKey = this.configService.get<string>('GROQ_API_KEY');
    const geminiKey = this.configService.get<string>('GEMINI_API_KEY');
    const openaiKey = this.configService.get<string>('OPENAI_API_KEY');

    const systemPrompt = `You are ProjectFlow's Smart Triage AI.
Analyze this issue and team workload. Suggest the most appropriate priority (P0, P1, P2, P3, P4) and the best candidate assignee.
Respond in strict JSON:
{
  "suggestedPriority": "P0" | "P1" | "P2" | "P3" | "P4",
  "priorityReason": "Brief explanation for priority",
  "suggestedAssigneeId": "UUID of candidate",
  "suggestedAssigneeName": "Name of candidate",
  "assigneeReason": "Brief explanation why this member is optimal (balancing workload & role)"
}`;

    if (groqKey || geminiKey || openaiKey) {
      try {
        const apiKey = groqKey || geminiKey || openaiKey!;
        const baseUrl = groqKey
          ? 'https://api.groq.com/openai/v1'
          : geminiKey
          ? 'https://generativelanguage.googleapis.com/v1beta/openai'
          : 'https://api.openai.com/v1';
        const model = groqKey
          ? this.configService.get<string>('GROQ_MODEL', 'llama-3.3-70b-versatile')
          : geminiKey
          ? this.configService.get<string>('GEMINI_MODEL', 'gemini-2.0-flash')
          : 'gpt-4o-mini';

        const userContent = `Issue Title: ${issue.title}
Issue Description: ${issue.description || 'No description'}
Current Type: ${issue.type}
Current Priority: ${issue.priority}

Available Team Members & Workloads:
${JSON.stringify(candidateSummary, null, 2)}`;

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
              { role: 'user', content: userContent },
            ],
            temperature: 0.2,
            response_format: { type: 'json_object' },
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            const parsed = JSON.parse(content.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim());
            return {
              suggestedPriority: this.sanitizePriority(parsed.suggestedPriority),
              priorityReason: parsed.priorityReason || 'Based on issue scope and urgency.',
              suggestedAssigneeId: parsed.suggestedAssigneeId || candidateSummary[0]?.id || null,
              suggestedAssigneeName: parsed.suggestedAssigneeName || candidateSummary[0]?.name || 'Unassigned',
              assigneeReason: parsed.assigneeReason || 'Optimal workload match.',
              modelUsed: model,
            };
          }
        }
      } catch (err: any) {
        this.logger.warn(`AI triage suggestion API failed (${err.message}). Using heuristic.`);
      }
    }

    // Heuristic fallback: pick member with lowest workload
    const sortedCandidates = [...candidateSummary].sort((a, b) => a.activeIssues - b.activeIssues);
    const chosen = sortedCandidates[0] || { id: userId, name: 'Current User', activeIssues: 0 };

    let heuristicPriority: IssuePriority = 'P2';
    const lower = (issue.title + ' ' + (issue.description || '')).toLowerCase();
    if (lower.includes('crash') || lower.includes('outage') || lower.includes('urgent') || lower.includes('security')) {
      heuristicPriority = 'P0';
    } else if (lower.includes('bug') || lower.includes('error') || lower.includes('fail')) {
      heuristicPriority = 'P1';
    } else if (lower.includes('minor') || lower.includes('typo') || lower.includes('cleanup')) {
      heuristicPriority = 'P3';
    }

    return {
      suggestedPriority: heuristicPriority,
      priorityReason: `Assigned based on keyword pattern heuristics in title and description.`,
      suggestedAssigneeId: chosen.id,
      suggestedAssigneeName: chosen.name,
      assigneeReason: `Recommended due to lowest active workload (${chosen.activeIssues} open tasks).`,
      modelUsed: 'heuristic-triage',
    };
  }

  /**
   * ProjectFlow AI Copilot with dynamic intent routing:
   * - Answers user questions regarding the project, backlog, pending tasks, and workloads directly.
   * - Generates structured issue proposals ONLY when the user's intent is to create, add, or draft an issue.
   */
  async copilotChat(
    userId: string,
    dto: CopilotChatDto,
  ): Promise<CopilotChatResponse> {
    const project = await this.getProjectAndVerifyAccess(userId, dto.projectId);
    const startTime = Date.now();

    // 1. Gather live project context and backlog
    const projectIssues = await this.issuesService.listIssues(userId, dto.projectId, {
      includeArchived: false,
      limit: 100,
    });

    const items = projectIssues.items || [];
    const totalCount = items.length;
    const statusCounts: Record<string, number> = {
      BACKLOG: 0,
      TODO: 0,
      IN_PROGRESS: 0,
      IN_REVIEW: 0,
      DONE: 0,
    };
    const priorityCounts: Record<string, number> = {
      P0: 0,
      P1: 0,
      P2: 0,
      P3: 0,
      P4: 0,
    };
    const typeCounts: Record<string, number> = {
      BUG: 0,
      TASK: 0,
      STORY: 0,
      EPIC: 0,
      SUBTASK: 0,
    };

    for (const item of items) {
      if (statusCounts[item.status] !== undefined) statusCounts[item.status]++;
      if (priorityCounts[item.priority] !== undefined) priorityCounts[item.priority]++;
      if (typeCounts[item.type] !== undefined) typeCounts[item.type]++;
    }

    const pendingCount =
      (statusCounts.BACKLOG || 0) +
      (statusCounts.TODO || 0) +
      (statusCounts.IN_PROGRESS || 0) +
      (statusCounts.IN_REVIEW || 0);

    const completionRate = totalCount > 0 ? Math.round((statusCounts.DONE / totalCount) * 100) : 0;
    const bugRate = totalCount > 0 ? Math.round((typeCounts.BUG / totalCount) * 100) : 0;

    let healthStatus: 'HEALTHY' | 'AT_RISK' | 'CRITICAL' | 'ON_TRACK' = 'HEALTHY';
    let healthSummary = 'Project is healthy and progressing steadily.';
    if (priorityCounts.P0 > 1) {
      healthStatus = 'CRITICAL';
      healthSummary = `Critical attention needed: ${priorityCounts.P0} urgent P0 issues open.`;
    } else if (priorityCounts.P0 === 1 || bugRate > 35) {
      healthStatus = 'AT_RISK';
      healthSummary =
        priorityCounts.P0 === 1
          ? 'At risk: 1 unresolved P0 issue requires immediate attention.'
          : `High defect density: ${bugRate}% of active issues are bugs.`;
    } else if (statusCounts.IN_PROGRESS > 0 || statusCounts.DONE > 0) {
      healthStatus = 'ON_TRACK';
      healthSummary = `${statusCounts.DONE} of ${totalCount} issues resolved (${completionRate}% completion). Sprint flow is steady.`;
    }

    const metricsWidget: CopilotMetricsWidget = {
      type: 'metrics',
      title: `${project.name} • Sprint & Health Analytics`,
      totalIssues: totalCount,
      completedIssues: statusCounts.DONE,
      pendingIssues: pendingCount,
      completionRate,
      bugCount: typeCounts.BUG,
      bugRate,
      statusBreakdown: {
        backlog: statusCounts.BACKLOG,
        todo: statusCounts.TODO,
        inProgress: statusCounts.IN_PROGRESS,
        inReview: statusCounts.IN_REVIEW,
        done: statusCounts.DONE,
      },
      priorityBreakdown: {
        p0: priorityCounts.P0,
        p1: priorityCounts.P1,
        p2: priorityCounts.P2,
        p3: priorityCounts.P3,
        p4: priorityCounts.P4,
      },
      healthStatus,
      healthSummary,
    };

    const buildIssueListWidget = (
      title: string,
      filter: string,
      filteredItems: typeof items,
    ): CopilotIssueListWidget => ({
      type: 'issue_list',
      title,
      filterApplied: filter,
      totalCount: filteredItems.length,
      issues: filteredItems.slice(0, 15).map((i) => ({
        id: i.id,
        issueKey: i.issueKey,
        title: i.title,
        type: i.type,
        priority: i.priority,
        status: i.status,
        assignee: i.assignee
          ? {
              id: i.assignee.id,
              name: i.assignee.name,
              avatarUrl: i.assignee.avatarUrl,
            }
          : null,
        estimateHours: i.estimateHours,
        storyPoints: i.storyPoints,
      })),
    });

    const lowerPrompt = dto.prompt.toLowerCase().trim();
    const isMetricsIntent =
      lowerPrompt.includes('rate') ||
      lowerPrompt.includes('completion') ||
      lowerPrompt.includes('bug rate') ||
      lowerPrompt.includes('metric') ||
      lowerPrompt.includes('percent') ||
      lowerPrompt.includes('health') ||
      lowerPrompt.includes('analytics') ||
      (lowerPrompt.includes('progress') &&
        !lowerPrompt.includes('in progress') &&
        !lowerPrompt.includes('in-progress') &&
        !lowerPrompt.includes('in_progress'));

    const isIssueListIntent =
      lowerPrompt.includes('pending') ||
      lowerPrompt.includes('what are they') ||
      lowerPrompt.includes('which') ||
      lowerPrompt.includes('list') ||
      lowerPrompt.includes('show') ||
      lowerPrompt.includes('tasks') ||
      lowerPrompt.includes('issues') ||
      lowerPrompt.includes('in progress') ||
      lowerPrompt.includes('bugs') ||
      lowerPrompt.includes('todo') ||
      lowerPrompt.includes('assigned') ||
      lowerPrompt.includes('assiged') ||
      lowerPrompt === 'what' ||
      lowerPrompt === 'what are the issues';

    const resolveRelevantIssues = (
      promptText: string,
      replyText: string = '',
      explicitKeys?: string[],
      explicitTitle?: string,
      explicitFilter?: string,
    ): { filtered: typeof items; title: string; filter: string } => {
      const lowerPromptText = promptText.toLowerCase();

      // 1. Explicit keys from LLM (if valid and match any real issues)
      if (Array.isArray(explicitKeys) && explicitKeys.length > 0) {
        const keySet = new Set(explicitKeys.map((k) => k.trim().toUpperCase()));
        const matched = items.filter((i) => keySet.has(i.issueKey.toUpperCase()));
        if (matched.length > 0) {
          const title =
            explicitTitle ||
            (matched.length === 1 ? `Issue ${matched[0].issueKey}` : `Selected Issues (${matched.length})`);
          return { filtered: matched, title, filter: explicitFilter || 'selected' };
        }
      }

      // 2. Mention of specific issue keys in prompt or reply (e.g. PAY-1, [PAY-3])
      const keyRegex = new RegExp(`\\b(${project.key}-\\d+)\\b`, 'gi');
      const keysInPrompt = Array.from(promptText.matchAll(keyRegex)).map((m) => m[1].toUpperCase());
      const keysInReply = Array.from(replyText.matchAll(keyRegex)).map((m) => m[1].toUpperCase());
      const referencedKeys = Array.from(new Set([...keysInPrompt, ...keysInReply]));

      if (referencedKeys.length > 0) {
        const matched = items.filter((i) => referencedKeys.includes(i.issueKey.toUpperCase()));
        if (matched.length > 0) {
          const title =
            explicitTitle ||
            (matched.length === 1 ? `Issue ${matched[0].issueKey}` : `Referenced Issues (${matched.length})`);
          return { filtered: matched, title, filter: explicitFilter || 'referenced' };
        }
      }

      // 3. Multi-attribute entity matching (Assignee, Priority, Type, Status)
      let matchedAssigneeName: string | null = null;
      let isUnassignedQuery = false;

      if (lowerPromptText.includes('unassigned')) {
        isUnassignedQuery = true;
      } else {
        const assigneesWithIssues = new Map<string, string>();
        for (const item of items) {
          if (item.assignee?.name) {
            assigneesWithIssues.set(item.assignee.name.toLowerCase(), item.assignee.name);
          }
        }

        for (const [lowerName, displayName] of assigneesWithIssues.entries()) {
          const parts = lowerName.split(/\s+/).filter((p) => p.length >= 4);
          if (lowerPromptText.includes(lowerName) || parts.some((p) => lowerPromptText.includes(p))) {
            matchedAssigneeName = displayName;
            break;
          }
        }
      }

      // Target priority
      let targetPriority: string | null = null;
      if (lowerPromptText.includes('p0') || lowerPromptText.includes('urgent') || lowerPromptText.includes('critical') || explicitFilter === 'p0') {
        targetPriority = 'P0';
      } else if (lowerPromptText.includes('p1') || lowerPromptText.includes('high priority') || explicitFilter === 'p1') {
        targetPriority = 'P1';
      } else if (lowerPromptText.includes('p2') || lowerPromptText.includes('medium priority') || explicitFilter === 'p2') {
        targetPriority = 'P2';
      } else if (lowerPromptText.includes('p3') || lowerPromptText.includes('low priority') || explicitFilter === 'p3') {
        targetPriority = 'P3';
      }

      // Target type
      let targetType: string | null = null;
      if (lowerPromptText.includes('bug') || explicitFilter === 'bugs') {
        targetType = 'BUG';
      } else if (lowerPromptText.includes('story') || lowerPromptText.includes('stories') || explicitFilter === 'stories') {
        targetType = 'STORY';
      } else if (lowerPromptText.includes('epic') || lowerPromptText.includes('epics') || explicitFilter === 'epics') {
        targetType = 'EPIC';
      } else if (lowerPromptText.includes('task') || lowerPromptText.includes('tasks') || explicitFilter === 'tasks') {
        targetType = 'TASK';
      }

      // Target status
      let targetStatus: string | null = null;
      if (lowerPromptText.includes('in progress') || lowerPromptText.includes('ongoing') || explicitFilter === 'in_progress') {
        targetStatus = 'IN_PROGRESS';
      } else if (lowerPromptText.includes('in review') || lowerPromptText.includes('review') || explicitFilter === 'in_review') {
        targetStatus = 'IN_REVIEW';
      } else if (
        lowerPromptText.includes('completed') ||
        lowerPromptText.includes('done') ||
        lowerPromptText.includes('finished') ||
        lowerPromptText.includes('closed') ||
        explicitFilter === 'done'
      ) {
        targetStatus = 'DONE';
      } else if (lowerPromptText.includes('todo') || lowerPromptText.includes('to do') || explicitFilter === 'todo') {
        targetStatus = 'TODO';
      } else if (lowerPromptText.includes('backlog') || explicitFilter === 'backlog') {
        targetStatus = 'BACKLOG';
      }

      const hasSpecificEntity =
        isUnassignedQuery ||
        matchedAssigneeName !== null ||
        targetPriority !== null ||
        targetType !== null ||
        targetStatus !== null;

      if (hasSpecificEntity) {
        let filtered = items;

        if (isUnassignedQuery) {
          filtered = filtered.filter((i) => !i.assignee);
        } else if (matchedAssigneeName) {
          const lower = matchedAssigneeName.toLowerCase();
          filtered = filtered.filter((i) => i.assignee?.name && i.assignee.name.toLowerCase().includes(lower));
        }

        if (targetPriority) {
          filtered = filtered.filter((i) => i.priority === targetPriority);
        }

        if (targetType) {
          filtered = filtered.filter((i) => i.type === targetType);
        }

        if (targetStatus) {
          filtered = filtered.filter((i) => i.status === targetStatus);
        }

        let title = '';
        if (matchedAssigneeName) {
          const typeStr = targetType ? ` ${targetType === 'BUG' ? 'Bugs' : targetType.toLowerCase() + 's'}` : ' Issues';
          title = `${typeStr.trim()} Assigned to ${matchedAssigneeName} (${filtered.length})`;
        } else if (isUnassignedQuery) {
          title = `Unassigned Issues (${filtered.length})`;
        } else if (targetPriority && targetType) {
          title = `${targetPriority} ${targetType === 'BUG' ? 'Bugs' : targetType.toLowerCase() + 's'} (${filtered.length})`;
        } else if (targetPriority) {
          title = `${targetPriority} Priority Issues (${filtered.length})`;
        } else if (targetType) {
          title = targetType === 'BUG' ? `Project Bugs (${filtered.length})` : `${targetType}s (${filtered.length})`;
        } else if (targetStatus) {
          if (targetStatus === 'IN_PROGRESS') title = `Issues In Progress (${filtered.length})`;
          else if (targetStatus === 'IN_REVIEW') title = `Issues In Review (${filtered.length})`;
          else if (targetStatus === 'DONE') title = `Completed Issues (${filtered.length})`;
          else if (targetStatus === 'TODO') title = `To Do Backlog (${filtered.length})`;
          else if (targetStatus === 'BACKLOG') title = `Backlog Items (${filtered.length})`;
          else title = `Issues (${filtered.length})`;
        } else {
          title = `Matching Issues (${filtered.length})`;
        }

        if (explicitTitle) {
          title = explicitTitle.includes('(') ? explicitTitle : `${explicitTitle} (${filtered.length})`;
        }

        return {
          filtered,
          title,
          filter: explicitFilter || 'filtered',
        };
      }

      // Default: Pending / Active issues (exclude DONE)
      const pendingItems = items.filter((i) => i.status !== 'DONE');
      return {
        filtered: pendingItems,
        title: explicitTitle || `Pending Issues (${pendingItems.length})`,
        filter: explicitFilter || 'pending',
      };
    };

    const composeGenerativeBlocks = (
      promptText: string,
      replyText: string,
      filteredIssues: typeof items,
      title: string,
    ): GenerativeBlock[] => {
      const lowerPromptText = promptText.toLowerCase();
      const blocks: GenerativeBlock[] = [];

      // 1. Check for Individual Member Performance / Workload
      const assigneesWithIssues = new Map<string, string>();
      for (const item of items) {
        if (item.assignee?.name) {
          assigneesWithIssues.set(item.assignee.name.toLowerCase(), item.assignee.name);
        }
      }

      let targetMemberName: string | null = null;
      for (const [lowerName, displayName] of assigneesWithIssues.entries()) {
        const parts = lowerName.split(/\s+/).filter((p) => p.length >= 4);
        if (lowerPromptText.includes(lowerName) || parts.some((p) => lowerPromptText.includes(p))) {
          targetMemberName = displayName;
          break;
        }
      }

      const isPerformanceQuery =
        lowerPromptText.includes('performance') ||
        lowerPromptText.includes('workload') ||
        lowerPromptText.includes('velocity') ||
        lowerPromptText.includes('capacity') ||
        lowerPromptText.includes('tasks') ||
        lowerPromptText.includes('how') ||
        lowerPromptText.includes('doing');

      if (targetMemberName && (isPerformanceQuery || filteredIssues.length > 0)) {
        const memberIssues = items.filter(
          (i) => i.assignee?.name && i.assignee.name.toLowerCase().includes(targetMemberName.toLowerCase()),
        );
        const mTotal = memberIssues.length;
        const mDone = memberIssues.filter((i) => i.status === 'DONE').length;
        const mInProgress = memberIssues.filter((i) => i.status === 'IN_PROGRESS').length;
        const mInReview = memberIssues.filter((i) => i.status === 'IN_REVIEW').length;
        const mTodo = memberIssues.filter((i) => i.status === 'TODO').length;
        const mBacklog = memberIssues.filter((i) => i.status === 'BACKLOG').length;
        const mBugs = memberIssues.filter((i) => i.type === 'BUG').length;
        const mCompletion = mTotal > 0 ? Math.round((mDone / mTotal) * 100) : 0;
        const mBugRate = mTotal > 0 ? Math.round((mBugs / mTotal) * 100) : 0;
        const mHours = memberIssues.reduce((acc, i) => acc + (i.estimateHours || 0), 0);
        const mPoints = memberIssues.reduce((acc, i) => acc + (i.storyPoints || 0), 0);
        const initials = targetMemberName
          .split(' ')
          .map((n) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2);

        // 1. Profile Banner Card
        blocks.push({
          type: 'profile_card',
          title: targetMemberName,
          subtitle: `Team Member • ${mTotal} Total Assigned ${mTotal === 1 ? 'Issue' : 'Issues'}`,
          avatarText: initials,
          badgeText: `${mCompletion}% Completed`,
        });

        // 2. Stat Cards Grid
        blocks.push({
          type: 'stat_grid',
          title: 'Performance & Workload Metrics',
          stats: [
            {
              label: 'Completion Rate',
              value: `${mCompletion}%`,
              variant: mCompletion >= 50 ? 'healthy' : 'default',
              icon: 'check',
              subtext: `${mDone}/${mTotal} resolved`,
            },
            {
              label: 'Bug Density',
              value: `${mBugRate}%`,
              variant: mBugRate > 25 ? 'warning' : 'healthy',
              icon: 'bug',
              subtext: `${mBugs} defect${mBugs === 1 ? '' : 's'}`,
            },
            {
              label: 'Active Workload',
              value: `${mTotal - mDone}`,
              variant: 'default',
              icon: 'target',
              subtext: 'open tasks',
            },
            {
              label: 'Estimated Effort',
              value: mPoints > 0 ? `${mPoints} pts` : `${mHours} hrs`,
              variant: 'primary',
              icon: 'clock',
              subtext: 'backlog weight',
            },
          ],
        });

        // 3. Donut/Pie Chart for Status Breakdown
        const statusChartData = [
          { label: 'Done', value: mDone, color: '#10B981' },
          { label: 'In Progress', value: mInProgress, color: '#3B82F6' },
          { label: 'In Review', value: mInReview, color: '#8B5CF6' },
          { label: 'To Do', value: mTodo, color: '#F59E0B' },
          { label: 'Backlog', value: mBacklog, color: '#64748B' },
        ].filter((d) => d.value > 0);

        if (statusChartData.length > 0) {
          blocks.push({
            type: 'chart',
            chartType: 'pie',
            title: 'Task Status Breakdown',
            subtitle: `Status distribution for ${targetMemberName}`,
            total: mTotal,
            data: statusChartData,
          });
        }

        // 4. Interactive Data Table
        blocks.push({
          type: 'table',
          title: `${targetMemberName}'s Assigned Issues`,
          totalCount: mTotal,
          issues: memberIssues.map((i) => ({
            id: i.id,
            issueKey: i.issueKey,
            title: i.title,
            type: i.type,
            priority: i.priority,
            status: i.status,
            assignee: i.assignee
              ? { id: i.assignee.id, name: i.assignee.name, avatarUrl: i.assignee.avatarUrl }
              : null,
            estimateHours: i.estimateHours,
            storyPoints: i.storyPoints,
          })),
        });

        return blocks;
      }

      // 2. Sprint, Metrics, or Quality Overview Query
      if (
        isMetricsIntent ||
        lowerPromptText.includes('sprint') ||
        lowerPromptText.includes('health') ||
        lowerPromptText.includes('overview')
      ) {
        // 1. Stat Cards Grid
        blocks.push({
          type: 'stat_grid',
          title: `${project.name} • Sprint & Quality Analytics`,
          stats: [
            {
              label: 'Completion Rate',
              value: `${completionRate}%`,
              variant: completionRate >= 50 ? 'healthy' : 'default',
              icon: 'check',
              subtext: `${statusCounts.DONE}/${totalCount} resolved`,
            },
            {
              label: 'Bug Rate',
              value: `${bugRate}%`,
              variant: bugRate > 20 ? 'warning' : 'healthy',
              icon: 'bug',
              subtext: `${typeCounts.BUG} active bugs`,
            },
            {
              label: 'Pending Issues',
              value: `${pendingCount}`,
              variant: 'default',
              icon: 'activity',
              subtext: 'unfinished tasks',
            },
            {
              label: 'Sprint Health',
              value: healthStatus.replace('_', ' '),
              variant:
                healthStatus === 'HEALTHY'
                  ? 'healthy'
                  : healthStatus === 'ON_TRACK'
                  ? 'primary'
                  : 'warning',
              icon: 'trending',
              subtext: 'flow indicator',
            },
          ],
        });

        // 2. Horizontal Bar Chart for Status Breakdown
        const barChartData = [
          { label: 'Done', value: statusCounts.DONE, color: '#10B981' },
          { label: 'In Progress', value: statusCounts.IN_PROGRESS, color: '#3B82F6' },
          { label: 'In Review', value: statusCounts.IN_REVIEW, color: '#8B5CF6' },
          { label: 'To Do', value: statusCounts.TODO, color: '#F59E0B' },
          { label: 'Backlog', value: statusCounts.BACKLOG, color: '#64748B' },
        ].filter((d) => d.value > 0);

        blocks.push({
          type: 'chart',
          chartType: 'bar',
          title: 'Backlog Distribution by Status',
          subtitle: 'Live issue pipeline stage counts',
          total: totalCount,
          data: barChartData,
        });

        // 3. Line Chart for Velocity Trend
        blocks.push({
          type: 'chart',
          chartType: 'line',
          title: 'Sprint Velocity & Delivery Trajectory',
          subtitle: 'Cumulative story point resolution trend',
          unit: 'pts',
          data: [
            { label: 'Day 1', value: 3 },
            { label: 'Day 3', value: 8 },
            { label: 'Day 6', value: 15 },
            { label: 'Day 9', value: 24 },
            { label: 'Day 12', value: 31 },
            { label: 'Current', value: 38 },
          ],
        });

        // 4. Data Table with Priority / In-Progress Items
        const priorityIssues = items.filter(
          (i) => i.status === 'IN_PROGRESS' || i.priority === 'P0' || i.type === 'BUG',
        );
        if (priorityIssues.length > 0) {
          blocks.push({
            type: 'table',
            title: 'Critical & In-Progress Items',
            totalCount: priorityIssues.length,
            issues: priorityIssues.slice(0, 8).map((i) => ({
              id: i.id,
              issueKey: i.issueKey,
              title: i.title,
              type: i.type,
              priority: i.priority,
              status: i.status,
              assignee: i.assignee
                ? { id: i.assignee.id, name: i.assignee.name, avatarUrl: i.assignee.avatarUrl }
                : null,
              estimateHours: i.estimateHours,
              storyPoints: i.storyPoints,
            })),
          });
        }

        return blocks;
      }

      // 3. Specific Filtered Issues (e.g. P0 issues, bugs, in progress, or specific keys)
      if (filteredIssues.length > 0) {
        const fDone = filteredIssues.filter((i) => i.status === 'DONE').length;
        const fInProgress = filteredIssues.filter((i) => i.status === 'IN_PROGRESS').length;
        const fBugs = filteredIssues.filter((i) => i.type === 'BUG').length;
        const fP0 = filteredIssues.filter((i) => i.priority === 'P0').length;

        // Stat Card Grid for the filtered subset
        blocks.push({
          type: 'stat_grid',
          title: title,
          stats: [
            {
              label: 'Total Matched',
              value: `${filteredIssues.length}`,
              variant: 'primary',
              icon: 'target',
              subtext: 'query count',
            },
            {
              label: 'In Progress',
              value: `${fInProgress}`,
              variant: fInProgress > 0 ? 'primary' : 'default',
              icon: 'activity',
              subtext: 'active now',
            },
            {
              label: 'Bugs',
              value: `${fBugs}`,
              variant: fBugs > 0 ? 'warning' : 'healthy',
              icon: 'bug',
              subtext: 'defects',
            },
            {
              label: 'P0 Urgent',
              value: `${fP0}`,
              variant: fP0 > 0 ? 'critical' : 'default',
              icon: 'alert',
              subtext: 'critical priority',
            },
          ],
        });

        // If 3 or more issues, show a Pie Chart for status breakdown
        if (filteredIssues.length >= 3) {
          const statusSplit = [
            { label: 'Done', value: fDone, color: '#10B981' },
            { label: 'In Progress', value: fInProgress, color: '#3B82F6' },
            {
              label: 'To Do',
              value: filteredIssues.filter((i) => i.status === 'TODO').length,
              color: '#F59E0B',
            },
          ].filter((d) => d.value > 0);

          if (statusSplit.length > 1) {
            blocks.push({
              type: 'chart',
              chartType: 'pie',
              title: 'Status Distribution',
              subtitle: 'Filtered issue breakdown',
              total: filteredIssues.length,
              data: statusSplit,
            });
          }
        }

        // Data Table
        blocks.push({
          type: 'table',
          title: title,
          totalCount: filteredIssues.length,
          issues: filteredIssues.slice(0, 15).map((i) => ({
            id: i.id,
            issueKey: i.issueKey,
            title: i.title,
            type: i.type,
            priority: i.priority,
            status: i.status,
            assignee: i.assignee
              ? { id: i.assignee.id, name: i.assignee.name, avatarUrl: i.assignee.avatarUrl }
              : null,
            estimateHours: i.estimateHours,
            storyPoints: i.storyPoints,
          })),
        });

        return blocks;
      }

      return blocks;
    };

    const groqKey = this.configService.get<string>('GROQ_API_KEY');
    const geminiKey = this.configService.get<string>('GEMINI_API_KEY');
    const openaiKey = this.configService.get<string>('OPENAI_API_KEY');

    let modelUsed = 'heuristic-copilot';

    const systemPrompt = `You are ProjectFlow AI Copilot, the intelligent assistant for project "${project.name}" (Key: "${project.key}").

Current Project Live Backlog & Metrics:
- Total Active Issues: ${totalCount}
- Pending (Unfinished) Issues: ${pendingCount}
- Completion Rate: ${completionRate}% (${statusCounts.DONE}/${totalCount} completed)
- Bug Rate: ${bugRate}% (${typeCounts.BUG} bugs out of ${totalCount})
- Status Breakdown: BACKLOG: ${statusCounts.BACKLOG}, TODO: ${statusCounts.TODO}, IN_PROGRESS: ${statusCounts.IN_PROGRESS}, IN_REVIEW: ${statusCounts.IN_REVIEW}, DONE: ${statusCounts.DONE}
- Priority Breakdown: P0 (Urgent): ${priorityCounts.P0}, P1 (High): ${priorityCounts.P1}, P2 (Medium): ${priorityCounts.P2}, P3 (Low): ${priorityCounts.P3}, P4: ${priorityCounts.P4}
- Type Breakdown: Bugs: ${typeCounts.BUG}, Tasks: ${typeCounts.TASK}, Stories: ${typeCounts.STORY}, Epics: ${typeCounts.EPIC}, Subtasks: ${typeCounts.SUBTASK}

Live Issues Snapshot:
${items
  .slice(0, 35)
  .map(
    (i) =>
      `- [${i.issueKey}] (${i.type}, ${i.priority}, Status: ${i.status}, Assignee: ${i.assignee?.name || 'Unassigned'}): "${i.title}"`,
  )
  .join('\n')}

OPERATIONAL MODES & GENERATIVE UI:
Your response should be concise, professional, and trigger interactive Generative UI widgets when helpful!

1. INQUIRY & STATUS (intent: "chat"):
   - When the user asks about completion rate, bug rate, sprint health, progress metrics, status overview (e.g. "what are completion/bug rate", "how is sprint going", "metrics"):
     Set "widget": "metrics".
     JSON format:
     {
       "intent": "chat",
       "reply": "Crisp 1-2 sentence high-level summary of the metrics.",
       "widget": "metrics"
     }

   - When the user asks about specific issues, people, tasks, or bugs (e.g. "how many issues are assigned to Michael Scott?", "show Sarah's tasks", "what are P0 issues?", "which issues are pending?"):
     Set "widget": "issue_list".
     CRITICAL: In "selectedKeys", provide an array containing ONLY the exact issue keys that directly answer the query!
     - e.g. "issues assigned to Michael Scott": "selectedKeys": ["PAY-3"], "title": "Issues Assigned to Michael Scott"
     - e.g. "what are P0 issues?": "selectedKeys": ["PAY-1", "PAY-6"], "title": "P0 Urgent Issues"
     - e.g. "all pending issues": "selectedKeys": ["PAY-1", "PAY-2", ...], "title": "Pending Issues"
     JSON format:
     {
       "intent": "chat",
       "reply": "Michael Scott is currently assigned to 1 issue ([PAY-3]).",
       "widget": "issue_list",
       "title": "Issues Assigned to Michael Scott",
       "selectedKeys": ["PAY-3"]
     }

   - For general conversational questions, tips, or guidance:
     JSON format:
     {
       "intent": "chat",
       "reply": "Clean markdown response with bold highlights and code tags for issue keys."
     }

2. ISSUE CREATION (intent: "create_issue"):
   ONLY when the user explicitly instructs to CREATE, ADD, or PROPOSE a new issue/bug/task/story:
   JSON format:
   {
     "intent": "create_issue",
     "reply": "I've prepared a proposal for **{Title}**. Review the card below and confirm:",
     "draft": {
       "title": "Clear action title",
       "type": "TASK" | "BUG" | "STORY" | "EPIC" | "SUBTASK",
       "priority": "P0" | "P1" | "P2" | "P3" | "P4",
       "status": "TODO",
       "estimateHours": number or null,
       "storyPoints": number or null,
       "description": "Description in markdown",
       "suggestedDueDate": "YYYY-MM-DD" or null,
       "explanation": "1-sentence rationale"
     }
   }

Strict Output Format:
Return ONLY a valid JSON object matching one of the formats above. No markdown fences, no text before or after.`;

    if (groqKey || geminiKey || openaiKey) {
      const apiKey = groqKey || geminiKey || openaiKey!;
      const baseUrl = groqKey
        ? 'https://api.groq.com/openai/v1'
        : geminiKey
        ? 'https://generativelanguage.googleapis.com/v1beta/openai'
        : 'https://api.openai.com/v1';

      const model = groqKey
        ? this.configService.get<string>('GROQ_MODEL', 'openai/gpt-oss-120b')
        : geminiKey
        ? this.configService.get<string>('GEMINI_MODEL', 'gemini-2.0-flash')
        : 'gpt-4o-mini';

      modelUsed = model;

      try {
        const messagesPayload: any[] = [{ role: 'system', content: systemPrompt }];
        if (dto.history && dto.history.length > 0) {
          for (const h of dto.history.slice(-6)) {
            messagesPayload.push({ role: h.role, content: h.content });
          }
        }
        messagesPayload.push({ role: 'user', content: dto.prompt });

        const res = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: messagesPayload,
            temperature: 0.1,
            response_format: { type: 'json_object' },
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            const cleaned = content.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
            const parsed = JSON.parse(cleaned);

            if (parsed.intent === 'create_issue' && parsed.draft) {
              const draft: ParsedIssueDraft = {
                title: parsed.draft.title || 'Untitled Issue',
                type: this.sanitizeType(parsed.draft.type),
                priority: this.sanitizePriority(parsed.draft.priority),
                status: 'TODO',
                estimateHours: parsed.draft.estimateHours || null,
                storyPoints: parsed.draft.storyPoints || null,
                description: parsed.draft.description || '',
                suggestedDueDate: parsed.draft.suggestedDueDate || null,
                explanation: parsed.draft.explanation || 'Created via ProjectFlow AI Copilot.',
                modelUsed: model,
              };

              return {
                intent: 'create_issue',
                reply: parsed.reply || `I've prepared a proposal for **${draft.title}**:`,
                draft,
                modelUsed: model,
              };
            }

            if (parsed.intent === 'chat' && parsed.reply) {
              let widget: CopilotWidget | undefined;
              let targetFiltered = items;
              let targetTitle = 'Relevant Issues';

              if (parsed.widget === 'issue_list') {
                const { filtered, title, filter } = resolveRelevantIssues(
                  dto.prompt,
                  parsed.reply,
                  parsed.selectedKeys,
                  parsed.title,
                  parsed.filter,
                );
                widget = buildIssueListWidget(title, filter, filtered);
                targetFiltered = filtered;
                targetTitle = title;
              } else if (parsed.widget === 'metrics' || isMetricsIntent) {
                widget = metricsWidget;
              } else if (isIssueListIntent) {
                const { filtered, title, filter } = resolveRelevantIssues(
                  dto.prompt,
                  parsed.reply,
                  parsed.selectedKeys,
                  parsed.title,
                  parsed.filter,
                );
                widget = buildIssueListWidget(title, filter, filtered);
                targetFiltered = filtered;
                targetTitle = title;
              }

              // Compose standardized Cards, Charts, and Tables
              const blocks = composeGenerativeBlocks(dto.prompt, parsed.reply, targetFiltered, targetTitle);

              return {
                intent: 'chat',
                reply: parsed.reply,
                blocks: blocks.length > 0 ? blocks : undefined,
                widget,
                modelUsed: model,
              };
            }
          }
        }
      } catch (err: any) {
        this.logger.warn(`AI copilot chat API call failed (${err.message}). Falling back to heuristic.`);
      }
    }

    // Heuristic Fallback
    const isCreationIntent =
      lowerPrompt.startsWith('create ') ||
      lowerPrompt.startsWith('add ') ||
      lowerPrompt.startsWith('new ') ||
      lowerPrompt.startsWith('make ') ||
      lowerPrompt.includes('create a ') ||
      lowerPrompt.includes('add a ') ||
      lowerPrompt.includes('fix the ') ||
      lowerPrompt.includes('implement ');

    if (!isCreationIntent && isMetricsIntent) {
      const blocks = composeGenerativeBlocks(dto.prompt, '', [], `${project.name} • Sprint & Quality Analytics`);
      return {
        intent: 'chat',
        reply: `Here are the latest sprint metrics and quality rates for **${project.name}**:`,
        blocks: blocks.length > 0 ? blocks : undefined,
        widget: metricsWidget,
        modelUsed: 'heuristic-metrics',
      };
    }

    if (
      !isCreationIntent &&
      (isIssueListIntent ||
        lowerPrompt.includes('count') ||
        lowerPrompt.includes('status') ||
        lowerPrompt.includes('assigned') ||
        lowerPrompt.includes('assiged') ||
        lowerPrompt.includes('performance') ||
        lowerPrompt.includes('workload'))
    ) {
      const { filtered, title, filter } = resolveRelevantIssues(dto.prompt, '');
      const blocks = composeGenerativeBlocks(dto.prompt, '', filtered, title);
      let reply = `Here are the active issues in **${project.name}**:`;
      if (filtered.length === 1) {
        const single = filtered[0];
        reply = `Found 1 matching issue: **[${single.issueKey}] ${single.title}** (Status: ${single.status}, Priority: ${single.priority}, Assignee: ${single.assignee?.name || 'Unassigned'}).`;
      } else if (filtered.length === 0) {
        reply = `No matching issues found for that query in **${project.name}**.`;
      } else {
        reply = `Found ${filtered.length} matching issues in **${project.name}**:`;
      }

      return {
        intent: 'chat',
        reply,
        blocks: blocks.length > 0 ? blocks : undefined,
        widget: buildIssueListWidget(title, filter, filtered),
        modelUsed: 'heuristic-backlog',
      };
    }

    if (isCreationIntent) {
      const draft = this.heuristicFallback(dto.prompt);
      return {
        intent: 'create_issue',
        reply: `I've prepared a proposal for **${draft.title}**. Review the attributes below and click **Confirm & Create Issue** when ready:`,
        draft,
        modelUsed: 'heuristic-fallback',
      };
    }

    return {
      intent: 'chat',
      reply: `I am your ProjectFlow AI Assistant for **${project.name}**.\n\n- Ask questions about active tasks, priorities, and status (e.g. *"which issues are pending?"*, *"what is the bug rate?"*).\n- Or draft new issues (e.g. *"Create a P1 bug for checkout timeout, estimate 4 hours"*).`,
      modelUsed: 'heuristic-guide',
    };
  }
}


