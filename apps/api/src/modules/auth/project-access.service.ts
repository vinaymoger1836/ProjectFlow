import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { Database, projects, userRoles } from '@projectflow/database';
import { DRIZZLE_DB } from '../database/database.module';

export type ProjectRecord = typeof projects.$inferSelect;

/**
 * Tenant isolation check shared across modules: a user may access a project
 * only when they hold a role in the project's organization.
 */
@Injectable()
export class ProjectAccessService {
  constructor(@Inject(DRIZZLE_DB) private readonly db: Database) {}

  async assertProjectAccess(userId: string, projectId: string): Promise<ProjectRecord> {
    // One round trip: the project plus whether the user holds any role in its organization
    const [row] = await this.db
      .select({ project: projects, membershipId: userRoles.id })
      .from(projects)
      .leftJoin(userRoles, and(eq(userRoles.organizationId, projects.organizationId), eq(userRoles.userId, userId)))
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!row) {
      throw new NotFoundException(`Project with ID '${projectId}' not found.`);
    }
    if (!row.membershipId) {
      throw new ForbiddenException('Access denied: You do not have permission to access this project.');
    }

    return row.project;
  }
}
