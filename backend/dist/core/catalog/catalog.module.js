"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var CatalogBootstrap_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CatalogModule = exports.CatalogBootstrap = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const cloudru_embeddings_service_1 = require("../../adapters/embeddings/cloudru-embeddings.service");
const mis_adapters_module_1 = require("../../adapters/mis/mis-adapters.module");
const mis_registry_service_1 = require("../../adapters/mis/mis-registry.service");
const token_usage_entity_1 = require("../../database/entities/token-usage.entity");
const catalog_indexer_service_1 = require("./catalog-indexer.service");
const catalog_search_service_1 = require("./catalog-search.service");
let CatalogBootstrap = CatalogBootstrap_1 = class CatalogBootstrap {
    constructor(db, mis, indexer) {
        this.db = db;
        this.mis = mis;
        this.indexer = indexer;
        this.logger = new common_1.Logger(CatalogBootstrap_1.name);
    }
    onApplicationBootstrap() {
        if (process.env.CATALOG_REINDEX_ON_BOOT === 'false')
            return;
        void this.run();
    }
    async run() {
        try {
            const nets = await this.db.query(`SELECT id FROM clinic_nets WHERE mis IS NULL OR mis = '' ORDER BY id`);
            for (const { id } of nets) {
                const { catalog } = await this.mis.forNet(id);
                await this.indexer.reindex(catalog, { embed: true });
            }
        }
        catch (err) {
            this.logger.error(`Индексация каталога при старте: ${String(err)}`);
        }
    }
};
exports.CatalogBootstrap = CatalogBootstrap;
exports.CatalogBootstrap = CatalogBootstrap = CatalogBootstrap_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [typeorm_2.DataSource,
        mis_registry_service_1.MisRegistry,
        catalog_indexer_service_1.CatalogIndexer])
], CatalogBootstrap);
let CatalogModule = class CatalogModule {
};
exports.CatalogModule = CatalogModule;
exports.CatalogModule = CatalogModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([token_usage_entity_1.TokenUsage]), mis_adapters_module_1.MisAdaptersModule],
        providers: [
            cloudru_embeddings_service_1.CloudRuEmbeddingsService,
            { provide: catalog_indexer_service_1.EMBEDDING_PORT, useExisting: cloudru_embeddings_service_1.CloudRuEmbeddingsService },
            catalog_indexer_service_1.CatalogIndexer,
            catalog_search_service_1.CatalogSearch,
            CatalogBootstrap,
        ],
        exports: [catalog_indexer_service_1.CatalogIndexer, catalog_search_service_1.CatalogSearch, catalog_indexer_service_1.EMBEDDING_PORT],
    })
], CatalogModule);
//# sourceMappingURL=catalog.module.js.map