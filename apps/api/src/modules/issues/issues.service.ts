import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { eq, and, or, ilike, sql, desc, asc, inArray, SQL } from 'drizzle-orm';
import { aliasedTable } from 'drizzle-orm';
import {
  Database,
  issues,
  projects,
  users,
  userRoles,
  labels,
  issueLabels,
  issueComments,
  activities,
} from '@projectflow/database';
import { DRIZZLE_DB } from '../database/database.module';
import { CreateIssueDto } from './dto/create-issue.dto';
import { UpdateIssueDto } from './dto/update-issue.dto';
import { IssueQueryDto } from './dto/issue-query.dto';
import { CreateCommentDto } from './dto/create-comment.dto';

const assigneeUser = aliasedTable(users, 'assignee_user');
const reporterUser = aliasedTable(users, 'reporter_user');
const commentAuthor = aliasedTable(users, 'comment_author');

@Injectable()
export class IssuesService {
  constructor(@Inject(DRIZZLE_DB) private readonly db: Database) {}

  /**
   * Creates a new issue with atomic sequential key numbering per project (e.g. PAY-1, PAY-2).
   * Automatically initializes status to TODO, links labels, and records an activity audit event.
   */
  async createIssue(userId: string, projectId: string, dto: CreateIssueDto) {
    const project = await this.getProjectAndVerifyAccess(userId, projectId);

    return await this.db.transaction(async (tx) => {
      // 1. Atomically increment project issueCounter to prevent sequence race conditions
      const [updatedProject] = await tx
        .update(projects)
        .set({ issueCounter: sql`${projects.issueCounter} + 1` })
        .where(eq(projects.id, projectId))
        .returning({
          key: projects.key,
          issueCounter: projects.issueCounter,
          organizationId: projects.organizationId,
        });

      const nextCounter = updatedProject.issueCounter;
      const issueKey = `${updatedProject.key}-${nextCounter}`;

      // 2. Insert new issue
      const [createdIssue] = await tx
        .insert(issues)
        .values({
          projectId,
          issueKey,
          keyNumber: nextCounter,
          title: dto.title,
          description: dto.description,
          type: dto.type,
          status: dto.status || 'TODO',
          priority: dto.priority,
          assigneeId: dto.assigneeId || null,
          reporterId: userId,
          parentIssueId: dto.parentIssueId || null,
          sprintId: dto.sprintId || null,
          milestoneId: dto.milestoneId || null,
          releaseId: dto.releaseId || null,
          storyPoints: dto.storyPoints ?? null,
          estimateHours: dto.estimateHours ?? null,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          isArchived: false,
        })
        .returning();

      // 3. Link labels if provided
      if (dto.labelIds && dto.labelIds.length > 0) {
        for (const labelId of dto.labelIds) {
          await tx.insert(issueLabels).values({
            issueId: createdIssue.id,
            labelId,
          });
        }
      }

      // 4. Record audit activity
      await tx.insert(activities).values({
        organizationId: project.organizationId,
        projectId,
        userId,
        entityType: 'ISSUE',
        entityId: createdIssue.id,
        action: 'CREATED',
        details: {
          issueKey: createdIssue.issueKey,
          title: createdIssue.title,
          type: createdIssue.type,
          priority: createdIssue.priority,
          status: createdIssue.status,
        },
      });

      return await this.getIssueDetailsById(createdIssue.id, tx);
    });
  }

