// Банк считается сам (src/pot.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { preflopPot, streetMoney, currentPot } from '../src/pot.js';
import { preflopAdvice } from '../src/preflop.js';
import { positionInfo } from '../src/positions.js';
import { parseCards } from '../src/cards.js';

test('флоп: баттон повысил до 3 ББ, ББ уравнял — 3 + 3 + полблайнда МБ', () => {
  assert.equal(preflopPot({ bb: 2, action: 'raise', raiseTo: 6, players: 2, heroKey: 'BB' }), 13);
});

test('флоп с анте ББ: анте прибавляется (блайнды 20 000/40 000, анте 40 000)', () => {
  assert.equal(preflopPot({ bb: 40000, ante: 40000, action: 'raise', raiseTo: 100000, players: 2, heroKey: 'BTN' }), 260000);
});

test('флоп: ты открыл сам по совету — банк от твоего повышения', () => {
  assert.equal(preflopPot({ bb: 2, action: 'none', heroMove: { action: 'raise', amount: 7 }, players: 2, heroKey: 'CO' }), 15);
});

test('флоп: два лимпера и ты на ББ — по блайнду с каждого и полблайнда МБ', () => {
  assert.equal(preflopPot({ bb: 2, action: 'limp', players: 3, heroKey: 'BB' }), 7);
});

test('один на один оба блайнда в игре — мёртвых денег нет', () => {
  assert.equal(preflopPot({ bb: 2, action: 'raise', raiseTo: 5, players: 2, heroKey: 'BB', headsUp: true }), 10);
});

test('пример владельца: банк 2000, на тёрне повысили на 500, трое уравняли и я — на ривере 4500', () => {
  // На тёрне 4 соперника (поставивший + трое), все остались; я уравнял.
  const pot = currentPot({ flopPot: 2000, streets: [{ toCall: 0, opponents: 4 }, { toCall: 500, opponents: 4 }], opponentsNow: 4 });
  assert.equal(pot, 2000 + 500 * 5);
});

test('кто сбросил на ставку, денег не добавил: на ривере осталось 2 соперника', () => {
  const pot = currentPot({ flopPot: 2000, streets: [{ toCall: 500, opponents: 4 }], opponentsNow: 2 });
  assert.equal(pot, 2000 + 500 * 3);
});

test('ставил ты (по совету), соперник уравнял', () => {
  assert.equal(streetMoney({ toCall: 0, heroMove: { action: 'bet', amount: 800 }, stayed: 1 }), 1600);
  assert.equal(streetMoney({ toCall: 0, heroMove: { action: 'check', amount: 0 }, stayed: 1 }), 0);
});

test('ручная поправка банка: дальше ставки прибавляются к ней', () => {
  const pot = currentPot({ flopPot: 2000, streets: [{ toCall: 500, opponents: 1 }], opponentsNow: 1, fix: { street: 0, value: 3000 } });
  assert.equal(pot, 4000);
  assert.equal(currentPot({ flopPot: 2000, streets: [], fix: { street: 0, value: 3000 } }), 3000);
});

test('анте ББ один на один: при 10 ББ ва-банк и колл шире, чем без анте', () => {
  const btn = positionInfo(2, 0), bb = positionInfo(2, 1);
  const go = (hand, pos, extra) => preflopAdvice({ hero: parseCards(hand), position: pos, bigBlind: 1, stack: 10, ...extra }).action;
  assert.equal(go('Jh 4d', btn, {}), 'fold');
  assert.equal(go('Jh 4d', btn, { ante: 1 }), 'allin');
  assert.equal(go('Kh 6d', bb, { action: 'raise', raiseTo: 10 }), 'fold');
  assert.equal(go('Kh 6d', bb, { action: 'raise', raiseTo: 10, ante: 1 }), 'allin');
});

test('соперник поставил, совет был «рейз» — считаем колл (повышение владелец поправит сам)', () => {
  assert.equal(streetMoney({ toCall: 150000, heroMove: { action: 'raise', amount: 450000 }, stayed: 1 }), 300000);
  assert.equal(preflopPot({ bb: 2, action: 'raise', raiseTo: 6, heroMove: { action: 'raise', amount: 24 }, players: 2, heroKey: 'BB' }), 13);
});
