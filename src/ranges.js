// Диапазоны — какие руки правдоподобно держит соперник.
import { handClass } from './hands.js';
import { HAND_RANKS, HAND_RANKS_HU } from './handRanks.js';
import { rankOf, suitOf } from './cards.js';
import { evaluate, categoryOf, CATEGORY } from './evaluator.js';
import { PREFLOP_DATA } from './preflopData.js';
import { OPEN } from './openTables.js';
import { parseRange } from './hands.js';

// Сильнейшие классы рук, занимающие долю share от всех 1326 комбинаций.
// headsUp — рейтинг «один на один» (для ва-банка с коротким стеком).
export function topClasses(share, headsUp = false) {
  const result = new Set();
  let combos = 0;
  for (const cls of headsUp ? HAND_RANKS_HU : HAND_RANKS) {
    if (combos / 1326 >= share) break;
    result.add(cls);
    combos += cls.length === 2 ? 6 : cls.endsWith('s') ? 4 : 12;
  }
  return result;
}

// Все 1326 пар карт [a, b].
const ALL_COMBOS = [];
for (let a = 0; a < 52; a++) for (let b = a + 1; b < 52; b++) ALL_COMBOS.push([a, b]);
export const combosIn = (classes) => ALL_COMBOS.filter(([a, b]) => classes.has(handClass(a, b)));

