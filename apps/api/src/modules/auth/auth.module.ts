import { Module, Global } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { SupabaseAuthGuard } from './guards/supabase-auth.guard';
import { OrgMemberGuard } from './guards/org-member.guard';

@Global()
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    ConfigModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, SupabaseAuthGuard, OrgMemberGuard],
  exports: [AuthService, SupabaseAuthGuard, OrgMemberGuard, PassportModule],
})
export class AuthModule {}
