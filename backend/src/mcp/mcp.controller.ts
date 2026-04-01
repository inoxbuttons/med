import { Body, Controller, Get, Post } from '@nestjs/common';
import { McpService } from './mcp.service';

interface PromptDto {
  provider: 'openai' | 'gigachat';
  prompt: string;
  model?: string;
}

@Controller('mcp')
export class McpController {
  constructor(private readonly mcpService: McpService) {}

  @Get('info')
  getInfo() {
    return {
      name: 'med-mcp-server',
      version: '0.1.0',
      providers: ['openai', 'gigachat'],
    };
  }

  @Post('prompt')
  async handlePrompt(@Body() dto: PromptDto) {
    const messages = [{ role: 'user' as const, content: dto.prompt }];

    if (dto.provider === 'gigachat') {
      return {
        provider: 'gigachat',
        response: await this.mcpService['gigaChat'].chat(messages, dto.model),
      };
    }

    return {
      provider: 'openai',
      response: await this.mcpService['openAi'].chat(messages, dto.model),
    };
  }
}
