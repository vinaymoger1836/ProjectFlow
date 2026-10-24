import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { Database, sprints, milestones, releases, users, userRoles } from '@projectflow/database';
import { DRIZZLE_DB } from '../database/database.module';

export type SprintRecord = typeof sprints.$inferSelect;
export type MilestoneRecord = typeof milestones.$inferSelect;
export type ReleaseRecord = typeof releases.$inferSelect;

/**
 * Validates the containers an issue may be moved into. Shared by single-issue edits,
 * bulk changes, and release carry-over so every path enforces the same rules.
 */
@Injectable()
export class AssignmentTargetsService {
  constructor(@Inject(DRIZZLE_DB) private readonly db: Database) {}

  /** An issue may only join a PLANNED or ACTIVE sprint of its own project. */
  async assertSprint(projectId: string, sprintId: string): Promise<SprintRecord> {
    const [sprint] = await this.db
      .select()
      .from(sprints)
      .where(and(eq(sprints.id, sprintId), eq(sprints.projectId, projectId)))
      .limit(1);

    if (!sprint) {
      throw new BadRequestException(`Sprint '${sprintId}' does not exist in this project.`);
    }
    if (sprint.status !== 'PLANNED' && sprint.status !== 'ACTIVE') {
      throw new BadRequestException(`${sprint.name} is ${sprint.status.toLowerCase()} and cannot receive issues.`);
    }
    return sprint;
  }

  async assertMilestone(projectId: string, milestoneId: string): Promise<MilestoneRecord> {
    const [milestone] = await this.db
      .select()
      .from(milestones)
      .where(and(eq(milestones.id, milestoneId), eq(milestones.projectId, projectId)))
      .limit(1);

    if (!milestone) {
      throw new BadRequestException(`Milestone '${milestoneId}' does not exist in this project.`);
    }
    return milestone;
  }

  /** Shipped releases are a historical record and cannot receive new issues. */
  async assertRelease(projectId: string, releaseId: string): Promise<ReleaseRecord> {
    const [release] = await this.db
      .select()
      .from(releases)
      .where(and(eq(releases.id, releaseId), eq(releases.projectId, projectId)))
      .limit(1);

    if (!release) {
      throw new BadRequestException(`Release '${releaseId}' does not exist in this project.`);
    }
    if (release.status === 'RELEASED') {
      throw new BadRequestException(`${release.version} has already shipped and cannot receive issues.`);
    }
    return release;
  }

  async assertAssignee(organizationId: string, userId: string): Promise<{ id: string; name: string }> {
    const [member] = await this.db
      .select({ id: users.id, name: users.name })
      .from(users)
      .innerJoin(userRoles, and(eq(userRoles.userId, users.id), eq(userRoles.organizationId, organizationId)))
      .where(eq(users.id, userId))
      .limit(1);

    if (!member) {
      throw new BadRequestException(`User '${userId}' is not a member of this organization.`);
    }
    return member;
  }
}
