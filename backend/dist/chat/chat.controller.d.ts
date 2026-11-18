import { ChatService } from './chat.service';
import { SendMessageDto, SendMessageResponse, ChatMessage } from './chat.types';
export declare class ChatController {
    private readonly chatService;
    constructor(chatService: ChatService);
    sendMessage(dto: SendMessageDto): Promise<SendMessageResponse>;
    getHistory(sessionId: string): Promise<ChatMessage[]>;
    clearSession(sessionId: string): Promise<void>;
}
