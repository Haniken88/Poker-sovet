// Тренажёр «Что делаешь?» (2026-10-13): придумывает раздачу до флопа, правильный ответ — совет приложения
// (те же проверенные таблицы: Нэш, солверы). Спорные места («почти равно») в вопросы не берём.
import { preflopAdvice } from './preflop.js';
import { positionInfo } from './positions.js';
import { handClass } from './hands.js';
import { HAND_RANKS } from './handRanks.js';

export const TOPICS = [
  ['short', 'Короткий стек'],
  ['vsShove', 'Против ва-банка'],
  ['open', 'Открытие'],
  ['vsRaise', 'Против повышения'],
  ['mix', 'Всё подряд'],
];
export const SERIES = 20;
export const FREE_PER_DAY = 10;

const RANK = new Map(HAND_RANKS.map((c, i) => [c, i]));
const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];
const int = (rnd, a, b) => a + Math.floor(rnd() * (b - a + 1));

// Случайная рука; самый «мусор» (нижние 40 %) берём реже — с ним вопрос слишком лёгкий.
function dealHand(rnd) {
  for (;;) {
    const a = Math.floor(rnd() * 52); let b = Math.floor(rnd() * 51); if (b >= a) b++;
    const cls = handClass(a, b);
    if (RANK.get(cls) > 100 && rnd() < 0.75) continue;
    return [a, b];
  }
}

// Действие в ответ → кнопка. Против ва-банка «ва-банк» приложения — это колл.
function answerOf(advice, facingAllIn) {
  if (advice.action === 'allin') return facingAllIn ? 'call' : 'allin';
  if (advice.action === 'check') return 'fold';
  return advice.action; // fold | call | raise
}

/**
 * Один вопрос. topic — из TOPICS; rnd — генератор 0…1.
 * Возвращает { topic, players, offset, stackBB, ante, hero, seatsActs, ctx, options, correct, advice } или null (переиграть).
 */
export function makeQuestion(topic, rnd) {
  const kind = topic === 'mix' ? pick(rnd, ['short', 'vsShove', 'open', 'vsRaise']) : topic;
  const players = kind === 'short' || kind === 'vsShove' ? pick(rnd, [2, 3, 6, 6, 9, 9, 9]) : pick(rnd, [6, 9, 9]);
  const ante = rnd() < 0.5 ? 1 : 0;
  const stackBB = kind === 'short' ? int(rnd, 4, 20) : kind === 'vsShove' ? int(rnd, 4, 15)
    : kind === 'open' ? pick(rnd, [25, 30, 40, 60, 100]) : pick(rnd, [20, 25, 40, 60, 100]);
  // Порядок хода до флопа: смещения от баттона 3…N−1 (ранние), 0 (баттон), 1 (МБ), 2 (ББ); вдвоём — 0, 1.
  const order = players === 2 ? [0, 1] : [...Array.from({ length: players - 3 }, (_, i) => i + 3), 0, 1, 2];
  let heroIdx, openerIdx = -1;
  if (kind === 'short' || kind === 'open') {
    heroIdx = int(rnd, 0, order.length - 2); // не ББ: все сбросили — ББ просто чекает
  } else {
    if (order.length < 2) return null;
    openerIdx = int(rnd, 0, order.length - 2);
    heroIdx = int(rnd, openerIdx + 1, order.length - 1);
  }
  const offset = order[heroIdx];
  const position = positionInfo(players, offset);
  const hero = dealHand(rnd);
  const bb = 1;
  const stack = stackBB * bb;
  let action = 'none', raiseTo = 0, opener = null;
  if (kind === 'vsShove') { action = 'raise'; raiseTo = stack; opener = positionInfo(players, order[openerIdx]); }
  if (kind === 'vsRaise') { action = 'raise'; raiseTo = pick(rnd, [2, 2.5, 3]); opener = positionInfo(players, order[openerIdx]); }
  const advice = preflopAdvice({ hero, position, action, raiseTo, bigBlind: bb, stack, opener, ante });
  if (advice.close) return null; // спорно — не спрашиваем
  const facingAllIn = kind === 'vsShove';
  const correct = answerOf(advice, facingAllIn);

  // Что сделал каждый до тебя (по смещению от баттона).
  const seatsActs = {};
  order.forEach((off, i) => {
    if (i >= heroIdx) return;
    if (i === openerIdx) seatsActs[off] = kind === 'vsShove' ? 'allin' : { raise: raiseTo };
    else seatsActs[off] = 'fold';
  });

  const options = kind === 'vsShove' ? ['fold', 'call']
    : kind === 'short' ? (stackBB > 15 ? ['fold', 'raise', 'allin'] : ['fold', 'allin'])
    : kind === 'open' ? (stackBB <= 25 ? ['fold', 'raise', 'allin'] : ['fold', 'raise'])
    : stackBB <= 30 ? ['fold', 'call', 'allin'] : ['fold', 'call', 'raise'];
  if (!options.includes(correct)) return null;
  return { topic: kind, players, offset, stackBB, ante, hero, seatsActs, raiseTo, position, opener,
    options, correct, advice };
}

/** Вопрос с несколькими попытками (спорные места переигрываются). */
// Чтобы «пас» не угадывался вслепую: часть вопросов с ответом «пас» переигрываем (цель — около половины).
const FOLD_SKIP = { short: 0, vsShove: 0.1, open: 0.35, vsRaise: 0.6, mix: 0.45 };
export function nextQuestion(topic, rnd) {
  for (let i = 0; i < 200; i++) {
    const q = makeQuestion(topic, rnd);
    if (q && !(q.correct === 'fold' && rnd() < FOLD_SKIP[topic])) return q;
  }
  throw new Error('Не удалось придумать вопрос');
}
