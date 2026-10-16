// «Полное объяснение» для тренажёра (2026-10-15, просьба владельца): почему ответ именно такой — цифрами из тех же
// таблиц, по которым дан совет (Нэш для короткого стека, таблицы солверов для глубокого). Человек должен понять,
// что «67o ва-банк» верно только в этой ситуации (место, сколько игроков после, стек), а не всегда.
import { ringSet, chartLookup, chartPos, preflopEquity } from './preflop.js';
import { nashHU } from './nashHU.js';
import { combosIn } from './ranges.js';
import { calcEquity } from './equity.js';
import { handClass, combosOf } from './hands.js';
import { huCall } from './huCall.js';
import { HAND_RANKS_HU } from './handRanks.js';

const ru = (n) => String(Math.round(n * 10) / 10).replace('.', ',');
const after = (n) => (n === 1 ? 'После тебя ходит ещё <b>один</b> игрок' : `После тебя ходят ещё <b>${n}</b>`);
const pc = (x) => Math.round(x * 100);
const share = (set) => [...set].reduce((s, c) => s + combosOf(c), 0) / 1326;
const NAME = { BTN: 'баттон', SB: 'малый блайнд', BB: 'большой блайнд', CO: 'катофф', HJ: 'хайджек', LJ: 'лоуджек' };
const name = (p) => NAME[p.key] || `ранняя (${p.key})`;
const eqVs = (hero, set, iterations, random) =>
  calcEquity({ hero, opponents: 1, ranges: [{ groups: [combosIn(set)], weights: [1] }], iterations, random }).equity;

// Короткий стек, до тебя все сбросили: кто после тебя и с чем уравнивает (по Нэшу).
function callersBehind(position, players, stackBB, ante) {
  if (players === 2) return [{ key: 'BB', posted: 1, set: nashHU(stackBB, ante).call }];
  const m = position.behind;
  return Array.from({ length: m }, (_, j) => {
    const fromEnd = m - 1 - j;
    return { key: fromEnd === 0 ? 'BB' : fromEnd === 1 ? 'SB' : null, posted: fromEnd === 0 ? 1 : fromEnd === 1 ? 0.5 : 0,
      set: ringSet(ante, m, stackBB, 1 + j) };
  });
}
const pushSet = (players, behind, stackBB, ante) => (players === 2 ? nashHU(stackBB, ante).push : ringSet(ante, behind, stackBB, 0));

function explainPush(q, iterations, random) {
  const { hero, position, players, stackBB: S } = q;
  const ante = q.ante > 0;
  const cls = handClass(hero[0], hero[1]);
  const dead = 1.5 + (ante ? 1 : 0);
  const heroPosted = position.key === 'SB' || (players === 2 && position.key === 'BTN') ? 0.5 : 0;
  const callers = callersBehind(position, players, S, ante);
  let allFold = 1, ev = 0, callP = 0, eqSum = 0;
  for (const c of callers) {
    const sh = share(c.set), eq = eqVs(hero, c.set, iterations, random);
    const p = allFold * sh;
    ev += p * (eq * (2 * S + dead - c.posted - heroPosted) - (S - heroPosted));
    callP += p; eqSum += p * eq; allFold *= 1 - sh;
  }
  ev += allFold * dead;
  const lines = [];
  const left = players === 2 ? 1 : position.behind;
  lines.push(`${after(left)}. По таблице Нэша ${left === 1 ? 'он сбросит' : 'все они сбросят'} примерно в <b>${pc(allFold)} %</b> случаев — тогда ты без вскрытия забираешь <b>${ru(dead)} ББ</b> (блайнды${ante ? ' и анте' : ''}).`);
  lines.push(`Уравняют примерно в <b>${pc(callP)} %</b> случаев — обычно сильными руками. Против них у ${cls} шанс около <b>${pc(callP ? eqSum / callP : 0)} %</b>.`);
  // Итог — по таблице (q.correct); прикидка выше упрощённая, на границе честно говорим, что разница копеечная.
  const push = q.correct === 'allin';
  if ((ev >= 0) === push && Math.abs(ev) >= 0.15) {
    lines.push(push
      ? `В среднем ва-банк приносит <b>+${ru(ev)} ББ</b> за раздачу, а пас — 0 (теряешь только уже поставленное). Поэтому ва-банк.`
      : `В среднем ва-банк теряет <b>${ru(ev)} ББ</b> за раздачу, а пас — 0. Поэтому пас.`);
  } else {
    lines.push(`Ва-банк и пас здесь почти одинаковы (разница около ${ru(Math.abs(ev))} ББ) — рука на самой границе. Точная таблица Нэша говорит: <b>${push ? 'ва-банк' : 'пас'}</b>, но ошибка тут стоит копейки.`);
  }
  // Когда с этой же рукой решение другое — чтобы не выучить «с ${cls} всегда так».
  const pushNow = pushSet(players, position.behind, S, ante).has(cls);
  const alt = [];
  if (players > 2 && position.behind < 8 && pushSet(9, 8, S, ante).has(cls) !== pushNow) alt.push(`с первой позиции за полным столом (после тебя 8 игроков) — ${pushNow ? 'уже пас' : 'ва-банк'}`);
  if (position.behind > 2 && pushSet(players, 2, S, ante).has(cls) !== pushNow) alt.push(`с баттона (после тебя только блайнды) — ${pushNow ? 'пас' : 'ва-банк'}`);
  const S2 = Math.min(players === 2 ? 20 : 15, Math.round(S) + 6);
  if (S2 !== S && pushSet(players, position.behind, S2, ante).has(cls) !== pushNow) alt.push(`при стеке ${S2} ББ на этом же месте — ${pushNow ? 'пас' : 'ва-банк'}`);
  if (pushSet(players, position.behind, S, !ante).has(cls) !== pushNow) alt.push(`${ante ? 'без анте' : 'с анте'} — ${pushNow ? 'пас' : 'ва-банк'}`);
  if (alt.length) lines.push(`Но это не правило «с ${cls} всегда ${pushNow ? 'ва-банк' : 'пас'}»: ${alt.join('; ')}.`);
  lines.push('Это расчёт «в долгую»: в отдельной раздаче можно проиграть, но на сотнях таких раздач так выгоднее.');
  return lines;
}

