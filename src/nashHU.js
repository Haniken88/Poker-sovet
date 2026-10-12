// Равновесие Нэша «ва-банк или пас» один на один, без анте (chip EV).
// Источник: PokerStrategy, «Nash Ranges for the Push-or-Fold Play», таблица 1 (без анте):
// https://www.pokerstrategy.com/strategy/sit-and-go/1779/ — списки рук переписаны как есть
// (исправлены только опечатки: «98,o», лишние запятые и «5x+» → «5x» в колле на 2–3 ББ —
// иначе доля рук не сходится с подписанной в самой таблице). Сверено своим расчётом:
// data-build/nash/check.mjs (доли рук совпадают с подписанными в таблице).
// Ключ — эффективный стек в ББ. push — с чем малый блайнд (баттон) идёт ва-банк первым,
// call — с чем большой блайнд уравнивает такой ва-банк (только против игры «по Нэшу»).
import { RANKS } from './cards.js';
import { parseRange } from './hands.js';
import { NASH_HU_ANTE } from './nashHUAnte.js';

export const NASH_HU_SOURCE = 'https://www.pokerstrategy.com/strategy/sit-and-go/1779/';

export const NASH_HU = {
  1: { pushPct: 100, push: 'any', callPct: 100, call: 'any' },
  2: { pushPct: 94.6, push: '22+, 8x+, 72s+, 73o+, 62s+, 63o+, 52s+, 53o+, 42s+, 32s', callPct: 96.4, call: '22+, 8x+, 72s+, 73o+, 62s+, 63o+, 5x, 42s+, 43o, 32s' },
  3: { pushPct: 84.6, push: '22+, Tx+, 92s+, 93o+, 82s+, 84o+, 73s+, 75o+, 63s+, 65o, 53s+', callPct: 96.4, call: '22+, 8x+, 72s+, 73o+, 62s+, 63o+, 5x, 42s+, 43o, 32s' },
  4: { pushPct: 78.3, push: '22+, Jx+, T2s+, T3o+, 92s+, 95o+, 83s+, 85o+, 74s+, 76o, 64s+, 53s+', callPct: 82.2, call: '22+, Tx+, 92s+, 95o+, 82s+, 85o+, 73s+, 75o+, 63s+, 65o, 53s+, 43s' },
  5: { pushPct: 74.1, push: '22+, Jx+, T2s+, T5o+, 93s+, 96o+, 84s+, 86o+, 74s+, 76o, 64s+, 53s+', callPct: 68.6, call: '22+, Qx+, J2s+, J3o+, T2s+, T6o+, 94s+, 96o+, 85s+, 87o, 75s+, 65s' },
  6: { pushPct: 70.1, push: '22+, Qx+, J2s+, J4o+, T2s+, T6o+, 94s+, 97o+, 84s+, 86o+, 74s+, 76o, 64s+, 53s+', callPct: 59.6, call: '22+, Qx+, J2s+, J6o+, T5s+, T7o+, 96s+, 98o, 86s+' },
  7: { pushPct: 66.2, push: '22+, Qx+, J2s+, J6o+, T3s+, T7o+, 95s+, 97o+, 84s+, 87o, 74s+, 76o, 64s+, 53s+, 43s', callPct: 50.8, call: '22+, Kx+, Q2s+, Q5o+, J5s+, J8o+, T7s+, T8o+, 97s+' },
  8: { pushPct: 62.6, push: '22+, Kx+, Q2s+, Q3o+, J2s+, J7o+, T4s+, T7o+, 95s+, 97o+, 85s+, 87o, 74s+, 64s+, 53s+', callPct: 48.4, call: '22+, Kx+, Q2s+, Q6o+, J6s+, J8o+, T7s+, T9o, 98s' },
  9: { pushPct: 58.7, push: '22+, Kx+, Q2s+, Q5o+, J2s+, J8o+, T5s+, T8o+, 95s+, 97o+, 85s+, 87o, 74s+, 64s+, 53s+', callPct: 42.7, call: '22+, Ax+, K2s+, K4o+, Q4s+, Q8o+, J7s+, J9o+, T8s+, T9o, 98s' },
  10: { pushPct: 56.6, push: '22+, Kx+, Q2s+, Q7o+, J3s+, J8o+, T5s+, T8o+, 95s+, 97o+, 85s+, 87o, 74s+, 64s+, 53s+', callPct: 38.5, call: '22+, Ax+, K2s+, K6o+, Q6s+, Q8o+, J8s+, J9o+, T9s' },
  11: { pushPct: 54.4, push: '22+, Kx+, Q2s+, Q8o+, J4s+, J8o+, T5s+, T8o+, 95s+, 98o, 85s+, 87o, 74s+, 64s+, 53s+', callPct: 36.3, call: '22+, Ax+, K2s+, K6o+, Q7s+, Q9o+, J8s+, JTo, T9s' },
  12: { pushPct: 51.4, push: '22+, Ax+, K2s+, K3o+, Q2s+, Q8o+, J5s+, J9o+, T6s+, T8o+, 95s+, 98o, 85s+, 87o, 75s+, 64s+, 54s', callPct: 33.0, call: '22+, Ax+, K4s+, K8o+, Q8s+, Q9o+, J9s+, JTo' },
  13: { pushPct: 49.0, push: '22+, Ax+, K2s+, K4o+, Q3s+, Q8o+, J5s+, J9o+, T6s+, T8o+, 96s+, 98o, 85s+, 75s+, 64s+, 54s', callPct: 31.8, call: '22+, Ax+, K5s+, K8o+, Q8s+, QTo+, J9s+, JTo' },
  14: { pushPct: 49.0, push: '22+, Ax+, K2s+, K5o+, Q4s+, Q9o+, J5s+, J8o+, T6s+, T8o+, 95s+, 98o, 85s+, 87o, 75s+, 64s+, 54s', callPct: 30.0, call: '22+, Ax+, K6s+, K8o+, Q9s+, QTo+, JTs' },
  15: { pushPct: 45.7, push: '22+, Ax+, K2s+, K6o+, Q4s+, Q9o+, J6s+, J9o+, T6s+, T8o+, 96s+, 98o, 85s+, 75s+, 64s+, 54s', callPct: 28.4, call: '33+, Ax+, K7s+, K9o+, Q9s+, QTo+, JTs' },
  16: { pushPct: 43.3, push: '22+, Ax+, K2s+, K7o+, Q5s+, Q9o+, J6s+, J9o+, T6s+, T9o, 96s+, 98o, 85s+, 75s+, 65s, 54s', callPct: 27.1, call: '33+, A2s+, A3o+, K8s+, K9o+, Q9s+, QTo+, JTs' },
  17: { pushPct: 43.3, push: '22+, Ax+, K2s+, K8o+, Q5s+, Q9o+, J6s+, J9o+, T6s+, T8o+, 96s+, 98o, 85s+, 75s+, 65s, 54s', callPct: 25.0, call: '33+, A2s+, A4o+, K8s+, K9o+, QTs+, QJo, JTs' },
  18: { pushPct: 42.1, push: '22+, Ax+, K2s+, K8o+, Q5s+, Q9o+, J7s+, J9o+, T6s+, T9o, 96s+, 98o, 85s+, 75s+, 65s, 54s', callPct: 23.8, call: '33+, A2s+, A4o+, K9s+, KTo+, QTs+, QJo, JTs' },
  19: { pushPct: 40.9, push: '22+, Ax+, K2s+, K9o+, Q5s+, Q9o+, J7s+, J9o+, T6s+, T9o, 96s+, 98o, 86s+, 75s+, 65s, 54s', callPct: 22.6, call: '33+, A2s+, A5o+, K9s+, KTo+, QTs+, QJo' },
  20: { pushPct: 40.9, push: '22+, Ax+, K3s+, K9o+, Q5s+, Q9o+, J6s+, J9o+, T6s+, T9o, 96s+, 98o, 86s+, 75s+, 65s, 54s', callPct: 21.7, call: '33+, A2s+, A5o+, K9s+, KTo+, QTs+' },
};

