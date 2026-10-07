// Совет после флопа: комбинация, дро, шанс выиграть и решение по цене колла.
import { rankOf, suitOf } from './cards.js';
import { evaluate, categoryOf, handName as comboName, CATEGORY } from './evaluator.js';
import { calcEquity } from './equity.js';
import { opponentRanges, preflopRanges, hasSomething } from './ranges.js';
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
 * Как руки соперника легли на этот стол (как во Flopzilla): доля «пара и лучше», «только дро», «ничего».
 * Считается по его рукам до флопа (из таблиц), без учёта ставок на этой улице. null — если не знаем его руки.
 */
export function describeRangeHit(preflop, board, hero) {
  const charts = preflopRanges(preflop);
  if (!charts) return null;
  const dead = new Set([...board, ...hero]);
  const boardCat = categoryOf(evaluate(board));
  let made = 0, draw = 0, total = 0;
  for (const [a, b, w = 1] of charts.aggressor) {
    if (dead.has(a) || dead.has(b)) continue;
    total += w;
    const cat = categoryOf(evaluate([a, b, ...board]));
    const ranks = board.map(rankOf);
    const usesCard = rankOf(a) === rankOf(b) || ranks.includes(rankOf(a)) || ranks.includes(rankOf(b)) || cat > boardCat + 1;
    if (cat > boardCat && usesCard) made += w;
    else if (board.length < 5 && hasSomething(a, b, board)) draw += w;
  }
  if (!total) return null;
  const pct = (x) => Math.round((x / total) * 100);
  return { made: pct(made), draw: pct(draw), air: 100 - pct(made) - pct(draw) };
}

/**
 * hero — 2 карты, board — 3–5 карт, opponents — сколько соперников ещё в раздаче,
 * pot — банк в центре стола (без ставок этой улицы),
 * toCall — сколько поставил соперник на этой улице (0 = ставок не было),
 * preflopAction — что было префлоп ('none'/'limp'/'raise'/'3bet'),
 * stack — сколько у тебя осталось денег (Infinity = не важно),
 * style — как блефует поставивший: 'rare' (редко), 'normal', 'often' (часто),
 * preflop — кто что делал до флопа ({ action, hero, raiser, reraiser, heroOpened }):
 *   тогда руки соперников берутся из таблиц солверов.
 * Возвращает { action, amount, text, reason, equity, randomEquity, handName, draws }.
 */
