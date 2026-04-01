import { Page } from 'playwright';
import { BaseScraper } from './base.scraper';
import type { CollectedItem, ScraperOptions } from '../types/collector';

export interface DoctorItem {
  name: string;
  specialization: string;
  locations: string[];
  price: string | null;
  profileUrl: string;
  collectedAt: string;
}

const BASE_URL = 'https://med21vek.com/doctors/';
const TOTAL_PAGES = 5;
const DELAY_BETWEEN_PAGES_MS = 2_000;
const MAX_RETRIES = 3;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class Med21VekScraper extends BaseScraper {
  constructor(options: ScraperOptions = {}) {
    // load + waitForSelector быстрее и надёжнее networkidle
    super({ waitFor: 'load', timeout: 45_000, ...options });
  }

  async collectAllDoctors(): Promise<DoctorItem[]> {
    const all: DoctorItem[] = [];

    for (let pageNum = 1; pageNum <= TOTAL_PAGES; pageNum++) {
      const url =
        pageNum === 1 ? BASE_URL : `${BASE_URL}page/${pageNum}/`;

      console.log(`\n[${pageNum}/${TOTAL_PAGES}] Scraping: ${url}`);

      // Retry при сетевых ошибках
      let result = await this.scrapeOne(url);
      for (let attempt = 2; !result.success && attempt <= MAX_RETRIES; attempt++) {
        console.log(`  Retry ${attempt}/${MAX_RETRIES}...`);
        await sleep(3_000);
        result = await this.scrapeOne(url);
      }

      if (result.success && result.data) {
        const doctors = result.data['doctors'] as DoctorItem[];
        console.log(`  Found ${doctors.length} doctors`);
        all.push(...doctors);
      } else {
        console.error(`  Failed after ${MAX_RETRIES} attempts: ${result.error}`);
      }

      // Пауза между страницами чтобы не перегружать сервер
      if (pageNum < TOTAL_PAGES) {
        await sleep(DELAY_BETWEEN_PAGES_MS);
      }
    }

    return all;
  }

  protected async extract(page: Page, url: string): Promise<CollectedItem> {
    // Ждём первую карточку после загрузки страницы
    await page.waitForSelector('.our__experts-content', { timeout: 20_000 });
    // Небольшая пауза — цена может догружаться динамически
    await sleep(1_500);

    const doctors = await page.evaluate(() => {
      const cards = Array.from(
        document.querySelectorAll<HTMLElement>('.our__experts-content'),
      );

      return cards.map((card) => {
        // Имя и ссылка на профиль
        const nameEl = card.querySelector<HTMLAnchorElement>('a.our__experts-name');
        const name = nameEl?.textContent?.trim() ?? '';
        const profileUrl = nameEl?.getAttribute('href') ?? '';

        // Специализация
        const specialization =
          card.querySelector('.our__experts-position')?.textContent?.trim() ?? '';

        // Места приёма — только текстовые ноды (пропускаем SVG-иконки)
        const locationEls = Array.from(
          card.querySelectorAll<HTMLElement>('.our__experts-place'),
        );
        const locations = locationEls
          .map((el) => {
            let text = '';
            el.childNodes.forEach((node) => {
              if (node.nodeType === Node.TEXT_NODE) {
                text += node.textContent ?? '';
              }
            });
            return text.trim();
          })
          .filter((t) => t.length > 0);

        // Цена: сначала data-price на кнопке, затем текст .our__experts-cost
        const signupBtn = card.querySelector<HTMLButtonElement>('button.signup');
        const dataPrice = signupBtn?.getAttribute('data-price')?.trim() ?? '';
        const costText =
          card.querySelector('.our__experts-cost')?.textContent?.trim() ?? '';

        let price: string | null = null;
        if (dataPrice) {
          price = `${dataPrice} ₽`;
        } else if (costText && costText !== '') {
          price = costText;
        }

        return { name, specialization, locations, price, profileUrl };
      }).filter((d) => d.name.length > 0);
    });

    const now = new Date().toISOString();
    return {
      url,
      doctors: doctors.map((d) => ({ ...d, collectedAt: now })),
      collectedAt: now,
    } as unknown as CollectedItem;
  }
}
