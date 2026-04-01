import { Module } from '@nestjs/common';
import { OpenAiService } from './openai.service';
import { GigaChatService } from './gigachat.service';

@Module({
  providers: [OpenAiService, GigaChatService],
  exports: [OpenAiService, GigaChatService],
})
export class LlmModule {}
