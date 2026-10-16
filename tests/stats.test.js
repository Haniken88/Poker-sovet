// Статистика по местам (src/stats.js): кто «вошёл», итог в ББ, периоды, строки таблицы.
import test from 'node:test';
import assert from 'node:assert/strict';
import { handEntry, addHand, summarize, MAX_HANDS } from '../src/stats.js';

const day = new Date(2026, 9, 16, 20, 0).getTime();
const e = (o) => handEntry({ time: day, bb: 1000, ...o });

test('«вошёл»: сброс без вложений — нет, сброс после колла — да, проход на ББ — нет', () => {
  assert.equal(e({ posKey: 'UTG', kind: 'fold', amount: 0 }).e, false);
  assert.equal(e({ posKey: 'BB', kind: 'fold', amount: 1000, posted: 1000 }).e, false);
  assert.equal(e({ posKey: 'BB', kind: 'fold', amount: 3000, posted: 1000 }).e, true);
  assert.equal(e({ posKey: 'BB', kind: 'win', amount: 500, walk: true }).e, false);
  assert.equal(e({ posKey: 'BTN', kind: 'lose', amount: 2500 }).e, true);
});

test('итог в ББ со знаком, таблица по местам и сумма', () => {
  let list = [];
  list = addHand(list, e({ posKey: 'UTG+1', kind: 'win', amount: 4500 }));
  list = addHand(list, e({ posKey: 'HJ', kind: 'lose', amount: 2000 }));
  list = addHand(list, e({ posKey: 'BTN', kind: 'fold', amount: 0 }));
  const s = summarize(list, 'all');
  assert.deepEqual([s.total.hands, s.total.entered, s.total.won, s.total.net], [3, 2, 1, 2.5]);
  const row = (id) => s.rows.find((r) => r.id === id);
  assert.equal(row('early').net, 4.5);
  assert.equal(row('middle').net, -2);
  assert.equal(row('BTN').hands, 1);
  assert.equal(row('SB').hands, 0);
});

test('периоды: сегодня / месяц / всё время', () => {
  const now = new Date(2026, 9, 16, 22, 0);
  const at = (d) => handEntry({ time: d.getTime(), posKey: 'CO', kind: 'win', amount: 1000, bb: 1000 });
  const list = [at(new Date(2026, 9, 16, 1)), at(new Date(2026, 9, 2)), at(new Date(2026, 8, 30))];
  assert.equal(summarize(list, 'day', now).total.hands, 1);
  assert.equal(summarize(list, 'month', now).total.hands, 2);
  assert.equal(summarize(list, 'all', now).total.hands, 3);
});

test('хранится не больше MAX_HANDS последних раздач', () => {
  let list = Array.from({ length: MAX_HANDS }, (_, i) => ({ t: i }));
  list = addHand(list, { t: 'new' });
  assert.equal(list.length, MAX_HANDS);
  assert.equal(list.at(-1).t, 'new');
  assert.equal(list[0].t, 1);
});
