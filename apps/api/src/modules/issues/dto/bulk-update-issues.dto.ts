import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateIf,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BulkChangeSource, IssuePriority, StandardIssueStatus } from '@projectflow/types';
import { ISSUE_PRIORITIES } from './create-issue.dto';
import { IsEntityId } from '../../../common/validators/is-entity-id.decorator';

export const STANDARD_ISSUE_STATUSES: StandardIssueStatus[] = [
  'BACKLOG',
  'TODO',
  'IN_PROGRESS',
  'IN_REVIEW',
  'BLOCKED',
  'DONE',
  'CANCELLED',
];

export const BULK_CHANGE_SOURCES: BulkChangeSource[] = ['MANUAL', 'AI_READINESS'];

export const MAX_BULK_OPERATIONS = 100;

export class BulkIssueChangesDto {
  @ApiPropertyOptional({ enum: STANDARD_ISSUE_STATUSES })
  @IsOptional()
  @IsIn(STANDARD_ISSUE_STATUSES)
  status?: StandardIssueStatus;

  @ApiPropertyOptional({ enum: ISSUE_PRIORITIES })
  @IsOptional()
  @IsIn(ISSUE_PRIORITIES)
  priority?: IssuePriority;

  @ApiPropertyOptional({ nullable: true, description: 'null unassigns' })
  @IsOptional()
  @ValidateIf((_, val) => val !== null)
  @IsEntityId()
  assigneeId?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'null moves to the backlog' })
  @IsOptional()
  @ValidateIf((_, val) => val !== null)
  @IsEntityId()
  sprintId?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'null removes the milestone' })
  @IsOptional()
  @ValidateIf((_, val) => val !== null)
  @IsEntityId()
  milestoneId?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'null removes the release' })
  @IsOptional()
  @ValidateIf((_, val) => val !== null)
  @IsEntityId()
  releaseId?: string | null;
}

export class BulkIssueOperationDto {
  @ApiProperty()
  @IsEntityId()
  issueId: string;

  @ApiProperty({ type: BulkIssueChangesDto })
  @IsObject()
  @ValidateNested()
  @Type(() => BulkIssueChangesDto)
  changes: BulkIssueChangesDto;
}

export class BulkUpdateIssuesDto {
  @ApiProperty({ type: [BulkIssueOperationDto], maxItems: MAX_BULK_OPERATIONS })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_BULK_OPERATIONS)
  @ValidateNested({ each: true })
  @Type(() => BulkIssueOperationDto)
  operations: BulkIssueOperationDto[];

  @ApiPropertyOptional({ description: 'When true, returns the diff without writing anything', default: false })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @ApiPropertyOptional({ enum: BULK_CHANGE_SOURCES, default: 'MANUAL' })
  @IsOptional()
  @IsIn(BULK_CHANGE_SOURCES)
  source?: BulkChangeSource;
}
