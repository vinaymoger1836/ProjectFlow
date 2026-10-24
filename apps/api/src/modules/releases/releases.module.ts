import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { SprintsModule } from '../sprints/sprints.module';
import { MilestonesModule } from '../milestones/milestones.module';
import { ReleasesController } from './releases.controller';
import { ReleasesService } from './releases.service';
import { ReleaseReadinessService } from './release-readiness.service';
import { ReleaseNotesService } from './release-notes.service';

@Module({
  imports: [LlmModule, SprintsModule, MilestonesModule],
  controllers: [ReleasesController],
  providers: [ReleasesService, ReleaseReadinessService, ReleaseNotesService],
  exports: [ReleasesService, ReleaseReadinessService],
})
export class ReleasesModule {}
