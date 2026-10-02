import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { ChatMessage } from '../chat/chat.types';
import { CompletionResult, LlmTool, LlmUsage } from './llm.types';

/**
 * Qwen3-235B-A22B через OpenAI-compatible endpoint cloud.ru Foundation Models.
 * Базовый URL: https://foundation-models.api.cloud.ru/v1/
 */
@Injectable()
export class Qwen3Service {
  private readonly logger = new Logger(Qwen3Service.name);
  private readonly client: OpenAI;
  private readonly defaultModel: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('QWEN3_API_KEY', '');
    const baseURL = this.config.get<string>('QWEN3_BASE_URL', 'https://foundation-models.api.cloud.ru/v1');
    this.client = new OpenAI({ apiKey, baseURL });
    this.defaultModel = this.config.get<string>('QWEN3_MODEL', 'qwen/qwen3-235b-a22b');
  }

  async complete(
    messages: ChatMessage[],
    tools: LlmTool[] = [],
    model?: string,
    forceText = false,
  ): Promise<CompletionResult> {
    const converted = messages.map((m) => {
      if (m.role === 'function') {
        return { role: 'user' as const, content: `[Tool result for ${m.name}]: ${m.content}` };
      }
      return { role: m.role as 'system' | 'user' | 'assistant', content: m.content };
    });

    const params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
      model: model ?? this.defaultModel,
      messages: converted,
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
