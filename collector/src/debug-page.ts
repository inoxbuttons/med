import 'dotenv/config';
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function main() {
  const execPath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const browser = await chromium.launch({ headless: true, executablePath: execPath });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  await page.goto('https://med21vek.com/doctors/', { waitUntil: 'networkidle', timeout: 45_000 });

  // Дамп outerHTML первой карточки врача через нахождение <picture> с photo_expert
  const cardInfo = await page.evaluate(() => {
    const pictures = Array.from(document.querySelectorAll('picture'));
    const doctorPictures = pictures.filter((p) =>
      p.querySelector('img[alt="photo_expert"]') !== null,
    );

    if (doctorPictures.length === 0) return { found: 0, html: '', ancestors: [] };

    const pic = doctorPictures[0];

    // Показываем цепочку предков с классами
    const ancestors: string[] = [];
    let el: Element | null = pic;
    for (let i = 0; i < 8; i++) {
      if (!el) break;
      ancestors.push(`${el.tagName}[class="${el.getAttribute('class') ?? ''}"]`);
      el = el.parentElement;
    }

    // HTML контейнера на 3 уровня вверх
    let container: Element = pic;
    for (let i = 0; i < 3; i++) {
      if (container.parentElement) container = container.parentElement;
    }

    return {
      found: doctorPictures.length,
      html: container.outerHTML.slice(0, 3000),
      ancestors,
    };
  });

  console.log(`\nDoctor pictures found: ${cardInfo.found}`);
  console.log('\nAncestor chain (bottom → top):');
  cardInfo.ancestors.forEach((a, i) => console.log(`  ${'  '.repeat(i)}${a}`));
  console.log('\nCard HTML (3 levels up from picture):');
  console.log(cardInfo.html);

  // Сохраняем полный HTML карточки
  const outPath = path.resolve(__dirname, '../results/card-debug.html');
  fs.writeFileSync(outPath, cardInfo.html, 'utf-8');
  console.log(`\nSaved to: ${outPath}`);

  await browser.close();
}

main().catch(console.error);
