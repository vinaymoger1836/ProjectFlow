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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { IssuesService } from './issues.service';
import { CreateIssueDto } from './dto/create-issue.dto';
import { UpdateIssueDto } from './dto/update-issue.dto';
import { IssueQueryDto } from './dto/issue-query.dto';
import { CreateCommentDto } from './dto/create-comment.dto';

@ApiTags('Issues')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller()
export class IssuesController {
  constructor(private readonly issuesService: IssuesService) {}

  @Get('projects/:projectId/issues')
  @ApiOperation({ summary: 'List project issues with sorting, filtering, and pagination' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  async listIssues(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: IssueQueryDto,
  ) {
    const result = await this.issuesService.listIssues(user.id, projectId, query);
    return {
      success: true,
      data: result,
    };
  }

  @Post('projects/:projectId/issues')
  @ApiOperation({ summary: 'Create a new issue with atomic sequential project key (e.g. PAY-1)' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  async createIssue(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateIssueDto,
  ) {
    const issue = await this.issuesService.createIssue(user.id, projectId, dto);
    return {
      success: true,
      data: issue,
    };
  }

  @Get('issues/:identifier')
  @ApiOperation({ summary: 'Get issue details by UUID or human key (e.g. PAY-10)' })
  @ApiParam({ name: 'identifier', description: 'Issue UUID or formatted Key (e.g. PAY-10)' })
  async getIssue(
    @CurrentUser() user: AuthenticatedUser,
    @Param('identifier') identifier: string,
  ) {
    const issue = await this.issuesService.getIssue(user.id, identifier);
    return {
      success: true,
      data: issue,
    };
  }

  @Patch('issues/:issueId')
  @ApiOperation({ summary: 'Update issue fields, status, assignee, or labels' })
  @ApiParam({ name: 'issueId', description: 'Issue UUID' })
  async updateIssue(
    @CurrentUser() user: AuthenticatedUser,
    @Param('issueId', ParseUUIDPipe) issueId: string,
    @Body() dto: UpdateIssueDto,
  ) {
    const issue = await this.issuesService.updateIssue(user.id, issueId, dto);
    return {
      success: true,
      data: issue,
    };
  }

  @Delete('issues/:issueId')
  @ApiOperation({ summary: 'Soft-delete / archive an issue' })
  @ApiParam({ name: 'issueId', description: 'Issue UUID' })
  async deleteIssue(
    @CurrentUser() user: AuthenticatedUser,
    @Param('issueId', ParseUUIDPipe) issueId: string,
  ) {
    const result = await this.issuesService.deleteIssue(user.id, issueId);
    return {
      success: true,
      data: result,
    };
  }

  @Get('issues/:issueId/comments')
  @ApiOperation({ summary: 'List all comments on an issue' })
  @ApiParam({ name: 'issueId', description: 'Issue UUID' })
  async listComments(
    @CurrentUser() user: AuthenticatedUser,
    @Param('issueId', ParseUUIDPipe) issueId: string,
  ) {
    const comments = await this.issuesService.listComments(user.id, issueId);
    return {
      success: true,
      data: comments,
    };
  }

  @Post('issues/:issueId/comments')
  @ApiOperation({ summary: 'Add a comment to an issue' })
  @ApiParam({ name: 'issueId', description: 'Issue UUID' })
  async addComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('issueId', ParseUUIDPipe) issueId: string,
    @Body() dto: CreateCommentDto,
  ) {
    const comment = await this.issuesService.addComment(user.id, issueId, dto);
    return {
      success: true,
      data: comment,
    };
  }

  @Get('issues/:issueId/subtasks')
  @ApiOperation({ summary: 'List all child subtasks for an issue' })
  @ApiParam({ name: 'issueId', description: 'Parent Issue UUID' })
  async listSubtasks(
    @CurrentUser() user: AuthenticatedUser,
    @Param('issueId', ParseUUIDPipe) issueId: string,
  ) {
    const subtasks = await this.issuesService.listSubtasks(user.id, issueId);
    return {
      success: true,
      data: subtasks,
    };
  }

  @Post('issues/:issueId/subtasks')
  @ApiOperation({ summary: 'Create a child subtask under a parent issue' })
  @ApiParam({ name: 'issueId', description: 'Parent Issue UUID' })
  async createSubtask(
    @CurrentUser() user: AuthenticatedUser,
    @Param('issueId', ParseUUIDPipe) issueId: string,
    @Body() dto: any,
  ) {
    const subtask = await this.issuesService.createSubtask(user.id, issueId, dto);
    return {
      success: true,
      data: subtask,
    };
  }

  @Get('issues/:issueId/activity')
  @ApiOperation({ summary: 'List activity audit trail for an issue' })
  @ApiParam({ name: 'issueId', description: 'Issue UUID' })
  async listActivities(
    @CurrentUser() user: AuthenticatedUser,
    @Param('issueId', ParseUUIDPipe) issueId: string,
  ) {
    const activities = await this.issuesService.listActivities(user.id, issueId);
    return {
      success: true,
      data: activities,
    };
  }

  @Get('issues/:issueId/attachments')
  @ApiOperation({ summary: 'List all attachments uploaded to an issue' })
  @ApiParam({ name: 'issueId', description: 'Issue UUID' })
  async listAttachments(
    @CurrentUser() user: AuthenticatedUser,
    @Param('issueId', ParseUUIDPipe) issueId: string,
  ) {
    const attachments = await this.issuesService.listAttachments(user.id, issueId);
    return {
      success: true,
      data: attachments,
    };
  }

  @Post('issues/:issueId/attachments')
  @ApiOperation({ summary: 'Upload / attach a file reference to an issue' })
  @ApiParam({ name: 'issueId', description: 'Issue UUID' })
  async addAttachment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('issueId', ParseUUIDPipe) issueId: string,
    @Body() dto: any,
  ) {
    const attachment = await this.issuesService.addAttachment(user.id, issueId, dto);
    return {
      success: true,
      data: attachment,
    };
  }
}

