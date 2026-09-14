import {
  Controller,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { AiService } from './ai.service';
import { ParseIssueDto } from './dto/parse-issue.dto';
import { ExecuteAiToolDto } from './dto/execute-tool.dto';

@ApiTags('AI')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('parse-issue')
  @ApiOperation({
    summary: 'Extract structured issue draft from natural language prompt',
    description: 'Uses Groq / Google Gemini 2.0 Flash / heuristic to generate structured issue attributes.',
  })
  async parseIssue(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ParseIssueDto,
  ) {
    const draft = await this.aiService.parseIssueFromText(user.id, dto);
    return {
      success: true,
      data: draft,
    };
  }

  @Post('execute-tool')
  @ApiOperation({
    summary: 'Execute typed AI mutation tool with schema validation and audit trail',
  })
  async executeTool(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ExecuteAiToolDto,
  ) {
    const result = await this.aiService.executeTool(user.id, dto);
    return {
      success: true,
      data: result,
    };
  }
}
