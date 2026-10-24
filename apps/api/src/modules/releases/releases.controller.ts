import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { ReleasesService } from './releases.service';
import { ReleaseReadinessService } from './release-readiness.service';
import { ReleaseNotesService } from './release-notes.service';
import { CreateReleaseDto, UpdateReleaseDto, UpdateReleaseStatusDto, ShipReleaseDto } from './dto/release.dto';

@ApiTags('Releases')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller()
export class ReleasesController {
  constructor(
    private readonly releasesService: ReleasesService,
    private readonly readinessService: ReleaseReadinessService,
    private readonly notesService: ReleaseNotesService,
  ) {}

  @Get('projects/:projectId/releases')
  @ApiOperation({ summary: 'List releases with live progress (unreleased first, then shipped history)' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  async listReleases(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    const data = await this.releasesService.listReleases(user.id, projectId);
    return { success: true, data };
  }

  @Post('projects/:projectId/releases')
  @ApiOperation({ summary: 'Create a PLANNED release' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  async createRelease(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateReleaseDto,
  ) {
    const data = await this.releasesService.createRelease(user.id, projectId, dto);
    return { success: true, data };
  }

  @Get('releases/:releaseId')
  @ApiOperation({ summary: 'Get release details and progress' })
  @ApiParam({ name: 'releaseId', description: 'Release UUID' })
  async getRelease(
    @CurrentUser() user: AuthenticatedUser,
    @Param('releaseId', ParseUUIDPipe) releaseId: string,
  ) {
    const data = await this.releasesService.getRelease(user.id, releaseId);
    return { success: true, data };
  }

  @Patch('releases/:releaseId')
  @ApiOperation({ summary: 'Update release version, name, dates, description, or notes' })
  @ApiParam({ name: 'releaseId', description: 'Release UUID' })
  async updateRelease(
    @CurrentUser() user: AuthenticatedUser,
    @Param('releaseId', ParseUUIDPipe) releaseId: string,
    @Body() dto: UpdateReleaseDto,
  ) {
    const data = await this.releasesService.updateRelease(user.id, releaseId, dto);
    return { success: true, data };
  }

  @Delete('releases/:releaseId')
  @ApiOperation({ summary: 'Delete an unreleased version (its issues are unassigned)' })
  @ApiParam({ name: 'releaseId', description: 'Release UUID' })
  async deleteRelease(
    @CurrentUser() user: AuthenticatedUser,
    @Param('releaseId', ParseUUIDPipe) releaseId: string,
  ) {
    const data = await this.releasesService.deleteRelease(user.id, releaseId);
    return { success: true, data };
  }

  @Post('releases/:releaseId/status')
  @HttpCode(200)
  @ApiOperation({ summary: 'Move between PLANNED, IN_PROGRESS and READY_FOR_RELEASE (readiness-gated)' })
  @ApiParam({ name: 'releaseId', description: 'Release UUID' })
  async updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('releaseId', ParseUUIDPipe) releaseId: string,
    @Body() dto: UpdateReleaseStatusDto,
  ) {
    const data = await this.releasesService.updateStatus(user.id, releaseId, dto);
    return { success: true, data };
  }

  @Post('releases/:releaseId/ship')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mark RELEASED and carry unfinished issues to another release or none (readiness-gated)' })
  @ApiParam({ name: 'releaseId', description: 'Release UUID' })
  async shipRelease(
    @CurrentUser() user: AuthenticatedUser,
    @Param('releaseId', ParseUUIDPipe) releaseId: string,
    @Body() dto: ShipReleaseDto,
  ) {
    const data = await this.releasesService.shipRelease(user.id, releaseId, dto);
    return { success: true, data };
  }

  @Get('releases/:releaseId/readiness')
  @ApiOperation({ summary: 'Deterministic release readiness checks and suggested fixes' })
  @ApiParam({ name: 'releaseId', description: 'Release UUID' })
  async getReadiness(
    @CurrentUser() user: AuthenticatedUser,
    @Param('releaseId', ParseUUIDPipe) releaseId: string,
  ) {
    const data = await this.readinessService.getReadiness(user.id, releaseId);
    return { success: true, data };
  }

  @Post('releases/:releaseId/readiness/assess')
  @HttpCode(200)
  @ApiOperation({ summary: 'Readiness checks plus AI narrative on target-date risk and recommended fixes' })
  @ApiParam({ name: 'releaseId', description: 'Release UUID' })
  async assessReadiness(
    @CurrentUser() user: AuthenticatedUser,
    @Param('releaseId', ParseUUIDPipe) releaseId: string,
  ) {
    const data = await this.readinessService.assessReadiness(user.id, releaseId);
    return { success: true, data };
  }

  @Post('releases/:releaseId/notes/generate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Draft categorized Markdown release notes from done issues (not saved)' })
  @ApiParam({ name: 'releaseId', description: 'Release UUID' })
  async generateNotes(
    @CurrentUser() user: AuthenticatedUser,
    @Param('releaseId', ParseUUIDPipe) releaseId: string,
  ) {
    const data = await this.notesService.generate(user.id, releaseId);
    return { success: true, data };
  }
}
