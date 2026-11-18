import { MisKind } from '../ports';
import { ClinicProfileService } from '../profile/clinic-profile.service';
export type PromptTask = 'legacy' | 'nlu' | 'answer' | 'symptoms' | 'agent';
export interface BuiltPrompt {
    text: string;
    hash: string;
    layers: string[];
}
export declare class PromptBuilder {
    private readonly profiles;
    private readonly root;
    private readonly logger;
    private readonly cache;
    constructor(profiles: ClinicProfileService, root?: string);
    build(task: PromptTask, target: {
        clinicNetId?: number | null;
        mis?: MisKind;
    }, vars?: Record<string, string | number>, opts?: {
        coreOverride?: string;
    }): BuiltPrompt;
    clearCache(): void;
    private read;
}
