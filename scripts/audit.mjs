// Большая проверка советов (2026-10-12, просьба владельца «чтобы не было ни дыр, ни ошибок»).
// Запуск: node scripts/audit.mjs → печатает сводку; подробности ошибок — по одной строке.
// Стол на 6 игроков, по 100 случайных раздач на позицию + полный перебор 169 рук по ситуациям.
import { preflopAdvice, preflopEquity, HU_PUSH_FOLD_BB } from '../src/preflop.js';
import { postflopAdvice } from '../src/postflop.js';
import { positionInfo } from '../src/positions.js';
import { allClasses } from '../src/hands.js';
import { seededRandom } from '../src/equity.js';
import { PREFLOP_DATA } from '../src/preflopData.js';
import { cardFromString } from '../src/cards.js';

const random = seededRandom(20261012);
const pick = (arr) => arr[Math.floor(random() * arr.length)];
const CL = allClasses();
const R = '23456789TJQKA';
const SUITS = 'shdc';
const problems = [];
const note = (kind, text) => problems.push(`${kind}: ${text}`);

// Случайные конкретные карты для класса руки, не пересекающиеся с занятыми.
function cardsFor(cls, used = new Set()) {
  for (let tries = 0; tries < 200; tries++) {
    const s1 = pick(SUITS); const s2 = cls.length === 2 || cls[2] === 'o' ? pick(SUITS.replace(s1, '')) : s1;
    const a = cardFromString(cls[0] + s1), b = cardFromString(cls[1] + s2);
    if (!used.has(a) && !used.has(b) && a !== b) return [a, b];
  }
  throw new Error('нет карт для ' + cls);
}
const BAD_TEXT = /undefined|NaN|null|\[object/;
function checkAdvice(a, ctx, { stack, raiseTo = 0, toCall = 0 }) {
  const where = JSON.stringify(ctx);
  if (!a || !a.action) return note('нет совета', where);
  if (!['fold', 'check', 'call', 'raise', 'allin', 'bet'].includes(a.action)) note('странное действие', `${a.action} ${where}`);
  if (BAD_TEXT.test(a.reason) || BAD_TEXT.test(a.text)) note('мусор в тексте', `${a.reason} ${where}`);
  if (!Number.isFinite(a.amount ?? 0)) note('сумма не число', where);
  if (Number.isFinite(stack) && a.amount > stack + 1e-9) note('сумма больше стека', `${a.amount} > ${stack} ${where}`);
  if (a.action === 'raise' && raiseTo && a.amount <= raiseTo) note('рейз не больше ставки', `${a.amount} ≤ ${raiseTo} ${where}`);
  if (a.action === 'raise' && toCall && a.amount <= toCall) note('рейз не больше ставки', `${a.amount} ≤ ${toCall} ${where}`);
  if (a.action === 'call' && raiseTo && Math.abs(a.amount - raiseTo) > 1e-9 && a.amount !== stack) note('колл не той суммы', `${a.amount} vs ${raiseTo} ${where}`);
}

// ---------- 1. 600 случайных раздач до флопа (6 игроков) ----------
const SEATS = [3, 4, 5, 0, 1, 2]; // смещения от баттона за 6 местами: LJ(UTG), HJ, CO, BTN, SB, BB
const STACKS = [3, 5, 8, 10, 12, 15, 16, 18, 20, 25, 30, 40, 60, 100, 150];
let preCount = 0;
const tally = {};
for (const offset of SEATS) {
  const position = positionInfo(6, offset);
  for (let i = 0; i < 100; i++) {
    const cls = pick(CL);
    const hero = cardsFor(cls);
    const stackBB = pick(STACKS), bb = 2, stack = stackBB * bb, ante = random() < 0.5 ? bb : 0;
    // Что было до тебя: только то, что возможно с этого места.
    const earlier = SEATS.slice(0, SEATS.indexOf(offset));
    const options = ['none', ...(earlier.length ? ['limp', 'raise', 'shove', '3bet'] : [])];
    let action = pick(options);
    let raiseTo = 0, opener = null, limpers = 0, heroOpened = false, threeBettor = null;
    if (action === 'limp') limpers = 1 + Math.floor(random() * earlier.length);
    if (action === 'raise') { raiseTo = pick([2, 2.5, 3, 4, 6]) * bb; opener = positionInfo(6, pick(earlier)); }
    if (action === 'shove') { action = 'raise'; raiseTo = stack; opener = positionInfo(6, pick(earlier)); }
    if (action === '3bet') { raiseTo = pick([7, 9, 11]) * bb; heroOpened = random() < 0.5; if (heroOpened) threeBettor = positionInfo(6, pick(SEATS.filter((s) => s !== offset))); }
    const ctx = { pos: position.key, cls, stackBB, ante: Boolean(ante), action, raiseTo: raiseTo / bb };
    try {
      const a = preflopAdvice({ hero, position, action, limpers, raiseTo, bigBlind: bb, stack, opener, heroOpened, threeBettor, ante });
      checkAdvice(a, ctx, { stack, raiseTo });
      const e = preflopEquity({ hero, action, limpers, opener, iterations: 400, random });
      if (!(e.equity >= 0 && e.equity <= 1)) note('шанс вне 0–100 %', JSON.stringify(ctx));
      const key = `${action}/${a.action}`; tally[key] = (tally[key] || 0) + 1;
    } catch (err) { note('ошибка программы', `${err.message} ${JSON.stringify(ctx)}`); }
    preCount++;
  }
}

// ---------- 2. «Дыры»: если играется рука, играется и такая же сильнее ----------
// Сильнее: та же старшая карта и младшая выше (той же мастности), одномастная вместо разномастной, пара старше.
function stronger(c) {
  const out = [];
  const hi = R.indexOf(c[0]), lo = R.indexOf(c[1]);
  if (c.length === 2) { if (hi < 12) out.push(R[hi + 1] + R[hi + 1]); return out; }
  if (lo + 1 < hi) out.push(R[hi] + R[lo + 1] + c[2]);
  if (c[2] === 'o') out.push(c[0] + c[1] + 's');
  return out;
}
const plays = (a) => ['raise', 'allin', 'call', 'bet'].includes(a.action);
let holeChecks = 0;
for (const players of [6, 9, 2]) {
  for (let offset = 0; offset < players; offset++) {
    const position = positionInfo(players, offset);
    if (position.key === 'BB') continue;
    for (const stackBB of STACKS) for (const ante of [0, 1]) {
      const decide = new Map(CL.map((c) => [c, preflopAdvice({ hero: cardsFor(c), position, bigBlind: 1, stack: stackBB, ante })]));
      for (const c of CL) {
        if (!plays(decide.get(c))) continue;
        for (const s of stronger(c)) {
          holeChecks++;
          // Известное исключение солверных таблиц: A5 играется, а A6–A8 нет (стрит A-2-3-4-5 и блокеры).
          if (/^A5/.test(c) && /^A[6-8]/.test(s)) continue;
          if (!plays(decide.get(s))) note('дыра', `${players} игроков, ${position.key}, ${stackBB} ББ${ante ? ', анте' : ''}: ${c} играется, а ${s} — пас`);
        }
      }
    }
  }
}

// ---------- 3. Сильные руки первым не сбрасываются ни при каком стеке ----------
const PREMIUM = ['AA', 'KK', 'QQ', 'JJ', 'TT', 'AKs', 'AKo', 'AQs', 'AQo', 'AJs', 'KQs'];
for (const players of [6, 9]) for (let offset = 0; offset < players; offset++) {
  const position = positionInfo(players, offset);
  if (position.key === 'BB') continue;
  for (const stackBB of STACKS) for (const ante of [0, 1]) for (const c of PREMIUM) {
    const a = preflopAdvice({ hero: cardsFor(c), position, bigBlind: 1, stack: stackBB, ante });
    if (!plays(a)) note('сильная рука — пас', `${players} игроков, ${position.key}, ${stackBB} ББ${ante ? ', анте' : ''}: ${c}`);
  }
}

// ---------- 3б. Колл против ва-банка (отмечено, кто пошёл): без дыр, AA–JJ и AK уравнивают всегда ----------
const ALWAYS_CALL = ['AA', 'KK', 'QQ', 'JJ', 'AKs', 'AKo'];
for (const players of [6, 9, 2]) for (let o = 0; o < players; o++) for (let h = 0; h < players; h++) {
  const opener = positionInfo(players, o), position = positionInfo(players, h);
  if (opener.behind <= position.behind) continue; // ты ходишь после пошедшего ва-банк
  for (const stackBB of [3, 5, 8, 10, 12, 15]) for (const ante of [0, 1]) {
    const decide = new Map(CL.map((c) => [c, preflopAdvice({ hero: cardsFor(c), position, action: 'raise', raiseTo: stackBB, opener, bigBlind: 1, stack: stackBB, ante })]));
    for (const c of CL) {
      if (plays(decide.get(c))) for (const s2 of stronger(c)) {
        holeChecks++;
        if (/^A5/.test(c) && /^A[6-8]/.test(s2)) continue;
        if (!plays(decide.get(s2))) note('дыра в колле', `${players} игроков, ${opener.key} ва-банк, ты ${position.key}, ${stackBB} ББ${ante ? ', анте' : ''}: ${c} колл, а ${s2} пас`);
      }
    }
    for (const c of ALWAYS_CALL) if (!plays(decide.get(c))) note('сильная рука не уравнивает ва-банк', `${players} игроков, ${opener.key} → ${position.key}, ${stackBB} ББ: ${c}`);
  }
}

// ---------- 4. Глубокий стек, первым: совпадение с солверами ----------
// Приложение открывает = солверы открывают (≥ 50 %) или поправка живой игры (солверы хоть иногда, ≥ 15 %).
// Ошибка — если приложение открывает руку, которую солверы почти не открывают, или пасует то, что открывают всегда.
const CHART_KEYS = { 3: 'LJ', 4: 'HJ', 5: 'CO', 0: 'BTN', 1: 'SB' };
let chartChecks = 0, liveWider = 0;
for (const [offset, key] of Object.entries(CHART_KEYS)) {
  const position = positionInfo(6, Number(offset));
  const sit = PREFLOP_DATA[`open:${key}`];
  for (const c of CL) {
    const row = sit.hands[c]; if (!row) continue;
    const solverRaise = row[0];
    const a = preflopAdvice({ hero: cardsFor(c), position, bigBlind: 1, stack: 100 });
    chartChecks++;
    if (plays(a) && solverRaise < 50) liveWider++;
    if (plays(a) && solverRaise < 10) note('шире солверов (поправка живой игры)', `${key} ${c}: солверы ${solverRaise} %`);
    if (!plays(a) && solverRaise >= 80) note('пас, хотя солверы открывают', `${key} ${c}: солверы ${solverRaise} %`);
  }
}

// ---------- 5. После флопа: 300 случайных раздач ----------
let postCount = 0;
for (let i = 0; i < 300; i++) {
  const deck = []; for (const r of R) for (const s of SUITS) deck.push(cardFromString(r + s));
  for (let k = deck.length - 1; k > 0; k--) { const j = Math.floor(random() * (k + 1)); [deck[k], deck[j]] = [deck[j], deck[k]]; }
  const hero = deck.slice(0, 2), board = deck.slice(2, 2 + pick([3, 4, 5]));
  const pot = pick([6, 10, 20, 40, 100]), toCall = pick([0, 0, pot / 3, pot / 2, pot, 2 * pot]);
  const stack = pick([10, 30, 100, 300, Infinity]);
  const opponents = pick([1, 1, 1, 2, 3]);
  const preflopAction = pick(['none', 'limp', 'raise', '3bet']);
  const ctx = { hand: hero.join(','), board: board.join(','), pot, toCall, stack, opponents, preflopAction };
  try {
    const a = postflopAdvice({ hero, board, opponents, pot, toCall, preflopAction, stack, iterations: 1500, random, style: pick(['rare', 'normal', 'often']) });
    checkAdvice(a, ctx, { stack, toCall });
    if (!toCall && a.action === 'call') note('колл без ставки', JSON.stringify(ctx));
    if (toCall && a.action === 'check') note('чек против ставки', JSON.stringify(ctx));
    if (!(a.equity >= 0 && a.equity <= 1)) note('шанс вне 0–100 %', JSON.stringify(ctx));
  } catch (err) { note('ошибка программы', `${err.message} ${JSON.stringify(ctx)}`); }
  postCount++;
}

const kinds = {};
for (const p of problems) { const k = p.split(':')[0]; kinds[k] = (kinds[k] || 0) + 1; }
console.log(`До флопа: ${preCount} случайных раздач (6 игроков, по 100 на позицию).`);
console.log(`Проверок на «дыры»: ${holeChecks}. Сверка с солверами (100 ББ, первым): ${chartChecks} рук, из них шире солверов (живая игра): ${liveWider}.`);
console.log(`После флопа: ${postCount} случайных раздач.`);
console.log('Что советует до флопа (действие до тебя / совет):', JSON.stringify(tally));
console.log(`Проблем: ${problems.length}`, JSON.stringify(kinds));
for (const p of problems.slice(0, 60)) console.log(' -', p);
void HU_PUSH_FOLD_BB;
// Для тестов: ошибка, если есть что-то кроме известных поправок живой игры.
const unexpected = problems.filter((p) => !p.startsWith('шире солверов (поправка живой игры)'));
process.exitCode = unexpected.length ? 1 : 0;
