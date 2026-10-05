import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCards } from '../src/cards.js';
import { handClass, parseRange, allClasses } from '../src/hands.js';
import { HAND_RANKS } from '../src/handRanks.js';
import { positionInfo } from '../src/positions.js';
import { preflopAdvice } from '../src/preflop.js';
import { postflopAdvice, describeHand, findDraws } from '../src/postflop.js';
import { seededRandom } from '../src/equity.js';

const cards = parseCards;

test('классы рук и разбор диапазонов', () => {
  assert.equal(handClass(...cards('As Kd')), 'AKo');
  assert.equal(handClass(...cards('Kh Ah')), 'AKs');
  assert.equal(handClass(...cards('7c 7d')), '77');
  assert.equal(allClasses().length, 169);
  assert.deepEqual([...parseRange('TT+')], ['TT', 'JJ', 'QQ', 'KK', 'AA']);
  assert.deepEqual([...parseRange('KTs+')], ['KTs', 'KJs', 'KQs']);
  assert.deepEqual([...parseRange('77-99, ATs-AQs')], ['77', '88', '99', 'ATs', 'AJs', 'AQs']);
  assert.throws(() => parseRange('ZZ'), /Ошибка в диапазоне/);
  assert.equal(new Set(HAND_RANKS).size, 169);
  assert.equal(HAND_RANKS[0], 'AA');
});

test('позиции за столом', () => {
  assert.equal(positionInfo(9, 0).key, 'BTN');
  assert.equal(positionInfo(9, 1).key, 'SB');
  assert.equal(positionInfo(9, 2).key, 'BB');
  assert.equal(positionInfo(9, 3).key, 'UTG');
  assert.equal(positionInfo(9, 3).behind, 8);
  assert.equal(positionInfo(9, 8).key, 'CO');
  assert.equal(positionInfo(9, 8).behind, 3);
  assert.equal(positionInfo(6, 3).key, 'LJ'); // за 6 местами UTG = лоуджек
  assert.equal(positionInfo(2, 0).key, 'BTN');
  assert.equal(positionInfo(2, 1).key, 'BB');
  assert.throws(() => positionInfo(11, 0), /от 2 до 10/);
});

const pre = (hand, players, offset, extra = {}) =>
  preflopAdvice({ hero: cards(hand), position: positionInfo(players, offset), ...extra });

test('префлоп: открытие зависит от позиции', () => {
  assert.equal(pre('As Ah', 9, 3).action, 'raise');
  assert.equal(pre('As Ah', 9, 3).amount, 3);
  assert.equal(pre('Ks 9d', 9, 3).action, 'fold'); // K9o с ранней — пас
  assert.equal(pre('Ks 9d', 9, 0).action, 'raise'); // а с баттона — рейз
  assert.equal(pre('7s 2d', 9, 0).action, 'fold');
  assert.equal(pre('7s 2d', 9, 2).action, 'check'); // ББ, все сбросили
});

test('префлоп: против лимперов и повышений', () => {
  assert.equal(pre('As Ks', 9, 5, { action: 'limp', limpers: 2 }).action, 'raise');
  assert.equal(pre('As Ks', 9, 5, { action: 'limp', limpers: 2 }).amount, 5);
  assert.equal(pre('6s 6d', 9, 0, { action: 'limp', limpers: 1 }).action, 'raise'); // с баттона — изолировать
  assert.equal(pre('4s 4d', 9, 0, { action: 'limp', limpers: 2 }).action, 'call'); // доехать до сета
  assert.equal(pre('Ks Kd', 9, 4, { action: 'raise', raiseTo: 3 }).action, 'raise');
  assert.equal(pre('Ks Kd', 9, 4, { action: 'raise', raiseTo: 3 }).amount, 9);
  assert.equal(pre('8s 8d', 9, 4, { action: 'raise', raiseTo: 3 }).action, 'call');
  assert.equal(pre('Ks 9d', 9, 4, { action: 'raise', raiseTo: 3 }).action, 'fold');
  assert.equal(pre('Ks 9s', 9, 2, { action: 'raise', raiseTo: 3 }).action, 'call'); // ББ защищает шире
  assert.equal(pre('As Ad', 9, 4, { action: '3bet', raiseTo: 9 }).action, 'raise');
  assert.equal(pre('Js Jd', 9, 4, { action: '3bet', raiseTo: 9 }).action, 'call');
  assert.equal(pre('Ts Td', 9, 4, { action: '3bet', raiseTo: 9 }).action, 'fold');
});

test('описание руки на флопе', () => {
  assert.equal(describeHand(cards('As Kd'), cards('Ah 7c 2d')), 'Старшая пара (тузов)');
  assert.equal(describeHand(cards('Qs Qd'), cards('Jh 7c 2d')), 'Оверпара (дам)');
  assert.equal(describeHand(cards('7s 8d'), cards('Ah 7c 2d')), 'Средняя пара (семёрок)');
  assert.equal(describeHand(cards('As Ad'), cards('Ah 7c 2d')), 'Сет (тройка)');
  assert.equal(describeHand(cards('2c 3d'), cards('As Ks Qs Js Ts')), 'Комбинация на столе (у всех)');
});

test('дро и ауты', () => {
  assert.deepEqual(findDraws(cards('As 5s'), cards('Ks 9s 2d')), { names: ['Флеш-дро'], outs: 9 });
  assert.deepEqual(findDraws(cards('9h 8d'), cards('7s 6c 2d')), { names: ['Двустороннее стрит-дро'], outs: 8 });
  assert.deepEqual(findDraws(cards('9h 8d'), cards('6s 5c Kd')), { names: ['Гатшот (стрит-дро в одну карту)'], outs: 4 });
  assert.equal(findDraws(cards('9s 8s'), cards('7s 6s Kd')).outs, 15); // флеш + стрит
  assert.deepEqual(findDraws(cards('2h 3d'), cards('As Ks Qs Js 9s')).names, []);
});

const post = (hand, board, extra) =>
  postflopAdvice({ hero: cards(hand), board: cards(board), random: seededRandom(1), ...extra });

test('постфлоп: сильная рука ставит, слабая не платит', () => {
  assert.equal(post('As Ad', 'Ah 7c 2d', { pot: 10 }).action, 'bet');
  assert.equal(post('As Ad', 'Ah 7c 2d', { pot: 10 }).amount, 6.6);
  assert.equal(post('As Ad', 'Ah 7c 2d', { pot: 10, toCall: 5 }).action, 'raise');
  assert.equal(post('4s 3d', 'Ah Kc 9d', { pot: 10 }).action, 'check');
  assert.equal(post('4s 3d', 'Ah Kc 9d', { pot: 10, toCall: 10 }).action, 'fold');
});

test('постфлоп: дро уравнивает только по хорошей цене', () => {
  // Флеш-дро на флопе ≈ 35 %: маленькая ставка (нужно 20 %) — колл, огромная (нужно 45 %) — пас.
  assert.equal(post('Js Ts', 'As 7s 2d', { pot: 20, toCall: 5, preflopAction: 'raise' }).action, 'call');
  assert.equal(post('Js Ts', 'As 7s 2d', { pot: 20, toCall: 30, preflopAction: 'raise' }).action, 'fold');
});

test('постфлоп: совет приходит быстро', () => {
  const start = performance.now();
  postflopAdvice({ hero: cards('As Kd'), board: cards('Ah 7c 2d'), opponents: 5, pot: 10, toCall: 5 });
  const ms = performance.now() - start;
  assert.ok(ms < 1000, `заняло ${ms.toFixed(0)} мс`);
});
