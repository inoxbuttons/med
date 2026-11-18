import { DataSource } from 'typeorm';
import { Doctor, Service } from '../domain';
import { CatalogSourcePort } from '../ports';
import { EmbeddingPort } from '../ports/embedding.port';
import { ClinicProfileService } from '../profile/clinic-profile.service';
export declare const EMBEDDING_PORT: unique symbol;
export type CatalogKind = 'service' | 'speciality' | 'doctor';
export interface IndexDoc {
    kind: CatalogKind;
    entityId: string;
    title: string;
    searchText: string;
    meta: Record<string, unknown>;
}
export interface ReindexStats {
    clinicNetId: number;
    total: number;
    upserted: number;
    deleted: number;
    embedded: number;
}
export declare function buildIndexDocs(services: Service[], doctors: Doctor[], synonyms: Record<string, string[]>): IndexDoc[];
export declare function contentHash(doc: IndexDoc): string;
export declare class CatalogIndexer {
    private readonly db;
    private readonly profiles;
    private readonly embeddings;
    private readonly logger;
    constructor(db: DataSource, profiles: ClinicProfileService, embeddings: EmbeddingPort);
    reindex(catalog: CatalogSourcePort, opts?: {
        embed?: boolean;
    }): Promise<ReindexStats>;
}
export declare function toVectorLiteral(v: number[]): string;
