import { IsString, IsOptional, IsInt, Min, Max, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEntityId } from '../../../common/validators/is-entity-id.decorator';

export class SimilarIssuesDto {
  @ApiProperty({ example: 'Stripe webhook retries create duplicate charges' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  title: string;

  @ApiPropertyOptional({ example: 'When the webhook times out, Stripe retries and we charge twice.' })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string;

  @ApiPropertyOptional({ description: 'Issue to ignore (e.g. when checking an issue being edited)' })
  @IsOptional()
  @IsEntityId()
  excludeIssueId?: string;

  @ApiPropertyOptional({ example: 3, minimum: 1, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  limit?: number;
}
