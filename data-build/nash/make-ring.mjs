// Нэш «ва-банк или пас» за полным столом, когда до тебя все сбросили (src/nashRing.js).
// m — сколько игроков после тебя (как position.behind в приложении): 1 = ты на МБ, 2 = баттон, 3 = катофф…
// Модель: ты идёшь ва-банк со стеком S (у всех по S), игроки после тебя по очереди уравнивают или сбрасывают;
// уравнял первый — остальные сбрасывают (двойные коллы при коротком стеке редки — упрощение, см. CLAUDE.md).
// Мёртвые деньги: МБ 0,5 + ББ 1 + анте A (анте платит ББ; A = 1 ББ или 0). Деньги в ББ.
// Проверка: m = 1 без анте должно совпасть с опубликованной таблицей один на один (src/nashHU.js).
// Запуск: nice -n 19 node data-build/nash/make-ring.mjs  (несколько минут, 1 поток)
import fs from 'fs';
import { CL, combos, EQ, W } from './eqmatrix.mjs';

const N = CL.length;
const Wf = W.map((r) => Float64Array.from(r)), EQf = EQ.map((r) => Float64Array.from(r));
const ITER = 1500;

// Кто после тебя: индекс j = 0 … m−1 по порядку хода; последние двое — МБ и ББ (при m = 1 только ББ).
function seats(m) {
  return Array.from({ length: m }, (_, j) => {
    const fromEnd = m - 1 - j; // 0 = ББ, 1 = МБ
    return { posted: fromEnd === 0 ? 1 : fromEnd === 1 ? 0.5 : 0 };
  });
}

function solve(m, S, A) {
  const heroPosted = m === 1 ? 0.5 : 0;
  const dead = 1.5 + A; // всё, что лежит в банке до ва-банка
  const callers = seats(m);
  const push = new Float64Array(N).fill(0.5);
  const call = callers.map(() => new Float64Array(N).fill(0.3));
  const P = new Float64Array(N), C = callers.map(() => new Float64Array(N));
  const cProb = new Float64Array(m), cEq = new Float64Array(m);
  for (let t = 1; t <= ITER; t++) {
    // Ты: лучший ответ на коллы.
    for (let h = 0; h < N; h++) {
      const wr = Wf[h], er = EQf[h];
      let tot = 0; for (let v = 0; v < N; v++) tot += wr[v];
      for (let j = 0; j < m; j++) {
        const cj = call[j]; let w = 0, e = 0;
        for (let v = 0; v < N; v++) { const x = wr[v] * cj[v]; w += x; e += x * er[v]; }
        cProb[j] = w / tot; cEq[j] = w ? e / w : 0;
      }
      let ev = 0, allFold = 1;
      for (let j = 0; j < m; j++) {
        // Банк при колле игрока j: твой S + его S + мёртвые деньги, кроме его собственного блайнда.
        const pot = 2 * S + dead - callers[j].posted - heroPosted;
        ev += allFold * cProb[j] * (cEq[j] * pot - (S - heroPosted));
        allFold *= 1 - cProb[j];
      }
      ev += allFold * dead;
      P[h] = ev > 0 ? 1 : 0;
    }
    // Игроки после тебя: лучший ответ на твой ва-банк (колл, если шанс × банк больше доплаты).
    for (let j = 0; j < m; j++) {
      const pot = 2 * S + dead - callers[j].posted - heroPosted;
      for (let v = 0; v < N; v++) {
        const wr = Wf[v], er = EQf[v]; let w = 0, e = 0;
        for (let h = 0; h < N; h++) { const x = wr[h] * push[h]; w += x; e += x * er[h]; }
        C[j][v] = w && (e / w) * pot - (S - callers[j].posted) > 0 ? 1 : 0;
      }
    }
    for (let i = 0; i < N; i++) {
      push[i] += (P[i] - push[i]) / (t + 1);
      for (let j = 0; j < m; j++) call[j][i] += (C[j][i] - call[j][i]) / (t + 1);
    }
  }
  return { push, call };
}

// 169 рук → битовая строка (шестнадцатеричная) в порядке allClasses().
const toHex = (f) => { let bits = ''; for (let i = 0; i < N; i++) bits += f[i] >= 0.5 ? '1' : '0'; bits = bits.padEnd(172, '0'); let s = ''; for (let i = 0; i < bits.length; i += 4) s += parseInt(bits.slice(i, i + 4), 2).toString(16); return s; };
const pct = (f) => Math.round(CL.reduce((s, c, i) => s + (f[i] >= 0.5 ? combos[i].length : 0), 0) / 1.326) / 10;

const out = { 0: {}, 1: {} };
const STACKS = Array.from({ length: 15 }, (_, i) => i + 1);
for (const A of [0, 1]) {
  for (let m = 1; m <= 8; m++) {
    out[A][m] = {};
    for (const S of STACKS) {
      const { push, call } = solve(m, S, A);
      out[A][m][S] = { pushPct: pct(push), push: toHex(push), call: call.map(toHex), callPct: call.map(pct) };
    }
    console.log(`анте ${A}, после тебя ${m}: ва-банк при 10 ББ ${out[A][m][10].pushPct} %, при 15 ББ ${out[A][m][15].pushPct} %; ББ уравнивает при 10 ББ ${out[A][m][10].callPct.at(-1)} %`);
  }
}
fs.writeFileSync(new URL('./ring.json', import.meta.url), JSON.stringify(out));
