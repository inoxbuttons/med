import { Module } from '@nestjs/common';
import { OpenAiService } from './openai.service';
import { GigaChatService } from './gigachat.service';
import { QwenService } from './qwen.service';
import { Qwen3Service } from './qwen3.service';

@Module({
  providers: [OpenAiService, GigaChatService, QwenService, Qwen3Service],
  exports: [OpenAiService, GigaChatService, QwenService, Qwen3Service],
})
export class LlmModule {}
