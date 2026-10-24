import { Module, Global } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { SupabaseAuthGuard } from './guards/supabase-auth.guard';
import { OrgMemberGuard } from './guards/org-member.guard';
import { ProjectAccessService } from './project-access.service';
import { getJwtSecret } from './auth.config';

@Global()
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({ secret: getJwtSecret(configService) }),
    }),
    ConfigModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, SupabaseAuthGuard, OrgMemberGuard, ProjectAccessService],
  exports: [AuthService, SupabaseAuthGuard, OrgMemberGuard, ProjectAccessService, PassportModule],
})
export class AuthModule {}
