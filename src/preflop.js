// Совет префлоп по таблицам стартовых рук.
// Уровень — крепкая база для обычной игры с живыми соперниками, не солвер.
import { handClass, parseRange } from './hands.js';
import { rankOf } from './cards.js';
import { topClasses, combosIn, PREFLOP_SHARE, chartCombos } from './ranges.js';
import { calcEquity } from './equity.js';
import { PREFLOP_DATA } from './preflopData.js';
import { nashHU } from './nashHU.js';
import { huCall } from './huCall.js';
import { NASH_RING } from './nashRing.js';
import { allClasses } from './hands.js';

// Полный стол, до 25 ББ (src/nashRing.js): ва-банк и колл против ва-банка по Нэшу.
const CLASSES = allClasses();
const ringCache = new Map();
export function ringSet(ante, behind, stackBB, which) {
  const m = String(Math.min(8, Math.max(1, behind)));
  const S = String(Math.min(25, Math.max(1, Math.round(stackBB))));
  const id = `${ante ? 1 : 0}:${m}:${S}:${which}`;
  if (!ringCache.has(id)) {
    const hex = NASH_RING[ante ? 1 : 0][m][S][which];
    let bits = ''; for (const ch of hex) bits += parseInt(ch, 16).toString(2).padStart(4, '0');
    ringCache.set(id, new Set(CLASSES.filter((_, i) => bits[i] === '1')));
  }
  return ringCache.get(id);
}

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

// Живая игра по умолчанию (2026-10-07, владелец играет вживую): шире открытия и коллы в позиции,
// крупнее открытие — так советуют профи против слабых живых соперников.
export const LIVE_GAME = true;
const OPEN_SIZE = 3.5; // в живой игре открывают крупнее, чем 2,5–3 ББ онлайн
const OPEN_SIZE_HU = 2.5; // один на один (3,5 ББ — размер для полного стола)
// Один на один до этого стека — «ва-банк или пас» по таблице Нэша (src/nashHU.js, проверено 2026-10-12).
export const HU_PUSH_FOLD_BB = 20;
// Полный стол: 15–25 ББ — часть рук ва-банк, остальное маленький рейз (см. firstIn в preflopAdvice).
export const MID_STACK_BB = 25;
// Размер открытия от стека (2026-10-12, источники сходятся: MTT Poker School — 2× до 30 ББ, 2,3× при 40–60;
// RangerPro — 2–2,2× при 15–25 ББ, 2,5–3× там — частая ошибка). Глубже 60 ББ — живая игра, 3,5 ББ.
export const openSizeFor = (stackBB, headsUp) => (headsUp ? OPEN_SIZE_HU : stackBB < 30 ? 2 : stackBB < 60 ? 2.3 : OPEN_SIZE);
const solvers = (v) => `по таблицам ${v.sources} солверов`;

import { OPEN } from './openTables.js';
const openRange = (behind) => OPEN[Math.min(8, Math.max(1, behind))];
export const OPEN_RANGES = OPEN;

// Против лимперов (кто-то уравнял блайнд без повышения).
const LIMP_CALL = '22+, A2s+, KTs+, QTs+, JTs, T9s, 98s, 87s, 76s, 65s';
// Изоляция лимпера (2026-10-16): руки, которые повышают ВСЕ найденные источники — списки Preflop Wizard (6-max, 100 ББ,
// один лимпер) — самые узкие из источников (GrindLab, pokerpro.tools, GTO Wizard через PokerNews дают шире). Наш рейз вне
// этих списков — «спорно»: источники расходятся (баттон — от 17 до 45 % рук).
const ISO_SURE = {
  BTN: '77+, A2s+, ATo+, KTs+, KQo, QTs+, JTs, T9s, 98s, 87s, 76s, 65s, KJo, QJo',
  CO: '88+, A2s+, AJo+, KJs+, QTs+, JTs, T9s, 98s, KTo',
  HJ: '99+, ATs+, AQo+, KJs+, QJs, JTs, T9s',
  SB: '88+, ATs+, A5s-A2s, AJo+, KTs+, QJs, JTs, T9s',
  BB: '99+, AQs+, AQo+, KQs',
};

