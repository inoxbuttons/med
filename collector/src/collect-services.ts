import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Med21VekServicesScraper } from './scrapers/med21vek-services.scraper';

const OUTPUT_DIR = path.resolve(__dirname, '../results');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'services.json');

async function main() {
  console.log('=== med21vek.com — сбор услуг и цен ===\n');

  const scraper = new Med21VekServicesScraper({
    headless: process.env.HEADLESS !== 'false',
    timeout: 45_000,
  });

  await scraper.init();

  try {
    const services = await scraper.collectAllServices();

    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(services, null, 2), 'utf-8');

    console.log('\n=== Готово ===');
    console.log(`Всего услуг: ${services.length}`);
    console.log(`Файл сохранён: ${OUTPUT_FILE}`);

    const withPrice = services.filter((s) => s.price !== null).length;
    const directions = [...new Set(services.map((s) => s.direction))];
    console.log(`С ценой: ${withPrice} / ${services.length}`);
    console.log(`Направлений: ${directions.length}`);

    console.log('\nПримеры:');
    services.slice(0, 5).forEach((s, i) => {
      console.log(`\n[${i + 1}] Направление: ${s.direction}`);
      console.log(`    Услуга:      ${s.service.slice(0, 80)}${s.service.length > 80 ? '…' : ''}`);
      console.log(`    Цена:        ${s.price ?? '—'}`);
    });
  } finally {
    await scraper.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
