import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { SprintsService } from './sprints.service';
import {
  CreateSprintDto,
  UpdateSprintDto,
  StartSprintDto,
  CompleteSprintDto,
  AssignSprintIssuesDto,
  SprintQueryDto,
} from './dto/sprint.dto';

@ApiTags('Sprints')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller()
export class SprintsController {
  constructor(private readonly sprintsService: SprintsService) {}

  @Get('projects/:projectId/sprints')
  @ApiOperation({ summary: 'List project sprints with live progress (active first, then planned, completed)' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  async listSprints(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: SprintQueryDto,
  ) {
    const data = await this.sprintsService.listSprints(user.id, projectId, query.status);
    return { success: true, data };
  }

  @Post('projects/:projectId/sprints')
  @ApiOperation({ summary: 'Create a PLANNED sprint' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  async createSprint(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateSprintDto,
  ) {
    const data = await this.sprintsService.createSprint(user.id, projectId, dto);
    return { success: true, data };
  }

  @Get('projects/:projectId/sprints/velocity')
  @ApiOperation({ summary: 'Velocity of the last 3 completed sprints' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  async getVelocity(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    const data = await this.sprintsService.getVelocity(user.id, projectId);
    return { success: true, data };
  }

  @Get('sprints/:sprintId')
  @ApiOperation({ summary: 'Get sprint details and progress' })
  @ApiParam({ name: 'sprintId', description: 'Sprint UUID' })
  async getSprint(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sprintId', ParseUUIDPipe) sprintId: string,
  ) {
    const data = await this.sprintsService.getSprint(user.id, sprintId);
    return { success: true, data };
  }

  @Patch('sprints/:sprintId')
  @ApiOperation({ summary: 'Update sprint name, goal, dates, or capacity' })
  @ApiParam({ name: 'sprintId', description: 'Sprint UUID' })
  async updateSprint(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sprintId', ParseUUIDPipe) sprintId: string,
    @Body() dto: UpdateSprintDto,
  ) {
    const data = await this.sprintsService.updateSprint(user.id, sprintId, dto);
    return { success: true, data };
  }

  @Delete('sprints/:sprintId')
  @ApiOperation({ summary: 'Delete a PLANNED sprint (its issues return to the backlog)' })
  @ApiParam({ name: 'sprintId', description: 'Sprint UUID' })
  async deleteSprint(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sprintId', ParseUUIDPipe) sprintId: string,
  ) {
    const data = await this.sprintsService.deleteSprint(user.id, sprintId);
    return { success: true, data };
  }

  @Post('sprints/:sprintId/start')
  @HttpCode(200)
  @ApiOperation({ summary: 'Start a PLANNED sprint and snapshot its committed scope' })
  @ApiParam({ name: 'sprintId', description: 'Sprint UUID' })
  async startSprint(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sprintId', ParseUUIDPipe) sprintId: string,
    @Body() dto: StartSprintDto,
  ) {
    const data = await this.sprintsService.startSprint(user.id, sprintId, dto);
    return { success: true, data };
  }

  @Post('sprints/:sprintId/complete')
  @HttpCode(200)
  @ApiOperation({ summary: 'Complete an ACTIVE sprint and roll unfinished issues to the backlog or another sprint' })
  @ApiParam({ name: 'sprintId', description: 'Sprint UUID' })
  async completeSprint(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sprintId', ParseUUIDPipe) sprintId: string,
    @Body() dto: CompleteSprintDto,
  ) {
    const data = await this.sprintsService.completeSprint(user.id, sprintId, dto);
    return { success: true, data };
  }

  @Post('sprints/:sprintId/issues')
  @HttpCode(200)
  @ApiOperation({ summary: 'Move issues into a sprint' })
  @ApiParam({ name: 'sprintId', description: 'Sprint UUID' })
  async assignIssues(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sprintId', ParseUUIDPipe) sprintId: string,
    @Body() dto: AssignSprintIssuesDto,
  ) {
    const data = await this.sprintsService.assignIssues(user.id, sprintId, dto.issueIds);
    return { success: true, data };
  }
}
