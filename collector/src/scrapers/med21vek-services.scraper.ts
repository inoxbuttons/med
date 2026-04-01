import { Page } from 'playwright';
import { BaseScraper } from './base.scraper';
import type { CollectedItem, ScraperOptions } from '../types/collector';

export interface ServiceItem {
  direction: string;
  service: string;
  price: string | null;
}

const BASE_URL = 'https://med21vek.com';
const DIRECTIONS_URL = `${BASE_URL}/directions/`;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class Med21VekServicesScraper extends BaseScraper {
  constructor(options: ScraperOptions = {}) {
    super({ waitFor: 'load', timeout: 45_000, ...options });
  }

  async collectAllServices(): Promise<ServiceItem[]> {
    const all: ServiceItem[] = [];

    const page = await this.newPage();

    // 1. Получаем список направлений с главной страницы
    console.log(`Loading directions page: ${DIRECTIONS_URL}`);
    await page.goto(DIRECTIONS_URL, { waitUntil: 'load', timeout: 45_000 });
    await page.waitForSelector('a[href*="/directions/service/"]', { timeout: 15_000 });

    const directions = await page.evaluate((base: string) => {
      // Дедупликация по href
      const seen = new Set<string>();
      return Array.from(
        document.querySelectorAll<HTMLAnchorElement>('a[href*="/directions/service/"]'),
      )
        .map((a) => ({
          name: a.textContent?.trim() ?? '',
          url: a.getAttribute('href')?.startsWith('http')
            ? a.getAttribute('href')!
            : base + a.getAttribute('href'),
        }))
        .filter((d) => {
          if (!d.name || seen.has(d.url ?? '')) return false;
          seen.add(d.url ?? '');
          return true;
        });
    }, BASE_URL);

    await page.close();

    console.log(`Found ${directions.length} directions\n`);

    // 2. Обходим каждое направление
    for (let i = 0; i < directions.length; i++) {
      const dir = directions[i];
      console.log(`[${i + 1}/${directions.length}] ${dir.name}`);

      let services: ServiceItem[] = [];
      let lastError = '';

      // Retry до 3 раз
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          services = await this.scrapServicePage(dir.url, dir.name);
          break;
        } catch (err) {
          lastError = err instanceof Error ? err.message : String(err);
          if (attempt < 3) {
            console.log(`  Retry ${attempt + 1}/3...`);
            await sleep(3_000);
          }
        }
      }

      if (services.length > 0) {
        console.log(`  → ${services.length} services`);
        all.push(...services);
      } else {
        console.warn(`  → Failed: ${lastError}`);
      }

      if (i < directions.length - 1) await sleep(1_500);
    }

    return all;
  }

  private async scrapServicePage(url: string, directionName: string): Promise<ServiceItem[]> {
    const page = await this.newPage();
    try {
      await page.goto(url, { waitUntil: 'load', timeout: 45_000 });
      await page.waitForSelector('.services__price-item', { timeout: 15_000 });
      await sleep(500);

      const items = await page.evaluate((direction: string) => {
        const results: Array<{ direction: string; service: string; price: string | null }> = [];
        const seen = new Set<string>(); // дедупликация (страница может иметь вкладки)

        document.querySelectorAll<HTMLElement>('.services__price-item').forEach((item) => {
          // Цена: из текста кнопки после "/ "
          const btn = item.querySelector<HTMLButtonElement>('button.make__appointment');
          const btnText = btn?.textContent?.trim() ?? '';
          const priceMatch = btnText.match(/\/\s*([\d\s,.]+[₽р]?)\s*$/);
          const price = priceMatch
            ? priceMatch[1].trim().replace(/\s+/g, ' ')
            : null;

          // Название услуги: весь текст item без текста кнопки
          const serviceText = (item.textContent ?? '')
            .replace(btnText, '')
            .replace(/\s+/g, ' ')
            .trim();

          if (!serviceText || serviceText.length < 3) return;

          const key = `${direction}::${serviceText}`;
          if (seen.has(key)) return;
          seen.add(key);

          results.push({ direction, service: serviceText, price });
        });

        return results;
      }, directionName);

      return items;
    } finally {
      await page.close();
    }
  }

  // Не используется напрямую, но требуется абстрактным классом
  protected async extract(_page: Page, url: string): Promise<CollectedItem> {
    return { url, collectedAt: new Date().toISOString() } as unknown as CollectedItem;
  }
}
