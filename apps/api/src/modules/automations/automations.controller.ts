import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, ParseUUIDPipe, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { AutomationsService } from './automations.service';
import { AutomationRunsQueryDto, CreateAutomationDto, UpdateAutomationDto } from './dto/automation.dto';

@ApiTags('Automations')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller()
export class AutomationsController {
  constructor(private readonly automationsService: AutomationsService) {}

  @Get('projects/:projectId/automations')
  @ApiOperation({ summary: 'List project automations with their latest run' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  async listAutomations(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    const data = await this.automationsService.listAutomations(user.id, projectId);
    return { success: true, data };
  }

  @Post('projects/:projectId/automations')
  @ApiOperation({ summary: 'Create an automation (trigger → conditions → actions)' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  async createAutomation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateAutomationDto,
  ) {
    const data = await this.automationsService.createAutomation(user.id, projectId, dto);
    return { success: true, data };
  }

  @Patch('automations/:automationId')
  @ApiOperation({ summary: 'Update an automation, or enable / disable it' })
  @ApiParam({ name: 'automationId', description: 'Automation UUID' })
  async updateAutomation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('automationId', ParseUUIDPipe) automationId: string,
    @Body() dto: UpdateAutomationDto,
  ) {
    const data = await this.automationsService.updateAutomation(user.id, automationId, dto);
    return { success: true, data };
  }

  @Delete('automations/:automationId')
  @ApiOperation({ summary: 'Delete an automation and its run history' })
  @ApiParam({ name: 'automationId', description: 'Automation UUID' })
  async deleteAutomation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('automationId', ParseUUIDPipe) automationId: string,
  ) {
    const data = await this.automationsService.deleteAutomation(user.id, automationId);
    return { success: true, data };
  }

  @Get('automations/:automationId/runs')
  @ApiOperation({ summary: 'Recent runs of an automation, newest first' })
  @ApiParam({ name: 'automationId', description: 'Automation UUID' })
  async listRuns(
    @CurrentUser() user: AuthenticatedUser,
    @Param('automationId', ParseUUIDPipe) automationId: string,
    @Query() query: AutomationRunsQueryDto,
  ) {
    const data = await this.automationsService.listRuns(user.id, automationId, query.limit);
    return { success: true, data };
  }

  @Post('automations/:automationId/run')
  @HttpCode(200)
  @ApiOperation({ summary: 'Run a scheduled automation now and return the run' })
  @ApiParam({ name: 'automationId', description: 'Automation UUID' })
  async runNow(
    @CurrentUser() user: AuthenticatedUser,
    @Param('automationId', ParseUUIDPipe) automationId: string,
  ) {
    const data = await this.automationsService.runNow(user.id, automationId);
    return { success: true, data };
  }
}
