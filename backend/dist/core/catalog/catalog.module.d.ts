import { OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MisRegistry } from '../../adapters/mis/mis-registry.service';
import { CatalogIndexer } from './catalog-indexer.service';
export declare class CatalogBootstrap implements OnApplicationBootstrap {
    private readonly db;
    private readonly mis;
    private readonly indexer;
    private readonly logger;
    constructor(db: DataSource, mis: MisRegistry, indexer: CatalogIndexer);
    onApplicationBootstrap(): void;
    private run;
}
export declare class CatalogModule {
}
