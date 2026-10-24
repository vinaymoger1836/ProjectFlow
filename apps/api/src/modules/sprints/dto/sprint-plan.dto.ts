import {
  IsString,
  IsOptional,
  IsInt,
  IsArray,
  IsDateString,
  Min,
  Max,
  MinLength,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEntityId } from '../../../common/validators/is-entity-id.decorator';

export class PlanSprintDto {
  @ApiProperty({ example: '11111111-1111-1111-1111-111111111111' })
  @IsEntityId()
  projectId: string;

  @ApiPropertyOptional({ description: 'Existing PLANNED sprint to fill; omit to propose a new sprint' })
  @IsOptional()
  @IsEntityId()
  sprintId?: string;

  @ApiPropertyOptional({ example: 30, description: 'Overrides sprint capacity and velocity' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  capacityPoints?: number;

  @ApiPropertyOptional({ example: 'Prepare next sprint, focus on payment reliability' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  instructions?: string;
}

export class ApplySprintPlanDto {
  @ApiProperty()
  @IsEntityId()
  projectId: string;

  @ApiPropertyOptional({ description: 'PLANNED sprint to update; omit to create a new sprint' })
  @IsOptional()
  @IsEntityId()
  sprintId?: string;

  @ApiProperty({ example: 'Sprint 3' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  goal?: string;

  @ApiProperty({ example: 30 })
  @IsInt()
  @Min(0)
  @Max(1000)
  capacityPoints: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(100)
  @IsEntityId({ each: true })
  issueIds: string[];
}
