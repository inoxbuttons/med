import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Med21VekScraper } from './scrapers/med21vek.scraper';

const OUTPUT_DIR = path.resolve(__dirname, '../results');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'doctors.json');

async function main() {
  console.log('=== med21vek.com — сбор данных о врачах ===');

  const scraper = new Med21VekScraper({
    headless: process.env.HEADLESS !== 'false',
    timeout: 45_000,
  });

  await scraper.init();

  try {
    const doctors = await scraper.collectAllDoctors();

    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(doctors, null, 2), 'utf-8');

    console.log('\n=== Готово ===');
    console.log(`Всего врачей: ${doctors.length}`);
    console.log(`Файл сохранён: ${OUTPUT_FILE}`);

    // Краткая статистика
    const withPrice = doctors.filter((d) => d.price !== null).length;
    const withLocation = doctors.filter((d) => d.locations.length > 0).length;
    console.log(`С ценой: ${withPrice} / ${doctors.length}`);
    console.log(`С местом приёма: ${withLocation} / ${doctors.length}`);

    // Пример первых 3 записей
    console.log('\nПримеры:');
    doctors.slice(0, 3).forEach((d, i) => {
      console.log(`\n[${i + 1}] ${d.name}`);
      console.log(`    Специализация: ${d.specialization}`);
      console.log(`    Места: ${d.locations.join(', ') || '—'}`);
      console.log(`    Цена: ${d.price ?? '—'}`);
    });
  } finally {
    await scraper.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
