// Сверка источников между собой (2026-10-12): опубликованная таблица PokerStrategy (src/nashHU.js) против порогов
// HoldemResources (holdemresources.net/hune, «до какого стека» ва-банк / колл, один на один без анте).
// Свой расчёт с исправленными шансами тоже совпал с HoldemResources в пределах 0,5 ББ — data-build/nash/check-hrc.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { nashHU } from '../src/nashHU.js';

// [рука, ва-банк до (ББ), колл до (ББ)]; 20 — «20+».
const HRC = [['K9o', 20, 17.1], ['K5o', 14.2, 10.2], ['K2o', 11.6, 8.1], ['Q8o', 13.0, 9.7], ['Q5o', 8.9, 6.8], ['J7o', 8.5, 6.4],
  ['J4o', 5.4, 4.7], ['T8o', 17.5, 6.6], ['T6o', 5.7, 4.6], ['98o', 20, 6.0], ['87o', 14.7, 4.7], ['76o', 10.7, 4.0], ['65s', 20, 4.9],
  ['54s', 20, 4.6], ['A2o', 20, 15.8], ['K2s', 19.3, 10.7], ['Q2s', 12.7, 7.2], ['J2s', 8.5, 5.6], ['T2s', 6.5, 4.5], ['22', 20, 15.0]];

test('PokerStrategy и HoldemResources согласны по каждой руке (один на один, без анте, 2–20 ББ)', () => {
  const misses = [];
  for (const [hand, pushTo, callTo] of HRC) {
    for (let S = 2; S <= 20; S++) {
      const { push, call } = nashHU(S);
      // У самой границы (±1 ББ) таблицы с целыми стеками могут расходиться — проверяем вне её.
      if (Math.abs(S - pushTo) > 1) { if (push.has(hand) !== S <= pushTo) misses.push(`${hand} ва-банк при ${S} ББ`); }
      if (Math.abs(S - callTo) > 1) { if (call.has(hand) !== S <= callTo) misses.push(`${hand} колл при ${S} ББ`); }
    }
  }
  assert.deepEqual(misses, []);
});
