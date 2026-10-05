// Сверка нашего расчёта шансов с известными значениями из калькуляторов эквити.
// Запуск: node scripts/compare-equity.mjs
import { parseCards } from '../src/cards.js';
import { calcEquity, seededRandom } from '../src/equity.js';

const CASES = [
  // [наша рука, рука соперника или null (случайная), стол, эталон %, источник]
  ['As Ah', 'Ks Kd', '', 81.95, 'AA против KK (одна общая масть, как в таблицах)'],
  ['As Ah', null, '', 85.2, 'AA против случайной руки'],
  ['Ks Kh', null, '', 82.4, 'KK против случайной руки'],
  ['As Kd', null, '', 65.3, 'AKo против случайной руки'],
  ['As Ks', null, '', 67.0, 'AKs против случайной руки'],
  ['7s 2d', null, '', 34.6, '72o против случайной руки'],
  ['As Ks', 'Qh Qd', '', 46.0, 'AKs против QQ'],
  ['As Kd', 'Qh Qc', '', 43.0, 'AKo против QQ'],
  ['2s 2d', 'Ah Kh', '', 50.0, '22 против AKs (монетка)'],
];
const random = seededRandom(2026);
console.log('Раздача'.padEnd(52), 'Наш шанс', ' Эталон', ' Разница');
for (const [hero, villain, board, expected, title] of CASES) {
  const { equity } = calcEquity({
    hero: parseCards(hero),
    board: board ? parseCards(board) : [],
    known: villain ? [parseCards(villain)] : [],
    opponents: villain ? 0 : 1,
    iterations: 200000,
    random,
  });
  const ours = equity * 100;
  console.log(title.padEnd(52), `${ours.toFixed(1)} %`.padStart(8), `${expected.toFixed(1)} %`.padStart(8), `${(ours - expected).toFixed(1)}`.padStart(7));
}