// ---------- Руки соперников по таблицам солверов ----------
const CHART = ['LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
const chartKey = (pos) => (pos ? (CHART.includes(pos.key) ? pos.key : 'LJ') : null);

/** Руки из сводной таблицы с весами: [карта, карта, частота 0…1]. kind — 'raise', 'call' или 'play'. */
export function chartCombos(situation, kind) {
  const sit = PREFLOP_DATA[situation];
  if (!sit) return null;
  const out = [];
  for (const [a, b] of ALL_COMBOS) {
    const row = sit.hands[handClass(a, b)];
    if (!row) continue;
    const w = (kind === 'raise' ? row[0] : kind === 'call' ? row[1] : row[0] + row[1]) / 100;
    if (w > 0.01) out.push([a, b, Math.min(1, w)]);
  }
  return out.length ? out : null;
}

/**
 * С какими руками соперники пришли на флоп — по таблицам и по тому, кто что сделал.
 * preflop = { action, hero, raiser, reraiser, heroOpened } (места — positionInfo).
 * Возвращает { aggressor, others, about } или null (тогда — старая грубая модель).
 * aggressor — тот, кто повышал последним (или уравнявший, если открывал ты).
 */
export function preflopRanges(preflop) {
  if (!preflop) return null;
  const { action, hero, raiser, reraiser, heroOpened } = preflop;
  const heroKey = chartKey(hero);
  if (action === 'raise' && raiser) {
    const rk = chartKey(raiser);
    // Ранние места полного стола (после них 6+ игроков) открывают уже, чем LJ, — таблица 9-max.
    const aggressor = raiser.behind >= 6
      ? combosIn(parseRange(OPEN[Math.min(8, raiser.behind)]))
      : chartCombos(`open:${rk}`, 'raise');
    // Кто ещё уравнял — не знаем; чаще всего это большой блайнд.
    const others = chartCombos(`vsopen:BB:${rk}`, 'call') || aggressor;
    return aggressor ? { aggressor, others, about: `против рук открытия: ${raiser.name}` } : null;
  }
  if (action === 'none' && heroKey && heroKey !== 'BB') {
    // Ты открыл, тебя уравняли — чаще всего большой блайнд.
    const callers = chartCombos(`vsopen:BB:${heroKey}`, 'call');
    return callers ? { aggressor: callers, others: callers, about: 'против рук, с которыми большой блайнд уравнивает' } : null;
  }
  if (action === '3bet' && heroOpened && reraiser) {
    const aggressor = chartCombos(`vsopen:${chartKey(reraiser)}:${heroKey}`, 'raise');
    return aggressor ? { aggressor, others: aggressor, about: 'против рук, с которыми делают 3-бет' } : null;
  }
  return null;
}

// Доля рук, с которой соперник входит в игру префлоп.
// Повысивший — сильнее, уравнявшие — шире, без повышений — ещё шире.
export const PREFLOP_SHARE = { raiser: 0.2, threeBettor: 0.07, caller: 0.35, open: 0.5 };

/**
 * «Что-то есть» на этом столе: пара и лучше с участием своей карты,
 * а до ривера — ещё флеш-дро и стрит-дро. Такими руками обычно ставят «по делу».
 */
export function hasSomething(a, b, board) {
  const ranks = board.map(rankOf);
  const ra = rankOf(a), rb = rankOf(b);
  if (ra === rb || ranks.includes(ra) || ranks.includes(rb)) return true;
  if (categoryOf(evaluate([a, b, ...board])) >= CATEGORY.STRAIGHT) return true;
  if (board.length === 5) return false;
  const suits = [0, 0, 0, 0];
  [a, b, ...board].forEach((c) => suits[suitOf(c)]++);
  if (suits[suitOf(a)] >= 4 || suits[suitOf(b)] >= 4) return true;
  let mask = 0;
  for (const r of [ra, rb, ...ranks]) mask |= 1 << r;
  if (mask & (1 << 14)) mask |= 2;
  const mine = (1 << ra) | (1 << rb) | (ra === 14 || rb === 14 ? 2 : 0);
  for (let low = 1; low <= 10; low++) {
    if (((mine >> low) & 0b11111) && popcount((mask >> low) & 0b11111) >= 4) return true;
  }
  return false;
}
const popcount = (n) => { let c = 0; while (n) { c += n & 1; n >>= 1; } return c; };

/**
 * Доля блефа в ставке — зависит от того, как играет соперник (это выбирает игрок:
 * за столом видно, кто блефует). Ставка тут почти ни при чём: живые игроки огромными
 * ставками (больше полутора банков) блефуют ещё реже.
 */
export const BLUFF_STYLE = { rare: 0.08, normal: 0.2, often: 0.35 };
export const bluffShare = (betToPot, style = 'normal') =>
  (BLUFF_STYLE[style] ?? BLUFF_STYLE.normal) * (betToPot > 1.5 ? 0.75 : 1);

/**
 * Руки, которыми ставят «по делу». Чем больше ставка, тем сильнее нужна рука:
 * до полбанка — лучшие 55 % его рук на этом столе, до банка — 40 %, больше — 22 %.
 * До ривера к ним добавляются дро (флеш-дро, стрит-дро), если ставка не больше банка.
 */
export function valueHands(pre, board, betToPot) {
  const top = betToPot <= 0.5 ? 0.55 : betToPot <= 1.2 ? 0.4 : 0.22;
  const boardSet = new Set(board);
  const scored = pre.filter(([a, b]) => !boardSet.has(a) && !boardSet.has(b))
    .map((combo) => ({ combo, v: evaluate([combo[0], combo[1], ...board]), w: combo[2] ?? 1 }))
    .sort((x, y) => y.v - x.v);
  // Лучшие top долей его рук — с учётом того, как часто он их играет.
  const total = scored.reduce((sum, x) => sum + x.w, 0);
  let acc = 0, cut = 0;
  for (const x of scored) { acc += x.w; cut = x.v; if (acc >= total * top) break; }
  const strong = scored.filter((x) => x.v >= cut).map((x) => x.combo);
  if (board.length === 5 || betToPot > 1.2) return strong;
  const inStrong = new Set(strong.map(([a, b]) => a * 52 + b));
  const draws = pre.filter(([a, b]) => !inStrong.has(a * 52 + b) && isDraw(a, b, board));
  return strong.concat(draws);
}

// Флеш-дро или стрит-дро (без готовой пары).
function isDraw(a, b, board) {
  const ranks = board.map(rankOf);
  if (rankOf(a) === rankOf(b) || ranks.includes(rankOf(a)) || ranks.includes(rankOf(b))) return false;
  return hasSomething(a, b, board);
}

/**
 * Диапазоны соперников после флопа.
 * preflopAction — что было префлоп; bet — ставка соперника на этой улице (0 — не ставили);
 * potBefore — банк до этой ставки, style — как блефует соперник (rare/normal/often).
 * Первый соперник — тот, кто поставил.
 * Возвращает { ranges, value } — value: диапазон ставящего только «по делу» (без блефов).
 */
export function opponentRanges({ board, opponents, preflopAction = 'none', bet = 0, potBefore = 0, style = 'normal', preflop = null }) {
  const aggressorShare = preflopAction === '3bet' ? PREFLOP_SHARE.threeBettor
    : preflopAction === 'raise' ? PREFLOP_SHARE.raiser : PREFLOP_SHARE.open;
  const otherShare = preflopAction === 'raise' || preflopAction === '3bet' ? PREFLOP_SHARE.caller : PREFLOP_SHARE.open;
  // Если знаем, кто что делал до флопа, — руки из таблиц солверов, иначе грубая оценка «лучшие N %».
  const charts = preflopRanges(preflop);
  const aggressor = charts?.aggressor ?? combosIn(topClasses(aggressorShare));
  const others = charts?.others ?? combosIn(topClasses(otherShare));
  const plain = (list) => ({ groups: [list], weights: [1] });

  const ranges = [];
  let value = null;
  for (let p = 0; p < opponents; p++) {
    const pre = p === 0 ? aggressor : others;
    if (p === 0 && bet > 0) {
      const betToPot = bet / Math.max(potBefore, 1e-9);
      const strong = valueHands(pre, board, betToPot);
      // Блефуют чаще всего тем, что не попало: из более широкого набора рук.
      const air = (charts ? pre : combosIn(topClasses(Math.max(aggressorShare, PREFLOP_SHARE.open))))
        .filter(([a, b]) => !hasSomething(a, b, board));
      const bluff = bluffShare(betToPot, style);
      ranges.push({ groups: [strong, air], weights: [1 - bluff, bluff] });
      value = [plain(strong)];
    } else {
      ranges.push(plain(pre));
    }
  }
  return { ranges, value, about: charts?.about ?? null };
}
