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
  ): Promise<{
    intent: 'chat' | 'create_issue';
    reply: string;
    draft?: ParsedIssueDraft;
    modelUsed: string;
  }> {
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

    const groqKey = this.configService.get<string>('GROQ_API_KEY');
    const geminiKey = this.configService.get<string>('GEMINI_API_KEY');
    const openaiKey = this.configService.get<string>('OPENAI_API_KEY');

    let modelUsed = 'heuristic-copilot';

    const systemPrompt = `You are ProjectFlow AI Copilot, the intelligent assistant for the project "${project.name}" (Key: "${project.key}").

Current Project Live Backlog & Metrics:
- Total Active Issues: ${totalCount}
- Pending (Unfinished) Issues: ${pendingCount}
- Breakdown by Status:
  * BACKLOG: ${statusCounts.BACKLOG}
  * TODO: ${statusCounts.TODO}
  * IN_PROGRESS: ${statusCounts.IN_PROGRESS}
  * IN_REVIEW: ${statusCounts.IN_REVIEW}
  * DONE: ${statusCounts.DONE}
- Breakdown by Priority: P0 (Urgent): ${priorityCounts.P0}, P1 (High): ${priorityCounts.P1}, P2 (Medium): ${priorityCounts.P2}, P3 (Low): ${priorityCounts.P3}, P4: ${priorityCounts.P4}
- Breakdown by Type: Bugs: ${typeCounts.BUG}, Tasks: ${typeCounts.TASK}, Stories: ${typeCounts.STORY}, Epics: ${typeCounts.EPIC}, Subtasks: ${typeCounts.SUBTASK}

Live Issues Snapshot:
${items
  .slice(0, 35)
  .map(
    (i) =>
      `- [${i.issueKey}] (${i.type}, ${i.priority}, Status: ${i.status}, Assignee: ${i.assignee?.name || 'Unassigned'}): "${i.title}"`,
  )
  .join('\n')}

Instructions:
You have two distinct operational modes:
1. QUESTION ANSWERING & BACKLOG QUERY (Default for inquiries):
   When the user asks about the project (e.g. "how many tasks are pending?", "what is in progress?", "who has open bugs?", "summarize project status", "what are P0 issues?"):
   - Respond directly, concisely, and accurately using the live data above!
   - Format in clean Markdown (bullet points, bold highlights, code tags for keys like \`[${project.key}-1]\`).
   - Do NOT propose creating a task for answering a question.
   - Output format:
     {
       "intent": "chat",
       "reply": "Markdown answer here..."
     }

2. ISSUE PROPOSAL & CREATION (Only when explicitly requested):
   ONLY when the user specifically instructs to CREATE, ADD, or PROPOSE a new issue/bug/task/story (e.g. "Create a task for...", "Add a bug: ...", "New feature: ...", "Fix checkout button", "I want to file a bug"):
   - Set "intent" to "create_issue".
   - Output format:
     {
       "intent": "create_issue",
       "reply": "I've prepared a proposal for **{Title}**. Review the card below and confirm:",
       "draft": {
         "title": "Clear action-oriented title",
         "type": "TASK" | "BUG" | "STORY" | "EPIC" | "SUBTASK",
         "priority": "P0" | "P1" | "P2" | "P3" | "P4",
         "status": "TODO",
         "estimateHours": number or null,
         "storyPoints": number or null,
         "description": "Markdown description",
         "suggestedDueDate": "YYYY-MM-DD" or null,
         "explanation": "Brief 1-sentence explanation"
       }
     }

Strict Output Format:
Return ONLY a valid JSON object matching one of the two formats above. No markdown fences, no surrounding commentary.`;

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
              return {
                intent: 'chat',
                reply: parsed.reply,
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
    const lower = dto.prompt.toLowerCase().trim();
    const isCreationIntent =
      lower.startsWith('create ') ||
      lower.startsWith('add ') ||
      lower.startsWith('new ') ||
      lower.startsWith('make ') ||
      lower.includes('create a ') ||
      lower.includes('add a ') ||
      lower.includes('fix the ') ||
      lower.includes('implement ');

    if (
      !isCreationIntent &&
      (lower.includes('pending') ||
        lower.includes('how many') ||
        lower.includes('count') ||
        lower.includes('status') ||
        lower.includes('overview') ||
        lower.includes('what') ||
        lower.includes('in progress'))
    ) {
      let reply = `There are currently **${pendingCount} pending issues** in **${project.name}**:\n\n`;
      reply += `- **${statusCounts.IN_PROGRESS}** In Progress\n`;
      reply += `- **${statusCounts.TODO}** To Do\n`;
      reply += `- **${statusCounts.IN_REVIEW}** In Review\n`;
      if (statusCounts.BACKLOG > 0) reply += `- **${statusCounts.BACKLOG}** in Backlog\n`;
      reply += `\n*(${statusCounts.DONE} completed out of ${totalCount} total issues)*\n\n`;

      const activeList = items.filter((i) => i.status !== 'DONE').slice(0, 6);
      if (activeList.length > 0) {
        reply += `**Active issues:**\n`;
        for (const item of activeList) {
          reply += `- \`[${item.issueKey}]\` **${item.title}** (${item.status.replace('_', ' ')} • ${item.priority} • ${item.assignee?.name || 'Unassigned'})\n`;
        }
      }

      return {
        intent: 'chat',
        reply,
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
      reply: `I am your ProjectFlow AI Assistant for **${project.name}**.\n\n- You can ask questions about active tasks, priorities, and status (e.g. *"how many tasks are pending?"* or *"what is in progress?"*).\n- You can ask me to draft new issues (e.g. *"Create a P1 bug for checkout timeout, estimate 4 hours"*).`,
      modelUsed: 'heuristic-guide',
    };
  }
}

