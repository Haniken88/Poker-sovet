import test from 'node:test';
import assert from 'node:assert/strict';
import { stepBB } from '../src/blinds.js';

const walk = (from, dir, n) => { const out = [from]; for (let i = 0; i < n; i++) out.push(stepBB(out.at(-1), dir)); return out; };

test('большой блайнд вверх: по 100 до 1 000, по 500 до 5 000, по 1 000 до 15 000, дальше по 5 000', () => {
  assert.deepEqual(walk(800, 1, 3), [800, 900, 1000, 1500]);
  assert.deepEqual(walk(4000, 1, 3), [4000, 4500, 5000, 6000]);
  assert.deepEqual(walk(14000, 1, 3), [14000, 15000, 20000, 25000]);
});

test('вниз — теми же шагами, не меньше 100', () => {
  assert.deepEqual(walk(20000, -1, 3), [20000, 15000, 14000, 13000]);
  assert.deepEqual(walk(1500, -1, 3), [1500, 1000, 900, 800]);
  assert.equal(stepBB(100, -1), 100);
});

test('некруглое число доводится до круглого', () => {
  assert.equal(stepBB(750, 1), 800);
  assert.equal(stepBB(750, -1), 700);
  assert.equal(stepBB(16200, 1), 20000);
});
