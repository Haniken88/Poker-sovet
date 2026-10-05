// Прогон типичных раздач: что советует приложение и что ждёт нормальный игрок.
// Запуск: node scripts/review.mjs  → печатает таблицу (Markdown).
import { parseCards } from '../src/cards.js';
import { positionInfo } from '../src/positions.js';
import { preflopAdvice, preflopEquity } from '../src/preflop.js';
import { postflopAdvice, percentText } from '../src/postflop.js';
import { seededRandom } from '../src/equity.js';

const BB = 2;
const POS = { UTG: 3, LJ: 6, HJ: 7, CO: 8, BTN: 0, SB: 1, BB: 2 }; // смещения за столом на 9
const NAMES = { none: 'все сбросили', limp: 'лимп', raise: 'рейз', '3bet': '3-бет' };

// [описание, позиция, рука, действие до тебя, рейз до, стек в ББ, что ждём (через |)]
const PREFLOP = [
  ['AA из ранней', 'UTG', 'As Ad', 'none', 0, 100, 'raise'],
  ['KJ разных мастей из ранней', 'UTG', 'Ks Jd', 'none', 0, 100, 'fold'],
  ['77 из ранней', 'UTG', '7s 7d', 'none', 0, 100, 'raise'],
  ['A5 одной масти с катоффа', 'CO', 'As 5s', 'none', 0, 100, 'raise'],
  ['K8 одной масти с баттона', 'BTN', 'Ks 8s', 'none', 0, 100, 'raise'],
  ['9-4 разных с баттона', 'BTN', '9c 4d', 'none', 0, 100, 'fold'],
  ['72 на ББ, все сбросили', 'BB', '7s 2d', 'none', 0, 100, 'check'],
  ['AK разных против 2 лимперов', 'HJ', 'As Kd', 'limp', 0, 100, 'raise'],
  ['55 на баттоне против лимпера', 'BTN', '5s 5d', 'limp', 0, 100, 'raise|call'],
  ['QQ против рейза', 'HJ', 'Qs Qd', 'raise', 6, 100, 'raise'],
  ['AJ разных против рейза', 'LJ', 'As Jd', 'raise', 6, 100, 'fold|call'],
  ['K9 одной масти на ББ против рейза', 'BB', 'Ks 9s', 'raise', 6, 100, 'call'],
  ['66 на катоффе против рейза', 'CO', '6s 6d', 'raise', 6, 100, 'call'],
  ['72 разных против рейза', 'BTN', '7s 2d', 'raise', 6, 100, 'fold'],
  ['JJ против 3-бета', 'HJ', 'Js Jd', '3bet', 18, 100, 'call'],
  ['AK одной масти против 3-бета', 'CO', 'As Ks', '3bet', 18, 100, 'raise|allin'],
  ['K9 разных, стек 10 ББ, баттон', 'BTN', 'Kd 9c', 'none', 0, 10, 'allin'],
  ['55, стек 8 ББ, ранняя', 'UTG', '5s 5d', 'none', 0, 8, 'allin'],
  ['J3 разных, стек 8 ББ, ранняя', 'UTG', 'Js 3d', 'none', 0, 8, 'fold'],
  ['22, стек 14 ББ, ранняя', 'UTG', '2s 2d', 'none', 0, 14, 'fold'],
  ['A2 разных, стек 6 ББ, малый блайнд', 'SB', 'Ad 2c', 'none', 0, 6, 'allin'],
  ['AQ одной масти, стек 12 ББ, против рейза', 'HJ', 'As Qs', 'raise', 6, 12, 'allin'],
];

