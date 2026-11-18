import type { LlmProvider } from '../types/chat';

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

export interface QuickReply {
  label: string;
  /** Уходит на сервер вместо подписи: "choice:2", "yes", "no" (движок pipeline). */
  payload?: string;
}

export interface SendMessageResponse {
  sessionId: string;
  reply: string;
  quickReplies?: QuickReply[];
}

export async function sendMessage(
  sessionId: string,
  message: string,
  provider: LlmProvider,
  model?: string,
  payload?: string,
): Promise<SendMessageResponse> {
  const res = await fetch(`${BASE_URL}/chat/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, message, provider, model, payload }),
  });

  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<SendMessageResponse>;
}
