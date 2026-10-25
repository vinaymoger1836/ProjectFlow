import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseModule } from './modules/database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { IssuesModule } from './modules/issues/issues.module';
import { AiModule } from './modules/ai/ai.module';
import { EventsModule } from './modules/events/events.module';
import { SearchModule } from './modules/search/search.module';
import { SprintsModule } from './modules/sprints/sprints.module';
import { MilestonesModule } from './modules/milestones/milestones.module';
import { ReleasesModule } from './modules/releases/releases.module';
import { ProjectHealthModule } from './modules/project-health/project-health.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { CommandModule } from './modules/command/command.module';
import { HealthController } from './modules/health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
    }),
    EventEmitterModule.forRoot(),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: Number(configService.get<string>('REDIS_PORT', '6379')),
          password: configService.get<string>('REDIS_PASSWORD') || undefined,
        },
      }),
    }),
    DatabaseModule,
    AuthModule,
    OrganizationsModule,
    ProjectsModule,
    IssuesModule,
    AiModule,
    EventsModule,
    SearchModule,
    SprintsModule,
    MilestonesModule,
    ReleasesModule,
    ProjectHealthModule,
    NotificationsModule,
    CommandModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
