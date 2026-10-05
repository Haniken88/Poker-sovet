// Повтор раздачи, которую владелец прислал кнопкой «Не согласен».
// Запуск: node scripts/replay.mjs '<строка после #data>'
import { positionInfo } from '../src/positions.js';
import { preflopAdvice, preflopEquity } from '../src/preflop.js';
import { postflopAdvice, percentText } from '../src/postflop.js';
import { seatPosition, activeSeats } from '../src/table.js';
import { cardToString } from '../src/cards.js';

const d = JSON.parse(process.argv[2].replace(/^#data\s*/, ''));
const pos = seatPosition(d.occupied, d.button, d.hero);
const hero = d.hole;
const board = d.board.filter((c) => c !== null);
const stack = d.stack > 0 ? d.stack : Infinity;
console.log('Карты:', hero.map(cardToString).join(' '), '| стол:', board.map(cardToString).join(' ') || '—',
  '| позиция:', pos.name, '| игроков:', activeSeats(d.occupied).length);
if (!board.length) {
  const a = preflopAdvice({ hero, position: pos, action: d.preflop, limpers: d.limpers, raiseTo: d.raiseTo, bigBlind: d.bb, stack });
  const e = preflopEquity({ hero, action: d.preflop, limpers: d.limpers, iterations: 20000 });
  console.log(a.text, a.close ? '(спорно)' : '', '|', percentText(e.equity), '%', e.label, '|', a.reason);
} else {
  const a = postflopAdvice({ hero, board, opponents: d.opponents, pot: d.pot, toCall: d.toCall,
    preflopAction: d.preflop, stack, style: d.style, iterations: 30000 });
  console.log(a.text, a.close ? '(спорно)' : '', '|', percentText(a.equity), '% (любые руки', percentText(a.randomEquity), '%) |', a.reason);
}
void positionInfo;