function explainVsShove(q, iterations, random) {
  const { hero, position, players, stackBB: S, opener } = q;
  const ante = q.ante > 0;
  const cls = handClass(hero[0], hero[1]);
  // Как в советах: за полным столом — Нэш; один на один — «средний» соперник (идёт ва-банк с shovePct % лучших рук).
  let pushes = pushSet(players, opener.behind, S, ante);
  if (players === 2) {
    const want = huCall(S, ante).row.shovePct / 100; pushes = new Set(); let n = 0;
    for (const c of HAND_RANKS_HU) { if (n / 1326 >= want) break; pushes.add(c); n += combosOf(c); }
  }
  const eq = eqVs(hero, pushes, iterations, random);
  const dead = 1.5 + (ante ? 1 : 0);
  const heroPosted = position.key === 'BB' ? 1 : position.key === 'SB' ? 0.5 : 0;
  const shPosted = opener.key === 'SB' || (players === 2 && opener.key === 'BTN') ? 0.5 : 0;
  const pot = 2 * S + dead - heroPosted - shPosted;
  const need = (S - heroPosted) / pot;
  return [
    `${name(opener)[0].toUpperCase() + name(opener).slice(1)} ${players === 2 ? 'в среднем' : 'по таблице Нэша'} идёт ва-банк примерно с <b>${pc(share(pushes))} %</b> рук. Против них у ${cls} шанс около <b>${pc(eq)} %</b>.`,
    `Доплатить ${ru(S - heroPosted)} ББ, а в банке после колла будет ${ru(pot)} ББ — колл окупается, если выигрываешь хотя бы в <b>${pc(need)} %</b> случаев.`,
    Math.abs(eq - need) < 0.03 || (eq >= need) !== (q.correct === 'call')
      ? `Шанс почти равен цене колла — рука на самой границе; по таблице, посчитанной точнее, — <b>${q.correct === 'call' ? 'колл' : 'пас'}</b>, ошибка тут стоит копейки.`
      : eq >= need ? `${pc(eq)} % больше ${pc(need)} % — колл выгоден.` : `${pc(eq)} % меньше ${pc(need)} % — колл в долгую убыточен, пас.`,
    'Чем шире соперник идёт ва-банк (позднее место, больше анте), тем больше рук выгодно уравнивать.',
  ];
}

