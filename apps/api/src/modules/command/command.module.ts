import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { AiModule } from '../ai/ai.module';
import { ProjectHealthModule } from '../project-health/project-health.module';
import { CommandController } from './command.controller';
import { CommandService } from './command.service';

@Module({
  imports: [LlmModule, AiModule, ProjectHealthModule],
  controllers: [CommandController],
  providers: [CommandService],
})
export class CommandModule {}
