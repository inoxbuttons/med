export interface CollectedItem {
  url: string;
  title?: string;
  text?: string;
  html?: string;
  meta?: Record<string, string>;
  links?: string[];
  collectedAt: string;
  [key: string]: unknown;
}

export interface ScraperOptions {
  headless?: boolean;
  timeout?: number;
  waitFor?: 'load' | 'domcontentloaded' | 'networkidle';
  userAgent?: string;
  proxy?: string;
}

export interface ScraperResult {
  success: boolean;
  url: string;
  data?: CollectedItem;
  error?: string;
}
