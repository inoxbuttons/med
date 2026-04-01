import 'dotenv/config';
import { GenericScraper } from './scrapers/generic.scraper';
import { saveJson } from './utils/save';
import type { CollectedItem } from './types/collector';

// Список URL для сбора данных (можно вынести в конфиг или передавать через CLI)
const URLS = (process.env.TARGET_URLS ?? '')
  .split(',')
  .map((u) => u.trim())
  .filter(Boolean);

async function main() {
  if (URLS.length === 0) {
    console.log('No TARGET_URLS set. Add them to .env or pass via env variable.');
    console.log('Example: TARGET_URLS=https://example.com,https://example.org');
    process.exit(0);
  }

  console.log(`Starting collection for ${URLS.length} URL(s)…`);

  const scraper = new GenericScraper({
    headless: process.env.HEADLESS !== 'false',
    timeout: Number(process.env.TIMEOUT_MS ?? 30_000),
  });

  await scraper.init();

  try {
    const results = await scraper.scrapeMany(URLS);
    const successful = results
      .filter((r) => r.success && r.data)
      .map((r) => r.data as CollectedItem);

    const failed = results.filter((r) => !r.success);

    if (successful.length > 0) {
      const filename = `collected_${Date.now()}.json`;
      saveJson(filename, successful);
    }

    if (failed.length > 0) {
      console.warn(`Failed URLs (${failed.length}):`);
      failed.forEach((r) => console.warn(`  ${r.url} — ${r.error}`));
    }

    console.log(`Done. Success: ${successful.length}, Failed: ${failed.length}`);
  } finally {
    await scraper.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
