// Сравнение советов приложения с TexasSolver на РИВЕРЕ (линия: на тёрне оба прочекали — банк известен точно).
// Запуск: node river-compare.mjs out3_*.json "Kd 9s 4h 2c" [открыл BTN|CO|SB] [стек ББ] [сколько риверов, 6]
import { readFileSync } from 'node:fs';
import { cardFromString } from '../../src/cards.js';
import { positionInfo } from '../../src/positions.js';
import { postflopAdvice } from '../../src/postflop.js';
import { seededRandom } from '../../src/equity.js';

const [file, turnText, opener = 'BTN', stackArg = '100', nArg = '6'] = process.argv.slice(2);
const tree = JSON.parse(readFileSync(file, 'utf8'));
const turn = turnText.split(/\s+/).map(cardFromString);
const BB_POS = positionInfo(9, 2), OPEN_POS = positionInfo(9, { BTN: 0, CO: 8, SB: 1 }[opener]);
const POT = opener === 'SB' ? 50 : 55, STACK = Number(stackArg) * 10 - 25;
const openerIP = opener !== 'SB';
const OOP = openerIP ? 'BB' : 'OPEN', IP = openerIP ? 'OPEN' : 'BB';
const ctx = (who) => (who === 'BB' ? { action: 'raise', hero: BB_POS, raiser: OPEN_POS } : { action: 'none', hero: OPEN_POS });
const group = (a) => (a.startsWith('FOLD') ? 'fold' : a.startsWith('CHECK') ? 'check' : a.startsWith('CALL') ? 'call' : a.startsWith('BET') ? 'bet' : 'raise');
const amountOf = (a) => Number(a.split(' ')[1] || 0);
const random = seededRandom(13);

const rivers = Object.entries(tree.childrens.CHECK.childrens.CHECK.dealcards).filter(([, n]) => n.strategy);
const step = Math.max(1, Math.floor(rivers.length / Number(nArg)));
const picked = rivers.filter((_, i) => i % step === 0).slice(0, Number(nArg));
const sum = {};
for (const [riverCard, root] of picked) {
  const board = [...turn, cardFromString(riverCard)];
  const points = [{ kind: 'A', node: root, hero: OOP, bet: 0 }];
  const ac = root.childrens?.CHECK;
  if (ac?.strategy) points.push({ kind: 'B', node: ac, hero: IP, bet: 0 });
  for (const [act, ch] of Object.entries(ac?.childrens || {})) if (group(act) === 'bet' && ch.strategy) points.push({ kind: 'C', node: ch, hero: OOP, bet: amountOf(act) });
  for (const [act, ch] of Object.entries(root.childrens || {})) if (group(act) === 'bet' && ch.strategy) points.push({ kind: 'D', node: ch, hero: IP, bet: amountOf(act) });
  for (const p of points) {
    const acts = p.node.strategy.actions;
    const key = p.kind + (p.bet ? (p.bet >= STACK ? ' (ва-банк)' : ' (ставка)') : '');
    const s = (sum[key] ||= { n: 0, top: 0, hard: 0 });
    for (const [hand, probs] of Object.entries(p.node.strategy.strategy)) {
      const hero = [cardFromString(hand.slice(0, 2)), cardFromString(hand.slice(2, 4))];
      if (board.some((c) => hero.includes(c))) continue;
      const mix = {}; probs.forEach((q, i) => { const g = group(acts[i]); mix[g] = (mix[g] || 0) + q; });
      const preflop = ctx(p.hero);
      const a = postflopAdvice({ hero, board, opponents: 1, pot: POT, toCall: p.bet, preflopAction: preflop.action, stack: STACK, preflop,
        iterations: 800, random, compareStyles: false });
      const g = a.action === 'allin' ? (p.bet >= STACK ? 'call' : p.bet ? 'raise' : 'bet') : a.action;
      const best = Object.entries(mix).sort((x, y) => y[1] - x[1])[0][0];
      s.n++; if (g === best) s.top++; if ((mix[g] || 0) < 0.15) s.hard++;
    }
  }
}
console.log(JSON.stringify(sum));
