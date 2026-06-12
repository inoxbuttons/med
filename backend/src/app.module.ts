import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
    DatabaseModule,
    McpModule,
    LlmModule,
    ChatModule,
    ClinicConfigModule,
    MessengersModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
