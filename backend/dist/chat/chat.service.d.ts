import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAiService } from '../llm/openai.service';
import { GigaChatService } from '../llm/gigachat.service';
import { BookingService } from '../booking/booking.service';
import { ChatMessage, SendMessageDto, SendMessageResponse } from './chat.types';
export declare class ChatService implements OnModuleInit {
    private readonly config;
    private readonly openAi;
    private readonly gigaChat;
    private readonly booking;
    private readonly logger;
    private readonly sessions;
    private readonly systemPrompt;
    private readonly SESSION_TTL_MS;
    constructor(config: ConfigService, openAi: OpenAiService, gigaChat: GigaChatService, booking: BookingService);
    onModuleInit(): void;
    sendMessage(dto: SendMessageDto): Promise<SendMessageResponse>;
    private handleSymptomMessage;
    private runToolLoop;
    getHistory(sessionId: string): ChatMessage[];
    clearSession(sessionId: string): void;
    private getOrCreateSession;
    private trimMessages;
    private cleanExpiredSessions;
}
