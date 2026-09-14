import { IsString, IsNotEmpty, IsUUID, IsIn, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { CreateIssueDto } from '../../issues/dto/create-issue.dto';

export class ExecuteAiToolDto {
  @ApiProperty({ example: 'create_issue', enum: ['create_issue'] })
  @IsString()
  @IsIn(['create_issue'])
  tool: 'create_issue';

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsString()
  @IsNotEmpty()
  projectId: string;

  @ApiProperty({ type: CreateIssueDto })
  @ValidateNested()
  @Type(() => CreateIssueDto)
  payload: CreateIssueDto;
}
