import {
  IsString,
  IsOptional,
  IsDateString,
  IsIn,
  IsBoolean,
  Matches,
  MinLength,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReleaseStatus } from '@projectflow/types';
import { IsEntityId } from '../../../common/validators/is-entity-id.decorator';

/** e.g. v2.4.0, 2026.11, 1.0.0-beta.1 */
const VERSION_REGEX = /^[A-Za-z0-9][A-Za-z0-9._+-]*$/;
const VERSION_MESSAGE = 'version may contain letters, digits, ".", "_", "+" and "-" (e.g. v2.4.0)';

export const RELEASE_NOTES_MAX_LENGTH = 50_000;

/** Statuses reachable through a plain transition; RELEASED goes through the ship flow. */
export const TRANSITION_STATUSES: Exclude<ReleaseStatus, 'RELEASED'>[] = ['PLANNED', 'IN_PROGRESS', 'READY_FOR_RELEASE'];

export class CreateReleaseDto {
  @ApiProperty({ example: 'v2.4.0' })
  @IsString()
  @MaxLength(50)
  @Matches(VERSION_REGEX, { message: VERSION_MESSAGE })
  version: string;

  @ApiPropertyOptional({ example: 'Multi-currency checkout', description: 'Defaults to the version' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({ example: '2026-12-01T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  targetDate?: string;
}

export class UpdateReleaseDto {
  @ApiPropertyOptional({ example: 'v2.4.1' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(VERSION_REGEX, { message: VERSION_MESSAGE })
  version?: string;

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
  @MaxLength(5000)
  description?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, val) => val !== null)
  @IsDateString()
  targetDate?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Markdown release notes' })
  @IsOptional()
  @ValidateIf((_, val) => val !== null)
  @IsString()
  @MaxLength(RELEASE_NOTES_MAX_LENGTH)
  releaseNotes?: string | null;
}

export class UpdateReleaseStatusDto {
  @ApiProperty({ enum: TRANSITION_STATUSES })
  @IsIn(TRANSITION_STATUSES)
  status: Exclude<ReleaseStatus, 'RELEASED'>;

  @ApiPropertyOptional({ description: 'Proceed although critical readiness checks fail (logged)' })
  @IsOptional()
  @IsBoolean()
  acknowledgeRisks?: boolean;
}

export class ShipReleaseDto {
  @ApiProperty({ enum: ['RELEASE', 'NONE'], description: 'Where unfinished issues go' })
  @IsIn(['RELEASE', 'NONE'])
  rolloverTo: 'RELEASE' | 'NONE';

  @ApiPropertyOptional({ description: 'Required when rolloverTo is RELEASE' })
  @ValidateIf((dto: ShipReleaseDto) => dto.rolloverTo === 'RELEASE')
  @IsEntityId()
  rolloverReleaseId?: string;

  @ApiPropertyOptional({ description: 'Proceed although critical readiness checks fail (logged)' })
  @IsOptional()
  @IsBoolean()
  acknowledgeRisks?: boolean;
}
