import { LlmProvider } from '../../chat/chat.types';
import { LlmUsage } from '../../llm/llm.types';
import { LlmPort } from '../ports/llm.port';
import { MisKind } from '../ports';
import { PromptBuilder } from '../prompts/prompt-builder.service';
import { Frame } from './frame';
import { Expectation } from './rule-parser';
export interface NluContext {
    clinicNetId: number;
    mis: MisKind;
    provider: LlmProvider;
    model?: string;
    expectation: Expectation;
    stateSummary?: string;
    lastAssistant?: string;
    recentUser?: string[];
    now?: Date;
}
export interface NluResult {
    frame: Frame;
    source: 'rules' | 'llm' | 'fallback';
    usage?: LlmUsage;
    promptHash?: string;
}
export declare class NluService {
    private readonly llm;
    private readonly prompts;
    private readonly logger;
    constructor(llm: LlmPort, prompts: PromptBuilder);
    parse(text: string, ctx: NluContext): Promise<NluResult>;
}
export declare function buildUserMessage(text: string, ctx: NluContext): string;
