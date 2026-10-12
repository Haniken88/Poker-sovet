// Задание для TexasSolver: баттон открыл 2,5 ББ, ББ уравнял, стол из аргумента:
// 3 карты — считаем с флопа (тяжело: до 5 ГБ памяти!), 4 карты — с тёрна (флоп прочекали; лёгко).
// Руки игроков — из нашей сводной таблицы (src/preflopData.js). Суммы — в десятых ББ.
// Запуск: node make_input.mjs "Kh,7c,2d" out.txt result.json [открыл: BTN|CO|SB] [стек в ББ, по умолчанию 100]
// (2026-10-12) Открывший BTN/CO — в позиции против ББ; открывший SB — без позиции, ББ в позиции.
import { writeFileSync } from 'node:fs';
import { PREFLOP_DATA } from '../../src/preflopData.js';

const [flop, outFile, resultFile, opener = 'BTN', stackArg = '100'] = process.argv.slice(2);
const stackBB = Number(stackArg);
const street = flop.split(',').length === 4 ? 'turn' : 'flop';
const rangeString = (sit, kind) => Object.entries(PREFLOP_DATA[sit].hands)
  .map(([h, [r, c]]) => [h, (kind === 'raise' ? r : c) / 100])
  .filter(([, w]) => w > 0.01)
  .map(([h, w]) => (w >= 0.995 ? h : `${h}:${w.toFixed(2)}`))
  .join(',');

const openRange = rangeString(`open:${opener}`, 'raise');
const bbRange = rangeString(`vsopen:BB:${opener}`, 'call');
const openerIP = opener !== 'SB';
const ip = openerIP ? openRange : bbRange;
const oop = openerIP ? bbRange : openRange;
// Банк: открытие 2,5 + колл 2,5 + малый блайнд 0,5 (если МБ сбросил; при открытии с МБ мёртвых денег нет).
const pot = opener === 'SB' ? 50 : 55;
const lines = [
  `set_pot ${pot}`,
  `set_effective_stack ${stackBB * 10 - 25}`, // стек − 2,5 ББ
  `set_board ${flop}`,
  `set_range_ip ${ip}`,
  `set_range_oop ${oop}`,
  // Небольшое дерево: по одному размеру ставки на улицу, чтобы считать быстро и без лишней памяти.
  ...(street === 'flop' ? ['set_bet_sizes oop,flop,bet,50', 'set_bet_sizes oop,flop,allin',
    'set_bet_sizes ip,flop,bet,50', 'set_bet_sizes ip,flop,allin'] : []),
  'set_bet_sizes oop,turn,bet,33,75', 'set_bet_sizes oop,turn,raise,100', 'set_bet_sizes oop,turn,allin',
  'set_bet_sizes ip,turn,bet,33,75', 'set_bet_sizes ip,turn,raise,100', 'set_bet_sizes ip,turn,allin',
  'set_bet_sizes oop,river,bet,75', 'set_bet_sizes oop,river,allin',
  'set_bet_sizes ip,river,bet,75', 'set_bet_sizes ip,river,raise,100', 'set_bet_sizes ip,river,allin',
  'set_allin_threshold 0.67',
  'build_tree',
  'set_thread_num 1', // одно ядро — сайт на сервере важнее
  'set_accuracy 1',
  'set_max_iteration 150',
  'set_print_interval 25',
  'set_use_isomorphism 1',
  'start_solve',
  'set_dump_rounds 1', // нужны только решения на первой улице
  `dump_result ${resultFile}`,
];
writeFileSync(outFile, lines.join('\n') + '\n');
console.log('задание:', outFile, '| в позиции', ip.split(',').length, 'классов, без позиции', oop.split(',').length);
