import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const schema = config.get<string>('DATABASE_SCHEMA') ?? 'public';

        return {
          type: 'postgres' as const,
          url: config.getOrThrow<string>('DATABASE_URL'),
          schema,
          extra: { options: `-c search_path=${schema}` },
          autoLoadEntities: true,
          migrationsRun: false,
          synchronize: false,
          retryAttempts: 1,
          retryDelay: 1000,
        };
      },
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
