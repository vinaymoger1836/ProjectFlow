import { IsString, IsNotEmpty, IsUUID, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ParseIssueDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Target Project UUID',
  })
  @IsString()
  @IsNotEmpty()
  projectId: string;

  @ApiProperty({
    example: 'We found a critical bug in checkout: concurrent orders trigger double charges on Stripe. Need urgent fix today, estimate 4 hours.',
    description: 'Natural language text describing the issue, task, bug, or feature',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(2000)
  prompt: string;
}
