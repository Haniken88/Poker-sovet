// Шансы класс против класса (169 × 169) для расчётов Нэша. Считается ~4 минуты, кэш — .eq-cache.json (не в git).
import fs from 'fs';
import { evaluate } from '../../src/evaluator.js';
import { seededRandom } from '../../src/equity.js';
import { handClass, allClasses } from '../../src/hands.js';

export const CL = allClasses();
export const idx = new Map(CL.map((c, i) => [c, i]));
const N = CL.length;
export const combos = CL.map(() => []);
for (let a = 0; a < 52; a++) for (let b = a + 1; b < 52; b++) combos[idx.get(handClass(a, b))].push([a, b]);

const cache = new URL('./.eq-cache.json', import.meta.url);
export let EQ, W;
if (fs.existsSync(cache)) ({ EQ, W } = JSON.parse(fs.readFileSync(cache)));
else {
  EQ = Array.from({ length: N }, () => new Array(N).fill(0));
  W = Array.from({ length: N }, () => new Array(N).fill(0));
  // 2026-10-12: был самописный генератор (seed * 1103515245 теряет точность в JS → карты выпадали неравномерно,
  // шансы врали на 1–2,5 %). Теперь — проверенный генератор приложения.
  const rnd = seededRandom(12345);
  const h1 = new Array(7), h2 = new Array(7), used = new Uint8Array(52);
  for (let i = 0; i < N; i++) for (let j = i; j < N; j++) {
    const pairs = [];
    for (const x of combos[i]) for (const y of combos[j]) if (!x.some((c) => y.includes(c))) pairs.push([x, y]);
    W[i][j] = W[j][i] = pairs.length;
    if (!pairs.length) continue;
    let s = 0; const ITER = 6000;
    for (let k = 0; k < ITER; k++) {
      const [x, y] = pairs[k % pairs.length]; used.fill(0);
      for (const c of [...x, ...y]) used[c] = 1;
      h1[0] = x[0]; h1[1] = x[1]; h2[0] = y[0]; h2[1] = y[1];
      for (let n = 0; n < 5;) { const c = (rnd() * 52) | 0; if (used[c]) continue; used[c] = 1; h1[2 + n] = h2[2 + n] = c; n++; }
      const a = evaluate(h1), b = evaluate(h2); s += a > b ? 1 : a === b ? 0.5 : 0;
    }
    EQ[i][j] = s / ITER; EQ[j][i] = 1 - s / ITER;
  }
  fs.writeFileSync(cache, JSON.stringify({ EQ, W }));
}
