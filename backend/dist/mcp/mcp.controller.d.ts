import { McpService } from './mcp.service';
interface PromptDto {
    provider: 'openai' | 'gigachat';
    prompt: string;
    model?: string;
}
export declare class McpController {
    private readonly mcpService;
    constructor(mcpService: McpService);
    getInfo(): {
        name: string;
        version: string;
        providers: string[];
    };
    handlePrompt(dto: PromptDto): Promise<{
        provider: string;
        response: string;
    }>;
}
export {};
