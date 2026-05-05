import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { ChatMessage } from '../chat/chat.types';
import { CompletionResult, LlmTool, LlmUsage } from './llm.types';

@Injectable()
export class OpenAiService {
  private readonly logger = new Logger(OpenAiService.name);
  private readonly client: OpenAI;

  constructor(private readonly config: ConfigService) {
    this.client = new OpenAI({
      apiKey: this.config.get<string>('OPENAI_API_KEY'),
    });
  }

  /** Simple chat without tools (backward-compatible) */
  async chat(messages: ChatMessage[], model = 'gpt-4o-mini'): Promise<string> {
    const result = await this.complete(messages, [], model);
    return result.type === 'text' ? result.content : '';
  }

  /** Full completion — supports tool calling */
  async complete(
    messages: ChatMessage[],
    tools: LlmTool[] = [],
    model = 'gpt-4o-mini',
  ): Promise<CompletionResult> {
    const openaiMessages = messages.map((m) => {
      // Convert GigaChat-style function messages to OpenAI tool messages
      if (m.role === 'function') {
        return { role: 'user' as const, content: `[Tool result for ${m.name}]: ${m.content}` };
      }
      return { role: m.role as 'system' | 'user' | 'assistant', content: m.content };
    });

    const params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
      model,
      messages: openaiMessages,
    };

    if (tools.length > 0) {
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
