/**
 * Переиндексация каталога сети.
 *   node dist/cli/catalog-reindex.js --net=2 [--embed]
 * --embed — посчитать эмбеддинги изменившихся документов (платно; нужен EMBEDDINGS_ENABLED=true).
 */
import { Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MisRegistry } from '../adapters/mis/mis-registry.service';
import { CatalogIndexer } from '../core/catalog/catalog-indexer.service';
import { CatalogModule } from '../core/catalog/catalog.module';
import { CoreModule } from '../core/core.module';
import { DatabaseModule } from '../database';

@Module({ imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule, CoreModule, CatalogModule] })
class CliModule {}

async function main() {
  const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}`));
  const net = Number(arg('net')?.split('=')[1]);
  if (!net) throw new Error('Укажите --net=<clinicNetId>');
  process.env.CATALOG_REINDEX_ON_BOOT = 'false';
  const app = await NestFactory.createApplicationContext(CliModule, { logger: ['log', 'warn', 'error'] });
  try {
    const { catalog } = await app.get(MisRegistry).forNet(net);
    const stats = await app.get(CatalogIndexer).reindex(catalog, { embed: !!arg('embed') });
    console.log(JSON.stringify(stats));
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  Logger.error(String(err));
  process.exit(1);
});
