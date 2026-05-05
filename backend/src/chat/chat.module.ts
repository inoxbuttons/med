import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { TokenUsageController } from './token-usage.controller';
import { LlmModule } from '../llm/llm.module';
import { BookingModule } from '../booking/booking.module';
import { TokenUsage } from '../database/entities/token-usage.entity';

@Module({
  imports: [LlmModule, BookingModule, TypeOrmModule.forFeature([TokenUsage])],
  controllers: [ChatController, TokenUsageController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
