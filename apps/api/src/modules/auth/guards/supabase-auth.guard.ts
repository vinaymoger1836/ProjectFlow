import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

export const DEV_USER = {
  id: '11111111-0000-0000-0000-000000000001',
  email: 'dev@projectflow.local',
  name: 'Dev Lead',
  avatarUrl: null,
};

@Injectable()
export class SupabaseAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    // In local development, allow requests without Bearer token to use the seeded dev user
    if (!authHeader && process.env.NODE_ENV !== 'production') {
      request.user = DEV_USER;
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any) {
    if (err || !user) {
      if (process.env.NODE_ENV !== 'production') {
        return DEV_USER;
      }
      throw err || new UnauthorizedException('Authentication required. Provide a valid Supabase Bearer token.');
    }
    return user;
  }
}
