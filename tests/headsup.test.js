// Один на один, короткий стек: таблица Нэша (src/nashHU.js) и «средняя» таблица колла (src/huCall.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { preflopAdvice } from '../src/preflop.js';
import { positionInfo } from '../src/positions.js';
import { parseCards } from '../src/cards.js';
import { allClasses, combosOf } from '../src/hands.js';
import { NASH_HU, parseNashRange, nashHU } from '../src/nashHU.js';
import { HU_CALL, huCall } from '../src/huCall.js';

const BTN = positionInfo(2, 0), BB = positionInfo(2, 1);
const toCards = (cls) => parseCards(cls.length === 2 ? `${cls[0]}s ${cls[0]}h` : cls[2] === 's' ? `${cls[0]}s ${cls[1]}s` : `${cls[0]}s ${cls[1]}h`);
const advise = (hand, position, extra) => preflopAdvice({ hero: parseCards(hand), position, bigBlind: 40000, ...extra });
const pct = (set) => [...set].reduce((s, c) => s + combosOf(c), 0) / 13.26;

test('таблица Нэша переписана без ошибок: доли рук совпадают с подписанными в источнике', () => {
  for (const [es, row] of Object.entries(NASH_HU)) {
    assert.ok(Math.abs(pct(parseNashRange(row.push)) - row.pushPct) < 0.15, `${es} ББ, ва-банк`);
    assert.ok(Math.abs(pct(parseNashRange(row.call)) - row.callPct) < 0.15, `${es} ББ, колл`);
  }
});

test('баттон один на один: ва-банк ровно с руками из таблицы Нэша (10, 15, 20 ББ)', () => {
  for (const es of [3, 10, 15, 20]) {
    const { push } = nashHU(es);
    for (const cls of allClasses()) {
      const got = preflopAdvice({ hero: toCards(cls), position: BTN, bigBlind: 1, stack: es }).action;
      assert.equal(got, push.has(cls) ? 'allin' : 'fold', `${cls}, ${es} ББ`);
    }
  }
});

test('средняя таблица колла не шире Нэша и сужается с ростом стека', () => {
  let prev = 101;
  for (let es = 3; es <= 20; es++) {
    const mid = huCall(es).call;
    assert.ok(pct(mid) <= NASH_HU[es].callPct + 1, `${es} ББ: средняя шире Нэша`);
    assert.ok(pct(mid) <= prev + 0.5, `${es} ББ: шире, чем при меньшем стеке`);
    prev = pct(mid);
  }
  assert.ok(Object.keys(HU_CALL).length === 20);
});

test('раздачи владельца 11.10: Q8o и A3o на баттоне, ~10 ББ — ва-банк', () => {
  assert.equal(advise('Qc 8s', BTN, { stack: 375000 }).action, 'allin');
  assert.equal(advise('Ad 3s', BTN, { stack: 395000 }).action, 'allin');
});

test('скриншот владельца 12.10: AK на баттоне, 15,4 ББ — ва-банк, а не рейз 3,5 ББ', () => {
  const a = advise('As Kd', BTN, { stack: 615000 });
  assert.equal(a.action, 'allin');
  assert.doesNotMatch(a.reason, /соперники/);
});

test('6-5 одной масти: ва-банк первым — да, колл чужого ва-банка — нет; разных мастей — пас', () => {
  assert.equal(advise('6h 5h', BTN, { stack: 400000 }).action, 'allin');
  assert.equal(advise('6h 5d', BTN, { stack: 400000 }).action, 'fold');
  assert.equal(advise('6h 5h', BB, { stack: 400000, action: 'raise', raiseTo: 400000 }).action, 'fold');
});

test('ББ против ва-банка при 10 ББ: A3o и 55 — колл, K5o и Q9o — пас', () => {
  const vsShove = (hand) => advise(hand, BB, { stack: 400000, action: 'raise', raiseTo: 400000 }).action;
  assert.equal(vsShove('Ad 3s'), 'allin');
  assert.equal(vsShove('5d 5s'), 'allin');
  assert.equal(vsShove('Kh 5d'), 'fold');
  assert.equal(vsShove('Qh 9d'), 'fold');
});

test('один на один глубже 20 ББ — обычная игра, но рейз 2,5 ББ, а не 3,5', () => {
  const a = advise('As Kd', BTN, { stack: 25 * 40000 });
  assert.equal(a.action, 'raise');
  assert.equal(a.amount, 2.5 * 40000);
});

test('раздача друга 12.10: A2s на ББ против повышения до 9 ББ, стек 30 — пас, объяснение про размер повышения', () => {
  const a = preflopAdvice({ hero: parseCards('Ad 2d'), position: positionInfo(7, 2), action: 'raise', raiseTo: 9, bigBlind: 1, stack: 30 });
  assert.equal(a.action, 'fold');
  assert.match(a.reason, /крупнее обычного/);
  assert.doesNotMatch(a.reason, /60 ББ|по таблицам/i);
});
