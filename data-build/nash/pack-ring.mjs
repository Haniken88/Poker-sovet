// Упаковка расчёта make-ring.mjs в src/nashRing.js + «средний» колл против ва-банка.
// Колл: соперник идёт ва-банк уже, чем по Нэшу, — берём 70 % его диапазона (лучшие руки по рейтингу один на один;
// у «средней» таблицы один на один при 10 ББ соотношение такое же: 38 % против 56,6 %). Уравниваем, если
// шанс × банк > доплаты. Запуск: node data-build/nash/pack-ring.mjs (после make-ring.mjs).
import fs from 'fs';
import { CL, idx, combos, EQ, W } from './eqmatrix.mjs';
import { HAND_RANKS_HU } from '../../src/handRanks.js';

const N = CL.length;
const ring = JSON.parse(fs.readFileSync(new URL('./ring.json', import.meta.url)));
const fromHex = (hex) => { let bits = ''; for (const ch of hex) bits += parseInt(ch, 16).toString(2).padStart(4, '0'); return CL.map((_, i) => bits[i] === '1'); };
const toHex = (arr) => { let bits = arr.map((b) => (b ? '1' : '0')).join('').padEnd(172, '0'); let s = ''; for (let i = 0; i < bits.length; i += 4) s += parseInt(bits.slice(i, i + 4), 2).toString(16); return s; };
const rank = new Map(HAND_RANKS_HU.map((c, i) => [c, i]));
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
      // Средний ва-банк: 70 % комбинаций Нэша, лучшие по рейтингу.
      const inPush = CL.filter((_, i) => push[i]).sort((a, b) => rank.get(a) - rank.get(b));
      const total = inPush.reduce((s, c) => s + combos[idx.get(c)].length, 0);
      const mid = new Set(); let n = 0;
      for (const c of inPush) { if (n >= total * 0.7) break; mid.add(idx.get(c)); n += combos[idx.get(c)].length; }
      const s = Number(S), dead = 1.5 + Number(A), heroPosted = m === '1' ? 0.5 : 0;
      const calls = Array.from({ length: Number(m) }, (_, j) => {
        const fromEnd = Number(m) - 1 - j, posted = fromEnd === 0 ? 1 : fromEnd === 1 ? 0.5 : 0;
        const pot = 2 * s + dead - posted - heroPosted;
        return toHex(closeArr(CL.map((_, v) => {
          let w = 0, e = 0;
          for (const h of mid) { w += W[v][h]; e += W[v][h] * EQ[v][h]; }
          return w > 0 && (e / w) * pot - (s - posted) > 0;
        })));
      });
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
