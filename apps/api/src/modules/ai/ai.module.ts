import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { IssuesModule } from '../issues/issues.module';
import { SprintsModule } from '../sprints/sprints.module';

@Module({
  imports: [DatabaseModule, AuthModule, IssuesModule, SprintsModule],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
