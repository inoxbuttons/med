import { Module } from '@nestjs/common';
import { OpenAiService } from './openai.service';
import { GigaChatService } from './gigachat.service';
import { QwenService } from './qwen.service';

@Module({
  providers: [OpenAiService, GigaChatService, QwenService],
  exports: [OpenAiService, GigaChatService, QwenService],
})
export class LlmModule {}
