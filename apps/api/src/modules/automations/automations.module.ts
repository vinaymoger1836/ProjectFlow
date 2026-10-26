import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsModule } from '../notifications/notifications.module';
import { LlmModule } from '../llm/llm.module';
import { AutomationsController } from './automations.controller';
import { AutomationsService } from './automations.service';
import { AutomationEngineService } from './automation-engine.service';
import { AutomationSchedulerService } from './automation-scheduler.service';
import { AutomationsProcessor } from './automations.processor';
import { AutomationDraftService } from './automation-draft.service';
import { IssueClassifierService } from './issue-classifier.service';
import { AUTOMATIONS_QUEUE } from './automations.constants';

@Module({
  imports: [
    NotificationsModule,
    LlmModule,
    BullModule.registerQueue({
      name: AUTOMATIONS_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 15_000 },
        removeOnComplete: true,
        removeOnFail: 100,
      },
    }),
  ],
  controllers: [AutomationsController],
  providers: [
    AutomationsService,
    AutomationEngineService,
    AutomationSchedulerService,
    AutomationsProcessor,
    AutomationDraftService,
    IssueClassifierService,
  ],
})
export class AutomationsModule {}
