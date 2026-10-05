// Шанс выиграть методом Монте-Карло: доигрываем раздачу много раз случайно
// и считаем, какую долю банка в среднем забирает игрок.
import { evaluate } from './evaluator.js';

/**
 * hero — 2 карты игрока, board — 0–5 общих карт,
 * opponents — сколько соперников с неизвестными картами,
 * known — массив известных рук соперников (для разборов и тестов),
 * iterations — сколько раздач сыграть, random — свой генератор (для тестов).
 * Возвращает { win, tie, equity } в долях от 1.
 */
export function calcEquity({
  hero,
  board = [],
  opponents = 1,
  known = [],
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
  const need = missingBoard + opponents * 2;
  if (need > deck.length) throw new Error('Слишком много игроков для одной колоды');

  const heroHand = [...hero, ...board, 0, 0, 0, 0, 0].slice(0, 7);
  const villainHand = [0, 0, ...board, 0, 0, 0, 0, 0].slice(0, 7);
  const boardStart = 2 + board.length;

  let wins = 0, ties = 0, share = 0;

  for (let round = 0; round < iterations; round++) {
    // Частичная перетасовка: в начало колоды встают ровно нужные карты.
    for (let i = 0; i < need; i++) {
      const j = i + Math.floor(random() * (deck.length - i));
      const t = deck[i]; deck[i] = deck[j]; deck[j] = t;
    }
    for (let i = 0; i < missingBoard; i++) {
      heroHand[boardStart + i] = villainHand[boardStart + i] = deck[i];
    }
    const heroValue = evaluate(heroHand);

    let best = 0, tied = 0, lost = false;
    const check = (value) => {
      if (value > heroValue) lost = true;
      else if (value === heroValue) tied++;
      if (value > best) best = value;
    };
    for (const hand of known) {
      villainHand[0] = hand[0]; villainHand[1] = hand[1];
      check(evaluate(villainHand));
      if (lost) break;
    }
    for (let p = 0; p < opponents && !lost; p++) {
      villainHand[0] = deck[missingBoard + p * 2];
      villainHand[1] = deck[missingBoard + p * 2 + 1];
      check(evaluate(villainHand));
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
