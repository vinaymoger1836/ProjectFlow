import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createDb, Database } from '@projectflow/database';

export const DRIZZLE_DB = 'DRIZZLE_DB';

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE_DB,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): Database => {
        const databaseUrl = configService.get<string>(
          'DATABASE_URL',
          'postgres://postgres:postgres@localhost:5432/projectflow',
        );
        return createDb(databaseUrl);
      },
    },
  ],
  exports: [DRIZZLE_DB],
})
export class DatabaseModule {}
