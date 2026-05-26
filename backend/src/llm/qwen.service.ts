import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { ChatMessage } from '../chat/chat.types';
import { CompletionResult, LlmTool, LlmUsage } from './llm.types';

/**
 * Qwen LLM через OpenAI-compatible endpoint Aliyun DashScope.
 * Использует тот же SDK openai с переопределённым baseURL.
 * Поддерживает function calling (tools) аналогично OpenAI.
 */
@Injectable()
export class QwenService {
  private readonly logger = new Logger(QwenService.name);
  private readonly client: OpenAI;
  private readonly defaultModel: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('QWEN_API_KEY');
    const baseURL = this.config.get<string>('QWEN_BASE_URL');
    this.client = new OpenAI({ apiKey, baseURL });
    this.defaultModel = this.config.get<string>('QWEN_MODEL', 'qwen-plus');
  }

  /** Простой чат без инструментов — для handleSymptomMessage и подобных мест. */
  async chat(messages: ChatMessage[], model?: string): Promise<string> {
    const result = await this.complete(messages, [], model);
    return result.type === 'text' ? result.content : '';
  }

  /**
   * Полный completion с tool-calling.
   * @param forceText — если true, не предлагаем инструменты (используется для финального текстового ответа,
   *                    например при confirmation_required и conflict-резолюции).
   */
  async complete(
    messages: ChatMessage[],
    tools: LlmTool[] = [],
    model?: string,
    forceText = false,
  ): Promise<CompletionResult> {
    const qwenMessages = messages.map((m) => {
      // function-роль конвертим в user-сообщение «Tool result for X: …», как и в openai.service.ts
      if (m.role === 'function') {
        return { role: 'user' as const, content: `[Tool result for ${m.name}]: ${m.content}` };
      }
      return { role: m.role as 'system' | 'user' | 'assistant', content: m.content };
    });

    const params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
      model: model ?? this.defaultModel,
      messages: qwenMessages,
    };

    if (tools.length > 0 && !forceText) {
      params.tools = tools.map((t) => ({
        type: 'function' as const,
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }));
      params.tool_choice = 'auto';
    }

    const response = await this.client.chat.completions.create(params);
    const choice = response.choices[0];
    const usage: LlmUsage | undefined = response.usage
      ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        }
      : undefined;

    if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls?.length) {
      const tc = choice.message.tool_calls[0].function;
      let args: Record<string, any> = {};
      try {
        args = JSON.parse(tc.arguments);
      } catch {
        this.logger.warn(`Failed to parse tool args: ${tc.arguments}`);
      }
      return { type: 'tool_call', toolName: tc.name, toolArgs: args, usage };
    }

    return { type: 'text', content: choice.message.content ?? '', usage };
  }
}
