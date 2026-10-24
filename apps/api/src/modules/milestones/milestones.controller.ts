import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { MilestonesService } from './milestones.service';
import { CreateMilestoneDto, UpdateMilestoneDto } from './dto/milestone.dto';

@ApiTags('Milestones')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller()
export class MilestonesController {
  constructor(private readonly milestonesService: MilestonesService) {}

  @Get('projects/:projectId/milestones')
  @ApiOperation({ summary: 'List milestones with live progress and slip status' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  async listMilestones(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    const data = await this.milestonesService.listMilestones(user.id, projectId);
    return { success: true, data };
  }

  @Post('projects/:projectId/milestones')
  @ApiOperation({ summary: 'Create a milestone' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  async createMilestone(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateMilestoneDto,
  ) {
    const data = await this.milestonesService.createMilestone(user.id, projectId, dto);
    return { success: true, data };
  }

  @Get('milestones/:milestoneId')
  @ApiOperation({ summary: 'Get milestone progress and slip status' })
  @ApiParam({ name: 'milestoneId', description: 'Milestone UUID' })
  async getMilestone(
    @CurrentUser() user: AuthenticatedUser,
    @Param('milestoneId', ParseUUIDPipe) milestoneId: string,
  ) {
    const data = await this.milestonesService.getMilestone(user.id, milestoneId);
    return { success: true, data };
  }

  @Patch('milestones/:milestoneId')
  @ApiOperation({ summary: 'Update milestone name, description, or target date' })
  @ApiParam({ name: 'milestoneId', description: 'Milestone UUID' })
  async updateMilestone(
    @CurrentUser() user: AuthenticatedUser,
    @Param('milestoneId', ParseUUIDPipe) milestoneId: string,
    @Body() dto: UpdateMilestoneDto,
  ) {
    const data = await this.milestonesService.updateMilestone(user.id, milestoneId, dto);
    return { success: true, data };
  }

  @Delete('milestones/:milestoneId')
  @ApiOperation({ summary: 'Delete a milestone (its issues are unassigned, not deleted)' })
  @ApiParam({ name: 'milestoneId', description: 'Milestone UUID' })
  async deleteMilestone(
    @CurrentUser() user: AuthenticatedUser,
    @Param('milestoneId', ParseUUIDPipe) milestoneId: string,
  ) {
    const data = await this.milestonesService.deleteMilestone(user.id, milestoneId);
    return { success: true, data };
  }
}
