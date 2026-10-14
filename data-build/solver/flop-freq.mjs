// Флоп: что делает солвер в зависимости от шанса руки (как bet-freq.mjs, но для флопов с ПК владельца) +
// ответ на ставку: доля колла/рейза/паса по «шанс минус цена колла».
import { readFileSync, readdirSync } from 'node:fs';
import { cardFromString } from '../../src/cards.js';
import { positionInfo } from '../../src/positions.js';
import { postflopAdvice } from '../../src/postflop.js';
import { seededRandom } from '../../src/equity.js';

const DIR = '/root/poker-bot/data-build/solver/pc-flops/poker/results/';
const random = seededRandom(21);
const BB_POS = positionInfo(9, 2);
const group = (a) => (a.startsWith('FOLD') ? 'fold' : a.startsWith('CHECK') ? 'check' : a.startsWith('CALL') ? 'call' : a.startsWith('BET') ? 'bet' : 'raise');
const first = {}, facing = {};
for (const f of readdirSync(DIR).filter((f) => f.endsWith('.json'))) {
  const [opener, stack, b] = f.replace('.json', '').split('_');
  const tree = JSON.parse(readFileSync(DIR + f, 'utf8'));
  const board = b.match(/../g).map(cardFromString);
  const OPEN = positionInfo(9, { BTN: 0, CO: 8, SB: 1 }[opener]);
  const openerIP = opener !== 'SB';
  const pot = opener === 'SB' ? 50 : 55, STACK = Number(stack) * 10 - 25;
  const ctx = (who) => (who === 'BB' ? { action: 'raise', hero: BB_POS, raiser: OPEN } : { action: 'none', hero: OPEN });
  const OOP = openerIP ? 'BB' : 'OPEN', IP = openerIP ? 'OPEN' : 'BB';
  const nodes = [{ node: tree, who: OOP, ip: false, bet: 0 }];
  const ac = tree.childrens?.CHECK; if (ac) nodes.push({ node: ac, who: IP, ip: true, bet: 0 });
  for (const [act, ch] of Object.entries(ac?.childrens || {})) if (act.startsWith('BET') && ch.strategy && Number(act.split(' ')[1]) < STACK) nodes.push({ node: ch, who: OOP, ip: false, bet: Number(act.split(' ')[1]) });
  for (const [act, ch] of Object.entries(tree.childrens || {})) if (act.startsWith('BET') && ch.strategy && Number(act.split(' ')[1]) < STACK) nodes.push({ node: ch, who: IP, ip: true, bet: Number(act.split(' ')[1]) });
  for (const { node, who, ip, bet } of nodes) {
    const acts = node.strategy.actions;
    for (const [hand, probs] of Object.entries(node.strategy.strategy)) {
      const hero = [cardFromString(hand.slice(0, 2)), cardFromString(hand.slice(2, 4))];
      const preflop = ctx(who);
      const a = postflopAdvice({ hero, board, opponents: 1, pot, toCall: bet, preflopAction: preflop.action, stack: STACK, preflop, iterations: 1000, random, compareStyles: false });
      const mix = {}; probs.forEach((q, i) => { const g = group(acts[i]); mix[g] = (mix[g] || 0) + q; });
      if (!bet) {
        const key = `${who === 'BB' ? 'уравнял' : 'повышал'} · ${ip ? 'тебе прочекали' : 'ходишь первым'}`;
        const k = (first[key] ||= Array.from({ length: 10 }, () => [0, 0, 0])); const i = Math.min(9, Math.floor(a.equity * 10));
        k[i][0] += mix.bet || 0; k[i][1] += 1; k[i][2] += a.action === 'bet' || a.action === 'allin' ? 1 : 0;
      } else {
        const need = bet / (pot + 2 * bet);
        const d = Math.max(-3, Math.min(4, Math.floor((a.equity - need) * 10))); // шаг 10 п.п.
        const k = (facing[d] ||= { n: 0, call: 0, raise: 0, fold: 0, appFold: 0 });
        k.n++; k.call += mix.call || 0; k.raise += mix.raise || 0; k.fold += mix.fold || 0; k.appFold += a.action === 'fold' ? 1 : 0;
      }
    }
  }
}
console.log('КОГДА НИКТО НЕ СТАВИЛ: солвер ставит % (приложение ставит %), по шансу руки');
for (const [k, v] of Object.entries(first)) console.log(k.padEnd(30), v.map(([b, n, ap], i) => (n ? `${i * 10}%:${Math.round(b / n * 100)}(${Math.round(ap / n * 100)})` : '')).filter(Boolean).join(' '));
console.log('ОТВЕТ НА СТАВКУ: по «шанс − цена колла»: солвер пас/колл/рейз % | приложение пасует %');
for (const d of Object.keys(facing).map(Number).sort((a, b) => a - b)) { const v = facing[d]; console.log(`${d * 10}…${d * 10 + 10} п.п.`.padEnd(14), `пас ${Math.round(v.fold / v.n * 100)} колл ${Math.round(v.call / v.n * 100)} рейз ${Math.round(v.raise / v.n * 100)} | приложение пас ${Math.round(v.appFold / v.n * 100)} | рук ${v.n}`); }
