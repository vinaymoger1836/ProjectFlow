import { Controller, Get, Post, Delete, Body, Param, UseGuards, ParseUUIDPipe, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { IssueDependenciesService } from './issue-dependencies.service';
import { IssueBulkService } from './issue-bulk.service';
import { CreateIssueDependencyDto } from './dto/issue-dependency.dto';
import { BulkUpdateIssuesDto } from './dto/bulk-update-issues.dto';

@ApiTags('Issues')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller()
export class IssuePlanningController {
  constructor(
    private readonly dependenciesService: IssueDependenciesService,
    private readonly bulkService: IssueBulkService,
  ) {}

  @Get('issues/:identifier/dependencies')
  @ApiOperation({ summary: 'List links of an issue (blocks, blocked by, relates to, duplicates)' })
  @ApiParam({ name: 'identifier', description: 'Issue UUID or key (e.g. PAY-10)' })
  async listDependencies(@CurrentUser() user: AuthenticatedUser, @Param('identifier') identifier: string) {
    const data = await this.dependenciesService.listDependencies(user.id, identifier);
    return { success: true, data };
  }

  @Post('issues/:identifier/dependencies')
  @ApiOperation({ summary: 'Link an issue to another issue in the same project' })
  @ApiParam({ name: 'identifier', description: 'Issue UUID or key (e.g. PAY-10)' })
  async addDependency(
    @CurrentUser() user: AuthenticatedUser,
    @Param('identifier') identifier: string,
    @Body() dto: CreateIssueDependencyDto,
  ) {
    const data = await this.dependenciesService.addDependency(user.id, identifier, dto);
    return { success: true, data };
  }

  @Delete('issue-dependencies/:dependencyId')
  @ApiOperation({ summary: 'Remove an issue link' })
  @ApiParam({ name: 'dependencyId', description: 'Dependency UUID' })
  async removeDependency(
    @CurrentUser() user: AuthenticatedUser,
    @Param('dependencyId', ParseUUIDPipe) dependencyId: string,
  ) {
    const data = await this.dependenciesService.removeDependency(user.id, dependencyId);
    return { success: true, data };
  }

  @Post('projects/:projectId/issues/bulk-update')
  @HttpCode(200)
  @ApiOperation({ summary: 'Preview (dryRun) or apply a batch of issue field changes' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  async bulkUpdate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: BulkUpdateIssuesDto,
  ) {
    const data = await this.bulkService.bulkUpdate(user.id, projectId, dto);
    return { success: true, data };
  }
}
