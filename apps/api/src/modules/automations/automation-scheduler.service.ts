import { Injectable, Inject, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { OnEvent } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';
import { and, eq } from 'drizzle-orm';
import { Database, automations } from '@projectflow/database';
import { AutomationTrigger } from '@projectflow/types';
import { DRIZZLE_DB } from '../database/database.module';
import { DomainEvents, IssueCreatedEvent } from '../../common/events/domain-events';
import { scheduleToCron } from './automation-definition';
import {
  AUTOMATIONS_QUEUE,
  AutomationJobs,
  IssueCreatedJobData,
  ScheduledJobData,
  SCHEDULER_PREFIX,
  schedulerId,
} from './automations.constants';

/**
 * Feeds the automations queue: `issue.created` events become jobs, and every enabled scheduled
 * automation owns one BullMQ job scheduler (cron + timezone). Redis failures are logged, never thrown;
 * the boot-time reconcile repairs schedulers that could not be written.
 */
@Injectable()
export class AutomationSchedulerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AutomationSchedulerService.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    @InjectQueue(AUTOMATIONS_QUEUE) private readonly queue: Queue<IssueCreatedJobData | ScheduledJobData>,
  ) {}

  /** Not awaited, so an unreachable Redis cannot stall application startup. */
  onApplicationBootstrap() {
    void this.reconcile().catch((err: unknown) => this.logger.warn(`Could not reconcile automation schedules: ${errorMessage(err)}`));
  }

  @OnEvent(DomainEvents.IssueCreated, { async: true })
  async onIssueCreated(event: IssueCreatedEvent) {
    try {
      await this.queue.add(
        AutomationJobs.IssueCreated,
        { issueId: event.issueId, projectId: event.projectId, actorId: event.actorId },
        { jobId: `issue-created-${event.issueId}` },
      );
    } catch (err) {
      this.logger.warn(`Failed to enqueue automations for issue ${event.issueId}: ${errorMessage(err)}`);
    }
  }

  /** Creates, updates, or removes the automation's scheduler to match its current definition. */
  async sync(automation: { id: string; enabled: boolean; trigger: AutomationTrigger }): Promise<void> {
    try {
      if (automation.enabled && automation.trigger.type === 'SCHEDULE') {
        await this.queue.upsertJobScheduler(
          schedulerId(automation.id),
          { pattern: scheduleToCron(automation.trigger), tz: automation.trigger.timezone },
          { name: AutomationJobs.Scheduled, data: { automationId: automation.id } },
        );
      } else {
        await this.queue.removeJobScheduler(schedulerId(automation.id));
      }
    } catch (err) {
      this.logger.warn(`Could not update the schedule of automation ${automation.id}: ${errorMessage(err)}`);
    }
  }

  async remove(automationId: string): Promise<void> {
    try {
      await this.queue.removeJobScheduler(schedulerId(automationId));
    } catch (err) {
      this.logger.warn(`Could not remove the schedule of automation ${automationId}: ${errorMessage(err)}`);
    }
  }

  /** Every enabled scheduled automation gets its scheduler; schedulers of deleted or disabled ones are dropped. */
  private async reconcile() {
    const rows = await this.db
      .select({ id: automations.id, enabled: automations.enabled, trigger: automations.trigger })
      .from(automations)
      .where(and(eq(automations.triggerType, 'SCHEDULE'), eq(automations.enabled, true)));
    await Promise.all(rows.map((row) => this.sync(row)));

    const wanted = new Set(rows.map((row) => schedulerId(row.id)));
    const existing = await this.queue.getJobSchedulers();
    const stale = existing.map((s) => s.key).filter((key) => key.startsWith(SCHEDULER_PREFIX) && !wanted.has(key));
    await Promise.all(stale.map((key) => this.queue.removeJobScheduler(key)));

    if (rows.length > 0 || stale.length > 0) {
      this.logger.log(`Automation schedules: ${rows.length} active, ${stale.length} stale removed`);
    }
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
