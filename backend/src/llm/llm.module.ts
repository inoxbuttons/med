import { Module } from '@nestjs/common';
import { OpenAiService } from './openai.service';
import { GigaChatService } from './gigachat.service';
import { QwenService } from './qwen.service';
import { Qwen3Service } from './qwen3.service';
import { LlmRouter } from './llm-router.service';
import { LLM_PORT } from '../core/ports/llm.port';

@Module({
  providers: [OpenAiService, GigaChatService, QwenService, Qwen3Service, LlmRouter, { provide: LLM_PORT, useExisting: LlmRouter }],
  exports: [OpenAiService, GigaChatService, QwenService, Qwen3Service, LlmRouter, LLM_PORT],
})
export class LlmModule {}
