import { Module } from '@nestjs/common';
import { McpService } from './mcp.service';
import { McpController } from './mcp.controller';
import { LlmModule } from '../llm/llm.module';
import { MisAdaptersModule } from '../adapters/mis/mis-adapters.module';

@Module({
  imports: [LlmModule, MisAdaptersModule],
  providers: [McpService],
  controllers: [McpController],
  exports: [McpService],
})
export class McpModule {}
