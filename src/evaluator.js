// Оценка руки из 5–7 карт. Возвращает число: чем больше, тем сильнее рука.
// Устройство числа: категория * 16^5 + до пяти номиналов-кикеров по 4 бита.
import { rankOf, suitOf } from './cards.js';

export const CATEGORY = {
  HIGH_CARD: 0,
  PAIR: 1,
  TWO_PAIR: 2,
  TRIPS: 3,
  STRAIGHT: 4,
  FLUSH: 5,
  FULL_HOUSE: 6,
  QUADS: 7,
  STRAIGHT_FLUSH: 8,
};

export const CATEGORY_NAMES = [
  'Старшая карта',
  'Пара',
  'Две пары',
  'Сет (тройка)',
  'Стрит',
  'Флеш',
  'Фулл-хаус',
  'Каре',
  'Стрит-флеш',
];

const score = (category, kickers) => {
  let value = category;
  for (let i = 0; i < 5; i++) value = value * 16 + (kickers[i] || 0);
  return value;
};

// Старшая карта стрита по маске номиналов (бит n = номинал n), или 0.
function straightHigh(mask) {
  if (mask & (1 << 14)) mask |= 1 << 1; // туз внизу: A-2-3-4-5
  for (let high = 14; high >= 5; high--) {
    const need = 0b11111 << (high - 4);
    if ((mask & need) === need) return high;
  }
  return 0;
}

// Номиналы из маски от старшего к младшему, не больше limit штук.
function topRanks(mask, limit) {
  const result = [];
  for (let rank = 14; rank >= 2 && result.length < limit; rank--) {
    if (mask & (1 << rank)) result.push(rank);
  }
  return result;
}

// Рабочие массивы переиспользуются: оценка вызывается сотни тысяч раз подряд.
const counts = new Uint8Array(15);
const suitMasks = new Uint16Array(4);
const suitCounts = new Uint8Array(4);

export function evaluate(cards) {
  counts.fill(0);
  suitMasks.fill(0);
  suitCounts.fill(0);
  let rankMask = 0;

  for (const card of cards) {
    const rank = rankOf(card);
    const suit = suitOf(card);
    counts[rank]++;
    suitMasks[suit] |= 1 << rank;
    suitCounts[suit]++;
    rankMask |= 1 << rank;
  }

  const flushSuit = suitCounts.findIndex((n) => n >= 5);
  if (flushSuit >= 0) {
    const high = straightHigh(suitMasks[flushSuit]);
    if (high) return score(CATEGORY.STRAIGHT_FLUSH, [high]);
  }

  // Номиналы, сгруппированные по количеству, от старшего к младшему.
  const quads = [], trips = [], pairs = [], singles = [];
  for (let rank = 14; rank >= 2; rank--) {
    const n = counts[rank];
    if (n === 4) quads.push(rank);
    else if (n === 3) trips.push(rank);
    else if (n === 2) pairs.push(rank);
    else if (n === 1) singles.push(rank);
  }

  if (quads.length) {
    const kicker = topRanks(rankMask & ~(1 << quads[0]), 1);
    return score(CATEGORY.QUADS, [quads[0], ...kicker]);
  }

  // Фулл-хаус: тройка + пара (пару может дать и вторая тройка).
  if (trips.length && (trips.length > 1 || pairs.length)) {
    const pair = Math.max(trips[1] || 0, pairs[0] || 0);
    return score(CATEGORY.FULL_HOUSE, [trips[0], pair]);
  }

  if (flushSuit >= 0) {
    return score(CATEGORY.FLUSH, topRanks(suitMasks[flushSuit], 5));
  }

  const high = straightHigh(rankMask);
  if (high) return score(CATEGORY.STRAIGHT, [high]);

  if (trips.length) {
    const kickers = topRanks(rankMask & ~(1 << trips[0]), 2);
    return score(CATEGORY.TRIPS, [trips[0], ...kickers]);
  }

  if (pairs.length >= 2) {
    const [first, second] = pairs;
    const kicker = topRanks(rankMask & ~(1 << first) & ~(1 << second), 1);
    return score(CATEGORY.TWO_PAIR, [first, second, ...kicker]);
  }

  if (pairs.length === 1) {
    const kickers = topRanks(rankMask & ~(1 << pairs[0]), 3);
    return score(CATEGORY.PAIR, [pairs[0], ...kickers]);
  }

  return score(CATEGORY.HIGH_CARD, topRanks(rankMask, 5));
}

export const categoryOf = (value) => Math.floor(value / 16 ** 5);
// Старший номинал комбинации (для стрита — его верхняя карта).
const topRank = (value) => Math.floor(value / 16 ** 4) % 16;
export const handName = (value) =>
  categoryOf(value) === CATEGORY.STRAIGHT_FLUSH && topRank(value) === 14 ? 'Роял-флеш' : CATEGORY_NAMES[categoryOf(value)];
