// Совет префлоп по таблицам стартовых рук.
// Уровень — крепкая база для обычной игры с живыми соперниками, не солвер.
import { handClass, parseRange } from './hands.js';

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
 * bigBlind — размер большого блайнда (все суммы в тех же фишках).
 * Возвращает { action, amount, text, reason, hand }.
 */
export function preflopAdvice({ hero, position, action = 'none', limpers = 0, raiseTo = 0, bigBlind = 1 }) {
  const cls = handClass(hero[0], hero[1]);
  const bb = bigBlind;
  const late = position.group === 'late';
  const isBB = position.key === 'BB';
  const result = (act, amount, reason) => ({
    action: act,
    amount: amount ? chips(amount) : 0,
    text: ACTION_TEXT[act] + (amount ? ` до ${chips(amount)}` : ''),
    reason,
    hand: cls,
  });

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
  fold: 'Пас',
  check: 'Чек',
  call: 'Колл',
  bet: 'Ставка',
  raise: 'Рейз',
};
