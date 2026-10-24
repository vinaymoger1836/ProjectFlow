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
    const [project] = await this.db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) {
      throw new NotFoundException(`Project with ID '${projectId}' not found.`);
    }

    const membership = await this.db
      .select({ id: userRoles.id })
      .from(userRoles)
      .where(and(eq(userRoles.userId, userId), eq(userRoles.organizationId, project.organizationId)))
      .limit(1);

    if (membership.length === 0) {
      throw new ForbiddenException('Access denied: You do not have permission to access this project.');
    }

    return project;
  }
}
