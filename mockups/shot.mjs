// Скриншоты макетов как на iPhone: node shot.mjs a-neon
import { createRequire } from 'node:module';
const { firefox } = createRequire('/root/My-Site/package.json')('@playwright/test');
const names = process.argv.slice(2);
const browser = await firefox.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
for (const name of names) {
  for (const [suffix, query] of [['', ''], ['-picker', '?picker']]) {
    await page.goto(`http://localhost:8091/mockups/${name}.html${query}`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `shots/${name}${suffix}.png` });
  }
}
await browser.close();
