// Рисует иконки приложения из icons/icon.html. Нужен сервер: python3 -m http.server 8091
import { createRequire } from 'node:module';
const { firefox } = createRequire('/root/My-Site/package.json')('@playwright/test');
const dir = new URL('../icons/', import.meta.url).pathname;
const browser = await firefox.launch();
for (const [name, size] of [['icon-512.png', 512], ['icon-192.png', 192], ['apple-touch-icon.png', 180]]) {
  const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: size / 512 });
  await page.goto('http://localhost:8091/icons/icon.html', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: dir + name });
  await page.close();
}
await browser.close();
