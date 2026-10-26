import { Inject, Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { Database, automations } from '@projectflow/database';
import { DRIZZLE_DB } from '../database/database.module';
import { AutomationEngineService } from './automation-engine.service';
import { AutomationSchedulerService } from './automation-scheduler.service';
import { AUTOMATIONS_QUEUE, AutomationJobs, IssueCreatedJobData, ScheduledJobData } from './automations.constants';

@Processor(AUTOMATIONS_QUEUE, { concurrency: 2 })
export class AutomationsProcessor extends WorkerHost {
  private readonly logger = new Logger(AutomationsProcessor.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly engine: AutomationEngineService,
    private readonly scheduler: AutomationSchedulerService,
  ) {
    super();
  }

  async process(job: Job<IssueCreatedJobData | ScheduledJobData>): Promise<string> {
    if (job.name === AutomationJobs.IssueCreated) {
      const ran = await this.engine.handleIssueCreated(job.data as IssueCreatedJobData);
      return `ran ${ran}`;
    }

    // Re-read the automation: it may have been disabled, deleted, or changed since the job was scheduled
    const { automationId } = job.data as ScheduledJobData;
    const [rule] = await this.db.select().from(automations).where(eq(automations.id, automationId)).limit(1);
    if (!rule || !rule.enabled || rule.triggerType !== 'SCHEDULE') {
      await this.scheduler.remove(automationId);
      return 'skipped';
    }

    // Scheduler job ids are unique per occurrence (repeat:<scheduler>:<millis>) and stable across retries
    const run = await this.engine.runScheduled(rule, `schedule-${job.id ?? job.timestamp}`, false);
    return run ? `${run.status} matched=${run.matchedCount} notified=${run.notifiedCount}` : 'already-ran';
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, err: Error) {
    if (!job) return;
    this.logger.warn(`Automation job ${job.name} failed (attempt ${job.attemptsMade}): ${err.message}`);
  }
}
