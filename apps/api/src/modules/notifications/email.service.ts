import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Provider-agnostic SMTP sender. In development SMTP points at Mailpit, which captures every
 * message locally; any SMTP relay works in production. Disabled when SMTP_HOST is empty.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor(config: ConfigService) {
    const host = config.get<string>('SMTP_HOST');
    this.from = config.get<string>('MAIL_FROM', 'ProjectFlow <notifications@projectflow.local>');

    if (!host) {
      this.transporter = null;
      this.logger.warn('SMTP_HOST is not set: email notifications are disabled.');
      return;
    }

    const user = config.get<string>('SMTP_USER');
    this.transporter = nodemailer.createTransport({
      host,
      port: Number(config.get<string>('SMTP_PORT', '587')),
      secure: config.get<string>('SMTP_SECURE') === 'true',
      auth: user ? { user, pass: config.get<string>('SMTP_PASS', '') } : undefined,
    });
  }

  isEnabled(): boolean {
    return this.transporter !== null;
  }

  async send(message: EmailMessage): Promise<void> {
    if (!this.transporter) return;
    await this.transporter.sendMail({ from: this.from, ...message });
  }
}
