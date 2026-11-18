export interface EmbeddingPort {
    readonly enabled: boolean;
    readonly model: string;
    readonly dimensions: number;
    embed(texts: string[], purpose: 'document' | 'query'): Promise<number[][]>;
}
