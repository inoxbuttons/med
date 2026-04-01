import { chromium, Browser, BrowserContext } from 'playwright';
import type { ScraperOptions } from '../types/collector';

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const SYSTEM_CHROME_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // macOS
  '/usr/bin/google-chrome',                                        // Linux
  '/usr/bin/chromium-browser',                                     // Linux (Chromium)
];

function findSystemChrome(): string | undefined {
  const { existsSync } = require('fs') as typeof import('fs');
  return SYSTEM_CHROME_PATHS.find((p) => existsSync(p));
}

export async function createBrowser(options: ScraperOptions = {}): Promise<Browser> {
  const executablePath = process.env.CHROME_PATH ?? findSystemChrome();
  return chromium.launch({
    headless: options.headless ?? true,
    executablePath,
    proxy: options.proxy ? { server: options.proxy } : undefined,
  });
}

export async function createContext(
  browser: Browser,
  options: ScraperOptions = {},
): Promise<BrowserContext> {
  return browser.newContext({
    userAgent: options.userAgent ?? DEFAULT_USER_AGENT,
    ignoreHTTPSErrors: true,
    viewport: { width: 1280, height: 800 },
  });
}
