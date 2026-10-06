// Шанс выиграть методом Монте-Карло: доигрываем раздачу много раз случайно
// и считаем, какую долю банка в среднем забирает игрок.
import { evaluate } from './evaluator.js';

/**
 * hero — 2 карты игрока, board — 0–5 общих карт,
 * opponents — сколько соперников с неизвестными картами,
 * known — массив известных рук соперников (для разборов и тестов),
 * ranges — для каждого неизвестного соперника его возможные руки (или null = любые):
 *   { groups: [[[a, b, w?], ...], ...], weights: [0.7, 0.3] } — сначала по весу выбираем
 *   группу (например «сильные руки» или «блеф»), потом случайную руку из неё
 *   (w — частота руки 0…1, по умолчанию 1);
 * iterations — сколько раздач сыграть, random — свой генератор (для тестов).
 * Возвращает { win, tie, equity } в долях от 1.
 */
export function calcEquity({
  hero,
  board = [],
  opponents = 1,
  known = [],
  ranges = null,
  iterations = 10000,
  random = Math.random,
}) {
  const used = new Set([...hero, ...board, ...known.flat()]);
  if (used.size !== hero.length + board.length + known.flat().length) {
    throw new Error('Одна и та же карта указана дважды');
  }
  const deck = [];
  for (let card = 0; card < 52; card++) if (!used.has(card)) deck.push(card);

  const missingBoard = 5 - board.length;
  if (missingBoard + opponents * 2 > deck.length) throw new Error('Слишком много игроков для одной колоды');

  const heroHand = [...hero, ...board, 0, 0, 0, 0, 0].slice(0, 7);
  const villainHand = [0, 0, ...board, 0, 0, 0, 0, 0].slice(0, 7);
  const boardStart = 2 + board.length;
  const villainCards = new Array(opponents * 2);
  const taken = new Uint8Array(52);
  const size = deck.length;

  // Руки из диапазонов: только без карт героя и стола.
  const specs = Array.from({ length: opponents }, (_, p) => {
    const range = ranges?.[p];
    if (!range) return null;
    const groups = range.groups.map((g) => g.filter(([a, b]) => !used.has(a) && !used.has(b)));
    const weights = range.weights.map((w, i) => (groups[i].length ? w : 0));
    const total = weights.reduce((x, y) => x + y, 0);
    return total ? { groups, weights: weights.map((w) => w / total) } : null;
  });

  const freeCard = () => {
    for (;;) {
      const c = deck[Math.floor(random() * size)];
      if (!taken[c]) { taken[c] = 1; return c; }
    }
  };

  let wins = 0, ties = 0, share = 0;

  for (let round = 0; round < iterations; round++) {
    taken.fill(0);
    for (let p = 0; p < opponents; p++) {
      const spec = specs[p];
      let a = -1, b = -1;
      if (spec) {
        let roll = random(), g = 0;
        while (g < spec.weights.length - 1 && roll >= spec.weights[g]) roll -= spec.weights[g++];
        const group = spec.groups[g];
        for (let tries = 0; tries < 80; tries++) {
          const [x, y, w = 1] = group[Math.floor(random() * group.length)];
          // w — как часто соперник играет эту руку (из таблиц): 0,4 = в 40 % случаев.
          if (w < 1 && random() > w) continue;
          if (!taken[x] && !taken[y]) { a = x; b = y; break; }
        }
      }
      if (a < 0) { a = freeCard(); b = freeCard(); } else { taken[a] = 1; taken[b] = 1; }
      villainCards[p * 2] = a; villainCards[p * 2 + 1] = b;
    }
    for (let i = 0; i < missingBoard; i++) {
      heroHand[boardStart + i] = villainHand[boardStart + i] = freeCard();
    }
    const heroValue = evaluate(heroHand);

    let tied = 0, lost = false;
    for (const hand of known) {
      villainHand[0] = hand[0]; villainHand[1] = hand[1];
      const value = evaluate(villainHand);
      if (value > heroValue) { lost = true; break; }
      if (value === heroValue) tied++;
    }
    for (let p = 0; p < opponents && !lost; p++) {
      villainHand[0] = villainCards[p * 2];
      villainHand[1] = villainCards[p * 2 + 1];
      const value = evaluate(villainHand);
      if (value > heroValue) lost = true;
      else if (value === heroValue) tied++;
    }

    if (lost) continue;
    if (tied === 0) { wins++; share += 1; }
    else { ties++; share += 1 / (tied + 1); }
  }

  return { win: wins / iterations, tie: ties / iterations, equity: share / iterations };
}

// Повторяемый генератор случайных чисел (для тестов).
export function seededRandom(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