// В таблице есть сокращения «Kx+» (любой король или туз) и «Ax» (любой туз) — разворачиваем их.
export function parseNashRange(text) {
  const all = new Set();
  for (let i = 12; i >= 0; i--) for (let j = i; j >= 0; j--) {
    if (i === j) all.add(RANKS[i] + RANKS[i]);
    else all.add(RANKS[i] + RANKS[j] + 's').add(RANKS[i] + RANKS[j] + 'o');
  }
  if (text === 'any') return all;
  const result = new Set();
  const plain = [];
  for (const raw of text.split(',')) {
    const part = raw.trim();
    const m = part.match(/^([2-9TJQKA])x(\+?)$/);
    if (!m) { if (part) plain.push(part); continue; }
    const from = RANKS.indexOf(m[1]);
    const to = m[2] ? 12 : from;
    for (let hi = from; hi <= to; hi++) {
      for (let lo = 0; lo < hi; lo++) result.add(RANKS[hi] + RANKS[lo] + 's').add(RANKS[hi] + RANKS[lo] + 'o');
    }
  }
  for (const cls of parseRange(plain.join(','))) result.add(cls);
  return result;
}

// Где PokerStrategy расходится с HoldemResources (holdemresources.net/hune) и наш расчёт согласен с HoldemResources —
// берём HoldemResources (2 источника из 3, сверка 2026-10-12, tests/sources.test.js): до какого стека ва-банк.
export const HRC_PUSH_FIX = { T8o: 17.5, '87o': 14.7, '76o': 10.7 };

const parsed = new Map();
/** Стек в ББ → { push: Set, call: Set } по ближайшей строке таблицы (1–20); ante — с анте ББ (свой расчёт). */
export function nashHU(stackBB, ante = false) {
  const key = Math.min(20, Math.max(1, Math.round(stackBB)));
  const id = (ante ? 'a' : '') + key;
  if (!parsed.has(id)) {
    const row = ante ? NASH_HU_ANTE[key] : NASH_HU[key];
    const sets = ante
      ? { push: new Set(row.push.split(' ').filter(Boolean)), call: new Set(row.call.split(' ').filter(Boolean)) }
      : { push: parseNashRange(row.push), call: parseNashRange(row.call) };
    if (!ante) for (const [hand, upTo] of Object.entries(HRC_PUSH_FIX)) if (key <= upTo) sets.push.add(hand);
    parsed.set(id, { ...sets, row, key });
  }
  return parsed.get(id);
}
