import { Module } from '@nestjs/common';
import { McpService } from './mcp.service';
import { McpController } from './mcp.controller';
import { LlmModule } from '../llm/llm.module';
import { LocalDbModule } from '../integrations/local/local-db.module';

@Module({
  imports: [LlmModule, LocalDbModule],
  providers: [McpService],
  controllers: [McpController],
  exports: [McpService],
})
export class McpModule {}
