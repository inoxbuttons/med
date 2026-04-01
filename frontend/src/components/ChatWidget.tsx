import { useState, useCallback } from 'react';
import {
  MainContainer,
  ChatContainer,
  MessageList,
  Message,
  MessageInput,
  TypingIndicator,
  ConversationHeader,
} from '@chatscope/chat-ui-kit-react';
import '@chatscope/chat-ui-kit-styles/dist/default/styles.min.css';

import type { ChatMessage, LlmProvider } from '../types/chat';
import { sendMessage } from '../services/api';

interface Props {
  sessionId: string;
  provider?: LlmProvider;
  model?: string;
  title?: string;
  placeholder?: string;
}

function makeId() {
  return Math.random().toString(36).slice(2);
}

export function ChatWidget({
  sessionId,
  provider = 'gigachat',
  model,
  title = 'AI Ассистент',
  placeholder = 'Напишите сообщение…',
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  const handleSend = useCallback(
    async (text: string) => {
      const userMsg: ChatMessage = {
        id: makeId(),
        text,
        sender: 'user',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsTyping(true);

      try {
        const data = await sendMessage(sessionId, text, provider, model);

        setMessages((prev) => [
          ...prev,
          {
            id: makeId(),
            text: data.reply,
            sender: 'assistant',
            timestamp: new Date(),
          },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: makeId(),
            text: 'Произошла ошибка. Попробуйте ещё раз.',
            sender: 'assistant',
            timestamp: new Date(),
          },
        ]);
      } finally {
        setIsTyping(false);
      }
    },
    [sessionId, provider, model],
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <MainContainer style={{ flex: 1 }}>
        <ChatContainer>
          <ConversationHeader>
            <ConversationHeader.Content userName={title} />
          </ConversationHeader>

          <MessageList
            typingIndicator={
              isTyping ? <TypingIndicator content="Печатает…" /> : null
            }
          >
            {messages.map((msg) => (
              <Message
                key={msg.id}
                model={{
                  message: msg.text,
                  sentTime: msg.timestamp.toLocaleTimeString(),
                  sender: msg.sender === 'user' ? 'Вы' : title,
                  direction: msg.sender === 'user' ? 'outgoing' : 'incoming',
                  position: 'single',
                }}
              />
            ))}
          </MessageList>

          <MessageInput
            placeholder={placeholder}
            onSend={handleSend}
            attachButton={false}
          />
        </ChatContainer>
      </MainContainer>
    </div>
  );
}
