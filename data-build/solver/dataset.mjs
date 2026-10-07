// Таблица для настройки: что видит приложение и что выбрал солвер — по каждой руке и точке решения.
// Запуск: node dataset.mjs out_*.json > dataset.jsonl
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { cardFromString } from '../../src/cards.js';
import { positionInfo } from '../../src/positions.js';
import { postflopAdvice } from '../../src/postflop.js';
import { seededRandom } from '../../src/equity.js';
import { evaluate, categoryOf } from '../../src/evaluator.js';

const BB_POS = positionInfo(9, 2), BTN_POS = positionInfo(9, 0);
const POT = 55, STACK = 975;
const group = (a) => (a.startsWith('FOLD') ? 'fold' : a.startsWith('CHECK') ? 'check' : a.startsWith('CALL') ? 'call'
  : a.startsWith('BET') ? 'bet' : 'raise');
const amountOf = (a) => Number(a.split(' ')[1] || 0);
const random = seededRandom(5);

for (const file of process.argv.slice(2)) {
  const tree = JSON.parse(readFileSync(file, 'utf8'));
  const code = basename(file).replace(/^out_|\.json$/g, '');
  const board = code.match(/../g).map(cardFromString);
  const points = [{ kind: 'A', node: tree, hero: 'BB', bet: 0 }];
  const afterCheck = tree.childrens?.CHECK;
  if (afterCheck) points.push({ kind: 'B', node: afterCheck, hero: 'BTN', bet: 0 });
  for (const [act, child] of Object.entries(afterCheck?.childrens || {}))
    if (group(act) === 'bet' && child.strategy) points.push({ kind: 'C', node: child, hero: 'BB', bet: amountOf(act) });
  for (const [act, child] of Object.entries(tree.childrens || {}))
    if (group(act) === 'bet' && child.strategy) points.push({ kind: 'D', node: child, hero: 'BTN', bet: amountOf(act) });
  for (const p of points) {
    const acts = p.node.strategy.actions;
    for (const [hand, probs] of Object.entries(p.node.strategy.strategy)) {
      const mix = {};
      probs.forEach((q, i) => { const g = group(acts[i]); mix[g] = (mix[g] || 0) + q; });
      const hero = [cardFromString(hand.slice(0, 2)), cardFromString(hand.slice(2, 4))];
      const preflop = p.hero === 'BB' ? { action: 'raise', hero: BB_POS, raiser: BTN_POS } : { action: 'none', hero: BTN_POS };
      const a = postflopAdvice({ hero, board, opponents: 1, pot: POT, toCall: p.bet, preflopAction: preflop.action,
        stack: STACK, preflop, iterations: 2000, random, compareStyles: false });
      console.log(JSON.stringify({ board: code, kind: p.kind, bet: p.bet, ratio: +(p.bet / POT).toFixed(2), hand,
        eq: +a.equity.toFixed(3), req: +a.randomEquity.toFixed(3), vv: a.vsValue == null ? null : +a.vsValue.toFixed(3),
        outs: a.draws.outs, cat: categoryOf(evaluate([...hero, ...board])), name: a.handName, app: a.action, mix }));
    }
  }
}
