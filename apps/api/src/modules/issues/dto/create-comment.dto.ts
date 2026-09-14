import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCommentDto {
  @ApiProperty({ example: 'Investigated the issue; the webhook payload format changed with API version 2024-12.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  content: string;
}
