// Совет префлоп по таблицам стартовых рук.
// Уровень — крепкая база для обычной игры с живыми соперниками, не солвер.
import { handClass, parseRange } from './hands.js';
import { rankOf } from './cards.js';
import { topClasses, combosIn, PREFLOP_SHARE } from './ranges.js';
import { calcEquity } from './equity.js';

// Открытие (первым входишь в банк): чем больше игроков после тебя, тем уже диапазон.
const OPEN = {
  7: '77+, A9s+, KTs+, QTs+, JTs, AJo+, KQo',
  6: '66+, A8s+, KTs+, QTs+, JTs, T9s, AJo+, KQo',
  5: '55+, A2s+, KTs+, QTs+, JTs, T9s, 98s, ATo+, KQo',
  4: '44+, A2s+, K9s+, Q9s+, J9s+, T9s, 98s, 87s, ATo+, KJo+, QJo',
  3: '22+, A2s+, K7s+, Q8s+, J8s+, T8s+, 97s+, 87s, 76s, 65s, A9o+, KTo+, QTo+, JTo',
  2: '22+, A2s+, K2s+, Q5s+, J7s+, T7s+, 96s+, 86s+, 75s+, 64s+, 54s, A2o+, K9o+, Q9o+, J9o+, T9o, 98o',
  1: '22+, A2s+, K5s+, Q7s+, J7s+, T7s+, 97s+, 86s+, 76s, 65s, 54s, A5o+, K9o+, QTo+, JTo',
};
const openRange = (behind) => OPEN[Math.min(7, Math.max(1, behind))];

// Против лимперов (кто-то уравнял блайнд без повышения).
const LIMP_CALL = '22+, A2s+, KTs+, QTs+, JTs, T9s, 98s, 87s, 76s, 65s';

// Против одного повышения.
const THREEBET = 'QQ+, AKs, AKo';
const THREEBET_LATE = 'JJ+, AQs+, AKo, A5s';
const CALL_SMALL = '22-JJ, ATs-AQs, KJs+, QJs, JTs, T9s, 98s, AQo, KQo';
const CALL_BB_EXTRA = 'A2s+, K9s+, Q9s+, J9s+, T8s+, 97s+, 87s, 76s, 65s, ATo+, KJo+, QJo';
const CALL_BIG = '77-JJ, AQs, KQs, AQo';

// Против повторного повышения (3-бета).
const FOURBET = 'KK+, AKs';
const CALL_3BET = 'QQ, JJ, AKo, AQs';

const ranges = new Map();
const inRange = (cls, text) => {
  if (!ranges.has(text)) ranges.set(text, parseRange(text));
  return ranges.get(text).has(cls);
};

const chips = (amount) => Math.round(amount * 10) / 10;

/**
 * hero — 2 карты; position — из positionInfo;
 * action — что было до тебя: 'none' (все сбросили или ты первый), 'limp',
 *   'raise' (одно повышение), '3bet' (повышение на повышение);
 * limpers — сколько игроков уравняли блайнд; raiseTo — до скольки повысили;
 * bigBlind — размер большого блайнда (все суммы в тех же деньгах).
 * Возвращает { action, amount, text, reason, hand }.
 */
