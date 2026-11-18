import { LlmProvider } from '../../chat/chat.types';
import { LlmUsage } from '../../llm/llm.types';
import { CatalogSearch } from '../catalog/catalog-search.service';
import { CatalogSourcePort, MisKind } from '../ports';
import { LlmPort } from '../ports/llm.port';
import { PromptBuilder, PromptTask } from '../prompts/prompt-builder.service';
export interface AnswerContext {
    clinicNetId: number;
    mis: MisKind;
    provider: LlmProvider;
    model?: string;
    recent: Array<{
        role: 'user' | 'assistant';
        content: string;
    }>;
}
export interface AnswerResult {
    text: string;
    usage: LlmUsage[];
    promptHash: string;
    task: PromptTask;
}
export declare class AnswerService {
    private readonly llm;
    private readonly prompts;
    private readonly search;
    private readonly logger;
    constructor(llm: LlmPort, prompts: PromptBuilder, search: CatalogSearch);
    answer(question: string, facts: string, ctx: AnswerContext): Promise<AnswerResult>;
    symptoms(complaint: string, speciality: string, ctx: AnswerContext): Promise<AnswerResult>;
    agent(question: string, catalog: CatalogSourcePort, ctx: AnswerContext): Promise<AnswerResult>;
    private runTool;
}
