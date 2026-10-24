import { ConfigService } from '@nestjs/config';
import { AuthenticatedUser } from './auth.types';

/**
 * Seeded local development identity (see packages/database/src/seed.ts).
 */
export const DEV_USER: AuthenticatedUser = {
  id: '11111111-0000-0000-0000-000000000001',
  email: 'dev@projectflow.local',
  name: 'Dev Lead',
  avatarUrl: null,
};

/**
 * Token-less requests are mapped to DEV_USER only when explicitly opted in via
 * AUTH_DEV_BYPASS=true, and never in production. Invalid tokens are always rejected.
 */
export function isDevAuthBypassEnabled(): boolean {
  return process.env.AUTH_DEV_BYPASS === 'true' && process.env.NODE_ENV !== 'production';
}

/**
 * Resolves the Supabase JWT signing secret. Fails fast at boot instead of
 * silently falling back to a well-known development secret.
 */
export function getJwtSecret(configService: ConfigService): string {
  const secret =
    configService.get<string>('SUPABASE_JWT_SECRET') || configService.get<string>('JWT_SECRET');

  if (!secret) {
    throw new Error('SUPABASE_JWT_SECRET is not configured. Set it in .env before starting the API.');
  }

  return secret;
}
