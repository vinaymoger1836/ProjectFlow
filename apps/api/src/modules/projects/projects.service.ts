import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { eq, and, sql } from 'drizzle-orm';
import {
  Database,
  projects,
  projectMembers,
  projectSettings,
  userRoles,
  users,
  issues,
} from '@projectflow/database';
import { DRIZZLE_DB } from '../database/database.module';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddProjectMemberDto } from './dto/add-project-member.dto';
import { generateProjectKey } from './utils/key-generator';

@Injectable()
export class ProjectsService {
  constructor(@Inject(DRIZZLE_DB) private readonly db: Database) {}

  /**
   * Lists all projects within an organization.
   * Multi-tenant isolation: requires that the requesting user belongs to the organization.
   */
  async listProjectsByOrganization(userId: string, orgId: string) {
    await this.verifyUserOrgAccess(userId, orgId);

    const orgProjects = await this.db
      .select({
        id: projects.id,
        key: projects.key,
        name: projects.name,
        description: projects.description,
        healthStatus: projects.healthStatus,
        leadId: projects.leadId,
        teamId: projects.teamId,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
      })
      .from(projects)
      .where(eq(projects.organizationId, orgId));

    return orgProjects;
  }

  /**
   * Creates a new project within an organization.
   * Auto-suggests project key if not specified, verifies uniqueness within the org,
   * initializes project settings, and adds creator as LEAD in a single transaction.
   */
  async createProject(userId: string, orgId: string, dto: CreateProjectDto) {
    await this.verifyUserOrgAccess(userId, orgId);

    // Auto-suggest key if not provided or format provided key
    let key = (dto.key || generateProjectKey(dto.name)).toUpperCase();

    // Verify key uniqueness within this organization
    const existing = await this.db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.organizationId, orgId), eq(projects.key, key)))
      .limit(1);

    if (existing.length > 0) {
      if (dto.key) {
        throw new ConflictException(
          `Project key "${key}" is already in use in this organization. Please specify a different key.`,
        );
      }
      // If auto-suggested, append a number
      key = `${key.substring(0, 8)}${Math.floor(Math.random() * 90 + 10)}`;
    }

    return await this.db.transaction(async (tx) => {
      // 1. Insert Project
      const [newProject] = await tx
        .insert(projects)
        .values({
          organizationId: orgId,
          teamId: dto.teamId || null,
          key,
          name: dto.name,
          description: dto.description || null,
          leadId: userId,
          healthStatus: 'HEALTHY',
        })
        .returning();

      // 2. Initialize default workflow statuses & issue types
      const defaultStatuses = [
        { id: 'backlog', name: 'Backlog', category: 'BACKLOG', color: '#6B7280', order: 0 },
        { id: 'todo', name: 'To Do', category: 'TODO', color: '#3B82F6', order: 1 },
        { id: 'in_progress', name: 'In Progress', category: 'IN_PROGRESS', color: '#F59E0B', order: 2 },
        { id: 'in_review', name: 'In Review', category: 'IN_REVIEW', color: '#8B5CF6', order: 3 },
        { id: 'done', name: 'Done', category: 'DONE', color: '#10B981', order: 4 },
      ];

      const defaultIssueTypes = [
        { id: 'task', name: 'Task', icon: 'CheckSquare', color: '#3B82F6' },
        { id: 'bug', name: 'Bug', icon: 'AlertCircle', color: '#EF4444' },
        { id: 'story', name: 'Story', icon: 'Bookmark', color: '#10B981' },
        { id: 'epic', name: 'Epic', icon: 'Zap', color: '#8B5CF6' },
      ];

      await tx.insert(projectSettings).values({
        projectId: newProject.id,
        workflowStatuses: defaultStatuses,
        issueTypes: defaultIssueTypes,
        settingsJson: {},
      });

      // 3. Add creator as LEAD in project_members
      await tx.insert(projectMembers).values({
        projectId: newProject.id,
        userId,
        role: 'LEAD',
      });

      return {
        ...newProject,
        workflowStatuses: defaultStatuses,
        issueTypes: defaultIssueTypes,
      };
    });
  }

  /**
   * Retrieves project details by ID with tenant access check.
   */
  async getProjectById(userId: string, projectId: string) {
    const projectRows = await this.db
      .select({
        project: projects,
        settings: projectSettings,
      })
      .from(projects)
      .leftJoin(projectSettings, eq(projects.id, projectSettings.projectId))
      .where(eq(projects.id, projectId))
      .limit(1);

    if (projectRows.length === 0) {
      throw new NotFoundException(`Project with ID "${projectId}" not found.`);
    }

    const { project, settings } = projectRows[0];

    // Multi-tenant check: user must belong to project's organization
    await this.verifyUserOrgAccess(userId, project.organizationId);

    // Count project issues
    const issueCount = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(issues)
      .where(eq(issues.projectId, projectId));

    // Count project members
    const memberCount = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(projectMembers)
      .where(eq(projectMembers.projectId, projectId));

    return {
      ...project,
      settings: settings || null,
      stats: {
        totalIssues: Number(issueCount[0]?.count || 0),
        totalMembers: Number(memberCount[0]?.count || 0),
      },
    };
  }

  /**
   * Updates project details.
   */
  async updateProject(userId: string, projectId: string, dto: UpdateProjectDto) {
    const existing = await this.getProjectById(userId, projectId);

    const [updated] = await this.db
      .update(projects)
      .set({
        name: dto.name !== undefined ? dto.name : existing.name,
        description: dto.description !== undefined ? dto.description : existing.description,
        healthStatus: dto.healthStatus !== undefined ? dto.healthStatus : existing.healthStatus,
        leadId: dto.leadId !== undefined ? dto.leadId : existing.leadId,
        teamId: dto.teamId !== undefined ? dto.teamId : existing.teamId,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId))
      .returning();

    return updated;
  }

  /**
   * Lists all members of a project.
   */
  async listProjectMembers(userId: string, projectId: string) {
    const project = await this.getProjectById(userId, projectId);

    const members = await this.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        avatarUrl: users.avatarUrl,
        role: projectMembers.role,
        joinedAt: projectMembers.joinedAt,
      })
      .from(projectMembers)
      .innerJoin(users, eq(projectMembers.userId, users.id))
      .where(eq(projectMembers.projectId, projectId));

    return members;
  }

  /**
   * Adds or updates a member in a project.
   */
  async addProjectMember(userId: string, projectId: string, dto: AddProjectMemberDto) {
    const project = await this.getProjectById(userId, projectId);

    // Verify target user is part of the organization
    await this.verifyUserOrgAccess(dto.userId, project.organizationId);

    // Upsert project member
    const existingMember = await this.db
      .select()
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, dto.userId)))
      .limit(1);

    if (existingMember.length > 0) {
      const [updated] = await this.db
        .update(projectMembers)
        .set({ role: dto.role })
        .where(eq(projectMembers.id, existingMember[0].id))
        .returning();
      return updated;
    }

    const [created] = await this.db
      .insert(projectMembers)
      .values({
        projectId,
        userId: dto.userId,
        role: dto.role,
      })
      .returning();

    return created;
  }

  /**
   * Helper: validates that a user belongs to an organization.
   * Throws ForbiddenException if user is not in user_roles for this orgId.
   */
  private async verifyUserOrgAccess(userId: string, orgId: string): Promise<void> {
    const membership = await this.db
      .select({ id: userRoles.id })
      .from(userRoles)
      .where(and(eq(userRoles.userId, userId), eq(userRoles.organizationId, orgId)))
      .limit(1);

    if (membership.length === 0) {
      throw new ForbiddenException(
        'Access denied: You do not have permission to view or manage resources in this organization.',
      );
    }
  }
}
