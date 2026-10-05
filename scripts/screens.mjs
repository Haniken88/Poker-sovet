// Скриншоты приложения как на iPhone (для проверки дизайна).
// Нужен локальный сервер: python3 -m http.server 8091 (из корня проекта).
import { createRequire } from 'node:module';
const { firefox } = createRequire('/root/My-Site/package.json')('@playwright/test');
const out = new URL('../mockups/shots/', import.meta.url).pathname;
const browser = await firefox.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto('http://localhost:8091/index.html', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
const shot = async (name) => { await page.waitForTimeout(350); await page.screenshot({ path: out + name + '.png' }); };
const pick = async (rank, suit) => {
  await page.click(`.ranks [data-rank="${rank}"]`);
  await page.click(`.suits [data-suit="${suit}"]`);
};
await shot('app-1-empty');
await page.click('[data-hole="0"]');
await page.click('.ranks [data-rank="11"]');
await shot('app-2-picker');
await page.click('.suits [data-suit="0"]');
await pick(10, 0);
await page.click('[data-pre="raise"]');
await shot('app-3-preflop');
await page.click('[data-board="0"]');
await pick(14, 0); await pick(7, 0); await pick(2, 2);
await page.fill('input[data-key="toCall"]', '6'); await page.press('input[data-key="toCall"]', 'Tab');
await shot('app-4-flop');
await page.click('.seat[data-seat="7"]');
await shot('app-5-seatmenu');
await page.click('[data-act="toggle"]');
// перетаскиваем кнопку D к месту 8
const chip = await page.$('#button-chip');
const box = await chip.boundingBox();
const seat8 = await (await page.$('.seat[data-seat="8"]')).boundingBox();
await page.mouse.move(box.x + 15, box.y + 15); await page.mouse.down();
await page.mouse.move(seat8.x + 30, seat8.y + 20, { steps: 8 }); await page.mouse.up();
await page.evaluate(() => window.scrollTo(0, 0));
await shot('app-6-after-drag');
// маленький iPhone SE
await page.setViewportSize({ width: 375, height: 667 });
await shot('app-7-se');
console.log(errors.length ? 'ОШИБКИ: ' + errors.join('\n') : 'ошибок в консоли нет');
await browser.close();
