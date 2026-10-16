// Статистика по местам за столом (2026-10-16, Pro): сколько раздач, в скольких вошёл, сколько из них выиграл, итог в ББ.
// Раздачи пишутся из окна «Чем кончилась раздача?» (app.js); хранятся только в телефоне (localStorage 'poker-hands').

export const MAX_HANDS = 5000;

// Строки таблицы — от ранних мест к блайндам, как идёт ход до флопа.
export const ROWS = [
  ['early', 'Ранние'],
  ['middle', 'Средние'],
  ['CO', 'Катофф'],
  ['BTN', 'Баттон'],
  ['SB', 'МБ'],
  ['BB', 'ББ'],
];
const rowOf = (key) => (key.startsWith('UTG') ? 'early' : key === 'LJ' || key === 'HJ' ? 'middle' : key);

/**
 * Запись одной раздачи.
 * posKey — место (BTN, SB, BB, CO, HJ, LJ, UTG…), kind — 'win' | 'lose' | 'fold', amount — сколько выиграл/потерял (деньги стола),
 * posted — сколько блайнда ты поставил заранее, walk — все сбросили до тебя на большом блайнде (раздачу ты не играл).
 */
export function handEntry({ time, posKey, kind, amount, bb, posted = 0, walk = false, hand = null, stackBB = null }) {
  // «Вошёл» — сам положил в банк больше обязательного блайнда: уравнял, повысил, дошёл до флопа.
  const entered = kind === 'fold' ? amount > posted : !walk;
  const net = (kind === 'win' ? 1 : -1) * amount / bb;
  return { t: time, k: posKey, r: kind, e: entered, b: Math.round(net * 10) / 10, ...(hand ? { h: hand } : {}), ...(stackBB ? { s: Math.round(stackBB) } : {}) };
}

export function addHand(list, entry) {
  const next = [...list, entry];
  return next.length > MAX_HANDS ? next.slice(next.length - MAX_HANDS) : next;
}

// С какого момента считать: 'day' — с полуночи, 'month' — с 1-го числа, 'all' — всё.
export function periodStart(period, now = new Date()) {
  if (period === 'day') return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  return 0;
}

export function summarize(list, period = 'all', now = new Date()) {
  const from = periodStart(period, now);
  const blank = () => ({ hands: 0, entered: 0, won: 0, net: 0 });
  const total = blank();
  const rows = Object.fromEntries(ROWS.map(([id]) => [id, blank()]));
  for (const h of list) {
    if (h.t < from) continue;
    for (const s of [total, rows[rowOf(h.k)]]) {
      if (!s) continue;
      s.hands++;
      if (h.e) { s.entered++; if (h.r === 'win') s.won++; }
      s.net += h.b;
    }
  }
  const round = (s) => ({ ...s, net: Math.round(s.net * 10) / 10 });
  return { total: round(total), rows: ROWS.map(([id, label]) => ({ id, label, ...round(rows[id]) })) };
}
