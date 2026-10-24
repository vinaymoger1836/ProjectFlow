import { and, eq, ne, inArray, sql } from 'drizzle-orm';
import { Database, issues } from '@projectflow/database';
import { WorkProgress } from '@projectflow/types';

export const EMPTY_WORK_PROGRESS: WorkProgress = {
  issueCount: 0,
  doneIssueCount: 0,
  totalPoints: 0,
  donePoints: 0,
  unestimatedCount: 0,
  blockedCount: 0,
  openCriticalBugCount: 0,
  completionPercentage: 0,
};

const GROUP_COLUMNS = {
  milestoneId: issues.milestoneId,
  releaseId: issues.releaseId,
} as const;

/**
 * Live tallies per milestone or release. Cancelled issues are out of scope, and subtasks
 * are excluded because their effort is carried by the parent issue.
 */
export async function loadWorkProgress(
  db: Pick<Database, 'select'>,
  groupBy: keyof typeof GROUP_COLUMNS,
  ids: string[],
): Promise<Map<string, WorkProgress>> {
  const result = new Map<string, WorkProgress>();
  if (ids.length === 0) return result;

  const column = GROUP_COLUMNS[groupBy];
  const rows = await db
    .select({
      groupId: column,
      issueCount: sql<number>`count(*)::int`,
      doneIssueCount: sql<number>`(count(*) filter (where ${issues.status} = 'DONE'))::int`,
      totalPoints: sql<number>`coalesce(sum(${issues.storyPoints}), 0)::int`,
      donePoints: sql<number>`coalesce(sum(${issues.storyPoints}) filter (where ${issues.status} = 'DONE'), 0)::int`,
      unestimatedCount: sql<number>`(count(*) filter (where ${issues.storyPoints} is null and ${issues.status} <> 'DONE'))::int`,
      blockedCount: sql<number>`(count(*) filter (where ${issues.status} = 'BLOCKED'))::int`,
      openCriticalBugCount: sql<number>`(count(*) filter (where ${issues.type} = 'BUG' and ${issues.priority} in ('P0', 'P1') and ${issues.status} <> 'DONE'))::int`,
    })
    .from(issues)
    .where(
      and(
        inArray(column, ids),
        eq(issues.isArchived, false),
        ne(issues.type, 'SUBTASK'),
        ne(issues.status, 'CANCELLED'),
      ),
    )
    .groupBy(column);

  for (const row of rows) {
    if (!row.groupId) continue;
    result.set(row.groupId, {
      issueCount: row.issueCount,
      doneIssueCount: row.doneIssueCount,
      totalPoints: row.totalPoints,
      donePoints: row.donePoints,
      unestimatedCount: row.unestimatedCount,
      blockedCount: row.blockedCount,
      openCriticalBugCount: row.openCriticalBugCount,
      completionPercentage: row.issueCount > 0 ? Math.round((row.doneIssueCount / row.issueCount) * 100) : 0,
    });
  }
  return result;
}
