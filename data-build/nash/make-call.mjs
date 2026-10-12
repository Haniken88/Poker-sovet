// «Средняя» таблица колла против ва-банка один на один (src/huCall.js), без анте и с анте ББ (= 1 ББ).
// Таблица Нэша говорит, с чем уравнивать ва-банк соперника, который сам играет по Нэшу (широко).
// Живые соперники идут ва-банк уже, поэтому берём середину: соперник идёт ва-банк с долей рук
// посередине между осторожным (20 %) и Нэшем, его руки — лучшие по рейтингу один на один.
// Уравниваем, если шанс против этих рук ≥ цены колла: (S − 1) / (2S + A)
// (на ББ 1 ББ уже в банке, анте A — мёртвые деньги).
// Запуск: node data-build/nash/make-call.mjs
import fs from 'fs';
import { CL, idx, combos, EQ, W } from './eqmatrix.mjs';
import { HAND_RANKS_HU } from '../../src/handRanks.js';
import { NASH_HU } from '../../src/nashHU.js';
import { NASH_HU_ANTE } from '../../src/nashHUAnte.js';

const size = (c) => combos[idx.get(c)].length;
function top(share) {
  const set = new Set(); let n = 0;
  for (const c of HAND_RANKS_HU) { if (n / 1326 >= share) break; set.add(idx.get(c)); n += size(c); }
  return set;
}
function table(nashTable, A) {
  const out = [];
  for (let S = 1; S <= 20; S++) {
    const shoveShare = (20 + nashTable[S].pushPct) / 2 / 100;
    const shove = top(shoveShare);
    const need = (S - 1) / (2 * S + A);
    const calls = HAND_RANKS_HU.filter((c) => {
      const h = idx.get(c); let w = 0, e = 0;
      for (const v of shove) { w += W[h][v]; e += W[h][v] * EQ[h][v]; }
      return e / w >= need;
    });
    const row = { shovePct: Math.round(shoveShare * 1000) / 10, callPct: Math.round(calls.reduce((s, c) => s + size(c), 0) / 1.326) / 10, call: calls.join(' ') };
    out.push(`  ${S}: ${JSON.stringify(row)},`);
    console.log(`${A ? 'анте' : 'без анте'} ${S} ББ: соперник идёт ва-банк с ${row.shovePct} %, колл ${row.callPct} %`);
  }
  return out.join('\n');
}
fs.writeFileSync(new URL('../../src/huCall.js', import.meta.url), `// Создано data-build/nash/make-call.mjs — не править руками.
// «Средняя» таблица колла против ва-банка один на один: соперник идёт ва-банк с shovePct % рук
// (между осторожным 20 % и Нэшем), call — руки, с которыми колл выгоден (шанс ≥ цены колла).
export const HU_CALL = {
${table(NASH_HU, 0)}
};
// То же с анте большого блайнда (= 1 ББ).
export const HU_CALL_ANTE = {
${table(NASH_HU_ANTE, 1)}
};

const sets = new Map();
/** Стек в ББ → { call: Set, row } по ближайшей строке (1–20); ante — играем с анте ББ. */
export function huCall(stackBB, ante = false) {
  const key = Math.min(20, Math.max(1, Math.round(stackBB)));
  const id = (ante ? 'a' : '') + key;
  if (!sets.has(id)) {
    const row = (ante ? HU_CALL_ANTE : HU_CALL)[key];
    sets.set(id, { call: new Set(row.call.split(' ')), row, key });
  }
  return sets.get(id);
}
`);
