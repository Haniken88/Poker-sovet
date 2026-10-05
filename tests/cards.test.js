import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardFromString, cardToString, rankOf, suitOf } from '../src/cards.js';

test('карта туда и обратно', () => {
  for (const text of ['As', 'Kh', 'Td', '2c']) {
    assert.equal(cardToString(cardFromString(text)), text);
  }
});

test('номинал и масть', () => {
  const ace = cardFromString('Ah');
  assert.equal(rankOf(ace), 14);
  assert.equal(suitOf(ace), 1);
});

test('плохой ввод — понятная ошибка', () => {
  assert.throws(() => cardFromString('Xz'), /Непонятная карта/);
});
