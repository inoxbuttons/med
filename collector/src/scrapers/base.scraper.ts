import { Browser, BrowserContext, Page } from 'playwright';
import { createBrowser, createContext } from '../utils/browser';
import type { CollectedItem, ScraperOptions, ScraperResult } from '../types/collector';

export abstract class BaseScraper {
  protected browser: Browser | null = null;
  protected context: BrowserContext | null = null;

  constructor(protected readonly options: ScraperOptions = {}) {}

  async init(): Promise<void> {
    this.browser = await createBrowser(this.options);
    this.context = await createContext(this.browser, this.options);
  }

  async close(): Promise<void> {
    await this.context?.close();
    await this.browser?.close();
  }

  protected async newPage(): Promise<Page> {
    if (!this.context) throw new Error('Scraper not initialized. Call init() first.');
    const page = await this.context.newPage();
    page.setDefaultTimeout(this.options.timeout ?? 30_000);
    return page;
  }

  async scrapeOne(url: string): Promise<ScraperResult> {
    const page = await this.newPage();
    try {
      await page.goto(url, {
        waitUntil: this.options.waitFor ?? 'domcontentloaded',
      });
      const data = await this.extract(page, url);
      return { success: true, url, data };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error(`Failed to scrape ${url}: ${error}`);
      return { success: false, url, error };
    } finally {
      await page.close();
    }
  }

  async scrapeMany(urls: string[]): Promise<ScraperResult[]> {
    const results: ScraperResult[] = [];
    for (const url of urls) {
      const result = await this.scrapeOne(url);
      results.push(result);
    }
    return results;
  }

  protected abstract extract(page: Page, url: string): Promise<CollectedItem>;
}
