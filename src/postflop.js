// Совет после флопа: комбинация, дро, шанс выиграть и решение по цене колла.
import { rankOf, suitOf } from './cards.js';
import { evaluate, categoryOf, handName as comboName, CATEGORY } from './evaluator.js';
import { calcEquity } from './equity.js';
import { opponentRanges } from './ranges.js';
import { ACTION_TEXT } from './preflop.js';

const RANK_NAMES = {
  2: 'двоек', 3: 'троек', 4: 'четвёрок', 5: 'пятёрок', 6: 'шестёрок', 7: 'семёрок',
  8: 'восьмёрок', 9: 'девяток', 10: 'десяток', 11: 'валетов', 12: 'дам', 13: 'королей', 14: 'тузов',
};

// Понятное описание руки: «Старшая пара (тузов)», «Оверпара», «Флеш» …
export function describeHand(hero, board) {
  const value = evaluate([...hero, ...board]);
  const category = categoryOf(value);
  if (board.length === 5 && evaluate(board) === value) return 'Комбинация на столе (у всех)';
  if (category !== CATEGORY.PAIR) return comboName(value);

  const boardRanks = board.map(rankOf).sort((a, b) => b - a);
  const [a, b] = hero.map(rankOf);
  if (a === b) {
    if (a > boardRanks[0]) return `Оверпара (${RANK_NAMES[a]})`;
    return `Карманная пара ${RANK_NAMES[a]} (ниже старшей карты стола)`;
  }
  const paired = boardRanks.find((r) => r === a || r === b);
  if (!paired) return `Пара ${RANK_NAMES[boardRanks.find((r, i) => boardRanks[i + 1] === r)]} на столе`;
  if (paired === boardRanks[0]) return `Старшая пара (${RANK_NAMES[paired]})`;
  if (paired === boardRanks[boardRanks.length - 1]) return `Младшая пара (${RANK_NAMES[paired]})`;
  return `Средняя пара (${RANK_NAMES[paired]})`;
}

/**
 * Дро — на что «тянешь». Возвращает { names: [...], outs } — outs = сколько
 * карт колоды доделают стрит или флеш (точно, перебором).
 */
export function findDraws(hero, board) {
  if (board.length >= 5 || board.length < 3) return { names: [], outs: 0 };
  const cards = [...hero, ...board];
  const nowCategory = categoryOf(evaluate(cards));
  if (nowCategory >= CATEGORY.STRAIGHT) return { names: [], outs: 0 };

  const used = new Set(cards);
  let flushOuts = 0;
  const straightRanks = new Set();
  let outs = 0;
  for (let card = 0; card < 52; card++) {
    if (used.has(card)) continue;
    const category = categoryOf(evaluate([...cards, card]));
    if (category !== CATEGORY.STRAIGHT && category !== CATEGORY.FLUSH && category !== CATEGORY.STRAIGHT_FLUSH) continue;
    // Дро считается, только если в нём участвует хотя бы одна твоя карта.
    if (categoryOf(evaluate([...board, card])) === category) continue;
    outs++;
    if (category === CATEGORY.STRAIGHT) straightRanks.add(rankOf(card));
    else flushOuts++;
  }

  const names = [];
  const suitCounts = [0, 0, 0, 0];
  cards.forEach((c) => suitCounts[suitOf(c)]++);
  if (flushOuts > 0 && suitCounts.some((n, suit) => n === 4 && hero.some((c) => suitOf(c) === suit))) {
    names.push('Флеш-дро');
  }
  if (straightRanks.size >= 2) names.push('Двустороннее стрит-дро');
  else if (straightRanks.size === 1) names.push('Гатшот (стрит-дро в одну карту)');
  return { names, outs };
}

const chips = (amount) => Math.round(amount * 10) / 10;

// Процент для людей: у краёв с десятыми (99,7 % — не то же самое, что 100 %).
export function percentText(share) {
  const p = share * 100;
  if (p > 99 && p < 100) return String(Math.min(99.9, Math.floor(p * 10) / 10)).replace('.', ',');
  if (p > 0 && p < 1) return String(Math.max(0.1, Math.ceil(p * 10) / 10)).replace('.', ',');
  return String(Math.round(p));
}

/**
 * Какие руки соперника бьют тебя прямо сейчас (на текущих картах стола) — точный перебор.
 * Возвращает { count, total, hands: [{ cards: [a, b], name }] }.
 */
export function whoBeatsYou(hero, board) {
  const mine = evaluate([...hero, ...board]);
  const used = new Set([...hero, ...board]);
  const deck = [];
  for (let c = 0; c < 52; c++) if (!used.has(c)) deck.push(c);
  const hands = [];
  let total = 0;
  for (let i = 0; i < deck.length; i++) {
    for (let j = i + 1; j < deck.length; j++) {
      total++;
      const theirs = evaluate([deck[i], deck[j], ...board]);
      if (theirs > mine) hands.push({ cards: [deck[j], deck[i]], name: comboName(theirs) });
    }
  }
  return { count: hands.length, total, hands };
}

