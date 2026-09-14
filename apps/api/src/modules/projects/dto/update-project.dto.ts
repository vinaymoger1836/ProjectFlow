import { IsString, IsOptional, MinLength, MaxLength, IsIn, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProjectDto {
  @ApiPropertyOptional({ example: 'Payment Platform v2' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 'Updated project description' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ example: 'AT_RISK', enum: ['HEALTHY', 'AT_RISK', 'CRITICAL'] })
  @IsOptional()
  @IsIn(['HEALTHY', 'AT_RISK', 'CRITICAL'])
  healthStatus?: string;

  @ApiPropertyOptional({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6', description: 'Lead user UUID' })
  @IsOptional()
  @IsUUID()
  leadId?: string;

  @ApiPropertyOptional({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6', description: 'Team UUID' })
  @IsOptional()
  @IsUUID()
  teamId?: string;
}
