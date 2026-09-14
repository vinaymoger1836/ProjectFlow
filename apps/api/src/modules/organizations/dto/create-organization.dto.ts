import { IsString, IsNotEmpty, MinLength, MaxLength, Matches, IsOptional, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOrganizationDto {
  @ApiProperty({ example: 'Acme Technologies', description: 'Display name of the organization' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    example: 'acme-tech',
    description: 'Unique URL slug for the organization (lowercase letters, numbers, and hyphens)',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug must contain only lowercase alphanumeric characters and hyphens',
  })
  slug?: string;

  @ApiPropertyOptional({ example: 'https://example.com/logo.png', description: 'Logo image URL' })
  @IsOptional()
  @IsUrl()
  logoUrl?: string;
}