// [описание, рука, стол, банк, ставка соперника, соперников, префлоп, стек, что ждём]
const POSTFLOP = [
  ['Старшая пара с лучшим кикером, тебе чек', 'As Kd', 'Ah 7c 2d', 13, 0, 1, 'raise', 194, 'bet'],
  ['Старшая пара, ставка в полбанка', 'As Kd', 'Ah 7c 2d', 13, 6, 1, 'raise', 194, 'call|raise'],
  ['Ничего не попало, тебе чек', '7s 6s', 'Ah Kc 2d', 13, 0, 1, 'raise', 194, 'check'],
  ['Ничего не попало, ставка', '7s 6s', 'Ah Kc 2d', 13, 9, 1, 'raise', 194, 'fold'],
  ['Сет семёрок, ставка', '7s 7d', 'Kh 7c 2h', 13, 9, 1, 'raise', 194, 'raise'],
  ['Флеш-дро, ставка в банк', 'Js Ts', 'As 7s 2d', 13, 13, 1, 'raise', 194, 'call'],
  ['Флеш-дро, ставка в три банка', 'Js Ts', 'As 7s 2d', 13, 39, 1, 'raise', 194, 'fold'],
  ['Двустороннее стрит-дро, ставка в полбанка', '9s 8d', '7c 6h Kd', 13, 6, 1, 'raise', 194, 'call'],
  ['Гатшот, ставка в банк', '9s 8d', '6c 5h Kd', 13, 13, 1, 'raise', 194, 'fold'],
  ['Туз со слабым кикером, ставка в банк', 'Ad 3c', 'As Jh 8d', 13, 13, 1, 'raise', 194, 'call|fold'],
  ['Оверпара QQ, тебе чек', 'Qs Qd', '8h 5c 2d', 13, 0, 1, 'raise', 194, 'bet'],
  ['QQ на столе A-K, ставка', 'Qs Qd', 'Ah Kc 4d', 13, 9, 1, 'raise', 194, 'fold|call'],
  ['Ривер: натсовый флеш, ставка', 'Ah 5h', 'Kh 9h 2c 7h Js', 40, 20, 1, 'raise', 160, 'raise|allin'],
  ['Ривер: младшая пара, огромная ставка', '3s 3d', 'Kh 9c 7d 5s 2h', 40, 80, 1, 'raise', 160, 'fold'],
  ['Ривер: старшая пара, маленькая ставка', 'Kd Qc', 'Kh 9c 7d 5s 2h', 40, 10, 1, 'raise', 160, 'call|raise'],
  ['Ривер: AA на K-K-8-4-2 (твоя раздача)', 'Ac Ah', '4d Kc Kd 8s 2c', 250, 1000, 2, 'none', 20000, 'call'],
  ['Ривер: QQ на A-8-8-4-2, один (твоя)', 'Qh Qd', '4d Ad 8c 8s 2c', 750, 500, 1, 'none', 20000, 'call'],
  ['Тёрн: две пары, ставка, трое в игре', 'Ks 9s', 'Kh 9c 4d 2s', 30, 20, 3, 'none', 170, 'raise|call'],
  ['Старшая пара, хороший кикер, трое, чек', 'As Qd', 'Qh 8c 3d', 12, 0, 3, 'none', 194, 'bet'],
  ['Короткий стек: старшая пара, ставка', 'As Kd', 'Kh 8c 3d', 40, 20, 1, 'raise', 30, 'allin'],
  ['Готовый стрит, тебе чек', 'Jd Ts', '9h 8c 7d', 13, 0, 1, 'raise', 194, 'bet'],
];

const random = seededRandom(7);
const ok = (got, want) => want.split('|').includes(got);
const RU = { raise: 'рейз', fold: 'пас', call: 'колл', check: 'чек', bet: 'ставка', allin: 'ва-банк' };
const wantText = (want) => want.split('|').map((w) => RU[w]).join(' или ');
let bad = 0;
const pct = (x) => `${percentText(x)} %`;

console.log('# Проверка советов на типичных раздачах\n');
console.log('Столбец «Ждём» — что сделал бы нормальный игрок (по таблицам стартовых рук и шансам против цены колла). ' +
  'Создано: `node scripts/review.mjs > docs/proverka-sovetov.md`.\n');
console.log('## Префлоп (большой блайнд 2, стек 100 ББ, если не сказано иначе)\n');
console.log('| # | Раздача | До тебя | Совет | Шанс | Ждём | |');
console.log('|---|---|---|---|---|---|---|');
PREFLOP.forEach(([title, pos, hand, action, raiseTo, stackBB, want], i) => {
  const hero = parseCards(hand);
  const a = preflopAdvice({ hero, position: positionInfo(9, POS[pos]), action, limpers: 2, raiseTo, bigBlind: BB, stack: stackBB * BB });
  const e = preflopEquity({ hero, action, limpers: 2, iterations: 20000, random });
  const good = ok(a.action, want); if (!good) bad++;
  console.log(`| ${i + 1} | ${title} | ${NAMES[action]}${raiseTo ? ` до ${raiseTo}` : ''} | **${a.text}** | ${pct(e.equity)} ${e.label} | ${wantText(want)} | ${good ? '✅' : '❌'} |`);
});

console.log('\n## После флопа (банк — в центре, ставка — отдельно)\n');
console.log('| # | Раздача | Карты · стол | Банк / ставка | Совет | Шанс (против любых) | Ждём | |');
console.log('|---|---|---|---|---|---|---|---|');
POSTFLOP.forEach(([title, hand, board, pot, bet, opp, pre, stack, want], i) => {
  const a = postflopAdvice({ hero: parseCards(hand), board: parseCards(board), pot, toCall: bet, opponents: opp,
    preflopAction: pre, stack, iterations: 30000, random });
  const good = ok(a.action, want); if (!good) bad++;
  console.log(`| ${PREFLOP.length + i + 1} | ${title} | ${hand} · ${board} | ${pot} / ${bet || '—'} | **${a.text}** | ${pct(a.equity)} (${pct(a.randomEquity)}) | ${wantText(want)} | ${good ? '✅' : '❌'} |`);
});
console.log(`\nНе совпало с ожиданием: ${bad} из ${PREFLOP.length + POSTFLOP.length}`);
process.exitCode = bad ? 1 : 0;
