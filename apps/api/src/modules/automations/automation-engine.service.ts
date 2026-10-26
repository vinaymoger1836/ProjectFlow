import { Injectable, Inject, Logger } from '@nestjs/common';
import { and, asc, eq, inArray, isNull, notInArray, SQL } from 'drizzle-orm';
import { Database, automations, automationRuns, issues, projects } from '@projectflow/database';
import { AutomationCondition, AutomationRunSummary, NotifyAction } from '@projectflow/types';
import { DRIZZLE_DB } from '../database/database.module';
import { NotificationsService, NotifyInput } from '../notifications/notifications.service';
import { DIGEST_KEY_PREVIEW, IssueCreatedJobData, SCHEDULED_MATCH_LIMIT } from './automations.constants';

type AutomationRecord = typeof automations.$inferSelect;

interface MatchedIssue {
  id: string;
  issueKey: string;
  title: string;
  type: string;
  priority: string;
  assigneeId: string | null;
  reporterId: string;
}

interface ProjectContext {
  id: string;
  organizationId: string;
}

const MATCHED_ISSUE_COLUMNS = {
  id: issues.id,
  issueKey: issues.issueKey,
  title: issues.title,
  type: issues.type,
  priority: issues.priority,
  assigneeId: issues.assigneeId,
  reporterId: issues.reporterId,
};

/**
 * Executes automations: conditions compile to one SQL filter shared by both triggers, and every
 * execution is claimed in `automation_runs` by (automation, trigger key) before notifying, so a
 * retried or duplicated job never notifies twice. Failures are recorded on the run, not thrown.
 */
@Injectable()
export class AutomationEngineService {
  private readonly logger = new Logger(AutomationEngineService.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly notifications: NotificationsService,
  ) {}

  /** ISSUE_CREATED: notify about the new issue for each enabled automation whose conditions it matches. */
  async handleIssueCreated(job: IssueCreatedJobData): Promise<number> {
    const [rules, [project]] = await Promise.all([
      this.db
        .select()
        .from(automations)
        .where(
          and(
            eq(automations.projectId, job.projectId),
            eq(automations.triggerType, 'ISSUE_CREATED'),
            eq(automations.enabled, true),
          ),
        ),
      this.db
        .select({ id: projects.id, organizationId: projects.organizationId })
        .from(projects)
        .where(eq(projects.id, job.projectId))
        .limit(1),
    ]);
    if (rules.length === 0 || !project) return 0;

    const results = await Promise.all(
      rules.map(async (rule) => {
        const [issue] = await this.db
          .select(MATCHED_ISSUE_COLUMNS)
          .from(issues)
          .where(and(eq(issues.id, job.issueId), activeIssuesOf(job.projectId), conditionsToSql(rule.conditions)))
          .limit(1);
        if (!issue) return false;

        const runId = await this.claim(rule, `issue-${job.issueId}`, { issueId: issue.id });
        if (!runId) return false;

        await this.execute(runId, async () => {
          const recipientIds = [...recipientsFor(rule.actions, [issue], job.actorId).keys()];
          const delivery = await this.notifyAll(
            recipientIds.map((recipientId) => ({
              ...issueNotification(rule, project, issue, recipientId),
              title: `${rule.name}: ${issue.issueKey} created`,
              actorId: job.actorId,
            })),
          );
          return { matched: 1, ...delivery };
        });
        return true;
      }),
    );
    return results.filter(Boolean).length;
  }