export function preflopAdvice({ hero, position, action = 'none', limpers = 0, raiseTo = 0, bigBlind = 1, stack = Infinity }) {
  const cls = handClass(hero[0], hero[1]);
  const bb = bigBlind;
  const late = position.group === 'late';
  const isBB = position.key === 'BB';
  const result = (act, amount, reason) => {
    // Если ставка съедает треть стека и больше — честнее сразу ва-банк.
    if ((act === 'raise' || act === 'call') && amount >= stack * (act === 'raise' ? 0.35 : 1)) {
      act = 'allin'; amount = stack;
      reason += ' Стек маленький, поэтому сразу ва-банк.';
    }
    return {
      action: act,
      amount: amount ? chips(amount) : 0,
      text: ACTION_TEXT[act] + (amount ? ` до ${chips(amount)}` : ''),
      reason,
      hand: cls,
    };
  };

  // Короткий стек (15 больших блайндов и меньше): играем «ва-банк или пас».
  const stackBB = stack / bb;
  if (stackBB <= 15) {
    if (action === 'none' || action === 'limp') {
      if (isBB && action === 'none') return result('check', 0, 'Все сбросили до тебя — ты уже забрал блайнды.');
      const base = { 1: 0.5, 2: 0.38, 3: 0.26, 4: 0.2, 5: 0.16, 6: 0.13 }[Math.min(position.behind, 7)] ?? 0.11;
      const share = base * (stackBB > 10 ? 0.7 : 1) * (action === 'limp' ? 0.8 : 1);
      // Карманные пары с коротким стеком — всегда ва-банк (до 10 ББ любая, до 15 ББ от 55).
      const pairRank = cls.length === 2 ? hero.map(rankOf)[0] : 0;
      const pairShove = pairRank && (stackBB <= 10 || pairRank >= 5);
      if (pairShove || topClasses(share, true).has(cls)) {
        return result('allin', stack, `Стек всего ${chips(stackBB)} ББ: с ${cls} выгоднее сразу ва-банк — соперники чаще сбросят.`);
      }
      return result(isBB ? 'check' : 'fold', 0, `Стек ${chips(stackBB)} ББ — тут играют «ва-банк или пас», а ${cls} для ва-банка слабовата.`);
    }
    const share = (action === '3bet' ? 0.04 : 0.07) + (stackBB <= 10 ? 0.04 : 0);
    if (topClasses(share, true).has(cls)) {
      return result('allin', stack, `Короткий стек и сильная рука: ${cls} — ва-банк.`);
    }
    return result('fold', 0, `Со стеком ${chips(stackBB)} ББ против повышения ${cls} — пас.`);
  }

  if (action === 'none') {
    if (isBB) return result('check', 0, 'Все сбросили до тебя — ты уже забрал блайнды.');
    if (inRange(cls, openRange(position.behind))) {
      return result('raise', 3 * bb, `${cls} достаточно сильна, чтобы входить первым с этой позиции.`);
    }
    return result('fold', 0, `${cls} слишком слабая для этой позиции: после тебя ещё ${position.behind} игроков.`);
  }

  if (action === 'limp') {
    const raiseSize = (3 + limpers) * bb;
    // Повышаем, если рука входит в диапазон с запасом (на позицию строже).
    if (inRange(cls, openRange(position.behind + limpers + 1))) {
      return result('raise', raiseSize, `${cls} — сильная рука, повышай и забирай инициативу у лимперов.`);
    }
    if (isBB) return result('check', 0, 'Можно посмотреть флоп бесплатно.');
    if (inRange(cls, LIMP_CALL) && inRange(cls, openRange(position.behind))) {
      return result('call', bb, `${cls} хорошо играет в многосторонних банках: можно доехать до сета или дро.`);
    }
    return result('fold', 0, `${cls} не стоит денег даже против лимперов.`);
  }

  const raiseBB = raiseTo / bb;

  if (action === 'raise') {
    const threeBetRange = late || position.group === 'blinds' ? THREEBET_LATE : THREEBET;
    const threeBetSize = (position.group === 'blinds' ? 4 : 3) * raiseTo;
    if (inRange(cls, threeBetRange)) {
      return result('raise', threeBetSize, `${cls} — одна из лучших рук, повышай снова (3-бет).`);
    }
    const callRange = raiseBB > 4.5 ? CALL_BIG : CALL_SMALL;
    if (inRange(cls, callRange) || (isBB && raiseBB <= 3.5 && inRange(cls, CALL_BB_EXTRA))) {
      return result('call', raiseTo, isBB
        ? `${cls}: часть ставки уже в банке, цена колла хорошая.`
        : `${cls} неплохо играет против повышения, но для 3-бета слабовата.`);
    }
    return result('fold', 0, `Против повышения ${cls} слишком слабая.`);
  }

  if (action === '3bet') {
    if (inRange(cls, FOURBET)) {
      return result('raise', 2.3 * raiseTo, `${cls} — сильнейшая рука, повышай ещё (4-бет).`);
    }
    if (inRange(cls, CALL_3BET)) {
      return result('call', raiseTo, `${cls} достаточно сильна, чтобы уравнять 3-бет, но не для 4-бета.`);
    }
    return result('fold', 0, `Против повторного повышения ${cls} лучше сбросить.`);
  }

  throw new Error(`Неизвестное действие: ${action}`);
}

export const ACTION_TEXT = {
  allin: 'Ва-банк',
  fold: 'Пас',
  check: 'Чек',
  call: 'Колл',
  bet: 'Ставка',
  raise: 'Рейз',
};

/**
 * Шанс префлоп против тех, кто реально играет: при «все сбросили» — против одного
 * (кто-то из блайндов уравняет), при лимпах — против лимперов, при повышении —
 * против диапазона повысившего. Возвращает { equity, opponents, label }.
 */
export function preflopEquity({ hero, action = 'none', limpers = 1, iterations = 3000, random = Math.random }) {
  if (action === 'raise' || action === '3bet') {
    const range = combosIn(topClasses(action === '3bet' ? PREFLOP_SHARE.threeBettor : PREFLOP_SHARE.raiser));
    const { equity } = calcEquity({ hero, opponents: 1, ranges: [{ groups: [range], weights: [1] }], iterations, random });
    return { equity, opponents: 1, label: 'против руки повысившего' };
  }
  const opponents = action === 'limp' ? Math.max(1, limpers) : 1;
  const open = combosIn(topClasses(PREFLOP_SHARE.open));
  const ranges = Array.from({ length: opponents }, () => ({ groups: [open], weights: [1] }));
  const { equity } = calcEquity({ hero, opponents, ranges, iterations, random });
  return { equity, opponents, label: opponents === 1 ? 'против одного соперника' : `против ${opponents} соперников` };
}
