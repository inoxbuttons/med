import 'dotenv/config';
import { chromium } from 'playwright';

const execPath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: execPath });
  const page = await browser.newPage();

  const url = 'https://med21vek.com/directions/service/travmatolog-ortoped';
  console.log(`Checking: ${url}`);
  await page.goto(url, { waitUntil: 'load', timeout: 45_000 });
  await new Promise((r) => setTimeout(r, 2000));

  const info = await page.evaluate(() => {
    // Все классы с price/service/cost
    const relevantClasses = new Set<string>();
    document.querySelectorAll('[class]').forEach((el) =>
      el.classList.forEach((c) => {
        if (/price|service|cost|table|row|item|list/i.test(c)) relevantClasses.add(c);
      }),
    );

    // Элементы содержащие ₽
    const priceEls = Array.from(document.querySelectorAll('*'))
      .filter(
        (el) =>
          /[₽р]/.test((el as HTMLElement).innerText ?? '') &&
          (el as HTMLElement).children.length < 4,
      )
      .slice(0, 8)
      .map((el) => ({
        tag: el.tagName,
        class: el.getAttribute('class'),
        text: (el as HTMLElement).innerText?.replace(/\s+/g, ' ').slice(0, 120),
        parentClass: el.parentElement?.getAttribute('class'),
      }));

    // <table> если есть
    const tables = Array.from(document.querySelectorAll('table')).slice(0, 2).map((t) => ({
      class: t.getAttribute('class'),
      rows: Array.from(t.querySelectorAll('tr'))
        .slice(0, 5)
        .map((tr) => tr.innerText.replace(/\s+/g, ' ').slice(0, 100)),
    }));

    return { relevantClasses: [...relevantClasses].sort(), priceEls, tables };
  });

  console.log('\nRelevant classes:', info.relevantClasses);
  console.log('\nPrice elements:', JSON.stringify(info.priceEls, null, 2));
  console.log('\nTables:', JSON.stringify(info.tables, null, 2));

  await browser.close();
}

main().catch(console.error);
