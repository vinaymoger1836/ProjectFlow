/**
 * In-process domain events emitted after successful mutations (via @nestjs/event-emitter).
 * Listeners must never block or fail the originating request.
 */
export const DomainEvents = {
  IssueCreated: 'issue.created',
  IssueUpdated: 'issue.updated',
  IssueAssigned: 'issue.assigned',
  CommentCreated: 'comment.created',
  PlanningChanged: 'planning.changed',
} as const;

export interface IssueCreatedEvent {
  issueId: string;
  projectId: string;
}

export interface IssueUpdatedEvent {
  issueId: string;
  projectId: string;
  updatedFields: string[];
}

/** An issue gained a (new) assignee. Emitted by single edits, creation, and bulk changes. */
export interface IssueAssignedEvent {
  issueId: string;
  projectId: string;
  assigneeId: string;
  actorId: string;
}

export interface CommentCreatedEvent {
  commentId: string;
  issueId: string;
  projectId: string;
}

/** Sprints, milestones, releases, or issue links changed in a way that can affect project health. */
export interface PlanningChangedEvent {
  projectId: string;
  source: 'SPRINT' | 'MILESTONE' | 'RELEASE' | 'DEPENDENCY';
}
