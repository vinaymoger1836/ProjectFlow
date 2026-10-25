import { NotificationType } from '@projectflow/types';

export const NOTIFICATION_DELIVERY_QUEUE = 'notification-delivery';

export type DeliveryChannel = 'EMAIL' | 'PUSH';

export interface NotificationDefinition {
  label: string;
  description: string;
  defaults: { inApp: boolean; email: boolean; push: boolean };
}

/** Every notification type the platform can send, with its default channels. */
export const NOTIFICATION_CATALOG: Record<NotificationType, NotificationDefinition> = {
  ISSUE_ASSIGNED: {
    label: 'Issue assigned to me',
    description: 'Someone else assigns an issue to you (manually, by bulk edit, or through an AI-applied change).',
    // Push only reaches browsers that opted in, so enabling it by default sends nothing unexpected
    defaults: { inApp: true, email: true, push: true },
  },
};

export const NOTIFICATION_TYPES = Object.keys(NOTIFICATION_CATALOG) as NotificationType[];

export interface DeliveryJobData {
  channel: DeliveryChannel;
  recipientId: string;
  notificationType: NotificationType;
  title: string;
  body: string | null;
  /** App-relative link such as "/?issue=PAY-12". */
  link: string | null;
}
