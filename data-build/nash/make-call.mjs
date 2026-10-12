// «Средняя» таблица колла против ва-банка один на один (src/huCall.js).
// Таблица Нэша говорит, с чем уравнивать ва-банк соперника, который сам играет по Нэшу (широко).
// Живые соперники идут ва-банк уже, поэтому берём середину: соперник идёт ва-банк с долей рук
// посередине между осторожным (20 %) и Нэшем (pushPct из src/nashHU.js), его руки — лучшие по
// рейтингу один на один. Уравниваем, если шанс против этих рук ≥ цены колла: (стек − 1) / (2 · стек)
// (на ББ 1 ББ уже в банке, малый блайнд сбрасывать уже нечего — он весь стек поставил).
// Запуск: node data-build/nash/make-call.mjs  (около 2 минут, сервер не нагружает — 1 поток).
import fs from 'fs';
import { evaluate } from '../../src/evaluator.js';
import { handClass, allClasses, combosOf } from '../../src/hands.js';
import { HAND_RANKS_HU } from '../../src/handRanks.js';
import { NASH_HU } from '../../src/nashHU.js';

const CL = allClasses(); const idx = new Map(CL.map((c, i) => [c, i])); const N = CL.length;
const combos = CL.map(() => []);
for (let a = 0; a < 52; a++) for (let b = a + 1; b < 52; b++) combos[idx.get(handClass(a, b))].push([a, b]);

// Шанс класса i против класса j (с учётом общих карт), 3000 доигрываний на пару.
const EQ = Array.from({ length: N }, () => new Float64Array(N));
const W = Array.from({ length: N }, () => new Float64Array(N));
let seed = 12345; const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
const h1 = new Array(7), h2 = new Array(7), used = new Uint8Array(52);
for (let i = 0; i < N; i++) for (let j = i; j < N; j++) {
  const pairs = [];
  for (const x of combos[i]) for (const y of combos[j]) if (!x.some((c) => y.includes(c))) pairs.push([x, y]);
  W[i][j] = W[j][i] = pairs.length;
  if (!pairs.length) continue;
  let s = 0; const ITER = 3000;
  for (let k = 0; k < ITER; k++) {
    const [x, y] = pairs[k % pairs.length]; used.fill(0);
    for (const c of [...x, ...y]) used[c] = 1;
    h1[0] = x[0]; h1[1] = x[1]; h2[0] = y[0]; h2[1] = y[1];
    for (let n = 0; n < 5;) { const c = (rnd() * 52) | 0; if (used[c]) continue; used[c] = 1; h1[2 + n] = h2[2 + n] = c; n++; }
    const a = evaluate(h1), b = evaluate(h2); s += a > b ? 1 : a === b ? 0.5 : 0;
  }
  EQ[i][j] = s / ITER; EQ[j][i] = 1 - s / ITER;
}

function top(share) {
  const set = new Set(); let n = 0;
  for (const c of HAND_RANKS_HU) { if (n / 1326 >= share) break; set.add(idx.get(c)); n += combosOf(c); }
  return set;
}
const out = {};
for (let S = 1; S <= 20; S++) {
  const shoveShare = (20 + NASH_HU[S].pushPct) / 2 / 100;
  const shove = top(shoveShare);
  const need = (S - 1) / (2 * S);
  const calls = [];
  for (const c of HAND_RANKS_HU) {
    const h = idx.get(c); let w = 0, e = 0;
    for (const v of shove) { w += W[h][v]; e += W[h][v] * EQ[h][v]; }
    if (e / w >= need) calls.push(c);
  }
  const pct = calls.reduce((s, c) => s + combosOf(c), 0) / 13.26;
  out[S] = { shovePct: Math.round(shoveShare * 1000) / 10, callPct: Math.round(pct * 10) / 10, call: calls.join(' ') };
  console.log(`${S} ББ: соперник идёт ва-банк с ${out[S].shovePct} %, колл ${out[S].callPct} %`);
}
const body = Object.entries(out).map(([k, v]) => `  ${k}: ${JSON.stringify(v)},`).join('\n');
fs.writeFileSync(new URL('../../src/huCall.js', import.meta.url), `// Создано data-build/nash/make-call.mjs — не править руками.
// «Средняя» таблица колла против ва-банка один на один: соперник идёт ва-банк с shovePct % рук
// (между осторожным 20 % и Нэшем), call — руки, с которыми колл выгоден (шанс ≥ цены колла).
export const HU_CALL = {
${body}
};

const sets = new Map();
/** Стек в ББ → { call: Set, row } по ближайшей строке (1–20). */
export function huCall(stackBB) {
  const key = Math.min(20, Math.max(1, Math.round(stackBB)));
  if (!sets.has(key)) sets.set(key, { call: new Set(HU_CALL[key].call.split(' ')), row: HU_CALL[key], key });
  return sets.get(key);
}
`);
