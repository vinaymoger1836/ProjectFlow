import { Controller, Get, Post, Param, UseGuards, ParseUUIDPipe, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { ProjectAccessService } from '../auth/project-access.service';
import { ProjectHealthService } from './project-health.service';

@ApiTags('Project Health')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller()
export class ProjectHealthController {
  constructor(
    private readonly health: ProjectHealthService,
    private readonly projectAccess: ProjectAccessService,
  ) {}

  @Get('projects/:projectId/health')
  @ApiOperation({ summary: 'Live deterministic health evaluation with factors and 30-day trend' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  async getHealth(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    const data = await this.health.getReport(user.id, projectId);
    return { success: true, data };
  }

  @Post('projects/:projectId/health/recompute')
  @HttpCode(200)
  @ApiOperation({ summary: 'Re-evaluate now and persist the status and today\'s snapshot' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  async recompute(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    const project = await this.projectAccess.assertProjectAccess(user.id, projectId);
    await this.health.recompute(project.id);
    const data = await this.health.buildReport(project);
    return { success: true, data };
  }
}
