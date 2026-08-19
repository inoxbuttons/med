import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { McpModule } from './mcp/mcp.module';
import { LlmModule } from './llm/llm.module';
import { DatabaseModule } from './database';
import { ChatModule } from './chat/chat.module';
import { ClinicConfigModule } from './clinic-config/clinic-config.module';
import { MessengersModule } from './messengers/messengers.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // 30 запросов в минуту на IP — защита от спама и перерасхода LLM-бюджета
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 30 }]),
    DatabaseModule,
    McpModule,
    LlmModule,
    ChatModule,
    ClinicConfigModule,
    MessengersModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
