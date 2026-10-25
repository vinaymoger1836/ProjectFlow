import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationTriggersService } from './notification-triggers.service';
import { NotificationDeliveryProcessor } from './notification-delivery.processor';
import { EmailService } from './email.service';
import { PushService } from './push.service';
import { NOTIFICATION_DELIVERY_QUEUE } from './notifications.constants';

@Module({
  imports: [
    BullModule.registerQueue({
      name: NOTIFICATION_DELIVERY_QUEUE,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: true,
        removeOnFail: 100,
      },
    }),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationTriggersService, NotificationDeliveryProcessor, EmailService, PushService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
