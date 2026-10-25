import { Injectable, Inject, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { eq } from 'drizzle-orm';
import { Database, issues, projects, users } from '@projectflow/database';
import { DRIZZLE_DB } from '../database/database.module';
import { DomainEvents, IssueAssignedEvent } from '../../common/events/domain-events';
import { NotificationsService } from './notifications.service';

/**
 * Maps domain events to notifications. Only "assigned to me" is enabled (Phase 7 scope);
 * people are never notified about their own actions.
 */
@Injectable()
export class NotificationTriggersService {
  private readonly logger = new Logger(NotificationTriggersService.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly notificationsService: NotificationsService,
  ) {}

  @OnEvent(DomainEvents.IssueAssigned, { async: true })
  async onIssueAssigned(event: IssueAssignedEvent) {
    if (event.assigneeId === event.actorId) return;

    try {
      const [issue] = await this.db
        .select({
          id: issues.id,
          issueKey: issues.issueKey,
          title: issues.title,
          priority: issues.priority,
          organizationId: projects.organizationId,
        })
        .from(issues)
        .innerJoin(projects, eq(projects.id, issues.projectId))
        .where(eq(issues.id, event.issueId))
        .limit(1);
      if (!issue) return;

      const [actor] = await this.db.select({ name: users.name }).from(users).where(eq(users.id, event.actorId)).limit(1);

      await this.notificationsService.notify({
        recipientId: event.assigneeId,
        organizationId: issue.organizationId,
        projectId: event.projectId,
        type: 'ISSUE_ASSIGNED',
        title: `${actor?.name ?? 'Someone'} assigned you ${issue.issueKey}`,
        body: `${issue.priority} · ${issue.title}`,
        link: `/?issue=${encodeURIComponent(issue.issueKey)}`,
        entityType: 'ISSUE',
        entityId: issue.id,
        actorId: event.actorId,
      });
    } catch (err) {
      this.logger.warn(`Could not notify assignment of ${event.issueId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