function explainChart(q, iterations, random) {
  const { hero, position, opener, threeBettor, topic } = q;
  const cls = handClass(hero[0], hero[1]);
  const lines = [];
  let sit = null;
  if (topic === 'open' && position.behind <= 5) sit = `open:${chartPos(position)}`;
  if (topic === 'vsRaise' && opener) {
    let hk = chartPos(position); const ok = chartPos(opener);
    if (hk === ok || (hk === 'LJ' && ok !== 'LJ')) hk = 'HJ';
    sit = `vsopen:${hk}:${ok}`;
  }
  if (topic === 'vs3bet' && threeBettor) sit = `vs3bet:${chartPos(position)}:${chartPos(threeBettor)}`;
  const v = sit ? chartLookup(sit, cls) : null;
  // Проценты таблиц уже есть в коротком совете — повторяем их, только если совет их не называет.
  // Короткий стек с советом «ва-банк» — решение по Нэшу, таблицы 100 ББ тут ни при чём, их не показываем.
  const chartFits = v && !(q.stackBB < 40 && q.advice.action === 'allin');
  if (chartFits && !q.advice.reason.includes(`${v.call} %`)) lines.push(`По таблицам ${v.sources} солверов с ${cls} в этой ситуации: рейз <b>${v.raise} %</b>, колл <b>${v.call} %</b>, пас <b>${v.fold} %</b>.`);
  if (chartFits) lines.push('Солвер — программа, которая ищет самую выгодную игру против сильных соперников. Эти таблицы посчитаны для стека 100 ББ и обычного размера повышения.');
  if (topic === 'open') {
    const left = position.behind;
    lines.push(`${after(left)}. Чем больше игроков впереди, тем чаще у кого-то из них сильная рука — поэтому с ранних мест открывают мало рук, а с баттона — почти половину.`);
  }
  if (topic === 'vs3bet' && threeBettor) {
    const add = q.raiseTo - q.heroOpen, pot = q.raiseTo * 2 + 1.5 + (q.ante ? 1 : 0)
      - (threeBettor.key === 'BB' ? 1 : threeBettor.key === 'SB' ? 0.5 : 0) - (position.key === 'SB' ? 0.5 : 0);
    const ip = threeBettor.group === 'blinds';
    lines.push(`Доплатить ${ru(add)} ББ, после колла в банке ${ru(pot)} ББ. После флопа ты ходишь ${ip ? '<b>последним</b> (в позиции) — это помогает уравнивать шире' : '<b>первым</b> (без позиции) — поэтому уравнивают реже, а сильное чаще повышают ещё раз'}.`);
    if (cls.length === 2 && q.correct === 'call') {
      lines.push('Маленькая пара в основном ждёт сет — на флопе он приходит примерно в <b>12 %</b> раздач (1 раз из 8). Пока стеки глубокие, поймав сет, часто выигрываешь большой банк — это и окупает колл.');
    }
  }
  if (topic === 'vsLimp') {
    const L = q.limpers;
    lines.push(`${L > 1 ? `${L} игрока` : 'Игрок'} просто ${L > 1 ? 'уравняли' : 'уравнял'} 1 ББ — так обычно играют средними и слабыми руками: с сильными повышают сами. В банке уже ${ru(1.5 + L + (q.ante ? 1 : 0))} ББ, и его выгодно забрать.`);
    if (q.correct === 'raise' || q.correct === 'allin') lines.push(`Повышение «изолирует» лимпера: блайнды и он часто сбросят, а если уравняет — играешь против слабого диапазона с инициативой${position.group === 'blinds' ? '' : ' и позицией'}. Размер побольше обычного — ${q.stackBB >= 40 ? '3,5' : '2,5'} ББ плюс по 1 ББ за каждого лимпера${position.group === 'blinds' ? ' и ещё 1 ББ без позиции' : ''}: так советуют солвер GTO Wizard и Preflop Wizard.`);
    if (q.correct === 'call' && position.key === 'SB') lines.push('С малого блайнда доплатить всего полблайнда — цена очень хорошая, солвер GTO Wizard тут часто просто доплачивает.');
    if (q.correct === 'call' && position.key === 'BB') lines.push('Ты на большом блайнде: посмотреть флоп ничего не стоит. Повышать отсюда стоит только сильными руками — без позиции.');
    if (q.correct === 'fold') lines.push(`С ${cls} против лимпа не повышают даже самые широкие таблицы, а уравнивать за лимпером (без позиции и инициативы) — почти всегда хуже, чем повысить или сбросить.`);
    if (L > 1) lines.push('С каждым лишним лимпером повышают на ступень уже: кто-то из них может держать сильную руку.');
  }
  if (q.stackBB < 40 && topic !== 'vsLimp') lines.push(`Стек ${q.stackBB} ББ — короткий для обычной игры: повторное повышение обычно сразу ва-банк, а коллы «на попадание» не окупаются.`);
  if (/живой игры|живая игра/.test(q.advice.reason)) lines.push('Совет шире строгих таблиц: против слабых живых соперников профи играют больше рук (поправка «живой игры»).');
  if (!lines.length && topic === 'open') lines.push('Ранние места полного стола: таблица открытия для 9 игроков — чем больше игроков после тебя, тем сильнее нужна рука.');
  return lines;
}

/** Строки полного объяснения (HTML) для вопроса тренажёра. */
export function explainQuestion(q, { iterations = 2500, random = Math.random } = {}) {
  const shortPush = q.topic === 'short' && (q.players === 2 ? q.stackBB <= 20 : q.stackBB <= 15);
  if (shortPush) return explainPush(q, iterations, random);
  if (q.topic === 'vsShove' && q.stackBB <= (q.players === 2 ? 20 : 25)) return explainVsShove(q, iterations, random);
  if (q.topic === 'short') return [ // 16–20 ББ за полным столом: уже не чистый «ва-банк или пас»
    `Стек ${q.stackBB} ББ — средний: сильные руки открывают маленьким рейзом (2 ББ), а маленькие пары и слабые тузы с поздних мест — сразу ва-банк: после флопа они играют плохо.`,
    'Так советуют GTO Wizard, Preflop Wizard и MTT Poker School для стеков 15–30 ББ; ва-банк — только для рук, которые проходят по таблице Нэша для этого места.',
  ];
  return explainChart(q, iterations, random);
}
