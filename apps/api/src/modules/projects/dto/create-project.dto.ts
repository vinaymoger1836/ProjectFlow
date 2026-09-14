import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProjectDto {
  @ApiProperty({ example: 'Payment Integration Platform', description: 'Name of the project' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    example: 'PAY',
    description: 'Unique project key/prefix (2 to 10 uppercase letters or numbers). Auto-suggested if omitted.',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(10)
  @Matches(/^[A-Z0-9]+$/, {
    message: 'Project key must contain only uppercase letters and numbers (e.g. PAY, MOB, CORE1)',
  })
  key?: string;

  @ApiPropertyOptional({ example: 'Unified global checkout and gateway migration' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6', description: 'Associated Team UUID' })
  @IsOptional()
  @IsUUID()
  teamId?: string;
}
