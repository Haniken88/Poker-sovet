import { createRequire } from 'node:module';
const { firefox } = createRequire('/root/My-Site/package.json')('@playwright/test');
const browser = await firefox.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 1120 }, deviceScaleFactor: 2 });
await page.goto('http://localhost:8091/index.html', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.setItem('poker-table', JSON.stringify({ occupied: Array(9).fill(true), hero: 9, button: 1, bb: 50000, stack: 1100000, anteOn: true })));
await page.reload({ waitUntil: 'networkidle' }); await page.evaluate(() => document.fonts.ready);
const pick = async (rank, suit) => { await page.click(`.ranks [data-rank="${rank}"]`); await page.click(`.suits [data-suit="${suit}"]`); };
await page.click('[data-hole="0"]'); await pick(14, 1); await pick(12, 3);
await page.waitForTimeout(400);
if (await page.$('.sheet [data-act="close"]')) await page.click('.sheet [data-act="close"]').catch(() => {});
await page.keyboard.press('Escape');
await page.waitForTimeout(1500);
for (const answered of [false, true]) {
await page.evaluate((answered) => {
  const acts = { 4: ['пас'], 5: ['пас'], 6: ['рейз 2 ББ', 'raise'], 7: ['пас'], 8: ['колл', 'call'] };
  document.querySelectorAll('.seat-act').forEach((e) => e.remove());
  document.querySelectorAll('.seat').forEach((s) => { s.classList.remove('can-pick', 'is-raiser', 'is-caller');
    const a = acts[s.dataset.seat]; if (!a) return;
    const tag = document.createElement('div'); tag.className = 'seat-act ' + (a[1] || 'fold'); tag.textContent = a[0]; s.appendChild(tag); });
  if (!document.getElementById('tr-style')) { const st = document.createElement('style'); st.id = 'tr-style'; st.textContent = `
    .seat { overflow: visible; }
    .seat-act { position: absolute; left: 50%; top: 100%; transform: translate(-50%, 4px); white-space: nowrap; font: 700 10.5px Manrope;
      padding: 2px 7px; border-radius: 999px; background: rgba(0,0,0,.55); color: #a9b8a4; z-index: 3; }
    .seat-act.raise { background: #b3242f; color: #fff; } .seat-act.call { background: #d8b25a; color: #1d150c; }
    .trq { padding: 14px 18px 0; } .trq .prog { display: flex; justify-content: space-between; color: #a9b8a4; font-size: 13px; }
    .trq .prog b { color: #f3ead2; }
    .trq .dots { display: grid; grid-template-columns: repeat(20, 1fr); gap: 3px; margin: 6px 0 12px; }
    .trq .dots i { height: 5px; border-radius: 3px; background: #26362c; } .trq .dots .ok { background: #7fd6a2; } .trq .dots .no { background: #ff8a8f; } .trq .dots .now { background: #d8b25a; }
    .trq .sit { font-size: 13.5px; color: #d9e6d4; line-height: 1.45; } .trq .sit b { color: #f5eedc; }
    .trq h3 { font: 400 22px Prata; margin: 12px 0 10px; text-align: center; }
    .trq .ans { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .trq .ans span { text-align: center; padding: 13px 4px; border-radius: 12px; background: #18241d; border: 1px solid #2f4637; font: 700 13.5px Manrope; }
    .trq .ans .picked { background: #1f3a2a; border: 2px solid #7fd6a2; color: #7fd6a2; } .trq .ans .off { opacity: .45; }
    .tv { font: 400 26px/1 Prata; color: #1f6b44; } .tv small { display: block; font: 700 11px Manrope; letter-spacing: .1em; color: #8a6a1f; margin-bottom: 4px; }
    .tp { font-size: 13px; line-height: 1.45; color: #3e3424; margin-top: 8px; } .tp b { color: #1d150c; }
    .tn { margin-top: 12px; text-align: center; background: #d8b25a; color: #1d150c; font: 800 15px Manrope; padding: 12px; border-radius: 12px; }
    #new-hand, .hint-line, p.hint { display: none !important; }`; document.head.appendChild(st); }
  document.body.classList.remove('open');
  document.getElementById('street').textContent = 'Тренажёр';
  document.getElementById('inputs').innerHTML = `<div class="trq">
    <div class="prog"><span>Вопрос <b>7</b> из 20 · тема «Против повышения»</span><span>Верно <b>5</b>/6</span></div>
    <div class="dots"><i class="ok"></i><i class="ok"></i><i class="no"></i><i class="ok"></i><i class="ok"></i><i class="ok"></i><i class="now"></i>${'<i></i>'.repeat(13)}</div>
    <div class="sit">Ты — <b>катофф</b>, стек <b>22 ББ</b>, анте. До тебя: <b>UTG+2 повысил до 2 ББ</b>, хайджек уравнял. После тебя ещё баттон и блайнды.</div>
    <h3>Что делаешь?</h3>
    <div class="ans"><span class="${answered ? 'off' : ''}">Пас</span><span class="${answered ? 'off' : ''}">Колл 100 000</span><span class="${answered ? 'picked' : ''}">${answered ? 'Ва-банк ✓' : 'Ва-банк'}</span></div></div>`;
  const t = document.getElementById('ticket');
  t.classList.remove('busy');
  t.innerHTML = answered ? `<div class="tv"><small>Верно</small>Ва-банк 1 100 000</div>
    <div class="tp"><b>AQ при 22 ББ против повышения — снова повышай, и сразу ва-банком.</b> По таблицам солверов AQ здесь
      повышают всегда. Обычный 3-бет съел бы треть стека, поэтому при стеке до 30 ББ — сразу ва-банк: часто заберёшь
      банк (6,5 ББ уже в центре: блайнды, анте, рейз и колл), а против колла AQ впереди многих рук.</div><div class="tn">Дальше</div>`
    : `<div class="tv" style="color:#1d150c">Выбери ответ<small>Тренажёр</small></div><div class="tp">Подсказка появится после ответа.</div>`;
}, answered);
await page.waitForTimeout(900);
await page.evaluate(() => window.scrollTo(0, 0));
await page.screenshot({ path: `/root/poker-bot/mockups/shots/pro-trainer${answered ? '-answer' : ''}.png` });
}
await browser.close();
