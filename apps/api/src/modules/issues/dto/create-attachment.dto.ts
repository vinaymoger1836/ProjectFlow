import { IsString, IsNotEmpty, IsNumber, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAttachmentDto {
  @ApiProperty({ example: 'architecture-diagram.png' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName: string;

  @ApiProperty({ example: 204850 })
  @IsNumber()
  fileSize: number;

  @ApiProperty({ example: 'image/png' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  mimeType: string;

  @ApiProperty({ example: 'issues/attachments/uuid-file.png' })
  @IsString()
  @IsNotEmpty()
  s3Key: string;

  @ApiProperty({ example: 'https://storage.supabase.co/v1/object/public/attachments/file.png' })
  @IsString()
  @IsNotEmpty()
  s3Url: string;
}
