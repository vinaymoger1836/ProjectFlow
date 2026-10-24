/**
 * In-process domain events emitted after successful mutations (via @nestjs/event-emitter).
 * Listeners must never block or fail the originating request.
 */
export const DomainEvents = {
  IssueCreated: 'issue.created',
  IssueUpdated: 'issue.updated',
  CommentCreated: 'comment.created',
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

export interface CommentCreatedEvent {
  commentId: string;
  issueId: string;
  projectId: string;
}
