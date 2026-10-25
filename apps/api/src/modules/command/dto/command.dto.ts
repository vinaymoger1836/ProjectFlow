import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEntityId } from '../../../common/validators/is-entity-id.decorator';

export class CommandBarDto {
  @ApiProperty({ example: 'Which projects are at risk?' })
  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  prompt: string;

  @ApiPropertyOptional({ description: 'Project the user is currently viewing (default scope)' })
  @IsOptional()
  @IsEntityId()
  projectId?: string;
}