  /**
   * SCHEDULE (or "Run now"): find every matching issue and send each recipient one digest.
   * Returns null when this trigger occurrence already ran.
   */
  async runScheduled(rule: AutomationRecord, triggerKey: string, manual: boolean): Promise<AutomationRunSummary | null> {
    const [project] = await this.db
      .select({ id: projects.id, organizationId: projects.organizationId })
      .from(projects)
      .where(eq(projects.id, rule.projectId))
      .limit(1);
    if (!project) return null;

    const runId = await this.claim(rule, triggerKey, { manual });
    if (!runId) return null;

    await this.execute(runId, async () => {
      const matched = await this.db
        .select(MATCHED_ISSUE_COLUMNS)
        .from(issues)
        .where(and(activeIssuesOf(rule.projectId), conditionsToSql(rule.conditions)))
        .orderBy(asc(issues.priority), asc(issues.keyNumber))
        .limit(SCHEDULED_MATCH_LIMIT);

      // Scheduled runs have no actor, so nobody is excluded
      const byRecipient = recipientsFor(rule.actions, matched, null);
      const delivery = await this.notifyAll(
        [...byRecipient].map(([recipientId, recipientIssues]) => digestNotification(rule, project, recipientIssues, recipientId)),
      );
      return { matched: matched.length, ...delivery };
    });

    return this.getRun(runId);
  }

  async getRun(runId: string): Promise<AutomationRunSummary | null> {
    const [row] = await this.db
      .select({ run: automationRuns, issueKey: issues.issueKey })
      .from(automationRuns)
      .leftJoin(issues, eq(issues.id, automationRuns.issueId))
      .where(eq(automationRuns.id, runId))
      .limit(1);
    return row ? toRunSummary(row.run, row.issueKey) : null;
  }

  /** Inserts the run row; returns null when this (automation, trigger key) was already claimed. */
  private async claim(
    rule: AutomationRecord,
    triggerKey: string,
    extra: { issueId?: string; manual?: boolean },
  ): Promise<string | null> {
    const [row] = await this.db
      .insert(automationRuns)
      .values({
        automationId: rule.id,
        projectId: rule.projectId,
        triggerType: rule.triggerType,
        triggerKey,
        manual: extra.manual ?? false,
        issueId: extra.issueId ?? null,
        status: 'RUNNING',
      })
      .onConflictDoNothing({ target: [automationRuns.automationId, automationRuns.triggerKey] })
      .returning({ id: automationRuns.id });
    return row?.id ?? null;
  }

  /** Runs the actions and records the outcome; never throws. */
  private async execute(runId: string, work: () => Promise<{ matched: number; notified: number; failures: string[] }>) {
    const finish = (values: Partial<typeof automationRuns.$inferInsert>) =>
      this.db
        .update(automationRuns)
        .set({ ...values, finishedAt: new Date() })
        .where(eq(automationRuns.id, runId))
        .catch((err: unknown) => this.logger.warn(`Could not record automation run ${runId}: ${errorMessage(err)}`));

    try {
      const { matched, notified, failures } = await work();
      await finish({
        status: failures.length > 0 ? 'FAILED' : 'SUCCESS',
        matchedCount: matched,
        notifiedCount: notified,
        error: failures.length > 0 ? `${failures.length} notification(s) failed: ${failures[0]}` : null,
      });
    } catch (err) {
      this.logger.warn(`Automation run ${runId} failed: ${errorMessage(err)}`);
      await finish({ status: 'FAILED', error: errorMessage(err) });
    }
  }

  /** Notifies every recipient in parallel; one failed recipient does not stop the others. */
  private async notifyAll(inputs: NotifyInput[]): Promise<{ notified: number; failures: string[] }> {
    const outcomes = await Promise.allSettled(inputs.map((input) => this.notifications.notify(input)));
    return {
      notified: outcomes.filter((o) => o.status === 'fulfilled').length,
      failures: outcomes.flatMap((o) => (o.status === 'rejected' ? [errorMessage(o.reason)] : [])),
    };
  }
}

/** Non-archived issues of a project. */
function activeIssuesOf(projectId: string): SQL {
  return and(eq(issues.projectId, projectId), eq(issues.isArchived, false), isNull(issues.deletedAt)) as SQL;
}

