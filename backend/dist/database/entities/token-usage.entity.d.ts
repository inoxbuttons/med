import { ClinicNet } from './clinic-net.entity';
export declare class TokenUsage {
    id: number;
    clinicNetId: number | null;
    clinicNet: ClinicNet;
    sessionId: string;
    provider: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    createdAt: Date;
}
