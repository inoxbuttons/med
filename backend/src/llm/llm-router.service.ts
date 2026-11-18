import { Injectable } from '@nestjs/common';
import { LlmPort, LlmRequest } from '../core/ports/llm.port';
import { GigaChatService } from './gigachat.service';
import { CompletionResult, JsonCompletionRequest, JsonCompletionResult, parseJsonObject } from './llm.types';
import { LlmProvider } from '../chat/chat.types';
import { OpenAiService } from './openai.service';
import { QwenService } from './qwen.service';
import { Qwen3Service } from './qwen3.service';

/** Единая точка вызова модели — выбирает провайдера по имени. */
@Injectable()
export class LlmRouter implements LlmPort {
  constructor(
    private readonly openAi: OpenAiService,
    private readonly gigaChat: GigaChatService,
    private readonly qwen: QwenService,
    private readonly qwen3: Qwen3Service,
  ) {}

  complete({ provider, messages, tools = [], model, forceText = false, thinking }: LlmRequest): Promise<CompletionResult> {
    switch (provider) {
      case 'gigachat':
        return this.gigaChat.complete(messages, tools, model, forceText);
      case 'qwen':
        return this.qwen.complete(messages, tools, model, forceText);
      case 'qwen3':
        return this.qwen3.complete(messages, tools, model, forceText, thinking);
      case 'openai':
      default:
        return this.openAi.complete(messages, forceText ? [] : tools, model);
    }
  }

  completeJson(req: JsonCompletionRequest & { provider: LlmProvider }): Promise<JsonCompletionResult> {
    switch (req.provider) {
      case 'qwen3':
        return this.qwen3.completeJson(req);
      case 'gigachat':
        return this.gigaChat.completeJson(req);
      case 'openai':
        return this.openAi.completeJson(req);
      default:
        return this.jsonViaText(req);
    }
  }

  /** Запасной вариант: схема в системном сообщении, JSON — из текста ответа. */
  private async jsonViaText(req: JsonCompletionRequest & { provider: LlmProvider }): Promise<JsonCompletionResult> {
    const instruction = `Ответь только JSON-объектом по схеме:\n${JSON.stringify(req.schema)}`;
    const messages = [{ role: 'system' as const, content: instruction }, ...req.messages];
    const res = await this.complete({ provider: req.provider, messages, model: req.model, forceText: true });
    const raw = res.type === 'text' ? res.content : '';
    return { data: parseJsonObject(raw), raw, usage: res.usage };
  }
}
