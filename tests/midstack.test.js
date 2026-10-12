// Стеки 15–40 ББ за полным столом (2026-10-12): размер открытия и ва-банк вместо открытия.
// Источники: MTT Poker School (2× до 30 ББ, 2,3× при 40–60), RangerPro (2–2,2× при 15–25), GTO Wizard
// (при 20–25 ББ маленькие пары и слабые тузы с поздних мест — ва-банк, 3-бет — ва-банком), Preflop Wizard (20 ББ).
import test from 'node:test';
import assert from 'node:assert/strict';
import { preflopAdvice } from '../src/preflop.js';
import { positionInfo } from '../src/positions.js';
import { parseCards } from '../src/cards.js';

const go = (hand, offset, stack, extra = {}) => preflopAdvice({ hero: parseCards(hand), position: positionInfo(9, offset), bigBlind: 1, stack, ...extra });

test('размер открытия от стека: до 30 ББ — 2 ББ, до 60 — 2,3 ББ, глубже — 3,5 ББ (живая игра)', () => {
  assert.equal(go('As Kd', 3, 16).amount, 2);
  assert.equal(go('As Kd', 3, 29).amount, 2);
  assert.equal(go('As Kd', 3, 45).amount, 2.3);
  assert.equal(go('As Kd', 3, 100).amount, 3.5);
});

test('нет скачка на 15 ББ: AK с первой позиции — ва-банк при 15, маленький рейз при 16 (а не 3,5 ББ)', () => {
  assert.equal(go('As Kd', 3, 15).action, 'allin');
  const a = go('As Kd', 3, 16);
  assert.equal(a.action, 'raise');
  assert.ok(a.amount <= 2.2);
});

test('20 ББ с анте: маленькая пара с баттона — ва-банк, с первой позиции — пас (как у Preflop Wizard: там 66+)', () => {
  assert.equal(go('5s 5d', 0, 20, { ante: 1 }).action, 'allin');
  assert.equal(go('5s 5d', 3, 20, { ante: 1 }).action, 'fold');
});

test('20 ББ: сильные руки открывают маленьким рейзом, мусор — пас', () => {
  assert.equal(go('Ks Qd', 0, 20, { ante: 1 }).action, 'raise');
  assert.equal(go('7s 2d', 0, 20, { ante: 1 }).action, 'fold');
});

test('при стеке до 30 ББ повторное повышение — сразу ва-банк', () => {
  const a = go('Qs Qd', 7, 22, { action: 'raise', raiseTo: 2, opener: positionInfo(9, 3) });
  assert.equal(a.action, 'allin');
  assert.equal(a.amount, 22);
});
