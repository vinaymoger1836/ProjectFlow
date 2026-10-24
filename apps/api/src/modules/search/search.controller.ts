import { Controller, Get, Post, Body, Param, Query, UseGuards, ParseUUIDPipe, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { SimilarIssuesDto } from './dto/similar-issues.dto';

@ApiTags('Search')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('projects/:projectId/search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Hybrid keyword + semantic issue search across titles, descriptions, and comments' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  async search(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: SearchQueryDto,
  ) {
    const result = await this.searchService.searchIssues(user.id, projectId, query.q, query.limit);
    return {
      success: true,
      data: result,
    };
  }

  @Post('similar')
  @HttpCode(200)
  @ApiOperation({ summary: 'Find existing issues semantically similar to a draft (duplicate detection)' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  async similar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: SimilarIssuesDto,
  ) {
    const result = await this.searchService.findSimilarIssues(user.id, projectId, dto);
    return {
      success: true,
      data: result,
    };
  }
}
