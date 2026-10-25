import { Controller, Post, Body, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { CommandService } from './command.service';
import { CommandBarDto } from './dto/command.dto';

@ApiTags('Command Bar')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('command')
export class CommandController {
  constructor(private readonly commandService: CommandService) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'Global AI command bar: health, risk, cross-project issue queries, or Copilot' })
  async run(@CurrentUser() user: AuthenticatedUser, @Body() dto: CommandBarDto) {
    const data = await this.commandService.run(user.id, dto);
    return { success: true, data };
  }
}
