import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeSeats, seatPosition, nextActive } from '../src/table.js';

const all = Array(9).fill(true);
const without = (...seats) => all.map((v, i) => !seats.includes(i + 1));

test('позиции за полным столом: кнопка на 2 → 3 МБ, 4 ББ, 5 UTG, 1 катофф', () => {
  assert.equal(seatPosition(all, 2, 2).key, 'BTN');
  assert.equal(seatPosition(all, 2, 3).key, 'SB');
  assert.equal(seatPosition(all, 2, 4).key, 'BB');
  assert.equal(seatPosition(all, 2, 5).key, 'UTG');
  assert.equal(seatPosition(all, 2, 1).key, 'CO');
});

test('пустые места пропускаются', () => {
  const t = without(3, 4);
  assert.deepEqual(activeSeats(t), [1, 2, 5, 6, 7, 8, 9]);
  assert.equal(seatPosition(t, 2, 5).key, 'SB');
  assert.equal(seatPosition(t, 2, 6).key, 'BB');
  assert.equal(seatPosition(t, 2, 3), null);
});

test('кнопка переходит к следующему занятому месту по кругу', () => {
  assert.equal(nextActive(all, 2), 3);
  assert.equal(nextActive(all, 9), 1);
  assert.equal(nextActive(without(3, 4), 2), 5);
});

test('вдвоём: кнопка = малый блайнд', () => {
  const t = all.map((v, i) => i === 0 || i === 4);
  assert.equal(seatPosition(t, 1, 1).key, 'BTN');
  assert.equal(seatPosition(t, 1, 5).key, 'BB');
});
