import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { DEV_USER, isDevAuthBypassEnabled } from '../auth.config';
import { AuthenticatedUser } from '../auth.types';

@Injectable()
export class SupabaseAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();

    // Opt-in local development bypass: requests without a Bearer token use the seeded dev user
    if (!request.headers.authorization && isDevAuthBypassEnabled()) {
      request.user = DEV_USER;
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest<TUser = AuthenticatedUser>(err: unknown, user: TUser | false): TUser {
    if (err || !user) {
      throw err instanceof Error
        ? err
        : new UnauthorizedException('Authentication required. Provide a valid Supabase Bearer token.');
    }
    return user;
  }
}
