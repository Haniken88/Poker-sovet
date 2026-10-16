// Тренажёр «Что делаешь?» (2026-10-13): придумывает раздачу до флопа, правильный ответ — совет приложения
// (те же проверенные таблицы: Нэш, солверы). Спорные места («почти равно») в вопросы не берём.
import { preflopAdvice, openSizeFor } from './preflop.js';
import { positionInfo } from './positions.js';
import { handClass } from './hands.js';
import { HAND_RANKS } from './handRanks.js';

// Порядок — просьба владельца 2026-10-15: «Всё подряд» первым (по умолчанию), «Короткий стек» — в конце.
export const TOPICS = [
  ['mix', 'Всё подряд'],
  ['open', 'Открытие'],
  ['vsRaise', 'Против повышения'],
  ['vsLimp', 'Против лимпа'],
  ['vs3bet', 'Тебе сделали 3-бет'],
  ['vsShove', 'Против ва-банка'],
  ['short', 'Короткий стек'],
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
function answerOf(advice, facingAllIn, limped) {
  if (advice.action === 'allin') return facingAllIn ? 'call' : 'allin';
  if (advice.action === 'check') return limped ? 'call' : 'fold'; // ББ после лимпа: «чек» — на месте колла
  return advice.action; // fold | call | raise
}

/**
 * Один вопрос. topic — из TOPICS; rnd — генератор 0…1.
 * Возвращает { topic, players, offset, stackBB, ante, hero, seatsActs, ctx, options, correct, advice } или null (переиграть).
 */
export function makeQuestion(topic, rnd) {
  const kind = topic === 'mix' ? pick(rnd, ['short', 'vsShove', 'open', 'vsRaise', 'vsRaise', 'vs3bet', 'vsLimp']) : topic;
  const players = kind === 'short' || kind === 'vsShove' ? pick(rnd, [2, 3, 6, 6, 9, 9, 9]) : pick(rnd, [6, 9, 9]);
  const ante = rnd() < 0.5 ? 1 : 0;
  const stackBB = kind === 'short' ? int(rnd, 4, 20) : kind === 'vsShove' ? int(rnd, 4, 15)
    : kind === 'open' ? pick(rnd, [25, 30, 40, 60, 100]) : kind === 'vs3bet' ? pick(rnd, [40, 60, 100, 100])
    : kind === 'vsLimp' ? pick(rnd, [25, 40, 60, 100, 100])
    : pick(rnd, [20, 25, 40, 60, 100]);
  // Порядок хода до флопа: смещения от баттона 3…N−1 (ранние), 0 (баттон), 1 (МБ), 2 (ББ); вдвоём — 0, 1.
  const order = players === 2 ? [0, 1] : [...Array.from({ length: players - 3 }, (_, i) => i + 3), 0, 1, 2];
  let heroIdx, openerIdx = -1, tbIdx = -1, limpIdx = [];
  if (kind === 'short' || kind === 'open') {
    heroIdx = int(rnd, 0, order.length - 2); // не ББ: все сбросили — ББ просто чекает
  } else if (kind === 'vs3bet') {
    // Ты открыл первым, кто-то после тебя сделал 3-бет (таблицы солверов «открывший против 3-бета»).
    if (players === 2) return null;
    heroIdx = int(rnd, 0, order.length - 2);
    tbIdx = int(rnd, heroIdx + 1, order.length - 1);
  } else if (kind === 'vsLimp') {
    // Лимперы — 1–2 игрока подряд где-то до тебя (2026-10-16: только места, сверенные с источниками; спорные отсеиваются).
    if (order.length < 3) return null;
    limpIdx = [int(rnd, 0, order.length - 2)];
    heroIdx = int(rnd, limpIdx[0] + 1, order.length - 1);
    if (rnd() < 0.35 && heroIdx - limpIdx[0] >= 2) limpIdx.push(int(rnd, limpIdx[0] + 1, heroIdx - 1));
  } else if (kind === 'vsRaise' && rnd() < 0.4) {
    // Защита большого блайнда — самая частая ситуация «против повышения» в жизни.
    heroIdx = order.length - 1;
    openerIdx = int(rnd, 0, order.length - 2);
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
  let heroOpen = 0, threeBettor = null;
  if (kind === 'vs3bet') {
    threeBettor = positionInfo(players, order[tbIdx]);
    heroOpen = openSizeFor(stackBB, false);
    raiseTo = (threeBettor.group === 'blinds' ? 4 : 3) * heroOpen; // 3-бет: из блайндов ×4, в позиции ×3
    action = '3bet';
  }
  if (kind === 'vsLimp') action = 'limp';
  const limpers = limpIdx.length;
  const advice = preflopAdvice({ hero, position, action, limpers, raiseTo, bigBlind: bb, stack, opener, ante,
    heroOpened: kind === 'vs3bet', threeBettor });
  if (advice.close) return null; // спорно — не спрашиваем
  // ББ после лимпа с обычной рукой просто чекает — вопрос слишком лёгкий, берём редко.
  if (kind === 'vsLimp' && advice.action === 'check' && rnd() < 0.8) return null;
  const facingAllIn = kind === 'vsShove';
  const correct = answerOf(advice, facingAllIn, kind === 'vsLimp');

  // Что сделал каждый до тебя (по смещению от баттона).
  const seatsActs = {};
  order.forEach((off, i) => {
    if (kind === 'vs3bet') {
      // Все, кроме тебя и сделавшего 3-бет, уже сбросили; у тебя — твоё открытие.
      if (i === heroIdx) seatsActs[off] = { open: heroOpen };
      else if (i === tbIdx) seatsActs[off] = { threebet: raiseTo };
      else seatsActs[off] = 'fold';
      return;
    }
    if (i >= heroIdx) return;
    if (limpIdx.includes(i)) seatsActs[off] = 'limp';
    else if (i === openerIdx) seatsActs[off] = kind === 'vsShove' ? 'allin' : { raise: raiseTo };
    else seatsActs[off] = 'fold';
  });

  // Всегда четыре варианта (просьба владельца 2026-10-13), кроме ответа на ва-банк: там повысить нельзя — пас или колл.
  const options = kind === 'vsShove' ? ['fold', 'call'] : ['fold', 'call', 'raise', 'allin'];
  // Размер повторного повышения (как в советах): с блайндов ×4, иначе ×3.
  const threeBetTo = kind === 'vs3bet' ? Math.round(2.3 * raiseTo * 10) / 10 : kind === 'vsLimp' ? advice.action === 'raise' ? advice.amount
    : ((stackBB >= 40 ? 3.5 : 2.5) + limpers + (position.group === 'blinds' ? 1 : 0)) : (position.group === 'blinds' ? 4 : 3) * raiseTo;
  return { topic: kind, players, offset, stackBB, ante, hero, seatsActs, raiseTo, threeBetTo, position, opener, threeBettor, heroOpen, limpers,
    options, correct, advice };
}

/** Вопрос с несколькими попытками (спорные места переигрываются). */
// Чтобы «пас» не угадывался вслепую: часть вопросов с ответом «пас» переигрываем (цель — около половины).
const FOLD_SKIP = { short: 0, vsShove: 0.1, open: 0.35, vsRaise: 0.6, vs3bet: 0.75, vsLimp: 0.6, mix: 0.5 };
export function nextQuestion(topic, rnd) {
  for (let i = 0; i < 200; i++) {
    const q = makeQuestion(topic, rnd);
    if (q && !(q.correct === 'fold' && rnd() < FOLD_SKIP[topic])) return q;
  }
  throw new Error('Не удалось придумать вопрос');
}
