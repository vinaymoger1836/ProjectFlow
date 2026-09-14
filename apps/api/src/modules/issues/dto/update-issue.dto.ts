import {
  IsString,
  MaxLength,
  IsOptional,
  IsIn,
  IsInt,
  Min,
  Max,
  IsDateString,
  IsArray,
  ValidateIf,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IssueType, IssuePriority } from '@projectflow/types';
import { ISSUE_TYPES, ISSUE_PRIORITIES } from './create-issue.dto';
import { IsEntityId } from '../../../common/validators/is-entity-id.decorator';

export class UpdateIssueDto {
  @ApiPropertyOptional({ example: 'Updated title' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;

  @ApiPropertyOptional({ example: 'Updated description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ['TASK', 'BUG', 'STORY', 'EPIC', 'SUBTASK'] })
  @IsOptional()
  @IsIn(ISSUE_TYPES)
  type?: IssueType;

  @ApiPropertyOptional({ example: 'IN_PROGRESS' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  status?: string;

  @ApiPropertyOptional({ enum: ['P0', 'P1', 'P2', 'P3', 'P4'] })
  @IsOptional()
  @IsIn(ISSUE_PRIORITIES)
  priority?: IssuePriority;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000', nullable: true })
  @IsOptional()
  @ValidateIf((_, val) => val !== null && val !== undefined)
  @IsEntityId()
  assigneeId?: string | null;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000', nullable: true })
  @IsOptional()
  @ValidateIf((_, val) => val !== null && val !== undefined)
  @IsEntityId()
  parentIssueId?: string | null;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000', nullable: true })
  @IsOptional()
  @ValidateIf((_, val) => val !== null && val !== undefined)
  @IsEntityId()
  sprintId?: string | null;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000', nullable: true })
  @IsOptional()
  @ValidateIf((_, val) => val !== null && val !== undefined)
  @IsEntityId()
  milestoneId?: string | null;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000', nullable: true })
  @IsOptional()
  @ValidateIf((_, val) => val !== null && val !== undefined)
  @IsEntityId()
  releaseId?: string | null;

  @ApiPropertyOptional({ example: 5, nullable: true })
  @IsOptional()
  @ValidateIf((_, val) => val !== null && val !== undefined)
  @IsInt()
  @Min(0)
  @Max(100)
  storyPoints?: number | null;

  @ApiPropertyOptional({ example: 12, nullable: true })
  @IsOptional()
  @ValidateIf((_, val) => val !== null && val !== undefined)
  @IsInt()
  @Min(0)
  @Max(1000)
  estimateHours?: number | null;

  @ApiPropertyOptional({ example: '2026-04-15T18:00:00Z', nullable: true })
  @IsOptional()
  @ValidateIf((_, val) => val !== null && val !== undefined)
  @IsDateString()
  dueDate?: string | null;

  @ApiPropertyOptional({ example: ['123e4567-e89b-12d3-a456-426614174000'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsEntityId({ each: true })
  labelIds?: string[];
}