/**
 * hero — 2 карты, board — 3–5 карт, opponents — сколько соперников ещё в раздаче,
 * pot — банк в центре стола (без ставок этой улицы),
 * toCall — сколько поставил соперник на этой улице (0 = ставок не было),
 * preflopAction — что было префлоп ('none'/'limp'/'raise'/'3bet'),
 * stack — сколько у тебя осталось денег (Infinity = не важно).
 * Возвращает { action, amount, text, reason, equity, randomEquity, handName, draws }.
 */
export function postflopAdvice({
  hero, board, opponents = 1, pot, toCall = 0, preflopAction = 'none', stack = Infinity,
  iterations = 8000, random = Math.random,
}) {
  if (board.length < 3 || board.length > 5) throw new Error('На столе должно быть 3, 4 или 5 карт');
  const bet = toCall;
  const { ranges, value } = opponentRanges({ board, opponents, preflopAction, bet, potBefore: pot });
  const { equity } = calcEquity({ hero, board, opponents, ranges, iterations, random });
  const randomEquity = calcEquity({ hero, board, opponents, iterations: Math.round(iterations / 3), random }).equity;
  const handName = describeHand(hero, board);
  const draws = findDraws(hero, board);
  const percent = percentText(equity);
  const river = board.length === 5;

  // Нужный шанс для ставки на «вэлью»: против многих соперников ниже.
  const valueNeed = Math.max(0.35, 0.7 - 0.1 * opponents);
  const strongDraw = draws.outs >= 8 && !river;

  const result = (act, amount, reason) => {
    // Больше, чем есть, не поставишь; если ставка — почти весь стек, честнее идти ва-банк.
    if ((act === 'bet' || act === 'raise') && amount >= stack * 0.5) { act = 'allin'; amount = stack; }
    if (act === 'call' && amount >= stack) { act = 'allin'; amount = stack; }
    return {
      action: act,
      amount: amount ? chips(amount) : 0,
      text: ACTION_TEXT[act] + (amount ? `${act === 'raise' ? ' до' : ''} ${chips(amount)}` : ''),
      reason, equity, randomEquity, handName, draws,
    };
  };

  if (!bet) {
    if (equity >= valueNeed) {
      return result('bet', pot * 0.66, `Шанс ${percent} % — ты, скорее всего, впереди: ставь 2/3 банка, пусть платят худшие руки.`);
    }
    if (strongDraw && opponents <= 2) {
      return result('bet', pot * 0.5, `Сильное дро (${draws.outs} аутов): полбанка — можешь забрать банк сразу или доехать.`);
    }
    return result('check', 0, `Шанс ${percent} % — для ставки маловато, бесплатная карта тоже хорошо.`);
  }

  const price = Math.min(bet, stack);
  const potOdds = price / (pot + bet + price);
  const need = Math.round(potOdds * 100);
  // Повышаем, только если впереди даже против рук, которыми ставят «по делу» (без блефов).
  const vsValue = calcEquity({ hero, board, opponents, ranges: value ? [...value, ...ranges.slice(1)] : ranges,
    iterations: Math.round(iterations / 2), random }).equity;
  if (vsValue >= Math.max(valueNeed, 0.55) && price < stack) {
    return result('raise', bet * 3, `Ты впереди даже против рук, которыми так ставят без блефа (${percentText(vsValue)} %), — повышай втрое.`);
  }
  // На флопе впереди ещё ставки: дро без готовой пары реализует шанс не полностью
  // (на тёрне снова придётся платить). При ва-банке ставок больше не будет — без поправки.
  const madeHand = categoryOf(evaluate([...hero, ...board])) >= CATEGORY.PAIR && !describeHand(hero, board).includes('на столе');
  const realized = board.length === 3 && !madeHand && price < stack ? equity * 0.8 : equity;
  if (realized >= potOdds) {
    const bluffNote = river && categoryOf(evaluate([...hero, ...board])) >= CATEGORY.PAIR
      ? ' Часть таких ставок — блеф, его ты бьёшь.' : '';
    return result('call', price, `Шанс ${percent} %, а колл требует ${need} % — уравнивать выгодно.${bluffNote}`);
  }
  if (realized < equity && equity >= potOdds) {
    return result('fold', 0, `Шанс ${percent} %, но это до ривера, а на тёрне снова придётся платить: дро стоит около ${percentText(realized)} %, колл требует ${need} %.`);
  }
  return result('fold', 0, `Шанс ${percent} %, а колл требует ${need} % — в долгую это убыточно.`);
}
