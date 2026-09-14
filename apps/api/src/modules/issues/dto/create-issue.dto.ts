import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsIn,
  IsInt,
  Min,
  Max,
  IsDateString,
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IssueType, IssuePriority } from '@projectflow/types';
import { IsEntityId } from '../../../common/validators/is-entity-id.decorator';

export const ISSUE_TYPES: IssueType[] = ['TASK', 'BUG', 'STORY', 'EPIC', 'SUBTASK'];
export const ISSUE_PRIORITIES: IssuePriority[] = ['P0', 'P1', 'P2', 'P3', 'P4'];

export class CreateIssueDto {
  @ApiProperty({ example: 'Implement Stripe webhook verification and idempotency' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  title: string;

  @ApiPropertyOptional({ example: 'Ensure all incoming webhook events are verified with the Stripe endpoint signing secret.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'TASK', enum: ['TASK', 'BUG', 'STORY', 'EPIC', 'SUBTASK'] })
  @IsIn(ISSUE_TYPES)
  type: IssueType;

  @ApiPropertyOptional({ example: 'TODO', default: 'TODO' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  status?: string;

  @ApiProperty({ example: 'P1', enum: ['P0', 'P1', 'P2', 'P3', 'P4'] })
  @IsIn(ISSUE_PRIORITIES)
  priority: IssuePriority;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000', description: 'Assigned User UUID' })
  @IsOptional()
  @IsEntityId()
  assigneeId?: string;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000', description: 'Parent Issue UUID for subtasks/epics' })
  @IsOptional()
  @IsEntityId()
  parentIssueId?: string;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000', description: 'Sprint UUID' })
  @IsOptional()
  @IsEntityId()
  sprintId?: string;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000', description: 'Milestone UUID' })
  @IsOptional()
  @IsEntityId()
  milestoneId?: string;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000', description: 'Release UUID' })
  @IsOptional()
  @IsEntityId()
  releaseId?: string;

  @ApiPropertyOptional({ example: 3, description: 'Story point estimate (Fibonacci/integer)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  storyPoints?: number;

  @ApiPropertyOptional({ example: 8, description: 'Estimated effort in hours' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  estimateHours?: number;

  @ApiPropertyOptional({ example: '2026-03-31T23:59:59Z', description: 'Due date in ISO 8601 format' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ example: ['123e4567-e89b-12d3-a456-426614174000'], type: [String], description: 'Label UUIDs' })
  @IsOptional()
  @IsArray()
  @IsEntityId({ each: true })
  labelIds?: string[];
}