/** ANDs every condition; an empty list matches everything. */
export function conditionsToSql(conditions: AutomationCondition[]): SQL | undefined {
  const clauses = conditions.map((condition): SQL => {
    switch (condition.field) {
      case 'type':
        return condition.operator === 'IN' ? inArray(issues.type, condition.values) : notInArray(issues.type, condition.values);
      case 'priority':
        return condition.operator === 'IN'
          ? inArray(issues.priority, condition.values)
          : notInArray(issues.priority, condition.values);
      case 'status':
        return condition.operator === 'IN' ? inArray(issues.status, condition.values) : notInArray(issues.status, condition.values);
      case 'assignee':
        return condition.operator === 'UNASSIGNED' ? isNull(issues.assigneeId) : inArray(issues.assigneeId, condition.values);
    }
  });
  return clauses.length > 0 ? and(...clauses) : undefined;
}

/** Recipient → the issues they should hear about, across every NOTIFY action. The actor is never notified. */
function recipientsFor(
  actions: AutomationRecord['actions'],
  matched: MatchedIssue[],
  actorId: string | null,
): Map<string, MatchedIssue[]> {
  const recipients = new Set(actions.filter((a): a is NotifyAction => a.type === 'NOTIFY').flatMap((a) => a.recipients));
  const byRecipient = new Map<string, MatchedIssue[]>();
  for (const issue of matched) {
    const ids = new Set<string>();
    if (recipients.has('ASSIGNEE') && issue.assigneeId) ids.add(issue.assigneeId);
    if (recipients.has('REPORTER')) ids.add(issue.reporterId);
    for (const id of ids) {
      if (id === actorId) continue;
      byRecipient.set(id, [...(byRecipient.get(id) ?? []), issue]);
    }
  }
  return byRecipient;
}

function notifyMessage(rule: AutomationRecord): string | null {
  return rule.actions.find((a): a is NotifyAction => a.type === 'NOTIFY')?.message ?? null;
}

function withMessage(rule: AutomationRecord, text: string): string {
  const message = notifyMessage(rule);
  return message ? `${message} · ${text}` : text;
}

function issueNotification(rule: AutomationRecord, project: ProjectContext, issue: MatchedIssue, recipientId: string): NotifyInput {
  return {
    recipientId,
    organizationId: project.organizationId,
    projectId: project.id,
    type: 'AUTOMATION',
    title: `${rule.name}: ${issue.issueKey}`,
    body: withMessage(rule, `${issue.priority} ${issue.type} · ${issue.title}`),
    link: `/?issue=${encodeURIComponent(issue.issueKey)}`,
    entityType: 'ISSUE',
    entityId: issue.id,
    actorId: null,
  };
}

function digestNotification(rule: AutomationRecord, project: ProjectContext, matched: MatchedIssue[], recipientId: string): NotifyInput {
  if (matched.length === 1) return issueNotification(rule, project, matched[0], recipientId);

  const keys = matched.slice(0, DIGEST_KEY_PREVIEW).map((i) => i.issueKey).join(', ');
  const more = matched.length > DIGEST_KEY_PREVIEW ? ` +${matched.length - DIGEST_KEY_PREVIEW} more` : '';
  return {
    recipientId,
    organizationId: project.organizationId,
    projectId: project.id,
    type: 'AUTOMATION',
    title: `${rule.name}: ${matched.length} issues`,
    body: withMessage(rule, `${keys}${more}`),
    link: '/',
    entityType: 'AUTOMATION',
    entityId: rule.id,
    actorId: null,
  };
}

export function toRunSummary(run: typeof automationRuns.$inferSelect, issueKey: string | null): AutomationRunSummary {
  return {
    id: run.id,
    automationId: run.automationId,
    status: run.status,
    triggerType: run.triggerType,
    manual: run.manual,
    issueKey,
    matchedCount: run.matchedCount,
    notifiedCount: run.notifiedCount,
    error: run.error,
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
  };
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
