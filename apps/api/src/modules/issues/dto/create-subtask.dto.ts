import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsIn,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IssuePriority } from '@projectflow/types';
import { IsEntityId } from '../../../common/validators/is-entity-id.decorator';

export class CreateSubtaskDto {
  @ApiProperty({ example: 'Add unit tests for Stripe webhook signature verification' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  title: string;

  @ApiPropertyOptional({ example: 'P2', enum: ['P0', 'P1', 'P2', 'P3', 'P4'] })
  @IsOptional()
  @IsIn(['P0', 'P1', 'P2', 'P3', 'P4'])
  priority?: IssuePriority;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  estimateHours?: number;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsOptional()
  @IsEntityId()
  assigneeId?: string;
}
