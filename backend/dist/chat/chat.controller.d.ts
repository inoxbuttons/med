import { ChatService } from './chat.service';
import { SendMessageDto, SendMessageResponse, ChatMessage } from './chat.types';
export declare class ChatController {
    private readonly chatService;
    constructor(chatService: ChatService);
    sendMessage(dto: SendMessageDto): Promise<SendMessageResponse>;
    getHistory(sessionId: string): ChatMessage[];
    clearSession(sessionId: string): void;
}
