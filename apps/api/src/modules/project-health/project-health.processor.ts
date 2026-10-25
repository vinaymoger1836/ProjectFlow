import { Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ProjectHealthService } from './project-health.service';
import { ProjectHealthQueueService } from './project-health-queue.service';
import { PROJECT_HEALTH_QUEUE, HealthJobs, RecomputeHealthJobData } from './project-health.constants';

@Processor(PROJECT_HEALTH_QUEUE, { concurrency: 2 })
export class ProjectHealthProcessor extends WorkerHost {
  private readonly logger = new Logger(ProjectHealthProcessor.name);

  constructor(
    private readonly health: ProjectHealthService,
    private readonly healthQueue: ProjectHealthQueueService,
  ) {
    super();
  }

  async process(job: Job<RecomputeHealthJobData | Record<string, never>>): Promise<string> {
    if (job.name === HealthJobs.Sweep) {
      const ids = await this.health.listAllProjectIds();
      // Stagger slightly so a large organization does not evaluate every project at once
      await Promise.all(ids.map((projectId, index) => this.healthQueue.enqueue(projectId, index * 2_000)));
      return `swept ${ids.length}`;
    }

    const { projectId } = job.data as RecomputeHealthJobData;
    const result = await this.health.recompute(projectId);
    return result ? `${result.status} ${result.score}` : 'project-missing';
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, err: Error) {
    if (!job) return;
    this.logger.warn(`Health job ${job.name} failed (attempt ${job.attemptsMade}): ${err.message}`);
  }
}
