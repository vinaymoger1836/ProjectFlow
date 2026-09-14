import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { OrgMemberGuard } from '../auth/guards/org-member.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddProjectMemberDto } from './dto/add-project-member.dto';

@ApiTags('Projects')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller()
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get('organizations/:orgId/projects')
  @UseGuards(OrgMemberGuard)
  @ApiOperation({ summary: 'List all projects within an organization (strict tenant isolation)' })
  @ApiParam({ name: 'orgId', description: 'Organization UUID' })
  async listProjectsByOrg(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orgId', ParseUUIDPipe) orgId: string,
  ) {
    const projectList = await this.projectsService.listProjectsByOrganization(user.id, orgId);
    return {
      success: true,
      data: projectList,
    };
  }

  @Post('organizations/:orgId/projects')
  @UseGuards(OrgMemberGuard)
  @ApiOperation({ summary: 'Create a new project in an organization' })
  @ApiParam({ name: 'orgId', description: 'Organization UUID' })
  async createProject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body() dto: CreateProjectDto,
  ) {
    const project = await this.projectsService.createProject(user.id, orgId, dto);
    return {
      success: true,
      data: project,
    };
  }

  @Get('projects/:projectId')
  @ApiOperation({ summary: 'Get project details, settings, and statistics' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  async getProject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    const project = await this.projectsService.getProjectById(user.id, projectId);
    return {
      success: true,
      data: project,
    };
  }

  @Patch('projects/:projectId')
  @ApiOperation({ summary: 'Update project settings, health, or description' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  async updateProject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: UpdateProjectDto,
  ) {
    const project = await this.projectsService.updateProject(user.id, projectId, dto);
    return {
      success: true,
      data: project,
    };
  }

  @Get('projects/:projectId/members')
  @ApiOperation({ summary: 'List all members assigned to a project' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  async listProjectMembers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    const members = await this.projectsService.listProjectMembers(user.id, projectId);
    return {
      success: true,
      data: members,
    };
  }

  @Post('projects/:projectId/members')
  @ApiOperation({ summary: 'Add a user as a member to a project' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  async addProjectMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: AddProjectMemberDto,
  ) {
    const member = await this.projectsService.addProjectMember(user.id, projectId, dto);
    return {
      success: true,
      data: member,
    };
  }
}
