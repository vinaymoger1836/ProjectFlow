import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { SprintsController } from './sprints.controller';
import { SprintsService } from './sprints.service';
import { SprintPlannerService } from './sprint-planner.service';

@Module({
  imports: [LlmModule],
  controllers: [SprintsController],
  providers: [SprintsService, SprintPlannerService],
  exports: [SprintsService, SprintPlannerService],
})
export class SprintsModule {}
