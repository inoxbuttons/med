import { OnModuleInit } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { OpenAiService } from '../llm/openai.service';
import { GigaChatService } from '../llm/gigachat.service';
import { MisRegistry } from '../adapters/mis/mis-registry.service';
export declare class McpService implements OnModuleInit {
    private readonly openAi;
    private readonly gigaChat;
    private readonly mis;
    private readonly logger;
    readonly server: McpServer;
    constructor(openAi: OpenAiService, gigaChat: GigaChatService, mis: MisRegistry);
    onModuleInit(): void;
    private registerTools;
    private text;
    connectInMemory(): Promise<InMemoryTransport>;
}
