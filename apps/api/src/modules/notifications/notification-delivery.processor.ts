import { Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { NotificationsService } from './notifications.service';
import { NOTIFICATION_DELIVERY_QUEUE, DeliveryJobData } from './notifications.constants';

/** Email and web push workers; failures retry with backoff and never touch the in-app inbox. */
@Processor(NOTIFICATION_DELIVERY_QUEUE, { concurrency: 4 })
export class NotificationDeliveryProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationDeliveryProcessor.name);

  constructor(private readonly notificationsService: NotificationsService) {
    super();
  }

  async process(job: Job<DeliveryJobData>): Promise<string> {
    if (job.data.channel === 'EMAIL') {
      return this.notificationsService.deliverEmail(job.data);
    }
    const result = await this.notificationsService.deliverPush(job.data);
    return `push sent=${result.sent} removed=${result.removed}`;
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<DeliveryJobData> | undefined, err: Error) {
    if (!job) return;
    this.logger.warn(`${job.data.channel} notification failed (attempt ${job.attemptsMade}): ${err.message}`);
  }
}
