import { useMemo } from 'react';
import { ChatWidget } from './components/ChatWidget';
import type { LlmProvider } from './types/chat';

function getQueryParam(key: string): string | undefined {
  const params = new URLSearchParams(window.location.search);
  return params.get(key) ?? undefined;
}

function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function App() {
  const provider = (getQueryParam('provider') ?? 'gigachat') as LlmProvider;
  const model    = getQueryParam('model');
  const title    = getQueryParam('title') ?? 'AI Ассистент';

  // sessionId берётся из URL (?session=xxx) или генерируется один раз
  const sessionId = useMemo(
    () => getQueryParam('session') ?? generateSessionId(),
    [],
  );

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ChatWidget
        sessionId={sessionId}
        provider={provider}
        model={model}
        title={title}
      />
    </div>
  );
}
