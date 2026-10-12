// Упаковка расчёта make-ring.mjs в src/nashRing.js: ва-банк и колл по Нэшу, без «дыр» от шума.
// Запуск: node data-build/nash/pack-ring.mjs (после make-ring.mjs).
import fs from 'fs';
import { allClasses } from '../../src/hands.js';

const CL = allClasses();

const N = CL.length;
const ring = JSON.parse(fs.readFileSync(new URL('./ring.json', import.meta.url)));
const fromHex = (hex) => { let bits = ''; for (const ch of hex) bits += parseInt(ch, 16).toString(2).padStart(4, '0'); return CL.map((_, i) => bits[i] === '1'); };
const toHex = (arr) => { let bits = arr.map((b) => (b ? '1' : '0')).join('').padEnd(172, '0'); let s = ''; for (let i = 0; i < bits.length; i += 4) s += parseInt(bits.slice(i, i + 4), 2).toString(16); return s; };
// «Сильнее — тоже играет»: убираем дыры от шума расчёта (K7s в диапазоне → K8s, K9s… тоже; пара → старшие пары;
// разномастная → такая же одномастная). Так устроены все настоящие таблицы.
const R = '23456789TJQKA';
function closeUp(set) {
  const out = new Set(set);
  let changed = true;
  while (changed) {
    changed = false;
    const add = (c) => { if (!out.has(c)) { out.add(c); changed = true; } };
    for (const c of [...out]) {
      const hi = R.indexOf(c[0]), lo = R.indexOf(c[1]);
      if (c.length === 2) { for (let r = hi + 1; r < 13; r++) add(R[r] + R[r]); continue; }
      const t = c[2];
      for (let r = lo + 1; r < hi; r++) add(R[hi] + R[r] + t);
      if (t === 'o') add(c[0] + c[1] + 's');
    }
  }
  return out;
}
const closeArr = (arr) => { const set = closeUp(CL.filter((_, i) => arr[i])); return CL.map((c) => set.has(c)); };

const out = {};
for (const A of ['0', '1']) {
  out[A] = {};
  for (const m of Object.keys(ring[A])) {
    out[A][m] = {};
    for (const S of Object.keys(ring[A][m])) {
      const row = ring[A][m][S];
      const push = closeArr(fromHex(row.push));
      // Колл — по чистой таблице Нэша (2026-10-12: «на 30 % уже Нэша» отброшено — с ранних мест это давало
      // пас с AK против ва-банка; проверка scripts/audit.mjs). Убираем только «дыры» от шума.
      const calls = row.call.map((hex) => toHex(closeArr(fromHex(hex))));
      out[A][m][S] = [toHex(push), ...calls];
    }
  }
}
fs.writeFileSync(new URL('../../src/nashRing.js', import.meta.url), `// Создано data-build/nash/make-ring.mjs + pack-ring.mjs — не править руками.
// Полный стол, короткий стек, до тебя все сбросили: [ва-банк по Нэшу, колл против ва-банка для каждого игрока после
// пошедшего (по порядку хода, последний — ББ)]. Ключи: анте (0/1) → сколько игроков после пошедшего → стек в ББ.
// Руки — 169 битов (порядок allClasses) в шестнадцатеричной записи. Свой расчёт; сверка — CLAUDE.md.
export const NASH_RING = ${JSON.stringify(out)};
`);
console.log('размер', fs.statSync(new URL('../../src/nashRing.js', import.meta.url)).size, 'байт');
