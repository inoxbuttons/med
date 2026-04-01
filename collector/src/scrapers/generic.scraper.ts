import { Page } from 'playwright';
import { BaseScraper } from './base.scraper';
import type { CollectedItem } from '../types/collector';

/**
 * Универсальный скрапер — собирает заголовок, текст, мета-теги и ссылки
 * с любой страницы. Используй как основу или расширяй для конкретных сайтов.
 */
export class GenericScraper extends BaseScraper {
  protected async extract(page: Page, url: string): Promise<CollectedItem> {
    const title = await page.title();

    const text = await page.evaluate(() =>
      document.body.innerText.replace(/\s+/g, ' ').trim(),
    );

    const meta = await page.evaluate(() => {
      const result: Record<string, string> = {};
      document.querySelectorAll('meta[name], meta[property]').forEach((el) => {
        const key =
          el.getAttribute('name') ?? el.getAttribute('property') ?? '';
        const value = el.getAttribute('content') ?? '';
        if (key && value) result[key] = value;
      });
      return result;
    });

    const links = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a[href]'))
        .map((a) => (a as HTMLAnchorElement).href)
        .filter((href) => href.startsWith('http')),
    );

    return {
      url,
      title,
      text: text.slice(0, 10_000), // обрезаем до 10k символов
      meta,
      links: [...new Set(links)],
      collectedAt: new Date().toISOString(),
    };
  }
}
