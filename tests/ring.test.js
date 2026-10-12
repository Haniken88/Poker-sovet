// Полный стол, короткий стек: таблица Нэша «ва-банк или пас» (src/nashRing.js, свой расчёт, сверка — CLAUDE.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { preflopAdvice } from '../src/preflop.js';
import { positionInfo } from '../src/positions.js';
import { parseCards } from '../src/cards.js';
import { allClasses } from '../src/hands.js';
import { NASH_RING } from '../src/nashRing.js';

const go = (hand, offset, extra = {}) => preflopAdvice({ hero: parseCards(hand), position: positionInfo(9, offset), bigBlind: 1, stack: 10, ...extra }).action;
const CL = allClasses();
const dec = (hex) => { let bits = ''; for (const ch of hex) bits += parseInt(ch, 16).toString(2).padStart(4, '0'); return new Set(CL.filter((_, i) => bits[i] === '1')); };

test('первая позиция, 10 ББ, без анте — как в опубликованных таблицах: AJo и KQs ва-банк, ATo пас', () => {
  assert.equal(go('As Jd', 3), 'allin');
  assert.equal(go('Ks Qs', 3), 'allin');
  assert.equal(go('As Td', 3), 'fold');
  assert.equal(go('7s 7d', 3), 'allin');
});

test('с анте ББ ва-банк шире: K9o с баттона при 10 ББ — без анте пас, с анте ва-банк', () => {
  assert.equal(go('Ks 9d', 0), 'fold');
  assert.equal(go('Ks 9d', 0, { ante: 1 }), 'allin');
});

test('чем больше игроков после тебя, тем уже ва-банк', () => {
  for (const A of [0, 1]) {
    const share = (m) => dec(NASH_RING[A][m][10][0]).size;
    assert.ok(share(2) > share(5) && share(5) > share(8), `анте ${A}`);
  }
});

test('в таблицах нет «дыр»: если играется K7s, то играются и K8s, K9s', () => {
  const R = '23456789TJQKA';
  for (const A of ['0', '1']) for (const m of Object.keys(NASH_RING[A])) for (const S of Object.keys(NASH_RING[A][m])) {
    for (const hex of NASH_RING[A][m][S]) {
      const set = dec(hex);
      for (const c of set) {
        if (c.length === 2) continue;
        const hi = R.indexOf(c[0]), lo = R.indexOf(c[1]);
        for (let r = lo + 1; r < hi; r++) assert.ok(set.has(R[hi] + R[r] + c[2]), `${A}/${m}/${S}: есть ${c}, нет ${R[hi] + R[r] + c[2]}`);
      }
    }
  }
});

test('ББ против ва-банка с баттона при 10 ББ: A7s и 22 — колл, K5o — пас; без отметки, кто пошёл, — старое правило', () => {
  const vs = (hand) => go(hand, 2, { action: 'raise', raiseTo: 10, opener: positionInfo(9, 0) });
  assert.equal(vs('As 7s'), 'allin');
  assert.equal(vs('2s 2d'), 'allin');
  assert.equal(vs('Ks 5d'), 'fold');
});

test('55 с первой позиции при 8 ББ: без анте пас (на границе), с анте ББ — ва-банк', () => {
  assert.equal(go('5s 5d', 3, { stack: 8 }), 'fold');
  assert.equal(go('5s 5d', 3, { stack: 8, ante: 1 }), 'allin');
});
