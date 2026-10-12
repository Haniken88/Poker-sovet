// Нэш «ва-банк или пас» один на один с анте большого блайнда (анте = 1 ББ, платит ББ) → src/nashHUAnte.js.
// Опубликованной таблицы именно для анте ББ с указанными условиями не нашлось — считаем сами тем же
// способом, который без анте сошёлся с опубликованной таблицей PokerStrategy (src/nashHU.js) в пределах 1–2 %.
// Сверка с анте: при 10 ББ получается ~71 % ва-банк и ~53 % колл — как у pokerlevelup.com (push-fold-charts).
// Деньги в ББ: МБ поставил 0,5, ББ — 1 + анте A (мёртвые деньги). Ва-банк выгоден, если
// (1 − c)·(1,5 + A) + c·(шанс·(2S + A) − (S − 0,5)) > 0; колл ББ — если шанс·(2S + A) − (S − 1) > 0.
// Метод — фиктивная игра (3000 шагов), рука в диапазоне, если играется в ≥ 50 % случаев.
import fs from 'fs';
import { CL, combos, EQ, W } from './eqmatrix.mjs';

const N = CL.length, A = 1;
function nash(S) {
  const push = new Float64Array(N).fill(0.5), call = new Float64Array(N).fill(0.5);
  const P = new Float64Array(N), C = new Float64Array(N);
  for (let t = 1; t <= 3000; t++) {
    for (let h = 0; h < N; h++) {
      let ev = 0;
      for (let v = 0; v < N; v++) { const w = W[h][v]; if (w) ev += w * (call[v] * (EQ[h][v] * (2 * S + A) - (S - 0.5)) + (1 - call[v]) * (1.5 + A)); }
      P[h] = ev > 0 ? 1 : 0;
    }
    for (let v = 0; v < N; v++) {
      let ev = 0, tot = 0;
      for (let h = 0; h < N; h++) { const w = W[v][h] * push[h]; if (w) { tot += w; ev += w * (EQ[v][h] * (2 * S + A) - (S - 1)); } }
      C[v] = tot && ev > 0 ? 1 : 0;
    }
    for (let i = 0; i < N; i++) { push[i] += (P[i] - push[i]) / (t + 1); call[i] += (C[i] - call[i]) / (t + 1); }
  }
  return { push, call };
}
const list = (f) => CL.filter((_, i) => f[i] >= 0.5);
const pct = (cls) => Math.round(cls.reduce((s, c) => s + combos[CL.indexOf(c)].length, 0) / 1.326) / 10;
const rows = [];
for (let S = 1; S <= 20; S++) {
  const { push, call } = nash(S);
  const p = list(push), c = list(call);
  rows.push(`  ${S}: ${JSON.stringify({ pushPct: pct(p), push: p.join(' '), callPct: pct(c), call: c.join(' ') })},`);
  console.log(`${S} ББ: ва-банк ${pct(p)} %, колл ${pct(c)} %`);
}
fs.writeFileSync(new URL('../../src/nashHUAnte.js', import.meta.url), `// Создано data-build/nash/make-ante.mjs — не править руками.
// Нэш «ва-банк или пас» один на один, анте платит большой блайнд (анте = 1 ББ). Свой расчёт (см. скрипт):
// без анте тот же расчёт совпал с опубликованной таблицей, с анте — с опубликованными 71 % / 53 % при 10 ББ.
export const NASH_HU_ANTE = {
${rows.join('\n')}
};
`);
