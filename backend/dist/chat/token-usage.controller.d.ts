import { Repository } from 'typeorm';
import { TokenUsage } from '../database/entities/token-usage.entity';
interface MonthlyUsageRow {
    clinicNetId: number | null;
    clinicNetName: string | null;
    month: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    calls: number;
}
export declare class TokenUsageController {
    private readonly repo;
    constructor(repo: Repository<TokenUsage>);
    getUsage(year?: string, month?: string, clinicNetId?: string): Promise<MonthlyUsageRow[]>;
}
export {};
