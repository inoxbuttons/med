import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatMessage } from '../chat/chat.types';
import { CompletionResult, JsonCompletionRequest, JsonCompletionResult, LlmTool, LlmUsage } from './llm.types';

interface GigaChatTokenResponse {
  access_token: string;
  expires_at: number;
}

interface GigaChatMessage {
  role: string;
  content: string;
  name?: string;
  function_call?: { name: string; arguments: string };
  functions_state_id?: string;
}

interface GigaChatCompletionResponse {
  choices: Array<{
    message: GigaChatMessage;
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

@Injectable()
export class GigaChatService {
  private readonly logger = new Logger(GigaChatService.name);
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  private readonly authUrl =
    'https://ngw.devices.sberbank.ru:9443/api/v2/oauth';
  private readonly apiUrl =
    'https://gigachat.devices.sberbank.ru/api/v1/chat/completions';

  constructor(private readonly config: ConfigService) {}

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.accessToken && now < this.tokenExpiresAt - 60_000) {
      return this.accessToken;
    }

    const credentials = this.config.get<string>('GIGACHAT_CREDENTIALS');
    const scope =
      this.config.get<string>('GIGACHAT_SCOPE') ?? 'GIGACHAT_API_PERS';

    const response = await fetch(this.authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        Authorization: `Basic ${credentials}`,
        RqUID: crypto.randomUUID(),
      },
      body: new URLSearchParams({ scope }),
    });

    if (!response.ok) {
      throw new Error(`GigaChat auth failed: ${response.statusText}`);
    }

    const data: GigaChatTokenResponse = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiresAt = data.expires_at;
    return this.accessToken;
  }

  /** Simple chat without tools (backward-compatible) */
  async chat(messages: ChatMessage[], model = 'GigaChat-Pro'): Promise<string> {
    const result = await this.complete(messages, [], model);
    return result.type === 'text' ? result.content : '';
  }

  /** Full completion — supports function calling */
  async complete(
    messages: ChatMessage[],
    tools: LlmTool[] = [],
    model = 'GigaChat-Pro',
    forceText = false,
  ): Promise<CompletionResult> {
    const token = await this.getAccessToken();

    // GigaChat expects function_call.arguments as an object, not a JSON string
    const gigaChatMessages = messages.map((m) => {
      if (m.role === 'assistant' && m.function_call) {
        let args: Record<string, any>;
        try {
          args = typeof m.function_call.arguments === 'string'
            ? JSON.parse(m.function_call.arguments)
            : (m.function_call.arguments as unknown as Record<string, any>);
        } catch {
          args = {};
        }
        return { ...m, function_call: { ...m.function_call, arguments: args } };
      }
      return m;
    });

    const body: Record<string, any> = { model, messages: gigaChatMessages };
    if (tools.length > 0) {
      body.functions = tools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      }));
      body.function_call = forceText ? 'none' : 'auto';
    }

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
      throw new Error(`GigaChat request failed: ${response.status} ${text}`);
    }

    const data: GigaChatCompletionResponse = await response.json();
    const usage: LlmUsage | undefined = data.usage
      ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        }
      : undefined;

    if (usage) {
      this.logger.debug(
        `Tokens — prompt: ${usage.promptTokens}, completion: ${usage.completionTokens}, total: ${usage.totalTokens}`,
      );
    }

    const choice = data.choices[0];

    if (choice.finish_reason === 'function_call' && choice.message.function_call) {
      let args: Record<string, any> = {};
      try {
        args = typeof choice.message.function_call.arguments === 'string'
          ? JSON.parse(choice.message.function_call.arguments)
          : (choice.message.function_call.arguments as unknown as Record<string, any>);
      } catch {
        this.logger.warn(`Failed to parse function args: ${choice.message.function_call.arguments}`);
      }
      return {
        type: 'tool_call',
        toolName: choice.message.function_call.name,
        toolArgs: args,
        functionsStateId: choice.message.functions_state_id,
        usage,
      };
    }

    return { type: 'text', content: choice.message.content, usage };
  }

  /**
   * Ответ по JSON-схеме через принудительный вызов функции: у GigaChat нет response_format,
   * но аргументы function_call — это JSON по схеме parameters.
   */
  async completeJson(req: JsonCompletionRequest): Promise<JsonCompletionResult> {
    const token = await this.getAccessToken();
    const body = {
      model: req.model ?? 'GigaChat-Pro',
      temperature: 0.01,
      messages: req.messages.filter((m) => m.role !== 'function').map((m) => ({ role: m.role, content: m.content })),
      functions: [{ name: req.schemaName, description: req.description ?? req.schemaName, parameters: req.schema }],
      function_call: { name: req.schemaName },
    };
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
      throw new Error(`GigaChat request failed: ${response.status} ${text}`);
    }
    const data: GigaChatCompletionResponse = await response.json();
    const usage: LlmUsage | undefined = data.usage
      ? { promptTokens: data.usage.prompt_tokens, completionTokens: data.usage.completion_tokens, totalTokens: data.usage.total_tokens }
      : undefined;
    const fc = data.choices[0]?.message?.function_call;
    if (!fc) return { data: null, raw: data.choices[0]?.message?.content ?? '', usage };
    const args = typeof fc.arguments === 'string' ? safeParse(fc.arguments) : (fc.arguments as unknown);
    return { data: args, raw: typeof fc.arguments === 'string' ? fc.arguments : JSON.stringify(fc.arguments), usage };
  }
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
