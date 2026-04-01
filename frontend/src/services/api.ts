import type { LlmProvider } from '../types/chat';

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

export interface SendMessageResponse {
  sessionId: string;
  reply: string;
}

export async function sendMessage(
  sessionId: string,
  message: string,
  provider: LlmProvider,
  model?: string,
): Promise<SendMessageResponse> {
  const res = await fetch(`${BASE_URL}/chat/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, message, provider, model }),
  });

  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<SendMessageResponse>;
}
