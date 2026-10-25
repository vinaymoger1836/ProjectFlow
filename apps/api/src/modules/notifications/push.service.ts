import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushPayload {
  title: string;
  body: string | null;
  url: string | null;
  tag: string;
}

/** Push services answer 404/410 for subscriptions the browser has revoked. */
const GONE_STATUSES = new Set([404, 410]);

export type PushOutcome = 'sent' | 'gone';

/**
 * Self-hosted Web Push (VAPID). Disabled unless both VAPID keys are configured.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  readonly publicKey: string | null;

  constructor(config: ConfigService) {
    const publicKey = config.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = config.get<string>('VAPID_PRIVATE_KEY');
    const subject = config.get<string>('VAPID_SUBJECT', 'mailto:notifications@projectflow.local');

    if (!publicKey || !privateKey) {
      this.publicKey = null;
      this.logger.warn('VAPID keys are not set: web push notifications are disabled.');
      return;
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);
    this.publicKey = publicKey;
  }

  isEnabled(): boolean {
    return this.publicKey !== null;
  }

  async send(target: PushTarget, payload: PushPayload): Promise<PushOutcome> {
    try {
      await webpush.sendNotification(
        { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
        JSON.stringify(payload),
        { TTL: 60 * 60 * 24 },
      );
      return 'sent';
    } catch (err) {
      if (err instanceof webpush.WebPushError && GONE_STATUSES.has(err.statusCode)) return 'gone';
      throw err;
    }
  }
}
