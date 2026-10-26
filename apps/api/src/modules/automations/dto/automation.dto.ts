import { IsString, IsOptional, IsBoolean, IsObject, IsArray, IsInt, Min, Max, MinLength, MaxLength, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * `trigger`, `conditions` and `actions` are discriminated unions, validated in depth by
 * `parseAutomationDefinition` (automation-definition.ts); the DTO only checks their shape.
 */
export class CreateAutomationDto {
  @ApiProperty({ example: 'Alert on new P0 bugs' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({ example: 'Make sure nobody misses a production bug.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiProperty({
    example: { type: 'SCHEDULE', frequency: 'WEEKLY', time: '09:00', weekdays: [1], timezone: 'Asia/Kolkata' },
    description: 'ISSUE_CREATED, or SCHEDULE with frequency DAILY | WEEKLY, "HH:MM" time, weekdays (0 = Sunday) and IANA timezone',
  })
  @IsObject()
  trigger: Record<string, unknown>;

  @ApiPropertyOptional({
    example: [{ field: 'priority', operator: 'IN', values: ['P0', 'P1'] }],
    description: 'ANDed; fields type | priority | status (IN / NOT_IN) and assignee (IN / UNASSIGNED)',
  })
  @IsOptional()
  @IsArray()
  conditions?: unknown[];

  @ApiProperty({ example: [{ type: 'NOTIFY', recipients: ['ASSIGNEE'], message: 'Please triage.' }] })
  @IsArray()
  actions: unknown[];
}

export class UpdateAutomationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, val) => val !== null)
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  trigger?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  conditions?: unknown[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  actions?: unknown[];
}

export class DraftAutomationDto {
  @ApiProperty({ example: 'Every Monday at 9am, send each assignee their open P0 and P1 bugs' })
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  prompt: string;

  @ApiPropertyOptional({ example: 'Asia/Kolkata', description: 'IANA timezone for schedules that do not name one (default UTC)' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;
}

export class AutomationRunsQueryDto {
  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