// Против одного повышения.
const THREEBET = 'QQ+, AKs, AKo';
const THREEBET_LATE = 'JJ+, AQs+, AKo, A5s';
const CALL_SMALL = '22-JJ, ATs-AQs, KJs+, QJs, JTs, T9s, 98s, AQo, KQo';
const CALL_BIG = '77-JJ, AQs, KQs, AQo';

// Спекулятивные руки: дешёвый колл ради большого банка, когда попадёшь (нужны глубокие стеки).
const SPECULATIVE = 'A2s-A9s, KTs, QTs, J9s, T9s, 98s, 87s, 76s, 65s, 54s, T8s, 97s, 86s, 75s';
// Сколько эффективных стеков (в разах от цены колла) нужно, чтобы ловить сет / доезжать.
// Живая игра — что дополнительно уравниваем против одного повышения (см. chartVsOpen).
const LIVE_CALL = '22-99, A2s-A9s, KTs+, QTs+, JTs, J9s, T9s, T8s, 98s, 87s, 76s, 65s, 54s';
const LIVE_CALL_LATE = 'KQo, KJo, KTo, QJo, QTo, JTo, ATo, AJo';
const SET_MINING_IN_POSITION = 18; // 15–20 по книгам, в позиции
const SET_MINING_OUT_OF_POSITION = 25; // без позиции — нужно больше
const SPECULATIVE_IMPLIED = 30;

// Против повторного повышения (3-бета).
const FOURBET = 'KK+, AKs';
const CALL_3BET = 'QQ, JJ, AKo, AQs';

// Сильные руки, которые первым в раздачу не сбрасывают ни при каком стеке (проверка — scripts/audit.mjs).
const PREMIUM = new Set(['AA', 'KK', 'QQ', 'JJ', 'TT', 'AKs', 'AKo', 'AQs', 'AQo', 'AJs', 'KQs']);

const ranges = new Map();
const inRange = (cls, text) => {
  if (!ranges.has(text)) ranges.set(text, parseRange(text));
  return ranges.get(text).has(cls);
};

const chips = (amount) => Math.round(amount * 10) / 10;
// Для текста: дробные по-русски (2,5).
const ru = (amount) => String(chips(amount)).replace('.', ',');

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
 * ante — анте большого блайнда (в тех же деньгах, 0 — нет): один на один берётся таблица Нэша с анте.
 * opener — место повысившего (positionInfo), threeBettor — место повысившего второй раз,
 * heroOpened — первым повышал ты сам (тогда «Повысили ×2» = 3-бет против тебя).
 */
