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
  // Банк 20 в центре. Ставка в банк (нужно 33 %) — колл; в три банка (нужно 43 %) — пас:
  // на тёрне снова придётся платить.
  assert.equal(post('Js Ts', 'As 7s 2d', { pot: 20, toCall: 20, preflopAction: 'raise' }).action, 'call');
  assert.equal(post('Js Ts', 'As 7s 2d', { pot: 20, toCall: 60, preflopAction: 'raise' }).action, 'fold');
  // Ва-банк в размер банка последними деньгами — колл: дальше платить не придётся.
  assert.equal(post('Js Ts', 'As 7s 2d', { pot: 20, toCall: 20, stack: 20, preflopAction: 'raise' }).action, 'allin');
});

test('постфлоп: совет приходит быстро', () => {
  const start = performance.now();
  postflopAdvice({ hero: cards('As Kd'), board: cards('Ah 7c 2d'), opponents: 5, pot: 10, toCall: 5 });
  const ms = performance.now() - start;
  assert.ok(ms < 1000, `заняло ${ms.toFixed(0)} мс`);
});

test('роял-флеш называется роял-флешем', async () => {
  const { evaluate, handName } = await import('../src/evaluator.js');
  assert.equal(handName(evaluate(cards('Ah Kh Qh Jh Th'))), 'Роял-флеш');
  assert.equal(handName(evaluate(cards('Kh Qh Jh Th 9h'))), 'Стрит-флеш');
});

test('кто тебя бьёт: каре троек на A-K-Q червей бьёт только J♥10♥', async () => {
  const { whoBeatsYou } = await import('../src/postflop.js');
  const { cardToString } = await import('../src/cards.js');
  const result = whoBeatsYou(cards('3c 3d'), cards('3h Ah Kh Qh 3s'));
  assert.equal(result.total, 990);
  assert.equal(result.count, 1);
  assert.deepEqual(result.hands[0].cards.map(cardToString).sort(), ['Jh', 'Th']);
  assert.equal(result.hands[0].name, 'Роял-флеш');
});

test('проценты у краёв — с десятыми', async () => {
  const { percentText } = await import('../src/postflop.js');
  assert.equal(percentText(0.9968), '99,6');
  assert.equal(percentText(0.99999), '99,9');
  assert.equal(percentText(1), '100');
  assert.equal(percentText(0.003), '0,3');
  assert.equal(percentText(0.5), '50');
});

// Раздачи владельца, на которых старая модель ошибалась (2026-10-05).
test('AA на K-K-8-4-2: против ставки в банк — колл, против ставки в 4 банка — пас', () => {
  const pot = post('Ac Ah', '4d Kc Kd 8s 2c', { pot: 1000, toCall: 1000, opponents: 1 });
  assert.equal(pot.action, 'call');
  assert.ok(pot.equity > 0.4, `шанс ${pot.equity}`);
  // Огромной ставкой обычно ставят сильную руку (короля или фулл-хаус).
  assert.equal(post('Ac Ah', '4d Kc Kd 8s 2c', { pot: 250, toCall: 1000, opponents: 2 }).action, 'fold');
});

test('QQ на A-8-8-4-2: решение зависит от того, как блефует соперник, и приложение это говорит', () => {
  const normal = post('Qh Qd', '4d Ad 8c 8s 2c', { pot: 750, toCall: 500, opponents: 1 });
  assert.ok(normal.equity > 0.1, `шанс ${normal.equity}`); // было 1 %
  assert.ok(normal.randomEquity > 0.7, `против любых рук ${normal.randomEquity}`);
  assert.equal(normal.action, 'fold');
  assert.match(normal.reason, /часто блефует — колл/);
  const often = post('Qh Qd', '4d Ad 8c 8s 2c', { pot: 750, toCall: 500, opponents: 1, style: 'often' });
  assert.equal(often.action, 'call');
});

test('префлоп: шанс считается против тех, кто играет, а не против всего стола', async () => {
  const { preflopEquity } = await import('../src/preflop.js');
  const random = seededRandom(5);
  const folded = preflopEquity({ hero: cards('9c 4d'), action: 'none', random });
  assert.equal(folded.opponents, 1);
  assert.ok(folded.equity > 0.3, `94o против одного: ${folded.equity}`); // было 6 % «против 8»
  const vsRaise = preflopEquity({ hero: cards('As Ah'), action: 'raise', random });
  assert.ok(vsRaise.equity > 0.75, `AA против рейзера: ${vsRaise.equity}`);
});

test('короткий стек: ва-банк или пас', () => {
  assert.equal(pre('As 9d', 9, 0, { stack: 16, bigBlind: 2 }).action, 'allin'); // 8 ББ с баттона
  assert.equal(pre('7s 2d', 9, 0, { stack: 16, bigBlind: 2 }).action, 'fold');
  assert.equal(pre('Qs Qd', 9, 4, { action: 'raise', raiseTo: 6, stack: 20, bigBlind: 2 }).action, 'allin');
  assert.equal(pre('Ks Td', 9, 4, { action: 'raise', raiseTo: 6, stack: 20, bigBlind: 2 }).action, 'fold');
  // Глубокий стек — обычный рейз, не ва-банк.
  assert.equal(pre('As Ad', 9, 3, { stack: 200, bigBlind: 2 }).action, 'raise');
});

test('ставка не больше стека: почти весь стек — значит ва-банк', () => {
  const r = post('As Ad', 'Ah 7c 2d', { pot: 100, stack: 80 });
  assert.equal(r.action, 'allin');
  assert.equal(r.amount, 80);
});
