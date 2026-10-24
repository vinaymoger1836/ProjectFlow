import { Module } from '@nestjs/common';
import { IssuesController } from './issues.controller';
import { IssuePlanningController } from './issue-planning.controller';
import { IssuesService } from './issues.service';
import { AssignmentTargetsService } from './assignment-targets.service';
import { IssueDependenciesService } from './issue-dependencies.service';
import { IssueBulkService } from './issue-bulk.service';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [IssuesController, IssuePlanningController],
  providers: [IssuesService, AssignmentTargetsService, IssueDependenciesService, IssueBulkService],
  exports: [IssuesService, AssignmentTargetsService, IssueDependenciesService, IssueBulkService],
})
export class IssuesModule {}
