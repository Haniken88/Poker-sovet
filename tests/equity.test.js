import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCards } from '../src/cards.js';
import { calcEquity, seededRandom } from '../src/equity.js';

const equity = ({ hero, board = '', known = [], opponents = 0, iterations = 40000 }) =>
  calcEquity({
    hero: parseCards(hero),
    board: board ? parseCards(board) : [],
    known: known.map(parseCards),
    opponents,
    iterations,
    random: seededRandom(42),
  }).equity;

// Известные значения из покерных калькуляторов (точность Монте-Карло ±1 %).
const near = (actual, expected, margin = 0.01) =>
  assert.ok(Math.abs(actual - expected) <= margin,
    `ожидалось ≈${(expected * 100).toFixed(1)} %, получилось ${(actual * 100).toFixed(1)} %`);

test('AA против KK префлоп ≈ 82 %', () => {
  near(equity({ hero: 'As Ah', known: ['Ks Kh'] }), 0.82);
});

test('AKs против QQ — почти поровну (≈ 46 %)', () => {
  near(equity({ hero: 'As Ks', known: ['Qh Qd'] }), 0.46);
});

test('против случайной руки: AA ≈ 85 %, 72o ≈ 35 %', () => {
  near(equity({ hero: 'As Ah', opponents: 1 }), 0.852);
  near(equity({ hero: '7s 2h', opponents: 1 }), 0.346);
});

test('AA против 9 соперников ≈ 31 %', () => {
  near(equity({ hero: 'As Ah', opponents: 9 }), 0.31, 0.015);
});

test('флеш-дро с тузом на флопе против пары королей ≈ 45,9 %', () => {
  // Точное значение — полный перебор всех 990 тёрнов и риверов:
  // 9 карт масти + 3 туза + доля дележей.
  near(equity({ hero: 'As 5s', board: 'Ks 9s 2d', known: ['Kh Qd'] }), 0.4586);
});

test('на ривере всё известно: ответ точный', () => {
  assert.equal(equity({ hero: 'As Ks', board: 'Qs Js Ts 2d 3c', known: ['Ah Ad'], iterations: 50 }), 1);
  assert.equal(equity({ hero: '2c 3d', board: 'As Ks Qs Js Ts', known: ['4h 5h'], iterations: 50 }), 0.5);
});

test('одна карта дважды — понятная ошибка', () => {
  assert.throws(() => equity({ hero: 'As Ah', known: ['As Kd'] }), /дважды/);
});

test('скорость: 10 000 раздач против 9 соперников меньше чем за секунду', () => {
  const start = performance.now();
  calcEquity({ hero: parseCards('As Kd'), opponents: 9, iterations: 10000 });
  const ms = performance.now() - start;
  assert.ok(ms < 1000, `заняло ${ms.toFixed(0)} мс`);
});
