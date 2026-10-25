import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SprintsModule } from '../sprints/sprints.module';
import { MilestonesModule } from '../milestones/milestones.module';
import { ReleasesModule } from '../releases/releases.module';
import { ProjectHealthController } from './project-health.controller';
import { ProjectHealthService } from './project-health.service';
import { ProjectHealthQueueService } from './project-health-queue.service';
import { ProjectHealthProcessor } from './project-health.processor';
import { PROJECT_HEALTH_QUEUE } from './project-health.constants';

@Module({
  imports: [
    SprintsModule,
    MilestonesModule,
    ReleasesModule,
    BullModule.registerQueue({
      name: PROJECT_HEALTH_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 15_000 },
        removeOnComplete: true,
        removeOnFail: 50,
      },
    }),
  ],
  controllers: [ProjectHealthController],
  providers: [ProjectHealthService, ProjectHealthQueueService, ProjectHealthProcessor],
  exports: [ProjectHealthService],
})
export class ProjectHealthModule {}
