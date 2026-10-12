// Сравнение советов приложения с решениями TexasSolver на флопе.
// Запуск: node compare.mjs result.json "Kh 7c 2d" [итераций приложения] [открыл: BTN|CO|SB] [стек ББ]
// Точки решения: A — ББ первым (чек/ставка), B — после чека ББ ходит баттон (ставка/чек),
// C — баттон поставил, ББ отвечает, D — ББ поставил первым, баттон отвечает.
import { readFileSync } from 'node:fs';
import { cardFromString } from '../../src/cards.js';
import { positionInfo } from '../../src/positions.js';
import { postflopAdvice } from '../../src/postflop.js';
import { seededRandom } from '../../src/equity.js';

const [resultFile, boardText, itersArg, opener = 'BTN', stackArg = '100'] = process.argv.slice(2);
const tree = JSON.parse(readFileSync(resultFile, 'utf8'));
const board = boardText.split(/\s+/).map(cardFromString);
const iterations = Number(itersArg || 2500);
const BB_POS = positionInfo(9, 2);
const OPEN_POS = positionInfo(9, { BTN: 0, CO: 8, SB: 1 }[opener]);
const POT = opener === 'SB' ? 50 : 55, STACK = Number(stackArg) * 10 - 25; // в десятых ББ
const openerIP = opener !== 'SB';
// Кто ходит первым после флопа (без позиции) и кто в позиции.
const OOP = openerIP ? 'BB' : 'OPEN', IP = openerIP ? 'OPEN' : 'BB';
const ctx = (who) => (who === 'BB' ? { action: 'raise', hero: BB_POS, raiser: OPEN_POS } : { action: 'none', hero: OPEN_POS });

// Группы действий: fold / check / call / bet / raise.
const group = (a) => (a.startsWith('FOLD') ? 'fold' : a.startsWith('CHECK') ? 'check' : a.startsWith('CALL') ? 'call'
  : a.startsWith('BET') ? 'bet' : 'raise');
const amountOf = (a) => Number(a.split(' ')[1] || 0);

function nodeMix(node) {
  const acts = node.strategy.actions;
  const out = {};
  for (const [hand, probs] of Object.entries(node.strategy.strategy)) {
    const mix = {};
    probs.forEach((p, i) => { const g = group(acts[i]); mix[g] = (mix[g] || 0) + p; });
    out[hand] = mix;
  }
  return out;
}

function appGroup(advice, facingBet, bet) {
  // Против ва-банка «ва-банк» приложения — это просто колл.
  if (advice.action === 'allin') return bet >= STACK ? 'call' : facingBet ? 'raise' : 'bet';
  return advice.action;
}

const points = [];
const root = tree; // ходит ББ (без позиции)
points.push({ name: 'A: первым ходит игрок без позиции', node: root, hero: OOP, bet: 0 });
const afterCheck = root.childrens?.CHECK;
if (afterCheck) points.push({ name: 'B: после чека ходит игрок в позиции', node: afterCheck, hero: IP, bet: 0 });
for (const [act, child] of Object.entries(afterCheck?.childrens || {})) {
  if (group(act) === 'bet' && child.strategy) points.push({ name: `C: в позиции ставит ${amountOf(act)}, отвечает без позиции`, node: child, hero: OOP, bet: amountOf(act) });
}
for (const [act, child] of Object.entries(root.childrens || {})) {
  if (group(act) === 'bet' && child.strategy) points.push({ name: `D: без позиции ставит ${amountOf(act)}, отвечает в позиции`, node: child, hero: IP, bet: amountOf(act) });
}

const random = seededRandom(11);
const summary = [];
const misses = [];
for (const p of points) {
  const mixes = nodeMix(p.node);
  let n = 0, top = 0, ok = 0, hard = 0;
  for (const [hand, mix] of Object.entries(mixes)) {
    const hero = [cardFromString(hand.slice(0, 2)), cardFromString(hand.slice(2, 4))];
    const preflop = ctx(p.hero);
    const advice = postflopAdvice({ hero, board, opponents: 1, pot: POT, toCall: p.bet, preflopAction: preflop.action,
      stack: STACK, preflop, iterations, random, compareStyles: false });
    const g = appGroup(advice, p.bet > 0, p.bet);
    const best = Object.entries(mix).sort((x, y) => y[1] - x[1])[0][0];
    const share = mix[g] || 0;
    n++;
    if (g === best) top++;
    if (g === best || share >= 0.35) ok++;
    if (share < 0.15) { hard++; misses.push({ point: p.name, hand, app: g, solver: mix, equity: advice.equity, close: advice.close }); }
  }
  summary.push({ point: p.name, hands: n, top: Math.round((top / n) * 100), ok: Math.round((ok / n) * 100), hard: Math.round((hard / n) * 100) });
}
console.log(JSON.stringify({ board: boardText, summary, misses }, null, 0));
