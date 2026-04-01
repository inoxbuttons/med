import { Module } from '@nestjs/common';
import { McpService } from './mcp.service';
import { McpController } from './mcp.controller';
import { LlmModule } from '../llm/llm.module';
import { BookingModule } from '../booking/booking.module';

@Module({
  imports: [LlmModule, BookingModule],
  providers: [McpService],
  controllers: [McpController],
  exports: [McpService],
})
export class McpModule {}
