import { OnModuleInit } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { OpenAiService } from '../llm/openai.service';
import { GigaChatService } from '../llm/gigachat.service';
import { BookingService } from '../booking/booking.service';
export declare class McpService implements OnModuleInit {
    private readonly openAi;
    private readonly gigaChat;
    private readonly booking;
    private readonly logger;
    readonly server: McpServer;
    constructor(openAi: OpenAiService, gigaChat: GigaChatService, booking: BookingService);
    onModuleInit(): void;
    private registerTools;
    connectInMemory(): Promise<InMemoryTransport>;
}
