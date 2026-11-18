"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const mis_registry_service_1 = require("../adapters/mis/mis-registry.service");
const catalog_indexer_service_1 = require("../core/catalog/catalog-indexer.service");
const catalog_module_1 = require("../core/catalog/catalog.module");
const core_module_1 = require("../core/core.module");
const database_1 = require("../database");
let CliModule = class CliModule {
};
CliModule = __decorate([
    (0, common_1.Module)({ imports: [config_1.ConfigModule.forRoot({ isGlobal: true }), database_1.DatabaseModule, core_module_1.CoreModule, catalog_module_1.CatalogModule] })
], CliModule);
async function main() {
    const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}`));
    const net = Number(arg('net')?.split('=')[1]);
    if (!net)
        throw new Error('Укажите --net=<clinicNetId>');
    process.env.CATALOG_REINDEX_ON_BOOT = 'false';
    const app = await core_1.NestFactory.createApplicationContext(CliModule, { logger: ['log', 'warn', 'error'] });
    try {
        const { catalog } = await app.get(mis_registry_service_1.MisRegistry).forNet(net);
        const stats = await app.get(catalog_indexer_service_1.CatalogIndexer).reindex(catalog, { embed: !!arg('embed') });
        console.log(JSON.stringify(stats));
    }
    finally {
        await app.close();
    }
}
main().catch((err) => {
    common_1.Logger.error(String(err));
    process.exit(1);
});
//# sourceMappingURL=catalog-reindex.js.map