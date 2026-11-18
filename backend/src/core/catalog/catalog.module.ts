import { Injectable, Logger, Module, OnApplicationBootstrap } from '@nestjs/common';
import { InjectDataSource, TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CloudRuEmbeddingsService } from '../../adapters/embeddings/cloudru-embeddings.service';
import { MisAdaptersModule } from '../../adapters/mis/mis-adapters.module';
import { MisRegistry } from '../../adapters/mis/mis-registry.service';
import { TokenUsage } from '../../database/entities/token-usage.entity';
import { CatalogIndexer, EMBEDDING_PORT } from './catalog-indexer.service';
import { CatalogSearch } from './catalog-search.service';

/**
 * При старте переиндексирует сети с локальной БД (каталог в нашей базе — дёшево).
 * Эмбеддинги считаются только для изменившихся документов и только при EMBEDDINGS_ENABLED=true.
 * Сети с внешней МИС индексируются командой: node dist/cli/catalog-reindex.js --net=<id>.
 */
@Injectable()
export class CatalogBootstrap implements OnApplicationBootstrap {
  private readonly logger = new Logger(CatalogBootstrap.name);

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly mis: MisRegistry,
    private readonly indexer: CatalogIndexer,
  ) {}

  onApplicationBootstrap() {
    if (process.env.CATALOG_REINDEX_ON_BOOT === 'false') return;
    void this.run();
  }

  private async run() {
    try {
      const nets: Array<{ id: number }> = await this.db.query(`SELECT id FROM clinic_nets WHERE mis IS NULL OR mis = '' ORDER BY id`);
      for (const { id } of nets) {
        const { catalog } = await this.mis.forNet(id);
        await this.indexer.reindex(catalog, { embed: true });
      }
    } catch (err) {
      this.logger.error(`Индексация каталога при старте: ${String(err)}`);
    }
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([TokenUsage]), MisAdaptersModule],
  providers: [
    CloudRuEmbeddingsService,
    { provide: EMBEDDING_PORT, useExisting: CloudRuEmbeddingsService },
    CatalogIndexer,
    CatalogSearch,
    CatalogBootstrap,
  ],
  exports: [CatalogIndexer, CatalogSearch, EMBEDDING_PORT],
})
export class CatalogModule {}