export function postflopAdvice({
  hero, board, opponents = 1, pot, toCall = 0, preflopAction = 'none', stack = Infinity, style = 'normal', preflop = null,
  iterations = 8000, random = Math.random, compareStyles = true,
}) {
  if (board.length < 3 || board.length > 5) throw new Error('На столе должно быть 3, 4 или 5 карт');
  const bet = toCall;
  const { ranges, value, about } = opponentRanges({ board, opponents, preflopAction, bet, potBefore: pot, style, preflop });
  const rangeHit = describeRangeHit(preflop, board, hero);
  const { equity } = calcEquity({ hero, board, opponents, ranges, iterations, random });
  const randomEquity = calcEquity({ hero, board, opponents, iterations: Math.round(iterations / 3), random }).equity;
  const handName = describeHand(hero, board);
  const draws = findDraws(hero, board);
  const percent = percentText(equity);
  const river = board.length === 5;

  // Сила руки относительно стола: пара, которая есть у всех на столе, — не наша заслуга.
  const mine = categoryOf(evaluate([...hero, ...board]));
  const boardOnly = categoryOf(evaluate(board));
  const madeHand = mine >= CATEGORY.PAIR && !handName.includes('на столе');
  const topPairPlus = madeHand && (/Старшая пара|Оверпара/.test(handName) || mine - boardOnly >= 1 && mine >= CATEGORY.TWO_PAIR);
  const bigHand = mine - boardOnly >= 2 || mine >= CATEGORY.STRAIGHT && !handName.includes('на столе');

  // SPR — сколько банков помещается в стеке. Маленький — можно ва-банк со старшей парой,
  // большой — одной парой весь стек не отдают.
  const spr = stack / (pot + bet);
  const sprText = Number.isFinite(spr) ? String(Math.round(spr * 10) / 10).replace('.', ',') : '';

  // Нужный шанс для ставки на «вэлью»: против многих соперников ниже.
  const valueNeed = Math.max(0.35, 0.7 - 0.1 * opponents);
  const strongDraw = draws.outs >= 8 && !river;

  let close = false; // спорно: решения почти равны
  let vsValue; // шанс против рук «по делу» (считается, если есть ставка)
  let needPct = null; // с какого шанса колл выгоден (цена + запас)
  const result = (act, amount, reason) => {
    // Больше, чем есть, не поставишь; если ставка — почти весь стек, честнее идти ва-банк.
    if ((act === 'bet' || act === 'raise') && amount >= stack * 0.5) { act = 'allin'; amount = stack; }
    if (act === 'call' && amount >= stack) { act = 'allin'; amount = stack; }
    return {
      action: act,
      amount: amount ? chips(amount) : 0,
      text: ACTION_TEXT[act] + (amount ? `${act === 'raise' ? ' до' : ''} ${chips(amount)}` : ''),
      reason, equity, randomEquity, handName, draws, spr, close, about, vsValue: typeof vsValue === 'number' ? vsValue : null, needPct, rangeHit,
    };
  };

  // Кто был агрессором до флопа (по данным солвера от этого зависит, ставить первым или чекать).
  const heroAggressor = Boolean(preflop && preflop.action === 'none' && preflop.hero && preflop.hero.key !== 'BB');
  const heroCaller = Boolean(preflop && ((preflop.action === 'raise' && preflop.raiser) || (preflop.action === '3bet' && preflop.heroOpened)));
  const headsUp = opponents === 1;

  if (!bet) {
    // Пороги подобраны по 71 тыс. решений TexasSolver (13 тёрнов, баттон против ББ, 2026-10-07).
    if (heroCaller && headsUp && !(spr < 1.5 && topPairPlus)) {
      // Ты уравнивал повышение: первым почти всегда чек — солвер так делает в 70–98 % рук, даже с сильными.
      close = equity >= 0.85;
      return result('check', 0, equity >= 0.85
        ? `Шанс ${percent} %, но первым против того, кто повышал до флопа, обычно чекают — он поставит сам, а ты повысишь или уравняешь. Ставка тоже не ошибка.`
        : `Первым против того, кто повышал до флопа, чекают почти всегда (шанс ${percent} %) — пусть ставит он.`);
    }
    if (heroAggressor && headsUp && !(spr < 1.5 && topPairPlus)) {
      // Повышал ты, тебе прочекали: ставка с сильными и часть блефов со слабыми, середина — чек.
      // Живая игра: любители слишком часто сбрасывают на ставку — ставим чаще, чем солвер (с 70 %, а не с 80 %).
      if (equity >= 0.7) return result('bet', pot * 0.66, `Шанс ${percent} % — сильная рука, ставь 2/3 банка.`);
      if (equity < 0.4) {
        close = true;
        return result('bet', pot * 0.5, draws.outs >= 4
          ? `Слабая рука, но с дро (${draws.outs} аутов): ставка-блеф в полбанка — заберёшь банк или доедешь. Солвер так делает примерно в половине случаев.`
          : `Слабая рука (шанс ${percent} %): тут солвер примерно в половине случаев блефует полбанка, в половине — чек.`);
      }
      close = equity >= 0.6;
      return result('check', 0, `Шанс ${percent} % — средняя рука: проще чек и дойти до вскрытия дёшево.`);
    }
    close = Math.abs(equity - valueNeed) < 0.04;
    if (equity >= valueNeed) {
      if (spr < 1.5 && topPairPlus) {
        return result('allin', stack, `Шанс ${percent} %, а в стеке меньше полутора банков (SPR ${sprText}) — ставь всё сразу.`);
      }
      return result('bet', pot * 0.66, `Шанс ${percent} % — ты, скорее всего, впереди: ставь 2/3 банка, пусть платят худшие руки.`);
    }
    if (strongDraw && opponents <= 2) {
      return result('bet', pot * 0.5, `Сильное дро (${draws.outs} аутов): полбанка — можешь забрать банк сразу или доехать.`);
    }
    return result('check', 0, `Шанс ${percent} % — для ставки маловато, бесплатная карта тоже хорошо.`);
  }

  const price = Math.min(bet, stack);
  const potOdds = price / (pot + bet + price);
  // Повышаем, только если впереди даже против рук, которыми ставят «по делу» (без блефов).
  vsValue = calcEquity({ hero, board, opponents, ranges: value ? [...value, ...ranges.slice(1)] : ranges,
    iterations: Math.round(iterations / 2), random }).equity;
  // На ривере повышение уравняют только руки получше — нужен запас побольше.
  // При глубоких стеках (SPR > 6) одной парой банк не раздуваем.
  const deepOnePair = spr > 6 && !bigHand;
  const raiseNeed = heroAggressor ? 0.9 : 0.8; // по солверу рейзят только очень сильным
  if (vsValue >= Math.max(valueNeed, raiseNeed) && price < stack && !deepOnePair) {
    return result('raise', bet * 3, `Ты впереди даже против рук, которыми так ставят без блефа (${percentText(vsValue)} %), — повышай втрое.`);
  }
  // Маленький SPR и старшая пара или сильнее: сдаваться поздно — ва-банк.
  if (spr < 3 && topPairPlus && equity >= potOdds) {
    return result('allin', stack, `Стек меньше трёх банков (SPR ${sprText}), а у тебя ${handName.toLowerCase()} — с такой рукой при маленьком стеке идут ва-банк.`);
  }

  // Дро. На флопе впереди ещё ставки — шанс реализуется не полностью (на тёрне снова платить).
  // Зато при глубоких стеках, когда доедешь, выиграешь ещё (неявные шансы) — если ставка не больше банка.
  const drawing = !madeHand && !river && price < stack;
  // Будущий выигрыш — только для настоящих дро (4+ аута), а не для рук «ни с чем».
  const realDraw = drawing && draws.outs >= 4;
  const futureWin = realDraw && spr >= 4 && bet <= pot ? 0.3 * Math.min(stack - price, pot + bet + price) : 0;
  const realized = drawing && board.length === 3 ? equity * 0.87 : equity;
  const drawOdds = price / (pot + bet + price + futureWin);

  // Решение зависит от того, как блефует соперник? Скажем об этом прямо.
  const flip = (other) => {
    if (!compareStyles || style === other) return null;
    const alt = postflopAdvice({ hero, board, opponents, pot, toCall, preflopAction, stack, style: other, preflop,
      iterations: Math.round(iterations / 2), random, compareStyles: false });
    return alt.action;
  };
  // Запас к цене колла (подобран по солверу): против обычной ставки 6 %, если ставит первым тот,
  // кто до флопа только уравнивал, — 10 %; против ва-банка 3 % и 25 % соответственно.
  const allInBet = bet >= stack;
  const margin = heroAggressor ? (allInBet ? 0.25 : 0.10) : (allInBet ? 0.03 : 0.06);
  close = Math.abs(realized - (drawOdds + margin)) < 0.04;
  // С какого шанса колл выгоден (цена колла + запас) — это и показываем игроку.
  needPct = Math.round((drawOdds + margin) * 100);
  if (realized >= drawOdds + margin) {
    const rare = flip('rare');
    const note = rare === 'fold' ? ' Но если он почти не блефует — пас.' : '';
    const implied = futureWin && realized < potOdds
      ? ` Напрямую колл чуть дороже шанса, но стеки глубокие: доедешь — выиграешь ещё.` : '';
    const deep = deepOnePair && vsValue >= 0.55 ? ' Стеки глубокие — одной парой банк не раздувай, просто уравнивай.' : '';
    return result('call', price, `Шанс ${percent} %, а колл выгоден от ${needPct} % — уравнивай.${implied}${deep}${note}`);
  }
  if (realized < equity && equity >= potOdds + margin) {
    return result('fold', 0, `Шанс ${percent} %, но это до ривера, а на тёрне снова придётся платить: дро стоит около ${percentText(realized)} %, а колл выгоден от ${needPct} %.`);
  }
  const often = flip('often');
  const note = often === 'call' || often === 'allin' ? ' Но если он часто блефует — колл.' : '';
  return result('fold', 0, `Шанс ${percent} %, а колл выгоден только от ${needPct} % — пас.${note}`);
}
