// Совет префлоп по таблицам стартовых рук.
// Уровень — крепкая база для обычной игры с живыми соперниками, не солвер.
import { handClass, parseRange } from './hands.js';
import { rankOf } from './cards.js';
import { topClasses, combosIn, PREFLOP_SHARE, chartCombos } from './ranges.js';
import { calcEquity } from './equity.js';
import { PREFLOP_DATA } from './preflopData.js';

// ---------- Таблицы солверов ----------
// Места полного стола (9) переводим в места таблиц (6-max): ранние места — как самое раннее (LJ).
const CHART_POS = ['LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
export const chartPos = (position) => (CHART_POS.includes(position.key) ? position.key : 'LJ');

// Средние частоты из таблиц: { raise, call, fold } в %, close — источники расходятся или смешивают.
export function chartLookup(situation, cls) {
  const sit = PREFLOP_DATA[situation];
  const row = sit?.hands[cls];
  if (!row) return null;
  const [raise, call, close] = row;
  const fold = Math.max(0, 100 - raise - call);
  // Сначала «играть или пас», потом «колл или рейз».
  const top = raise + call > fold ? (raise >= call ? 'raise' : 'call') : 'fold';
  return { raise, call, fold, top, close: close === 1, sources: sit.sources.length };
}
const mix = (v) => `рейз ${v.raise} %, колл ${v.call} %, пас ${v.fold} %`;
const solvers = (v) => `по таблицам ${v.sources} солверов`;

import { OPEN } from './openTables.js';
const openRange = (behind) => OPEN[Math.min(8, Math.max(1, behind))];
export const OPEN_RANGES = OPEN;

// Против лимперов (кто-то уравнял блайнд без повышения).
const LIMP_CALL = '22+, A2s+, KTs+, QTs+, JTs, T9s, 98s, 87s, 76s, 65s';

// Против одного повышения.
const THREEBET = 'QQ+, AKs, AKo';
const THREEBET_LATE = 'JJ+, AQs+, AKo, A5s';
const CALL_SMALL = '22-JJ, ATs-AQs, KJs+, QJs, JTs, T9s, 98s, AQo, KQo';
const CALL_BIG = '77-JJ, AQs, KQs, AQo';

// Спекулятивные руки: дешёвый колл ради большого банка, когда попадёшь (нужны глубокие стеки).
const SPECULATIVE = 'A2s-A9s, KTs, QTs, J9s, T9s, 98s, 87s, 76s, 65s, 54s, T8s, 97s, 86s, 75s';
// Сколько эффективных стеков (в разах от цены колла) нужно, чтобы ловить сет / доезжать.
const SET_MINING_IN_POSITION = 18; // 15–20 по книгам, в позиции
const SET_MINING_OUT_OF_POSITION = 25; // без позиции — нужно больше
const SPECULATIVE_IMPLIED = 30;

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
 * bigBlind — размер большого блайнда (все суммы в тех же деньгах);
 * stack — эффективный стек: меньший из твоего и соперника (больше него не выиграешь и не проиграешь).
 * Возвращает { action, amount, text, reason, hand }.
 */
/**
 * opener — место повысившего (positionInfo), threeBettor — место повысившего второй раз,
 * heroOpened — первым повышал ты сам (тогда «Повысили ×2» = 3-бет против тебя).
 */
export function preflopAdvice({ hero, position, action = 'none', limpers = 0, raiseTo = 0, bigBlind = 1, stack = Infinity,
  opener = null, threeBettor = null, heroOpened = false }) {
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
    const v = position.behind <= 5 ? chartLookup(`open:${chartPos(position)}`, cls) : null;
    if (v) {
      const opens = v.top === 'raise';
      return { ...result(opens ? 'raise' : 'fold', opens ? 3 * bb : 0, opens
        ? `${cls} с этого места открывают: ${solvers(v)} рейз в ${v.raise} % случаев.`
        : `${cls} с этого места не открывают: ${solvers(v)} рейз только в ${v.raise} % случаев.`), close: v.close };
    }
    if (inRange(cls, openRange(position.behind))) {
      return result('raise', 3 * bb, `${cls} достаточно сильна, чтобы входить первым с этой позиции.`);
    }
    // На грани: с соседнего (более позднего) места эту руку уже открывают.
    const edge = inRange(cls, openRange(position.behind - 1));
    return { ...result('fold', 0, edge
      ? `${cls} — на самой границе: с этого места по таблицам пас, а на одно место позже уже открывают.`
      : `${cls} слишком слабая для этой позиции: после тебя ещё ${position.behind} игроков.`), close: edge };
  }

  // Сколько реально доплатить (блайнд уже на столе) и во сколько раз стек больше этой цены.
  const posted = isBB ? bb : position.key === 'SB' ? bb / 2 : 0;
  const implied = (cost) => (cost > 0 ? stack / cost : Infinity);
  const isPair = cls.length === 2;
  const inPosition = position.group !== 'blinds';

  // Ответ на одно повышение по таблицам солверов. null — таблицы для этой пары мест нет.
  function chartVsOpen() {
    let heroKey = chartPos(position);
    const openerKey = opener ? chartPos(opener) : (['LJ', 'HJ'].includes(heroKey) ? 'LJ' : 'HJ');
    // Оба на ранних местах полного стола: ты — следующий после открывшего.
    if (heroKey === openerKey || (heroKey === 'LJ' && openerKey !== 'LJ')) heroKey = 'HJ';
    const v = chartLookup(`vsopen:${heroKey}:${openerKey}`, cls);
    if (!v) return null;
    const who = opener ? '' : ' (кто повысил, не отмечено — считаю, что средняя позиция)';
    const threeBetSize = (position.group === 'blinds' ? 4 : 3) * raiseTo;
    let act = v.top, close = v.close, note = '';
    // Таблицы посчитаны для повышения в 2,5–3 ББ. Больше — уравниваем только уверенные коллы.
    if (act === 'call' && raiseBB > 4 && v.call < 70) { act = 'fold'; close = true; note = ' Повышение крупнее обычного — уравнивать дорого.'; }
    // Таблицы — для 100 ББ. При стеке меньше 60 ББ коллы ради сета и «на попадание» не окупаются.
    const speculative = (isPair && inRange(cls, '22-77')) || inRange(cls, SPECULATIVE);
    if (act === 'call' && speculative && stack / bb < 60) { act = 'fold'; close = true; note = ` Стек меньше 60 ББ: ради сета или флеша уравнивать уже невыгодно — потом мало выиграешь.`; }
    // Живая игра: руки «на попадание» (одномастные связки, тузы одной масти, маленькие пары) на баттоне
    // или большом блайнде при глубоком стеке уравнивают, если солверы хоть иногда их играют, —
    // за живым столом собранный стрит или флеш оплачивают чаще, чем в онлайн-таблицах.
    const liveSpec = (isPair && inRange(cls, '22-99')) || inRange(cls, SPECULATIVE);
    if (act === 'fold' && liveSpec && ['BTN', 'BB'].includes(heroKey) && raiseBB <= 3.5 && stack / bb >= 80 && v.raise + v.call >= 12) {
      act = 'call'; close = true; note = ' В живой игре такие руки уравнивают: соберёшь стрит, флеш или сет — заплатят.';
    }
    // Минимальное повышение дешевле, чем в таблицах: руки «на грани» можно уравнять.
    if (act === 'fold' && raiseBB <= 2.2 && v.raise + v.call >= 25) { act = 'call'; close = true; note = ' Повышение минимальное — дешевле, чем в таблицах, поэтому можно уравнять.'; }
    // Глубокие стеки (150+ ББ): маленькую пару можно уравнять ради сета — так советуют книги.
    if (act === 'fold' && isPair && inRange(cls, '22-JJ') && stack / bb >= 150
      && implied(cost) >= (inPosition ? SET_MINING_IN_POSITION : SET_MINING_OUT_OF_POSITION)) {
      act = 'call'; close = true; note = ` Стеки очень глубокие — уравнивай ради сета (приходит раз из 8,5).`;
    }
    const amount = act === 'raise' ? threeBetSize : act === 'call' ? raiseTo : 0;
    const head = act === 'raise' ? `${cls} — повышай снова (3-бет).` : act === 'call' ? `${cls} — уравнивай.` : `${cls} против этого повышения сбрасывают.`;
    return { ...result(act, amount, `${head} По таблицам ${v.sources} солверов: ${mix(v)}.${note}${who}`), close };
  }

  if (action === 'limp') {
    const raiseSize = (3 + limpers) * bb;
    // Повышаем, если рука входит в диапазон с запасом: каждый лимпер — как два лишних игрока после тебя.
    if (inRange(cls, openRange(position.behind + 2 * limpers + 1))) {
      return result('raise', raiseSize, `${cls} — сильная рука, повышай и забирай инициативу у лимперов.`);
    }
    if (isBB) return result('check', 0, 'Можно посмотреть флоп бесплатно.');
    // Малый блайнд доплачивает всего полблайнда при уже большом банке — входим шире.
    if (position.key === 'SB' && topClasses(0.55).has(cls)) {
      return result('call', bb, `Доплатить всего полблайнда, а в банке уже ${limpers + 2} блайнда — с ${cls} выгодно посмотреть флоп.`);
    }
    // Поздняя позиция и всего один лимпер: эту руку ты бы и так открыл с этого места —
    // за один блайнд и с позицией смотреть флоп выгодно (повысить тоже не ошибка).
    // Против нескольких лимперов в позиции — ещё и две старшие карты (от десятки) разных мастей:
    // стриты и сильные пары, а цена — один блайнд при большом банке.
    const broadway = hero.every((c) => rankOf(c) >= 10);
    if (late && limpers >= 2 && broadway && inRange(cls, openRange(position.behind))) {
      return result('call', bb, `${limpers} ${limpers >= 5 ? 'лимперов' : 'лимпера'}, а ты в позиции: ${cls} — две старшие карты (стриты и сильные пары), а доплатить всего один блайнд при банке в ${limpers + 1.5} блайнда.`);
    }
    if (late && limpers === 1 && inRange(cls, openRange(position.behind))) {
      return { ...result('call', bb, `Один лимпер, а ты в позиции: с этого места ${cls} ты бы и так открыл. Доплатить один блайнд и посмотреть флоп выгодно, повысить до ${chips(raiseSize)} тоже можно.`), close: true };
    }
    if (inRange(cls, LIMP_CALL) && inRange(cls, openRange(position.behind)) && implied(bb) >= 20) {
      return result('call', bb, `${cls} хорошо играет в многосторонних банках: дёшево, а попадёшь в сет или дро — выиграешь много.`);
    }
    return result('fold', 0, `${cls} не стоит денег даже против лимперов.`);
  }

  const raiseBB = raiseTo / bb;
  const cost = raiseTo - posted;

  if (action === 'raise') {
    const threeBetSize = (position.group === 'blinds' ? 4 : 3) * raiseTo;
    const fromChart = chartVsOpen();
    if (fromChart) return fromChart;
    const threeBetRange = late || position.group === 'blinds' ? THREEBET_LATE : THREEBET;
    if (inRange(cls, threeBetRange)) {
      return result('raise', threeBetSize, `${cls} — одна из лучших рук, повышай снова (3-бет).`);
    }
    // Маленькие и средние пары: ловим сет, если стеки глубокие.
    if (isPair && inRange(cls, '22-JJ')) {
      const need = inPosition ? SET_MINING_IN_POSITION : SET_MINING_OUT_OF_POSITION;
      if (implied(cost) >= need) {
        return result('call', raiseTo, `Ловим сет: он приходит раз из 8,5, а стек в ${Math.floor(implied(cost))} раз больше цены колла — попадёшь, выиграешь много.`);
      }
      if (inRange(cls, '77-JJ') && raiseBB <= 4.5) {
        return result('call', raiseTo, `${cls} достаточно сильна, чтобы уравнять, но стек маловат, чтобы играть «на сет».`);
      }
      return result('fold', 0, `${cls} против повышения играет «на сет», а для этого стек должен быть хотя бы в ${need} раз больше цены колла (сейчас в ${Math.floor(implied(cost))}).`);
    }
    // Тузы одной масти: флеш (часто натсовый), стрит A-2-3-4-5 и пара с тузом. Против минимального
    // повышения — колл с любого места, против повышения до 4 ББ — с поздних мест и блайндов.
    if (inRange(cls, 'A2s-A9s')) {
      if (raiseBB <= 2.5 && implied(cost) >= 15) {
        return result('call', raiseTo, `Повышение минимальное, а ${cls} — флеш с тузом, стрит A-2-3-4-5 и пара тузов. За такую цену стоит посмотреть флоп.`);
      }
      if (raiseBB <= 4 && (late || position.group === 'blinds') && implied(cost) >= 20) {
        return result('call', raiseTo, `${cls} из поздней позиции или с блайнда — колл: флеш с тузом окупает дешёвые входы.`);
      }
    }
    // Одномастные связки и тузы: дёшево, в позиции или на ББ, при глубоких стеках.
    if (inRange(cls, SPECULATIVE) && raiseBB <= 4 && (late || isBB) && implied(cost) >= SPECULATIVE_IMPLIED) {
      return result('call', raiseTo, `${cls} — рука «на попадание»: колл дешёвый, стеки глубокие, а флеш или стрит выиграют большой банк.`);
    }
    // Защита ББ по таблицам: чем дешевле повышение, тем больше рук защищаем
    // (против 2–2,5 ББ около половины, против 3 ББ ~38 %, против 4 ББ ~28 %).
    const defend = raiseBB <= 2.5 ? 0.5 : raiseBB <= 3.5 ? 0.38 : raiseBB <= 4.5 ? 0.28 : 0.18;
    if (isBB && topClasses(defend).has(cls)) {
      return { ...result('call', raiseTo, `Доплатить ${chips(cost)}, часть ставки уже в банке — с ${cls} большой блайнд защищают.`),
        close: !topClasses(defend - 0.06).has(cls) };
    }
    const bbEdge = isBB && topClasses(defend + 0.06).has(cls);
    const callRange = raiseBB > 4.5 ? CALL_BIG : CALL_SMALL;
    if (inRange(cls, callRange) && !isPair) {
      return result('call', raiseTo, `${cls} неплохо играет против повышения, но для 3-бета слабовата.`);
    }
    if (bbEdge) {
      return { ...result('fold', 0, `${cls} на границе защиты большого блайнда: по таблицам чаще пас, но колл — небольшая ошибка.`), close: true };
    }
    return result('fold', 0, `Против повышения ${cls} слишком слабая.`);
  }

  if (action === '3bet') {
    // Ты открыл, тебе ответили 3-бетом — таблицы «открывший против 3-бетора».
    if (heroOpened && threeBettor) {
      const v = chartLookup(`vs3bet:${chartPos(position)}:${chartPos(threeBettor)}`, cls);
      if (v) {
        const act = v.top;
        const text = act === 'raise' ? `${cls} — повышай ещё (4-бет): ${solvers(v)} ${mix(v)}.`
          : act === 'call' ? `${cls} уравнивает 3-бет: ${solvers(v)} ${mix(v)}.`
          : `${cls} против 3-бета сбрасывают: ${solvers(v)} ${mix(v)}.`;
        return { ...result(act, act === 'raise' ? 2.3 * raiseTo : act === 'call' ? raiseTo : 0, text), close: v.close };
      }
    }
    if (inRange(cls, FOURBET)) {
      return result('raise', 2.3 * raiseTo, `${cls} — сильнейшая рука, повышай ещё (4-бет).`);
    }
    if (inRange(cls, CALL_3BET)) {
      return result('call', raiseTo, `${cls} достаточно сильна, чтобы уравнять 3-бет, но не для 4-бета.`);
    }
    if (isPair && inRange(cls, '77-TT') && implied(cost) >= 20) {
      return result('call', raiseTo, `Против 3-бета ${cls} — только «на сет»: стек в ${Math.floor(implied(cost))} раз больше цены, это допустимо.`);
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
export function preflopEquity({ hero, action = 'none', limpers = 1, iterations = 3000, random = Math.random, opener = null }) {
  // Знаем, кто повысил, — его руки из таблиц солверов (открытие с его места).
  if (action === 'raise' && opener) {
    const range = opener.behind >= 6 ? combosIn(parseRange(OPEN[Math.min(8, opener.behind)])) : chartCombos(`open:${chartPos(opener)}`, 'raise');
    if (range) {
      const { equity } = calcEquity({ hero, opponents: 1, ranges: [{ groups: [range], weights: [1] }], iterations, random });
      return { equity, opponents: 1, label: `против рук открытия: ${opener.name}` };
    }
  }
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
