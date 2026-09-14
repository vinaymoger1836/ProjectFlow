import {
  IsOptional,
  IsString,
  IsUUID,
  IsIn,
  IsInt,
  Min,
  Max,
  IsBoolean,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IssueType, IssuePriority } from '@projectflow/types';
import { ISSUE_TYPES, ISSUE_PRIORITIES } from './create-issue.dto';

export class IssueQueryDto {
  @ApiPropertyOptional({ description: 'Filter by issue type', enum: ISSUE_TYPES })
  @IsOptional()
  @IsIn(ISSUE_TYPES)
  type?: IssueType;

  @ApiPropertyOptional({ description: 'Filter by issue status (e.g. TODO, IN_PROGRESS, DONE)' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by priority', enum: ISSUE_PRIORITIES })
  @IsOptional()
  @IsIn(ISSUE_PRIORITIES)
  priority?: IssuePriority;

  @ApiPropertyOptional({ description: 'Filter by assigned user UUID' })
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @ApiPropertyOptional({ description: 'Filter by reporter user UUID' })
  @IsOptional()
  @IsUUID()
  reporterId?: string;

  @ApiPropertyOptional({ description: 'Filter by sprint UUID' })
  @IsOptional()
  @IsUUID()
  sprintId?: string;

  @ApiPropertyOptional({ description: 'Search title, description, or issue key' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Include soft-deleted/archived issues', default: false })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeArchived?: boolean;

  @ApiPropertyOptional({ description: 'Page number (1-indexed)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Page size limit (max 100)', default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 25;

  @ApiPropertyOptional({
    description: 'Field to sort by',
    enum: ['createdAt', 'updatedAt', 'priority', 'status', 'keyNumber'],
    default: 'keyNumber',
  })
  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'priority', 'status', 'keyNumber'])
  sortBy?: 'createdAt' | 'updatedAt' | 'priority' | 'status' | 'keyNumber' = 'keyNumber';

  @ApiPropertyOptional({ description: 'Sort direction', enum: ['asc', 'desc'], default: 'asc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'asc';
}
