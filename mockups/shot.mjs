// Скриншоты макетов как на iPhone: node shot.mjs a-neon
import { createRequire } from 'node:module';
const { firefox } = createRequire('/root/My-Site/package.json')('@playwright/test');
const names = process.argv.slice(2);
const browser = await firefox.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
for (const name of names) {
  const states = name === 'b-felt'
    ? [['', ''], ['-picker1', '?picker=1'], ['-picker2', '?picker=2'], ['-picker3', '?picker=3']]
    : [['', ''], ['-picker', '?picker']];
  for (const [suffix, query] of states) {
    await page.goto(`http://localhost:8091/mockups/${name}.html${query}`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `shots/${name}${suffix}.png` });
  }
}
await browser.close();
