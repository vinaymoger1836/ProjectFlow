import {
  IsString,
  IsOptional,
  IsInt,
  IsIn,
  IsArray,
  IsDateString,
  Min,
  Max,
  MinLength,
  MaxLength,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SprintStatus } from '@projectflow/types';
import { IsEntityId } from '../../../common/validators/is-entity-id.decorator';

export const SPRINT_STATUSES: SprintStatus[] = ['PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED'];

export class CreateSprintDto {
  @ApiPropertyOptional({ example: 'Sprint 12', description: 'Defaults to "Sprint N"' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ example: 'Ship idempotent Stripe webhooks' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  goal?: string;

  @ApiPropertyOptional({ example: 30, description: 'Story-point capacity' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  capacityPoints?: number;

  @ApiPropertyOptional({ example: '2026-11-02T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-11-16T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class UpdateSprintDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, val) => val !== null)
  @IsString()
  @MaxLength(2000)
  goal?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, val) => val !== null)
  @IsInt()
  @Min(0)
  @Max(1000)
  capacityPoints?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, val) => val !== null)
  @IsDateString()
  startDate?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, val) => val !== null)
  @IsDateString()
  endDate?: string | null;
}

export class StartSprintDto {
  @ApiPropertyOptional({ description: 'Defaults to the planned start date, or now' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Defaults to the planned end date, or start + 14 days' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class CompleteSprintDto {
  @ApiProperty({ enum: ['BACKLOG', 'SPRINT'], description: 'Where unfinished issues go' })
  @IsIn(['BACKLOG', 'SPRINT'])
  rolloverTo: 'BACKLOG' | 'SPRINT';

  @ApiPropertyOptional({ description: 'Required when rolloverTo is SPRINT' })
  @ValidateIf((dto: CompleteSprintDto) => dto.rolloverTo === 'SPRINT')
  @IsEntityId()
  rolloverSprintId?: string;
}

export class AssignSprintIssuesDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsEntityId({ each: true })
  issueIds: string[];
}

export class SprintQueryDto {
  @ApiPropertyOptional({ example: 'ACTIVE,PLANNED', description: 'Comma-separated statuses' })
  @IsOptional()
  @IsString()
  status?: string;
}
