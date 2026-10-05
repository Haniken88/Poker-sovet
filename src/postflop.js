// Совет после флопа: комбинация, дро, шанс выиграть и решение по цене колла.
import { rankOf, suitOf } from './cards.js';
import { evaluate, categoryOf, handName as comboName, CATEGORY } from './evaluator.js';
import { calcEquity } from './equity.js';
import { handClass } from './hands.js';
import { HAND_RANKS } from './handRanks.js';
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

// Правдоподобные руки соперников: префлоп-диапазон (по тому, был ли рейз),
// а если сейчас ставят — ещё и «что-то есть» на этом столе.
const topClasses = (share) => {
  const result = new Set();
  let combos = 0;
  for (const cls of HAND_RANKS) {
    if (combos / 1326 >= share) break;
    result.add(cls);
    combos += cls.length === 2 ? 6 : cls.endsWith('s') ? 4 : 12;
  }
  return result;
};
const PREFLOP_SHARE = { none: 0.6, limp: 0.6, raise: 0.25, '3bet': 0.08 };

function hasSomething(a, b, board) {
  const ranks = board.map(rankOf);
  const ra = rankOf(a), rb = rankOf(b);
  if (ra === rb || ranks.includes(ra) || ranks.includes(rb)) return true; // пара и лучше
  if (board.length === 5) return categoryOf(evaluate([a, b, ...board])) >= CATEGORY.STRAIGHT;
  const suits = [0, 0, 0, 0];
  [a, b, ...board].forEach((c) => suits[suitOf(c)]++);
  if (suits[suitOf(a)] >= 4 || suits[suitOf(b)] >= 4) return true; // флеш-дро
  // Стрит-дро: 4 из 5 подряд с участием своей карты.
  let mask = 0;
  for (const r of [ra, rb, ...ranks]) mask |= 1 << r;
  if (mask & (1 << 14)) mask |= 2;
  for (let low = 1; low <= 10; low++) {
    const window = (mask >> low) & 0b11111;
    const mine = ((1 << ra) | (1 << rb) | (ra === 14 || rb === 14 ? 2 : 0)) >> low & 0b11111;
    if (mine && popcount(window) >= 4) return true;
  }
  return categoryOf(evaluate([a, b, ...board])) >= CATEGORY.STRAIGHT;
}
const popcount = (n) => { let c = 0; while (n) { c += n & 1; n >>= 1; } return c; };

export function villainFilter({ board, preflopAction = 'none', facingBet = false }) {
  const range = topClasses(PREFLOP_SHARE[preflopAction] ?? 0.6);
  const table = new Uint8Array(52 * 52);
  for (let a = 0; a < 52; a++) {
    for (let b = 0; b < 52; b++) {
      if (a === b) continue;
      table[a * 52 + b] = range.has(handClass(a, b)) && (!facingBet || hasSomething(a, b, board)) ? 1 : 0;
    }
  }
  return (a, b) => table[a * 52 + b] === 1;
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
 * pot — банк ДО твоего хода (со ставками соперников на этой улице),
 * toCall — сколько тебе доставить (0 = ставок не было),
 * preflopAction — что было префлоп ('none'/'limp'/'raise'/'3bet').
 * Возвращает { action, amount, text, reason, equity, handName, draws }.
 */
export function postflopAdvice({
  hero, board, opponents = 1, pot, toCall = 0, preflopAction = 'none',
  iterations = 8000, random = Math.random,
}) {
  if (board.length < 3 || board.length > 5) throw new Error('На столе должно быть 3, 4 или 5 карт');
  const facingBet = toCall > 0;
  const accept = villainFilter({ board, preflopAction, facingBet });
  const { equity } = calcEquity({ hero, board, opponents, iterations, random, accept });
  const handName = describeHand(hero, board);
  const draws = findDraws(hero, board);
  const percent = percentText(equity);
  const river = board.length === 5;

  // Нужный шанс для ставки на «вэлью»: против многих соперников ниже.
  const valueNeed = Math.max(0.35, 0.7 - 0.1 * opponents);
  const strongDraw = draws.outs >= 8 && !river;

  const result = (act, amount, reason) => ({
    action: act,
    amount: amount ? chips(amount) : 0,
    text: ACTION_TEXT[act] + (amount ? `${act === 'raise' ? ' до' : ''} ${chips(amount)}` : ''),
    reason,
    equity,
    handName,
    draws,
  });

  if (!facingBet) {
    if (equity >= valueNeed) {
      return result('bet', pot * 0.66, `Шанс ${percent} % — ты, скорее всего, впереди: ставь 2/3 банка, пусть платят худшие руки.`);
    }
    if (strongDraw && opponents <= 2) {
      return result('bet', pot * 0.5, `Сильное дро (${draws.outs} аутов): полубанка — можешь забрать банк сразу или доехать.`);
    }
    return result('check', 0, `Шанс ${percent} % — для ставки маловато, бесплатная карта тоже хорошо.`);
  }

  const potOdds = toCall / (pot + toCall);
  const need = Math.round(potOdds * 100);
  if (equity >= Math.max(valueNeed + 0.1, potOdds + 0.15)) {
    return result('raise', toCall * 3, `Шанс ${percent} % даже против рук, которые так ставят, — повышай втрое.`);
  }
  if (equity >= potOdds) {
    return result('call', toCall, `Шанс ${percent} %, а колл требует ${need} % — уравнивать выгодно.`);
  }
  return result('fold', 0, `Шанс ${percent} %, а колл требует ${need} % — в долгую это убыточно.`);
}