  /**
   * Lists issues for a project with comprehensive filtering, search, pagination, and sorting.
   * Multi-tenant isolated to project members. Soft-deleted issues are excluded by default.
   */
  async listIssues(userId: string, projectId: string, query: IssueQueryDto) {
    await this.getProjectAndVerifyAccess(userId, projectId);

    const conditions: (SQL<unknown> | undefined)[] = [eq(issues.projectId, projectId)];

    if (!query.includeArchived) {
      conditions.push(eq(issues.isArchived, false));
    }

    if (query.type) {
      conditions.push(eq(issues.type, query.type));
    }

    if (query.status) {
      // Support comma-separated statuses if requested
      const statuses = query.status.split(',').map((s) => s.trim());
      if (statuses.length === 1) {
        conditions.push(eq(issues.status, statuses[0]));
      } else if (statuses.length > 1) {
        conditions.push(inArray(issues.status, statuses));
      }
    }

    if (query.priority) {
      conditions.push(eq(issues.priority, query.priority));
    }

    if (query.assigneeId) {
      conditions.push(eq(issues.assigneeId, query.assigneeId));
    }

    if (query.reporterId) {
      conditions.push(eq(issues.reporterId, query.reporterId));
    }

    if (query.sprintId) {
      conditions.push(eq(issues.sprintId, query.sprintId));
    }

    if (query.search && query.search.trim().length > 0) {
      const s = `%${query.search.trim()}%`;
      const searchCondition = or(
        ilike(issues.title, s),
        ilike(issues.issueKey, s),
        ilike(issues.description, s),
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    const whereClause = and(...conditions);

    // Count total matching records
    const [countResult] = await this.db
      .select({ count: sql<string>`count(*)` })
      .from(issues)
      .where(whereClause);

    const total = parseInt(countResult?.count || '0', 10);
    const page = query.page || 1;
    const limit = query.limit || 25;
    const offset = (page - 1) * limit;

    // Determine sorting
    const getSortColumn = () => {
      switch (query.sortBy) {
        case 'createdAt':
          return issues.createdAt;
        case 'updatedAt':
          return issues.updatedAt;
        case 'priority':
          return issues.priority;
        case 'status':
          return issues.status;
        case 'keyNumber':
        default:
          return issues.keyNumber;
      }
    };
    const sortColumn = getSortColumn();
    const orderExpr = query.sortOrder === 'desc' ? desc(sortColumn) : asc(sortColumn);

    const rows = await this.db
      .select({
        id: issues.id,
        projectId: issues.projectId,
        issueKey: issues.issueKey,
        keyNumber: issues.keyNumber,
        title: issues.title,
        description: issues.description,
        type: issues.type,
        status: issues.status,
        priority: issues.priority,
        storyPoints: issues.storyPoints,
        estimateHours: issues.estimateHours,
        dueDate: issues.dueDate,
        sprintId: issues.sprintId,
        milestoneId: issues.milestoneId,
        releaseId: issues.releaseId,
        parentIssueId: issues.parentIssueId,
        isArchived: issues.isArchived,
        createdAt: issues.createdAt,
        updatedAt: issues.updatedAt,
        resolvedAt: issues.resolvedAt,
        assigneeId: assigneeUser.id,
        assigneeName: assigneeUser.name,
        assigneeEmail: assigneeUser.email,
        assigneeAvatarUrl: assigneeUser.avatarUrl,
        reporterId: reporterUser.id,
        reporterName: reporterUser.name,
        reporterEmail: reporterUser.email,
        reporterAvatarUrl: reporterUser.avatarUrl,
      })
      .from(issues)
      .leftJoin(reporterUser, eq(issues.reporterId, reporterUser.id))
      .leftJoin(assigneeUser, eq(issues.assigneeId, assigneeUser.id))
      .where(whereClause)
      .orderBy(orderExpr)
      .limit(limit)
      .offset(offset);

    // Fetch labels for the issues on this page
    const issueIds = rows.map((r) => r.id);
    let labelMap: Record<string, { id: string; name: string; color: string }[]> = {};

    if (issueIds.length > 0) {
      const issueLabelRows = await this.db
        .select({
          issueId: issueLabels.issueId,
          labelId: labels.id,
          labelName: labels.name,
          labelColor: labels.color,
        })
        .from(issueLabels)
        .innerJoin(labels, eq(issueLabels.labelId, labels.id))
        .where(inArray(issueLabels.issueId, issueIds));

      labelMap = issueLabelRows.reduce((acc, row) => {
        if (!acc[row.issueId]) acc[row.issueId] = [];
        acc[row.issueId].push({
          id: row.labelId,
          name: row.labelName,
          color: row.labelColor,
        });
        return acc;
      }, {} as Record<string, { id: string; name: string; color: string }[]>);
    }

    const items = rows.map((r) => {
      const {
        assigneeId,
        assigneeName,
        assigneeEmail,
        assigneeAvatarUrl,
        reporterId,
        reporterName,
        reporterEmail,
        reporterAvatarUrl,
        ...rest
      } = r;

      return {
        ...rest,
        assignee: assigneeId
          ? {
              id: assigneeId,
              name: assigneeName,
              email: assigneeEmail,
              avatarUrl: assigneeAvatarUrl,
            }
          : null,
        reporter: {
          id: reporterId,
          name: reporterName,
          email: reporterEmail,
          avatarUrl: reporterAvatarUrl,
        },
        labels: labelMap[r.id] || [],
      };
    });

    return {
      items,
      total,
      page,
      pageSize: limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Retrieves a single issue by either its UUID or human-readable key (e.g. PAY-10).
   * Validates multi-tenant permission.
   */
  async getIssue(userId: string, identifier: string) {
    const isIssueKey = /^[A-Z0-9]+-\d+$/i.test(identifier);

    const condition = isIssueKey
      ? eq(sql`UPPER(${issues.issueKey})`, identifier.toUpperCase())
      : eq(issues.id, identifier);

    const [existing] = await this.db
      .select({
        id: issues.id,
        projectId: issues.projectId,
      })
      .from(issues)
      .where(condition)
      .limit(1);

    if (!existing) {
      throw new NotFoundException(`Issue '${identifier}' not found.`);
    }

    await this.getProjectAndVerifyAccess(userId, existing.projectId);
    return await this.getIssueDetailsById(existing.id);
  }

  /**
   * Updates issue fields, handles status transitions, updates labels, and writes activity log.
   */
  async updateIssue(userId: string, issueId: string, dto: UpdateIssueDto) {
    const [existing] = await this.db
      .select()
      .from(issues)
      .where(eq(issues.id, issueId))
      .limit(1);

    if (!existing) {
      throw new NotFoundException(`Issue with ID '${issueId}' not found.`);
    }

    const project = await this.getProjectAndVerifyAccess(userId, existing.projectId);

    return await this.db.transaction(async (tx) => {
      const updates: Partial<typeof issues.$inferInsert> = {
        updatedAt: new Date(),
      };

      if (dto.title !== undefined) updates.title = dto.title;
      if (dto.description !== undefined) updates.description = dto.description;
      if (dto.type !== undefined) updates.type = dto.type;
      if (dto.priority !== undefined) updates.priority = dto.priority;
      if (dto.assigneeId !== undefined) updates.assigneeId = dto.assigneeId;
      if (dto.parentIssueId !== undefined) updates.parentIssueId = dto.parentIssueId;
      if (dto.sprintId !== undefined) updates.sprintId = dto.sprintId;
      if (dto.milestoneId !== undefined) updates.milestoneId = dto.milestoneId;
      if (dto.releaseId !== undefined) updates.releaseId = dto.releaseId;
      if (dto.storyPoints !== undefined) updates.storyPoints = dto.storyPoints;
      if (dto.estimateHours !== undefined) updates.estimateHours = dto.estimateHours;
      if (dto.dueDate !== undefined) {
        updates.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
      }

      // Handle status and resolution timestamp
      if (dto.status !== undefined && dto.status !== existing.status) {
        updates.status = dto.status;
        if (dto.status.toUpperCase() === 'DONE') {
          updates.resolvedAt = new Date();
        } else if (existing.status.toUpperCase() === 'DONE') {
          updates.resolvedAt = null;
        }
      }

      await tx.update(issues).set(updates).where(eq(issues.id, issueId));

      // Update labels if provided
      if (dto.labelIds !== undefined) {
        await tx.delete(issueLabels).where(eq(issueLabels.issueId, issueId));
        if (dto.labelIds.length > 0) {
          for (const labelId of dto.labelIds) {
            await tx.insert(issueLabels).values({
              issueId,
              labelId,
            });
          }
        }
      }

      // Record activity
      const action = dto.status && dto.status !== existing.status ? 'STATUS_CHANGED' : 'UPDATED';
      await tx.insert(activities).values({
        organizationId: project.organizationId,
        projectId: existing.projectId,
        userId,
        entityType: 'ISSUE',
        entityId: issueId,
        action,
        details: {
          previousStatus: existing.status,
          newStatus: dto.status || existing.status,
          updatedFields: Object.keys(dto),
        },
      });

      return await this.getIssueDetailsById(issueId, tx);
    });
  }

  /**
   * Soft-deletes an issue (sets isArchived to true and records deletedAt).
   */
  async deleteIssue(userId: string, issueId: string) {
    const [existing] = await this.db
      .select()
      .from(issues)
      .where(eq(issues.id, issueId))
      .limit(1);

    if (!existing) {
      throw new NotFoundException(`Issue with ID '${issueId}' not found.`);
    }

    const project = await this.getProjectAndVerifyAccess(userId, existing.projectId);

    await this.db.transaction(async (tx) => {
      await tx
        .update(issues)
        .set({
          isArchived: true,
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(issues.id, issueId));

      await tx.insert(activities).values({
        organizationId: project.organizationId,
        projectId: existing.projectId,
        userId,
        entityType: 'ISSUE',
        entityId: issueId,
        action: 'ARCHIVED',
        details: {
          issueKey: existing.issueKey,
          title: existing.title,
        },
      });
    });

    return { success: true, message: `Issue ${existing.issueKey} archived successfully.` };
  }

  /**
   * Adds a comment to an issue and logs activity.
   */
  async addComment(userId: string, issueId: string, dto: CreateCommentDto) {
    const [issue] = await this.db
      .select()
      .from(issues)
      .where(eq(issues.id, issueId))
      .limit(1);

    if (!issue) {
      throw new NotFoundException(`Issue with ID '${issueId}' not found.`);
    }

    const project = await this.getProjectAndVerifyAccess(userId, issue.projectId);

    const [comment] = await this.db
      .insert(issueComments)
      .values({
        issueId,
        userId,
        content: dto.content,
      })
      .returning();

    await this.db.insert(activities).values({
      organizationId: project.organizationId,
      projectId: issue.projectId,
      userId,
      entityType: 'ISSUE',
      entityId: issueId,
      action: 'COMMENT_ADDED',
      details: {
        commentId: comment.id,
        snippet: dto.content.slice(0, 100),
      },
    });

    const [author] = await this.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return {
      ...comment,
      author,
    };
  }

  /**
   * Lists all comments for an issue in chronological order.
   */
  async listComments(userId: string, issueId: string) {
    const [issue] = await this.db
      .select({ id: issues.id, projectId: issues.projectId })
      .from(issues)
      .where(eq(issues.id, issueId))
      .limit(1);

    if (!issue) {
      throw new NotFoundException(`Issue with ID '${issueId}' not found.`);
    }

    await this.getProjectAndVerifyAccess(userId, issue.projectId);

    const comments = await this.db
      .select({
        id: issueComments.id,
        content: issueComments.content,
        createdAt: issueComments.createdAt,
        updatedAt: issueComments.updatedAt,
        author: {
          id: commentAuthor.id,
          name: commentAuthor.name,
          email: commentAuthor.email,
          avatarUrl: commentAuthor.avatarUrl,
        },
      })
      .from(issueComments)
      .innerJoin(commentAuthor, eq(issueComments.userId, commentAuthor.id))
      .where(eq(issueComments.issueId, issueId))
      .orderBy(asc(issueComments.createdAt));

    return comments;
  }

  /**
   * Internal helper: retrieves full issue details with assignee, reporter, labels, and comments count.
   */
  private async getIssueDetailsById(issueId: string, customDb?: any) {
    const executor = customDb || this.db;

    const [issue] = await executor
      .select({
        id: issues.id,
        projectId: issues.projectId,
        issueKey: issues.issueKey,
        keyNumber: issues.keyNumber,
        title: issues.title,
        description: issues.description,
        type: issues.type,
        status: issues.status,
        priority: issues.priority,
        storyPoints: issues.storyPoints,
        estimateHours: issues.estimateHours,
        dueDate: issues.dueDate,
        sprintId: issues.sprintId,
        milestoneId: issues.milestoneId,
        releaseId: issues.releaseId,
        parentIssueId: issues.parentIssueId,
        isArchived: issues.isArchived,
        createdAt: issues.createdAt,
        updatedAt: issues.updatedAt,
        resolvedAt: issues.resolvedAt,
        closedAt: issues.closedAt,
        assigneeId: assigneeUser.id,
        assigneeName: assigneeUser.name,
        assigneeEmail: assigneeUser.email,
        assigneeAvatarUrl: assigneeUser.avatarUrl,
        reporterId: reporterUser.id,
        reporterName: reporterUser.name,
        reporterEmail: reporterUser.email,
        reporterAvatarUrl: reporterUser.avatarUrl,
      })
      .from(issues)
      .leftJoin(reporterUser, eq(issues.reporterId, reporterUser.id))
      .leftJoin(assigneeUser, eq(issues.assigneeId, assigneeUser.id))
      .where(eq(issues.id, issueId))
      .limit(1);

    if (!issue) {
      throw new NotFoundException(`Issue with ID '${issueId}' not found.`);
    }

    // Fetch labels
    const issueLabelRows = await executor
      .select({
        id: labels.id,
        name: labels.name,
        color: labels.color,
        description: labels.description,
      })
      .from(issueLabels)
      .innerJoin(labels, eq(issueLabels.labelId, labels.id))
      .where(eq(issueLabels.issueId, issueId));

    // Count comments
    const [commentCount] = await executor
      .select({ count: sql<string>`count(*)` })
      .from(issueComments)
      .where(eq(issueComments.issueId, issueId));

    const {
      assigneeId,
      assigneeName,
      assigneeEmail,
      assigneeAvatarUrl,
      reporterId,
      reporterName,
      reporterEmail,
      reporterAvatarUrl,
      ...rest
    } = issue;

    return {
      ...rest,
      assignee: assigneeId
        ? {
            id: assigneeId,
            name: assigneeName,
            email: assigneeEmail,
            avatarUrl: assigneeAvatarUrl,
          }
        : null,
      reporter: {
        id: reporterId,
        name: reporterName,
        email: reporterEmail,
        avatarUrl: reporterAvatarUrl,
      },
      labels: issueLabelRows,
      commentCount: parseInt(commentCount?.count || '0', 10),
    };
  }

  /**
   * Internal helper: retrieves project and verifies requesting user has membership in its organization.
   */
  private async getProjectAndVerifyAccess(userId: string, projectId: string) {
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
      throw new ForbiddenException(
        'Access denied: You do not have permission to view or manage issues in this project.',
      );
    }

    return project;
  }
}
