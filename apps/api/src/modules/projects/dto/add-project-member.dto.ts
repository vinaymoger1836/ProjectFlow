import { IsUUID, IsNotEmpty, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddProjectMemberDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6', description: 'User UUID to add' })
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    example: 'CONTRIBUTOR',
    enum: ['LEAD', 'MAINTAINER', 'CONTRIBUTOR', 'VIEWER'],
    description: 'Project role',
  })
  @IsIn(['LEAD', 'MAINTAINER', 'CONTRIBUTOR', 'VIEWER'])
  role: string;
}
