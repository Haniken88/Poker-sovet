// Как часто солвер СТАВИТ, когда никто ещё не ставил (точки A и B), в зависимости от шанса руки —
// отдельно: повышал/уравнивал до флопа × в позиции / без позиции. Для подбора порогов в postflop.js.
// Запуск: node bet-freq.mjs > bet-freq.json
import { readFileSync, readdirSync } from 'node:fs';
import { cardFromString } from '../../src/cards.js';
import { positionInfo } from '../../src/positions.js';
import { postflopAdvice } from '../../src/postflop.js';
import { seededRandom } from '../../src/equity.js';

const DIR = '/root/poker-solver/';
const random = seededRandom(9);
const BB_POS = positionInfo(9, 2);
const spots = [];
for (const f of readdirSync(DIR)) {
  let m = f.match(/^out_([2-9TJQKA][shdc]{1}(?:[2-9TJQKA][shdc]){3})\.json$/);
  if (m) { spots.push({ file: f, board: m[1], opener: 'BTN', stack: 100 }); continue; }
  m = f.match(/^out2_(BTN|CO|SB)_(\d+)_(\w+)\.json$/);
  if (m) spots.push({ file: f, board: m[3], opener: m[1], stack: Number(m[2]) });
}
const stats = {}; // ключ → корзина шанса → [ставок, всего]
for (const s of spots) {
  const tree = JSON.parse(readFileSync(DIR + s.file, 'utf8'));
  const board = s.board.match(/../g).map(cardFromString);
  const OPEN = positionInfo(9, { BTN: 0, CO: 8, SB: 1 }[s.opener]);
  const openerIP = s.opener !== 'SB';
  const pot = s.opener === 'SB' ? 50 : 55, stack = s.stack * 10 - 25;
  // A: ходит игрок без позиции первым; B: после чека — игрок в позиции.
  const nodes = [{ node: tree, who: openerIP ? 'BB' : 'OPEN', ip: false }];
  if (tree.childrens?.CHECK) nodes.push({ node: tree.childrens.CHECK, who: openerIP ? 'OPEN' : 'BB', ip: true });
  for (const { node, who, ip } of nodes) {
    const acts = node.strategy.actions;
    const key = `${who === 'BB' ? 'уравнял' : 'повышал'} · ${ip ? 'в позиции (тебе прочекали)' : 'без позиции (ходишь первым)'}`;
    for (const [hand, probs] of Object.entries(node.strategy.strategy)) {
      const hero = [cardFromString(hand.slice(0, 2)), cardFromString(hand.slice(2, 4))];
      const preflop = who === 'BB' ? { action: 'raise', hero: BB_POS, raiser: OPEN } : { action: 'none', hero: OPEN };
      const a = postflopAdvice({ hero, board, opponents: 1, pot, toCall: 0, preflopAction: preflop.action, stack, preflop,
        iterations: 1200, random, compareStyles: false });
      const bet = probs.reduce((sum, p, i) => sum + (acts[i].startsWith('BET') || acts[i].startsWith('ALLIN') ? p : 0), 0);
      const b = Math.min(9, Math.floor(a.equity * 10));
      const k = (stats[key] ||= Array.from({ length: 10 }, () => [0, 0]));
      k[b][0] += bet; k[b][1] += 1;
    }
  }
}
console.log(JSON.stringify(stats));
