import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload, AuthenticatedUser } from './auth.types';
import { AuthService } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    const secret =
      configService.get<string>('SUPABASE_JWT_SECRET') ||
      configService.get<string>('JWT_SECRET') ||
      'super-secret-development-jwt-key-min-32-chars-long';

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (!payload || !payload.sub) {
      throw new UnauthorizedException('Invalid or missing authentication token');
    }

    const email = payload.email || 'user@projectflow.local';
    const name =
      payload.user_metadata?.name ||
      payload.user_metadata?.full_name ||
      email.split('@')[0];
    const avatarUrl =
      payload.user_metadata?.avatar_url || payload.user_metadata?.picture || null;

    // Auto-provision or update user profile in PostgreSQL users table
    const user = await this.authService.syncUser({
      id: payload.sub,
      email,
      name,
      avatarUrl,
    });

    return user;
  }
}
