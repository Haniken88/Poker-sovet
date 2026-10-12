// Сверка своего метода с HoldemResources (holdemresources.net/hune): пороги стека по рукам, один на один,
// без анте и с анте 10 % (каждый кладёт 0,1 ББ → мёртвые деньги 0,2 ББ; стек считаем без анте).
import { CL, idx, EQ, W } from './eqmatrix.mjs';
const N = CL.length;
function nash(S, A, ITER = 2000) {
  const push = new Float64Array(N).fill(0.5), call = new Float64Array(N).fill(0.5);
  const P = new Float64Array(N), C = new Float64Array(N);
  for (let t = 1; t <= ITER; t++) {
    for (let h = 0; h < N; h++) { let ev = 0; for (let v = 0; v < N; v++) { const w = W[h][v]; if (w) ev += w * (call[v] * (EQ[h][v] * (2 * S + A) - (S - 0.5)) + (1 - call[v]) * (1.5 + A)); } P[h] = ev > 0 ? 1 : 0; }
    for (let v = 0; v < N; v++) { let ev = 0, tot = 0; for (let h = 0; h < N; h++) { const w = W[v][h] * push[h]; if (w) { tot += w; ev += w * (EQ[v][h] * (2 * S + A) - (S - 1)); } } C[v] = tot && ev > 0 ? 1 : 0; }
    for (let i = 0; i < N; i++) { push[i] += (P[i] - push[i]) / (t + 1); call[i] += (C[i] - call[i]) / (t + 1); }
  }
  return { push, call };
}
const HANDS = ['K9o','K5o','K2o','Q8o','Q5o','J7o','J4o','T8o','T6o','98o','87o','76o','65s','54s','32s','A2o','K2s','Q2s','J2s','T2s','22'];
const STACKS = [];
for (let s = 1; s <= 20; s += 0.5) STACKS.push(s);
for (const A of [0, 0.2]) {
  const pushMax = new Map(HANDS.map((h) => [h, 0])), callMax = new Map(HANDS.map((h) => [h, 0]));
  for (const S of STACKS) {
    const { push, call } = nash(S, A);
    for (const h of HANDS) {
      if (push[idx.get(h)] >= 0.5) pushMax.set(h, S);
      if (call[idx.get(h)] >= 0.5) callMax.set(h, S);
    }
  }
  console.log(`\nАнте ${A ? '10 %' : 'нет'}: рука — до какого стека ва-банк / колл (мой расчёт)`);
  console.log(HANDS.map((h) => `${h}: ${pushMax.get(h) >= 20 ? '20+' : pushMax.get(h)} / ${callMax.get(h) >= 20 ? '20+' : callMax.get(h)}`).join(' | '));
}