export function preflopAdvice({ hero, position, action = 'none', limpers = 0, raiseTo = 0, bigBlind = 1, stack = Infinity,
  opener = null, threeBettor = null, heroOpened = false, ante = 0 }) {
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
    // Повторное повышение при стеке до 30 ББ — сразу ва-банк (GTO Wizard: при 20–25 ББ 3-бет делают ва-банком).
    if (act === 'raise' && (action === 'raise' || action === '3bet') && stack / bigBlind <= 30) {
      act = 'allin'; amount = stack;
      reason += ' При стеке до 30 ББ повторно повышают сразу ва-банком: обычный 3-бет съел бы треть стека.';
    }
    return {
      action: act,
      amount: amount ? chips(amount) : 0,
      text: ACTION_TEXT[act] + (amount ? ` до ${chips(amount)}` : ''),
      reason,
      hand: cls,
    };
  };

  const stackBB = stack / bb;
  const headsUp = position.players === 2;
  const openSize = () => openSizeFor(stackBB, headsUp);

  // Один на один, стек до 20 ББ: малый блайнд — ва-банк или пас по таблице Нэша;
  // против ва-банка (или повышения) — колл по «средней» таблице (src/huCall.js):
  // соперник идёт ва-банк уже, чем по Нэшу, но шире осторожного игрока.
  if (headsUp && stackBB <= HU_PUSH_FOLD_BB && !(isBB && action !== 'raise' && action !== '3bet')) {
    const es = ru(stackBB);
    const withAnte = ante > 0; // анте платит ББ (≈ 1 ББ) — отдельная таблица
    const table = withAnte ? 'по таблице Нэша с анте' : 'по таблице Нэша';
    if (action === 'none') {
      return nashHU(stackBB, withAnte).push.has(cls)
        ? result('allin', stack, `Один на один, стек ${es} ББ: ${table} с ${cls} — ва-банк. Соперник часто сбросит, и банк твой без вскрытия.`)
        : result('fold', 0, `Один на один, стек ${es} ББ: ${table} ${cls} слишком слабая даже для ва-банка — пас.`);
    }
    const { call, row } = huCall(stackBB, withAnte);
    const facingAllIn = raiseTo >= stack;
    if (call.has(cls)) {
      return facingAllIn
        ? result('allin', stack, `Один на один, стек ${es} ББ: с ${cls} ва-банк соперника выгодно уравнять — шанс выше цены колла, если он идёт ва-банк хотя бы с ${ru(row.shovePct)} % рук.`)
        : result('allin', stack, `Один на один, стек ${es} ББ: с ${cls} — ва-банк. С этой рукой выгодно уравнять даже его ва-банк, а так он ещё и может сбросить.`);
    }
    return result('fold', 0, facingAllIn
      ? `Один на один, стек ${es} ББ: против ва-банка ${cls} слабовата — шанс ниже цены колла, пас.`
      : `Один на один, стек ${es} ББ: против повышения ${cls} слабовата — пас.`);
  }

  // Короткий стек (15 больших блайндов и меньше): играем «ва-банк или пас».
  if (stackBB <= 15) {
    if (action === 'none' || action === 'limp') {
      if (isBB && action === 'none') return result('check', 0, 'Все сбросили до тебя — ты уже забрал блайнды.');
      // Все сбросили — таблица Нэша для полного стола (МБ без анте — опубликованная таблица один на один).
      if (action === 'none') {
        const push = position.behind === 1 && !(ante > 0) ? nashHU(stackBB).push : ringSet(ante > 0, position.behind, stackBB, 0);
        const where = position.behind === 1 ? 'с малого блайнда против большого' : `с этого места (после тебя ${position.behind} ${position.behind < 5 ? 'игрока' : 'игроков'})`;
        // Сильные руки при 10–15 ББ первым не пасуем: чистый Нэш с ранних мест режет их на самой границе, а PokerSkill
        // (15 ББ) и Preflop Wizard (20 ББ) с ними идут ва-банк (сверка 2026-10-12, scripts/audit.mjs).
        if (!push.has(cls) && stackBB >= 10 && PREMIUM.has(cls)) {
          return { ...result('allin', stack, `Стек ${ru(stackBB)} ББ: ${cls} — сильная рука, ва-банк. По чистой таблице Нэша с этого места она на самой границе, но таблицы PokerSkill и Preflop Wizard с ней идут ва-банк.`), close: true };
        }
        return push.has(cls)
          ? result('allin', stack, `Стек ${ru(stackBB)} ББ, до тебя все сбросили: по таблице Нэша${ante > 0 ? ' с анте' : ''} ${where} ${cls} — ва-банк.`)
          : result('fold', 0, `Стек ${ru(stackBB)} ББ: по таблице Нэша${ante > 0 ? ' с анте' : ''} ${where} ${cls} слабовата для ва-банка — пас.`);
      }
      const base = { 1: 0.5, 2: 0.38, 3: 0.26, 4: 0.2, 5: 0.16, 6: 0.13 }[Math.min(position.behind, 7)] ?? 0.11;
      const share = base * (stackBB > 10 ? 0.7 : 1) * (action === 'limp' ? 0.8 : 1);
      // Карманные пары с коротким стеком — всегда ва-банк (до 10 ББ любая, до 15 ББ от 55).
      const pairRank = cls.length === 2 ? hero.map(rankOf)[0] : 0;
      const pairShove = pairRank && (stackBB <= 10 || pairRank >= 5);
      if (pairShove || topClasses(share, true).has(cls)) {
        return result('allin', stack, `Стек всего ${ru(stackBB)} ББ: с ${cls} выгоднее сразу ва-банк — ${headsUp ? 'соперник чаще сбросит' : 'соперники чаще сбросят'}.`);
      }
      return result(isBB ? 'check' : 'fold', 0, `Стек ${ru(stackBB)} ББ — тут играют «ва-банк или пас», а ${cls} для ва-банка слабовата.`);
    }
    // Против ва-банка — знаем, кто пошёл: колл по таблице Нэша для этой пары мест.
    if (action === 'raise' && opener && raiseTo >= stack && opener.behind > position.behind) {
      const j = opener.behind - 1 - position.behind;
      const calls = ringSet(ante > 0, opener.behind, stackBB, 1 + j);
      return calls.has(cls)
        ? result('allin', stack, `Стек ${ru(stackBB)} ББ: против ва-банка с этого места по таблице Нэша${ante > 0 ? ' с анте' : ''} ${cls} уравнивают — шанс выше цены колла.`)
        : result('fold', 0, `Стек ${ru(stackBB)} ББ: против ва-банка ${cls} слабовата — шанс ниже цены колла, пас.`);
    }
    const share = (action === '3bet' ? 0.04 : 0.07) + (stackBB <= 10 ? 0.04 : 0);
    if (topClasses(share, true).has(cls)) {
      return result('allin', stack, `Короткий стек и сильная рука: ${cls} — ва-банк.`);
    }
    return result('fold', 0, `Со стеком ${ru(stackBB)} ББ против повышения ${cls} — пас.`);
  }

  if (action === 'none') {
    if (isBB) return result('check', 0, 'Все сбросили до тебя — ты уже забрал блайнды.');
    const normal = firstIn();
    // 15–25 ББ за полным столом (сходятся GTO Wizard, Preflop Wizard, MTT Poker School): открывают маленьким рейзом,
    // а маленькие пары и слабые тузы с поздних мест — сразу ва-банк (после флопа играют плохо). Ва-банк — только если
    // рука проходит по Нэшу для этого места; руки, которые не открывают, — пас (чистый Нэш при 20 ББ слишком широк).
    if (!headsUp && stackBB > 15 && stackBB <= MID_STACK_BB && (position.group === 'late' || position.key === 'SB')) {
      const push = ringSet(ante > 0, position.behind, stackBB, 0);
      const poorPostflop = (cls.length === 2 && rankOf(hero[0]) <= 7) || /^A[2-9][so]$/.test(cls);
      if (push.has(cls) && poorPostflop) {
        return result('allin', stack, `Стек ${ru(stackBB)} ББ, позднее место: с ${cls} выгоднее сразу ва-банк, чем маленький рейз — после флопа такая рука играет плохо, а ва-банк часто забирает блайнды${ante > 0 ? ' и анте' : ''} без борьбы (проходит по таблице Нэша).`);
      }
    }
    return normal;
  }

  // Первым в раздачу (до тебя все сбросили) — по таблицам открытия.
  function firstIn() {
      const v = position.behind <= 5 ? chartLookup(`open:${chartPos(position)}`, cls) : null;
      if (v) {
        // Живая игра (по умолчанию): профи против слабых живых соперников открывают на 5–10 % рук больше —
        // руку открываем, если солверы хоть иногда открывают её с этого места, а с LJ и HJ ещё
        // и то, что уверенно открывают на соседнем месте позже.
        const key = chartPos(position);
        const NEXT = { LJ: 'HJ', HJ: 'CO' };
        const threshold = key === 'SB' ? 35 : 15;
        const nextV = NEXT[key] ? chartLookup(`open:${NEXT[key]}`, cls) : null;
        const strict = v.top === 'raise';
        const live = LIVE_GAME && (v.raise >= threshold || (nextV && nextV.raise >= 60));
        const opens = strict || live;
        const why = strict ? `${cls} с этого места открывают: ${solvers(v)} рейз в ${v.raise} % случаев.`
          : live ? `${cls} — открытие для живой игры: солверы с этого места открывают её редко (${v.raise} %), но против слабых соперников профи играют шире.`
          : `${cls} с этого места не открывают: ${solvers(v)} рейз только в ${v.raise} % случаев.`;
        return { ...result(opens ? 'raise' : 'fold', opens ? openSize() * bb : 0, why), close: v.close || (live && !strict) };
      }
      // Ранние места полного стола: в живой игре — на одну ступень свободнее.
      if (LIVE_GAME && !inRange(cls, openRange(position.behind)) && inRange(cls, openRange(position.behind - 1))) {
        return { ...result('raise', openSize() * bb, `${cls} — открытие для живой игры: по строгим таблицам с этого места пас, но против слабых соперников можно шире.`), close: true };
      }
      if (inRange(cls, openRange(position.behind))) {
        return result('raise', openSize() * bb, `${cls} достаточно сильна, чтобы входить первым с этой позиции.`);
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
    // Живая игра: против одного повышения на катоффе, баттоне и ББ уравниваем шире, чем строгие таблицы —
    // одномастные старшие руки, связки, пары, тузы одной масти; против позднего повышения (катофф,
    // баттон, МБ) — ещё и разномастные старшие (JT, QJ, KJ…). Так советуют профи против слабых живых соперников.
    const lateOpener = ['CO', 'BTN', 'SB'].includes(openerKey);
    // На ББ часть ставки уже в банке — разномастные старшие против обычного повышения (≤ 3 ББ) тоже уравниваем.
    const liveCall = inRange(cls, LIVE_CALL) || (inRange(cls, LIVE_CALL_LATE)
      && ((lateOpener && ['BTN', 'BB'].includes(heroKey)) || (heroKey === 'BB' && raiseBB <= 3)));
    if (LIVE_GAME && act === 'fold' && liveCall && ['CO', 'BTN', 'BB'].includes(heroKey) && raiseBB <= 3.5 && stack / bb >= 60) {
      act = 'call'; close = true;
      note = ' Строгие таблицы тут чаще пасуют, но в живой игре такую руку уравнивают: соберёшь пару с хорошим кикером, стрит, флеш или сет — заплатят.';
    }
    // Минимальное повышение дешевле, чем в таблицах: руки «на грани» можно уравнять.
    // (2026-10-12) Только при стеке от 40 ББ: при коротком стеке солверы против мин-рейза не уравнивают (колл 0 %) —
    // либо снова повышают (ва-банк), либо пас; после колла почти любой флоп — ва-банк без позиции.
    if (act === 'fold' && raiseBB <= 2.2 && v.raise + v.call >= 25 && stack / bb >= 40) { act = 'call'; close = true; note = ' Повышение минимальное — дешевле, чем в таблицах, поэтому можно уравнять.'; }
    // Глубокие стеки (150+ ББ): маленькую пару можно уравнять ради сета — так советуют книги.
    if (act === 'fold' && isPair && inRange(cls, '22-JJ') && stack / bb >= 150
      && implied(cost) >= (inPosition ? SET_MINING_IN_POSITION : SET_MINING_OUT_OF_POSITION)) {
      act = 'call'; close = true; note = ` Стеки очень глубокие — уравнивай ради сета (приходит раз из 8,5).`;
    }
    const amount = act === 'raise' ? threeBetSize : act === 'call' ? raiseTo : 0;
    const head = act === 'raise' ? `${cls} — повышай снова (3-бет).` : act === 'call' ? `${cls} — уравнивай.` : `${cls} против этого повышения сбрасывают.`;
    // Повышение крупнее 4 ББ: таблицы солверов посчитаны для обычного (2,5–3 ББ) — не ссылаемся на них.
    if (raiseBB > 4) {
      const share = Math.round((cost / stack) * 100);
      const commit = share >= 25 ? ` Колл — это ${share} % твоего стека: после него почти любой флоп пойдёт ва-банк, поэтому нужна рука, сильная сама по себе.` : '';
      const weakAce = act === 'fold' && /^A[2-9][so]$/.test(cls) ? ` ${cls} проигрывает любому тузу со старшей второй картой.` : '';
      const why = act === 'fold' ? ' Такое повышение обычно делают с сильной рукой.' : '';
      return { ...result(act, amount, `${head} Повышение до ${ru(raiseBB)} ББ — в ${ru(raiseBB / 2.75)} раза крупнее обычного (2,5–3 ББ).${why}${commit}${weakAce}${who}`), close };
    }
    return { ...result(act, amount, `${head} По таблицам ${v.sources} солверов: ${mix(v)}.${note}${who}`), close };
  }

  if (action === 'limp') {
    // Размер (2026-10-16): солвер GTO Wizard против одного лимпера при 50 и 100 ББ лучше всего повышает ~4,3 ББ, при 25 ББ —
    // 3–3,5 ББ (PokerNews, 03.2026); Preflop Wizard и GrindLab — +1 ББ за каждого лимпера и крупнее без позиции (из блайндов).
    const oop = position.group === 'blinds';
    const raiseSize = ((stackBB >= 40 ? 3.5 : 2.5) + limpers + (oop ? 1 : 0)) * bb;
    // С каждым лишним лимпером — на ступень уже (Preflop Wizard): баттон → как катофф → как хайджек.
    const tiers = ['BTN', 'CO', 'HJ'];
    const seat = isBB ? 'BB' : position.key === 'SB' ? 'SB'
      : tiers[Math.min(2, Math.max(0, tiers.indexOf(position.key === 'BTN' || position.key === 'CO' ? position.key : 'HJ')) + limpers - 1)];
    const sure = inRange(cls, ISO_SURE[seat]);
    const unsure = sure ? '' : ' Источники тут расходятся: часть повышает с такой рукой, часть — нет.';
    // Повышаем, если рука входит в диапазон с запасом: каждый лимпер — как два лишних игрока после тебя.
    if (inRange(cls, openRange(position.behind + 2 * limpers + 1))) {
      // Малый блайнд при 25 ББ и меньше: солвер только уравнивает или идёт ва-банк, без маленьких повышений (GTO Wizard).
      if (position.key === 'SB' && stackBB <= 25) {
        return { ...result('allin', stack, `Стек ${ru(stackBB)} ББ, малый блайнд против лимпа: солвер тут либо доплачивает, либо сразу ва-банк — с ${cls} ва-банк.${unsure}`), close: !sure };
      }
      return { ...result('raise', raiseSize, `${cls} — сильная рука, повышай и забирай инициативу у ${limpers > 1 ? 'лимперов' : 'лимпера'}.${unsure}`), close: !sure };
    }
    if (isBB) return result('check', 0, 'Можно посмотреть флоп бесплатно.');
    // Малый блайнд доплачивает всего полблайнда при уже большом банке — входим шире (солвер GTO Wizard тоже часто доплачивает).
    if (position.key === 'SB' && topClasses(0.55).has(cls)) {
      return result('call', bb, `Доплатить всего полблайнда, а в банке уже ${ru(limpers + 1.5 + (ante > 0 ? 1 : 0))} ББ — с ${cls} выгодно посмотреть флоп.`);
    }
    // Уравнять за лимпером не с блайндов: Preflop Wizard считает это почти всегда ошибкой (повышай или пас), солвер GTO Wizard
    // тут выбирает только из «повысить или пас» — поэтому такие коллы всегда «спорно».
    const broadway = hero.every((c) => rankOf(c) >= 10);
    if (late && limpers >= 2 && broadway && inRange(cls, openRange(position.behind))) {
      return { ...result('call', bb, `${limpers} ${limpers >= 5 ? 'лимперов' : 'лимпера'}, а ты в позиции: ${cls} — две старшие карты (стриты и сильные пары), а доплатить всего один блайнд при банке в ${ru(limpers + 1.5 + (ante > 0 ? 1 : 0))} ББ. Повысить тоже можно.`), close: true };
    }
    if (late && limpers === 1 && inRange(cls, openRange(position.behind))) {
      return { ...result('call', bb, `Один лимпер, а ты в позиции: с этого места ${cls} ты бы и так открыл. Доплатить один блайнд и посмотреть флоп выгодно, повысить до ${chips(raiseSize)} тоже можно.`), close: true };
    }
    if (inRange(cls, LIMP_CALL) && inRange(cls, openRange(position.behind)) && implied(bb) >= 20) {
      return { ...result('call', bb, `${cls} хорошо играет в многосторонних банках: дёшево, а попадёшь в сет или дро — выиграешь много. Повысить или сбросить тоже не ошибка.`), close: true };
    }
    // Пас рукой, которую ты бы открыл первым, — тоже на границе (широкие источники с ней изолируют).
    return { ...result('fold', 0, `${cls} не стоит денег даже против лимперов.`), close: inRange(cls, openRange(position.behind)) };
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
export function preflopEquity({ hero, action = 'none', limpers = 1, iterations = 3000, random = Math.random, opener = null, callers = 0 }) {
  // callers — сколько игроков уже уравняли повышение (отмечены на столе): шанс против всех, кто в банке.
  const extra = action === 'raise' || action === '3bet' ? Math.max(0, callers) : 0;
  const withCallers = (main, callerRange, label) => {
    const ranges = [{ groups: [main], weights: [1] }, ...Array.from({ length: extra }, () => ({ groups: [callerRange], weights: [1] }))];
    const { equity } = calcEquity({ hero, opponents: 1 + extra, ranges, iterations, random });
    const tail = extra ? ` и ${extra} ${extra === 1 ? 'уравнявшего' : 'уравнявших'}` : '';
    return { equity, opponents: 1 + extra, label: label + tail };
  };
  // Знаем, кто повысил, — его руки из таблиц солверов (открытие с его места).
  if (action === 'raise' && opener) {
    const range = opener.behind >= 6 ? combosIn(parseRange(OPEN[Math.min(8, opener.behind)])) : chartCombos(`open:${chartPos(opener)}`, 'raise');
    if (range) {
      // Уравнявшие — руки, с которыми уравнивают это открытие (таблица ББ), иначе лучшие 35 %.
      const callerRange = chartCombos(`vsopen:BB:${chartPos(opener)}`, 'call') || combosIn(topClasses(PREFLOP_SHARE.caller));
      return withCallers(range, callerRange, `против рук открытия: ${opener.name}`);
    }
  }
  if (action === 'raise' || action === '3bet') {
    const range = combosIn(topClasses(action === '3bet' ? PREFLOP_SHARE.threeBettor : PREFLOP_SHARE.raiser));
    return withCallers(range, combosIn(topClasses(PREFLOP_SHARE.caller)), 'против руки повысившего');
  }
  const opponents = action === 'limp' ? Math.max(1, limpers) : 1;
  const open = combosIn(topClasses(PREFLOP_SHARE.open));
  const ranges = Array.from({ length: opponents }, () => ({ groups: [open], weights: [1] }));
  const { equity } = calcEquity({ hero, opponents, ranges, iterations, random });
  return { equity, opponents, label: opponents === 1 ? 'против одного соперника' : `против ${opponents} соперников` };
}
