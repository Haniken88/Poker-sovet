// После флопа, когда никто не ставил: важно, ходишь ли ты первым или тебе прочекали (сверка с TexasSolver 2026-10-13).
import test from 'node:test';
import assert from 'node:assert/strict';
import { postflopAdvice } from '../src/postflop.js';
import { positionInfo } from '../src/positions.js';
import { parseCards } from '../src/cards.js';
import { seededRandom } from '../src/equity.js';

const SB = positionInfo(9, 1), BB = positionInfo(9, 2), BTN = positionInfo(9, 0), CO = positionInfo(9, 8);
const go = (hand, board, preflop) => postflopAdvice({ hero: parseCards(hand), board: parseCards(board), opponents: 1, pot: 6,
  toCall: 0, preflopAction: preflop.action, stack: 100, preflop, iterations: 4000, random: seededRandom(3), compareStyles: false }).action;

test('повышал с малого блайнда, ходишь первым без позиции: средняя рука — чек, очень сильная — ставка', () => {
  assert.equal(go('Qs Td', 'Kd 7c 3h 2s', { action: 'none', hero: SB }), 'check'); // ~41 %
  assert.equal(go('7s 7d', '7h Kc 3d 2s', { action: 'none', hero: SB }), 'bet');
});

test('уравнял на ББ против малого блайнда — ты в позиции, тебе прочекали: сильная — ставка, слабая — чек', () => {
  assert.equal(go('Kh Ks', 'Kd 7c 3h 2s', { action: 'raise', hero: BB, raiser: SB }), 'bet');
  assert.equal(go('5h 4h', 'Kd Jc 9h 2s', { action: 'raise', hero: BB, raiser: SB }), 'check');
});

test('уравнял на ББ против баттона — ходишь первым: чек даже с сильной (как и раньше)', () => {
  assert.equal(go('Kh Ks', 'Kd 7c 3h 2s', { action: 'raise', hero: BB, raiser: BTN }), 'check');
});

test('уравнял на баттоне против катоффа, тебе прочекали: сильная — ставка', () => {
  assert.equal(go('Ah Ad', 'As 8c 3d 2h', { action: 'raise', hero: BTN, raiser: CO }), 'bet');
});

// ФЛОП (2026-10-14, 6 флопов TexasSolver): свои правила, не как на тёрне.
const goFlop = (hand, board, preflop, toCall = 0) => postflopAdvice({ hero: parseCards(hand), board: parseCards(board), opponents: 1, pot: 6,
  toCall, preflopAction: preflop.action, stack: 100, preflop, iterations: 4000, random: seededRandom(5), compareStyles: false }).action;

test('флоп: кто повышал до флопа — ставит почти всегда, даже без попадания', () => {
  assert.equal(goFlop('Ah Qd', 'Kc 7s 2d', { action: 'none', hero: BTN }), 'bet');
  assert.equal(goFlop('6h 5h', 'Kc Js 2d', { action: 'none', hero: BTN }), 'bet');
});

test('флоп: уравнял и ходишь первым — средняя рука чек, сет — ставка', () => {
  assert.equal(goFlop('Qh Qd', 'Kc 7s 2d', { action: 'raise', hero: BB, raiser: BTN }), 'check');
  assert.equal(goFlop('7h 7d', 'Kc 7s 2d', { action: 'raise', hero: BB, raiser: BTN }), 'bet');
});

test('флоп: против ставки уравниваем, как только шанс не ниже цены (без запаса)', () => {
  // Пара с хорошим кикером против ставки полбанка — колл.
  assert.equal(goFlop('Ks Qh', 'Kc 7s 2d', { action: 'raise', hero: BB, raiser: BTN }, 3), 'call');
});
