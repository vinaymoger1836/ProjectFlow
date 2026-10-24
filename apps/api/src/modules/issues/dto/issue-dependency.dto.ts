import { IsIn, IsString, Matches, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IssueLinkKind } from '@projectflow/types';

export const ISSUE_LINK_KINDS: IssueLinkKind[] = ['BLOCKS', 'BLOCKED_BY', 'RELATES_TO', 'DUPLICATES', 'DUPLICATED_BY'];

/** Accepts either an issue UUID or a human key such as PAY-12. */
const ISSUE_REFERENCE_REGEX = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[A-Z0-9]+-\d+)$/i;

export class CreateIssueDependencyDto {
  @ApiProperty({ enum: ISSUE_LINK_KINDS, description: 'Relation read from this issue, e.g. BLOCKED_BY = "this issue is blocked by target"' })
  @IsIn(ISSUE_LINK_KINDS)
  kind: IssueLinkKind;

  @ApiProperty({ example: 'PAY-6', description: 'Issue key or UUID in the same project' })
  @IsString()
  @MaxLength(60)
  @Matches(ISSUE_REFERENCE_REGEX, { message: 'targetIssue must be an issue key (e.g. PAY-6) or UUID' })
  targetIssue: string;
}
