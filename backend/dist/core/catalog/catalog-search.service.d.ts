import { DataSource } from 'typeorm';
import { EmbeddingPort } from '../ports/embedding.port';
import { ClinicProfileService } from '../profile/clinic-profile.service';
import { CatalogKind } from './catalog-indexer.service';
export interface SearchHit {
    kind: CatalogKind;
    entityId: string;
    title: string;
    score: number;
    ranks: {
        fts: number | null;
        trgm: number | null;
        vector: number | null;
    };
    trgm: number;
    coverage: number;
    vecSim: number | null;
    prefix: boolean;
    meta: Record<string, any>;
}
export interface SearchOptions {
    kinds: CatalogKind[];
    clinicId?: number;
    limit?: number;
    noVector?: boolean;
}
export type SearchDecision = {
    kind: 'single';
    hit: SearchHit;
    hits: SearchHit[];
} | {
    kind: 'choice';
    hits: SearchHit[];
} | {
    kind: 'none';
    hits: [];
};
export declare function relevantHits(hits: SearchHit[]): SearchHit[];
export declare function decide(query: string, hits: SearchHit[], maxChoice?: number): SearchDecision;
export declare class CatalogSearch {
    private readonly db;
    private readonly profiles;
    private readonly embeddings;
    private readonly logger;
    constructor(db: DataSource, profiles: ClinicProfileService, embeddings: EmbeddingPort);
    hasIndex(clinicNetId: number, kind?: CatalogKind): Promise<boolean>;
    search(clinicNetId: number, query: string, opts: SearchOptions): Promise<SearchHit[]>;
    searchAndDecide(clinicNetId: number, query: string, opts: SearchOptions): Promise<SearchDecision>;
}
