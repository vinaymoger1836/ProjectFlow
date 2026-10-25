import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { OnEvent } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';
import {
  DomainEvents,
  IssueCreatedEvent,
  IssueUpdatedEvent,
  PlanningChangedEvent,
} from '../../common/events/domain-events';
import { ProjectHealthService } from './project-health.service';
import {
  PROJECT_HEALTH_QUEUE,
  HealthJobs,
  RecomputeHealthJobData,
  HEALTH_RECOMPUTE_DEBOUNCE_MS,
  HEALTH_SWEEP_SCHEDULER_ID,
  HEALTH_SWEEP_CRON,
} from './project-health.constants';

/**
 * Turns domain events into debounced health recomputes and schedules the daily sweep.
 * Enqueueing is fire-and-forget: a Redis outage delays health updates but never fails a mutation.
 */
@Injectable()
export class ProjectHealthQueueService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ProjectHealthQueueService.name);

  constructor(
    @InjectQueue(PROJECT_HEALTH_QUEUE) private readonly queue: Queue<RecomputeHealthJobData | Record<string, never>>,
    private readonly health: ProjectHealthService,
  ) {}

  /** Not awaited, so an unreachable Redis cannot stall application startup. */
  onApplicationBootstrap() {
    void this.queue
      .upsertJobScheduler(HEALTH_SWEEP_SCHEDULER_ID, { pattern: HEALTH_SWEEP_CRON, tz: 'UTC' }, { name: HealthJobs.Sweep, data: {} })
      .catch((err: unknown) => this.logger.warn(`Could not schedule the daily health sweep: ${errorMessage(err)}`));

    // Backfill today's snapshot for projects not evaluated yet (first boot, or after downtime)
    void this.health
      .findProjectsWithoutSnapshotToday()
      .then(async (ids) => {
        await Promise.all(ids.map((projectId) => this.enqueue(projectId, 0)));
        if (ids.length > 0) this.logger.log(`Queued health evaluation for ${ids.length} project(s)`);
      })
      .catch((err: unknown) => this.logger.warn(`Health backfill failed: ${errorMessage(err)}`));
  }

  @OnEvent(DomainEvents.IssueCreated, { async: true })
  async onIssueCreated(event: IssueCreatedEvent) {
    await this.enqueue(event.projectId);
  }

  @OnEvent(DomainEvents.IssueUpdated, { async: true })
  async onIssueUpdated(event: IssueUpdatedEvent) {
    await this.enqueue(event.projectId);
  }

  @OnEvent(DomainEvents.PlanningChanged, { async: true })
  async onPlanningChanged(event: PlanningChangedEvent) {
    await this.enqueue(event.projectId);
  }

  async enqueue(projectId: string, delay = HEALTH_RECOMPUTE_DEBOUNCE_MS) {
    try {
      await this.queue.add(
        HealthJobs.Recompute,
        { projectId },
        // One pending recompute per project; later events inside the window are absorbed by it
        { delay, deduplication: { id: `health:${projectId}`, ttl: Math.max(delay, 1) } },
      );
    } catch (err) {
      this.logger.warn(`Failed to enqueue health recompute for ${projectId}: ${errorMessage(err)}`);
    }
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
