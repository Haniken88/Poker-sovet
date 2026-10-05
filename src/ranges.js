// Диапазоны — какие руки правдоподобно держит соперник.
import { handClass } from './hands.js';
import { HAND_RANKS, HAND_RANKS_HU } from './handRanks.js';
import { rankOf, suitOf } from './cards.js';
import { evaluate, categoryOf, CATEGORY } from './evaluator.js';

// Сильнейшие классы рук, занимающие долю share от всех 1326 комбинаций.
// headsUp — рейтинг «один на один» (для ва-банка с коротким стеком).
export function topClasses(share, headsUp = false) {
  const result = new Set();
  let combos = 0;
  for (const cls of headsUp ? HAND_RANKS_HU : HAND_RANKS) {
    if (combos / 1326 >= share) break;
    result.add(cls);
    combos += cls.length === 2 ? 6 : cls.endsWith('s') ? 4 : 12;
  }
  return result;
}

// Все 1326 пар карт [a, b].
const ALL_COMBOS = [];
for (let a = 0; a < 52; a++) for (let b = a + 1; b < 52; b++) ALL_COMBOS.push([a, b]);
export const combosIn = (classes) => ALL_COMBOS.filter(([a, b]) => classes.has(handClass(a, b)));

// Доля рук, с которой соперник входит в игру префлоп.
// Повысивший — сильнее, уравнявшие — шире, без повышений — ещё шире.
export const PREFLOP_SHARE = { raiser: 0.2, threeBettor: 0.07, caller: 0.35, open: 0.5 };

/**
 * «Что-то есть» на этом столе: пара и лучше с участием своей карты,
 * а до ривера — ещё флеш-дро и стрит-дро. Такими руками обычно ставят «по делу».
 */
export function hasSomething(a, b, board) {
  const ranks = board.map(rankOf);
  const ra = rankOf(a), rb = rankOf(b);
  if (ra === rb || ranks.includes(ra) || ranks.includes(rb)) return true;
  if (categoryOf(evaluate([a, b, ...board])) >= CATEGORY.STRAIGHT) return true;
  if (board.length === 5) return false;
  const suits = [0, 0, 0, 0];
  [a, b, ...board].forEach((c) => suits[suitOf(c)]++);
  if (suits[suitOf(a)] >= 4 || suits[suitOf(b)] >= 4) return true;
  let mask = 0;
  for (const r of [ra, rb, ...ranks]) mask |= 1 << r;
  if (mask & (1 << 14)) mask |= 2;
  const mine = (1 << ra) | (1 << rb) | (ra === 14 || rb === 14 ? 2 : 0);
  for (let low = 1; low <= 10; low++) {
    if (((mine >> low) & 0b11111) && popcount((mask >> low) & 0b11111) >= 4) return true;
  }
  return false;
}
const popcount = (n) => { let c = 0; while (n) { c += n & 1; n >>= 1; } return c; };

/**
 * Доля блефа в ставке. По теории (ставка b в долях банка) блефов b / (1 + 2b):
 * полбанка — 25 %, банк — 33 %, два банка — 40 %. Живые игроки блефуют реже —
 * берём 3/4 от теории.
 */
export const bluffShare = (betToPot) => 0.75 * (betToPot / (1 + 2 * betToPot));

/**
 * Диапазоны соперников после флопа.
 * preflopAction — что было префлоп; bet — ставка соперника на этой улице (0 — не ставили);
 * potBefore — банк до этой ставки. Первый соперник — тот, кто поставил.
 * Возвращает { ranges, value } — value: диапазон ставящего только «по делу» (без блефов).
 */
export function opponentRanges({ board, opponents, preflopAction = 'none', bet = 0, potBefore = 0 }) {
  const aggressorShare = preflopAction === '3bet' ? PREFLOP_SHARE.threeBettor
    : preflopAction === 'raise' ? PREFLOP_SHARE.raiser : PREFLOP_SHARE.open;
  const otherShare = preflopAction === 'raise' || preflopAction === '3bet' ? PREFLOP_SHARE.caller : PREFLOP_SHARE.open;
  const aggressor = combosIn(topClasses(aggressorShare));
  const others = combosIn(topClasses(otherShare));
  const plain = (list) => ({ groups: [list], weights: [1] });

  const ranges = [];
  let value = null;
  for (let p = 0; p < opponents; p++) {
    const pre = p === 0 ? aggressor : others;
    if (p === 0 && bet > 0) {
      const strong = pre.filter(([a, b]) => hasSomething(a, b, board));
      // Блефуют чаще всего тем, что не попало: из более широкого набора рук.
      const air = combosIn(topClasses(Math.max(aggressorShare, PREFLOP_SHARE.open)))
        .filter(([a, b]) => !hasSomething(a, b, board));
      const bluff = bluffShare(bet / Math.max(potBefore, 1e-9));
      ranges.push({ groups: [strong, air], weights: [1 - bluff, bluff] });
      value = [plain(strong)];
    } else {
      ranges.push(plain(pre));
    }
  }
  return { ranges, value };
}
