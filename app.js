// Экран приложения: стол, выбор карт, ставки и совет.
import { makeCard, rankOf, suitOf } from './src/cards.js';
import { preflopAdvice } from './src/preflop.js';
import { postflopAdvice, whoBeatsYou, percentText } from './src/postflop.js';
import { calcEquity } from './src/equity.js';
import { handClass } from './src/hands.js';
import { GEOMETRY, DEALER_XY, SEAT_XY, SEAT_COUNT, activeSeats, seatPosition, nextActive } from './src/table.js';

const $ = (id) => document.getElementById(id);
const RANK_LABEL = { 10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
const rankLabel = (r) => RANK_LABEL[r] || String(r);
const SUIT_GLYPH = ['♠', '♥', '♦', '♣'];
const SUIT_CLASS = ['suit-s', 'suit-h', 'suit-d', 'suit-c'];
const SUIT_NAME = ['пики', 'червы', 'бубны', 'трефы'];
const SHORT = { BTN: 'BTN', SB: 'МБ', BB: 'ББ' };
const STREET = ['Префлоп', '', '', 'Флоп', 'Тёрн', 'Ривер'];

// ---------- Состояние ----------
const saved = (() => { try { return JSON.parse(localStorage.getItem('poker-table')) || {}; } catch { return {}; } })();
const state = {
  occupied: saved.occupied?.length === SEAT_COUNT ? saved.occupied : Array(SEAT_COUNT).fill(true),
  hero: saved.hero || 5,
  button: saved.button || 2,
  bb: saved.bb || 2,
  hole: [null, null],
  board: [null, null, null, null, null],
  preflop: 'none', limpers: 1, raiseTo: 0,
  pot: 0, toCall: 0, opponents: 1,
};
const persist = () => {
  try {
    localStorage.setItem('poker-table', JSON.stringify(
      { occupied: state.occupied, hero: state.hero, button: state.button, bb: state.bb }));
  } catch { /* приватный режим — просто не запоминаем */ }
};

const boardCount = () => state.board.filter((c) => c !== null).length;
const usedCards = (except) => [...state.hole, ...state.board].filter((c, i) => c !== null && i !== except);
const activeCount = () => activeSeats(state.occupied).length;

// ---------- Карты ----------
function cardHtml(card, extra = '') {
  if (card === null) return `<span class="card empty ${extra}"></span>`;
  return `<span class="card ${SUIT_CLASS[suitOf(card)]} ${extra}"><b>${rankLabel(rankOf(card))}</b><i>${SUIT_GLYPH[suitOf(card)]}</i></span>`;
}

// ---------- Стол ----------
const table = $('table');
const pct = ([x, y]) => ({ left: `${(x / GEOMETRY.W) * 100}%`, top: `${(y / GEOMETRY.H) * 100}%` });

function buildTable() {
  const { W, H, CY, CX1, CX2, R } = GEOMETRY;
  table.style.setProperty('--sx', `${((CX1 - R) / W) * 100}%`);
  table.style.setProperty('--sy', `${((CY - R) / H) * 100}%`);
  table.style.setProperty('--sw', `${((CX2 - CX1 + 2 * R) / W) * 100}%`);
  table.style.setProperty('--sh', `${((2 * R) / H) * 100}%`);

  const croupier = document.createElement('div');
  croupier.className = 'croupier';
  croupier.textContent = 'Дилер';
  Object.assign(croupier.style, pct(DEALER_XY));
  table.appendChild(croupier);

  for (let n = 1; n <= SEAT_COUNT; n++) {
    const seat = document.createElement('button');
    seat.className = 'seat';
    seat.dataset.seat = n;
    Object.assign(seat.style, pct(SEAT_XY[n]));
    seat.addEventListener('click', () => openSeatMenu(n));
    table.appendChild(seat);
  }

  const chip = document.createElement('div');
  chip.className = 'button-chip';
  chip.id = 'button-chip';
  chip.textContent = 'D';
  chip.setAttribute('aria-label', 'Кнопка дилера — перетащи на другое место');
  table.appendChild(chip);
  enableChipDrag(chip);
}

const chipPoint = (seat) => {
  const [x, y] = SEAT_XY[seat];
  const k = 0.32; // кнопка лежит на сукне перед игроком
  return [x + (179 - x) * k, y + (GEOMETRY.CY - y) * k];
};

function renderTable() {
  for (const el of table.querySelectorAll('.seat')) {
    const n = Number(el.dataset.seat);
    const occupied = state.occupied[n - 1];
    const pos = seatPosition(state.occupied, state.button, n);
    el.classList.toggle('is-hero', n === state.hero);
    el.classList.toggle('is-out', !occupied);
    el.innerHTML = `<b>${n}</b><span>${occupied ? (pos ? SHORT[pos.key] || pos.key : '') : 'пусто'}</span>`;
    el.setAttribute('aria-label', `Место ${n}${n === state.hero ? ', это ты' : ''}${occupied ? '' : ', пусто'}`);
  }
  Object.assign($('button-chip').style, pct(chipPoint(state.button)));

  const count = boardCount();
  const nextSlot = state.board.findIndex((c) => c === null);
  $('board').innerHTML = state.board.map((c, i) => {
    const unlocked = i < 3 || state.board[i - 1] !== null;
    const isNext = i === nextSlot && state.hole.every((h) => h !== null) && (i < 3 || state.board[2] !== null);
    return `<button class="slot" data-board="${i}" ${unlocked ? '' : 'disabled'} aria-label="Карта стола ${i + 1}">${cardHtml(c, isNext ? 'next' : '')}</button>`;
  }).join('');
  for (const b of $('board').querySelectorAll('button')) {
    b.addEventListener('click', () => openPicker('board', Number(b.dataset.board)));
  }
  $('pot-chip').innerHTML = count && state.pot ? `Банк <b>${fmt(state.pot)}</b>` : '';
  $('street').textContent = STREET[count] || 'Флоп';
}

// Перетаскивание кнопки D пальцем: отпустил — она встаёт к ближайшему занятому месту.
function enableChipDrag(chip) {
  let dragging = false;
  chip.addEventListener('pointerdown', (e) => {
    dragging = true;
    chip.setPointerCapture(e.pointerId);
    chip.classList.add('dragging');
  });
  chip.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const box = table.getBoundingClientRect();
    chip.style.left = `${((e.clientX - box.left) / box.width) * 100}%`;
    chip.style.top = `${((e.clientY - box.top) / box.height) * 100}%`;
  });
  const drop = (e) => {
    if (!dragging) return;
    dragging = false;
    chip.classList.remove('dragging');
    const box = table.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * GEOMETRY.W;
    const y = ((e.clientY - box.top) / box.height) * GEOMETRY.H;
    let best = state.button, bestDist = Infinity;
    for (const n of activeSeats(state.occupied)) {
      const [sx, sy] = chipPoint(n);
      const d = (sx - x) ** 2 + (sy - y) ** 2;
      if (d < bestDist) { bestDist = d; best = n; }
    }
    state.button = best;
    persist();
    render();
  };
  chip.addEventListener('pointerup', drop);
  chip.addEventListener('pointercancel', drop);
}

// ---------- Окно снизу ----------
const sheet = $('sheet');
function openSheet(html) {
  sheet.innerHTML = html;
  document.body.classList.add('open');
}
function closeSheet() { document.body.classList.remove('open'); }
$('dim').addEventListener('click', closeSheet);

function openSeatMenu(n) {
  const occupied = state.occupied[n - 1];
  const isHero = n === state.hero;
  openSheet(`
    <h2>Место ${n}<button data-act="close">Закрыть</button></h2>
    <div class="menu">
      <button data-act="hero" ${isHero ? 'disabled' : ''}>Я сижу здесь <small>${isHero ? 'уже ты' : ''}</small></button>
      <button data-act="button" ${n === state.button || !occupied ? 'disabled' : ''}>Кнопка у этого игрока <small>${n === state.button ? 'уже здесь' : ''}</small></button>
      <button data-act="toggle" ${isHero ? 'disabled' : ''}>${occupied ? 'Место пустое (игрок вышел)' : 'Здесь сидит игрок'}</button>
    </div>`);
  sheet.querySelector('[data-act="close"]').onclick = closeSheet;
  sheet.querySelector('[data-act="hero"]').onclick = () => {
    state.hero = n; state.occupied[n - 1] = true; done();
  };
  sheet.querySelector('[data-act="button"]').onclick = () => { state.button = n; done(); };
  sheet.querySelector('[data-act="toggle"]').onclick = () => {
    if (occupied && activeCount() <= 2) return;
    state.occupied[n - 1] = !occupied;
    if (!state.occupied[state.button - 1]) state.button = nextActive(state.occupied, state.button);
    done();
  };
  function done() { persist(); closeSheet(); render(); }
}

// Выбор карты: сначала номинал, потом масть.
const RANKS_ORDER = [14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2];
function openPicker(kind, index) {
  const slotIndex = kind === 'hole' ? index : 2 + index; // общий счёт для usedCards
  const current = kind === 'hole' ? state.hole[index] : state.board[index];
  let rank = current !== null ? rankOf(current) : null;
  const title = kind === 'hole'
    ? `Твоя карта ${index + 1} из 2`
    : index < 3 ? `Флоп: карта ${index + 1} из 3` : index === 3 ? 'Тёрн' : 'Ривер';

  openSheet(`
    <h2>${title}<button data-act="close">Закрыть</button></h2>
    <div class="step"><b>1</b> Номинал</div>
    <div class="ranks">${RANKS_ORDER.map((r) => `<button data-rank="${r}">${rankLabel(r)}</button>`).join('')}</div>
    <div class="step"><b>2</b> Масть</div>
    <div class="suits">${SUIT_GLYPH.map((g, s) => `<button class="${SUIT_CLASS[s]}" data-suit="${s}" aria-label="${SUIT_NAME[s]}">${g}</button>`).join('')}</div>
    ${current !== null ? '<button class="remove" data-act="remove">Убрать карту</button>' : ''}`);

  const used = new Set(usedCards(slotIndex));
  const paint = () => {
    for (const b of sheet.querySelectorAll('[data-rank]')) b.setAttribute('aria-pressed', String(Number(b.dataset.rank) === rank));
    sheet.querySelector('.suits').classList.toggle('waiting', rank === null);
    for (const b of sheet.querySelectorAll('[data-suit]')) {
      b.disabled = rank !== null && used.has(makeCard(rank, Number(b.dataset.suit)));
    }
  };
  paint();
  sheet.querySelector('[data-act="close"]').onclick = closeSheet;
  sheet.querySelector('[data-act="remove"]')?.addEventListener('click', () => {
    if (kind === 'hole') state.hole[index] = null;
    else for (let i = index; i < 5; i++) state.board[i] = null; // без флопа нет тёрна
    closeSheet(); onCardsChanged();
  });
  for (const b of sheet.querySelectorAll('[data-rank]')) b.onclick = () => { rank = Number(b.dataset.rank); paint(); };
  for (const b of sheet.querySelectorAll('[data-suit]')) b.onclick = () => {
    if (rank === null || b.disabled) return;
    const card = makeCard(rank, Number(b.dataset.suit));
    if (kind === 'hole') state.hole[index] = card; else state.board[index] = card;
    onCardsChanged();
    // Сразу следующая карта: вторая карта руки, остальные карты флопа.
    if (kind === 'hole' && state.hole[1 - index] === null) return openPicker('hole', 1 - index);
    if (kind === 'board' && index < 2 && state.board[index + 1] === null) return openPicker('board', index + 1);
    closeSheet();
  };
}

function onCardsChanged() {
  // На флопе по умолчанию: банк и соперники с префлопа.
  if (boardCount() >= 3 && !state.pot) {
    state.pot = state.preflop === 'none' || state.preflop === 'limp'
      ? state.bb * (1.5 + (state.preflop === 'limp' ? state.limpers : 0))
      : state.raiseTo * 2 + state.bb / 2;
  }
  render();
}

// ---------- Ввод ставок ----------
const fmt = (n) => String(Math.round(n * 10) / 10).replace('.', ',');
const parseNum = (s) => { const n = parseFloat(String(s).replace(',', '.')); return Number.isFinite(n) && n >= 0 ? n : 0; };

function stepper(key, name, step, min = 0, max = 100000) {
  const blinds = ['raiseTo', 'pot', 'toCall'].includes(key) && state[key] ? ` · ${inBlinds(state[key])}` : '';
  return `<label class="stepper"><span class="name">${name}${blinds}</span>
    <input class="value" inputmode="decimal" data-key="${key}" value="${fmt(state[key])}" aria-label="${name}">
    <span class="btns"><button type="button" data-key="${key}" data-step="${-step}" data-min="${min}" data-max="${max}" aria-label="Меньше">−</button><button type="button" data-key="${key}" data-step="${step}" data-min="${min}" data-max="${max}" aria-label="Больше">+</button></span></label>`;
}

function renderInputs() {
  const box = $('inputs');
  const preflop = boardCount() < 3;
  const others = Math.max(1, activeCount() - 1);
  if (preflop) {
    const segs = [['none', 'Все пас'], ['limp', 'Лимп'], ['raise', 'Рейз'], ['3bet', '3-бет']];
    box.innerHTML = `
      <div><div class="label">Что было до тебя</div>
        <div class="segments">${segs.map(([k, t]) => `<button data-pre="${k}" aria-pressed="${state.preflop === k}">${t}</button>`).join('')}</div></div>
      ${state.preflop === 'limp' ? `<div class="steppers">${stepper('limpers', 'Сколько уравняли блайнд', 1, 1, others)}</div>` : ''}
      ${state.preflop === 'raise' || state.preflop === '3bet' ? `<div class="steppers">${stepper('raiseTo', 'Повысили до', state.bb, state.bb)}</div>` : ''}`;
    for (const b of box.querySelectorAll('[data-pre]')) b.onclick = () => {
      state.preflop = b.dataset.pre;
      if (state.preflop === 'raise' && state.raiseTo < 2 * state.bb) state.raiseTo = 3 * state.bb;
      if (state.preflop === '3bet' && state.raiseTo < 6 * state.bb) state.raiseTo = 9 * state.bb;
      render();
    };
  } else {
    box.innerHTML = `<div class="steppers">
      ${stepper('pot', 'Банк (со ставками)', state.bb)}
      ${stepper('toCall', 'Тебе доставить (0 — чек)', state.bb)}
      ${stepper('opponents', 'Соперников в игре', 1, 1, others)}</div>`;
  }
  for (const b of box.querySelectorAll('button[data-step]')) b.onclick = () => {
    const key = b.dataset.key;
    state[key] = Math.min(Number(b.dataset.max), Math.max(Number(b.dataset.min), state[key] + Number(b.dataset.step)));
    render();
  };
  for (const input of box.querySelectorAll('input[data-key]')) {
    input.onchange = () => { state[input.dataset.key] = parseNum(input.value); render(); };
    input.onfocus = () => input.select();
  }
}

// ---------- Совет ----------
let adviceTimer = 0;
function renderTicket() {
  const ticket = $('ticket');
  const heroPos = seatPosition(state.occupied, state.button, state.hero);
  if (state.hole.some((c) => c === null)) {
    ticket.innerHTML = `<div class="wait">Выбери свои две карты<small>Нажми на пустые карты слева внизу</small></div>`;
    return;
  }
  if (!heroPos) {
    ticket.innerHTML = `<div class="wait">Нужно минимум 2 игрока<small>Отметь занятые места на столе</small></div>`;
    return;
  }
  const count = boardCount();
  if (count === 1 || count === 2) {
    ticket.innerHTML = `<div class="wait">Добавь остальные карты флопа<small>Флоп — это 3 карты</small></div>`;
    return;
  }
  if (count >= 3 && !state.pot) {
    ticket.innerHTML = `<div class="wait">Сколько в банке?<small>Введи банк — без него не посчитать цену колла</small></div>`;
    return;
  }

  ticket.classList.add('busy');
  clearTimeout(adviceTimer);
  // Расчёт — доли секунды; даём экрану сначала отрисоваться.
  adviceTimer = setTimeout(() => {
    const hero = state.hole;
    let advice, equity, lines;
    if (count === 0) {
      advice = preflopAdvice({ hero, position: heroPos, action: state.preflop,
        limpers: state.limpers, raiseTo: state.raiseTo, bigBlind: state.bb });
      equity = calcEquity({ hero, opponents: Math.min(activeCount() - 1, 8), iterations: 3000 }).equity;
      lines = [`<b>${handClass(hero[0], hero[1])}</b> · ${heroPos.name}`, advice.reason];
    } else {
      const board = state.board.filter((c) => c !== null);
      advice = postflopAdvice({ hero, board, opponents: state.opponents, pot: state.pot,
        toCall: state.toCall, preflopAction: state.preflop, iterations: 6000 });
      equity = advice.equity;
      const need = state.toCall ? ` · нужно ${Math.round((state.toCall / (state.pot + state.toCall)) * 100)} %` : '';
      const draws = advice.draws.names.length ? ` · ${advice.draws.names.join(', ')}, ${advice.draws.outs} аутов` : '';
      lines = [`<b>${advice.handName}</b>${draws}${need}`, advice.reason];
      const danger = dangerLine(hero, board);
      if (danger) lines.push(danger);
    }
    const { title, chips } = howMuch(advice, count === 0, heroPos);
    if (chips) lines.unshift(chips);
    ticket.classList.remove('busy');
    ticket.innerHTML = `
      <div class="top-row">
        <div class="act ${advice.action === 'fold' ? 'fold' : ''}"><small>Совет</small>${title}</div>
        <div class="gauge"><b>${percentText(equity)}%</b><span>шанс выиграть</span></div>
      </div>
      <hr>${lines.map((l) => `<div class="line">${l}</div>`).join('')}`;
  }, 30);
}

// Кто бьёт тебя на этих картах стола — если таких рук мало, называем их.
const shortCard = (c) => `<span class="${SUIT_CLASS[suitOf(c)]}">${rankLabel(rankOf(c))}${SUIT_GLYPH[suitOf(c)]}</span>`;
function dangerLine(hero, board) {
  const { count, hands } = whoBeatsYou(hero, board);
  const river = board.length === 5;
  if (count === 0) {
    return river ? '<b>Лучшая возможная рука</b> — тебя не бьёт ничего.' : 'Сейчас тебя не бьёт ничего (но карты ещё выйдут).';
  }
  if (count > 6) return '';
  const list = hands.map((h) => `${shortCard(h.cards[0])} ${shortCard(h.cards[1])} — ${h.name.toLowerCase()}`).join(', ');
  return `<b>${river ? 'Тебя бьёт' : 'Сейчас тебя бьёт'} только:</b> ${list}.`;
}

// Сколько ставить — в больших блайндах и сразу в деньгах: «3 больших блайнда — это 600».
const roundToSB = (n) => Math.max(state.bb / 2, Math.round(n / (state.bb / 2)) * (state.bb / 2));
function inBlinds(n) {
  const x = Math.round((n / state.bb) * 10) / 10;
  const whole = Number.isInteger(x);
  const last = x % 10, last2 = x % 100;
  const word = !whole ? 'больших блайнда'
    : last === 1 && last2 !== 11 ? 'большой блайнд'
    : last >= 2 && last <= 4 && (last2 < 12 || last2 > 14) ? 'больших блайнда' : 'больших блайндов';
  return `${fmt(x)} ${word}`;
}

function howMuch(advice, preflop, heroPos) {
  const amount = roundToSB(advice.amount);
  // Префлоп блайнды уже лежат на столе — их не докладывают второй раз.
  const posted = preflop ? (heroPos.key === 'BB' ? state.bb : heroPos.key === 'SB' ? state.bb / 2 : 0) : 0;
  const blind = posted ? ` Твой блайнд ${fmt(posted)} уже на столе — доложи <b>${fmt(amount - posted)}</b>.` : '';
  switch (advice.action) {
    case 'raise': {
      const theirs = preflop ? (state.preflop === 'none' ? 0 : state.preflop === 'limp' ? state.bb : state.raiseTo) : state.toCall;
      return { title: `Рейз: ${fmt(amount)}`,
        chips: `Ставь ${inBlinds(amount)} — это <b>${fmt(amount)}</b> всего${theirs ? ` (у соперника ${fmt(theirs)})` : ''}.${blind}` };
    }
    case 'bet':
      return { title: `Ставка: ${fmt(amount)}`, chips: `Ставь ${inBlinds(amount)} — это <b>${fmt(amount)}</b>.` };
    case 'call': {
      const add = amount - posted;
      return { title: `Колл: ${fmt(add)}`,
        chips: `Доложи ${inBlinds(add)} — это <b>${fmt(add)}</b>, столько же, сколько у соперника.${posted ? ` (Твой блайнд ${fmt(posted)} уже на столе.)` : ''}` };
    }
    default:
      return { title: advice.text, chips: '' };
  }
}

// ---------- Твоя рука ----------
function renderHand() {
  $('hero-cards').innerHTML = state.hole.map((c, i) =>
    `<button aria-label="Твоя карта ${i + 1}" data-hole="${i}">${c === null ? '<span class="card big empty">+</span>' : cardHtml(c, 'big')}</button>`).join('');
  for (const b of $('hero-cards').querySelectorAll('button')) b.onclick = () => openPicker('hole', Number(b.dataset.hole));
  const pos = seatPosition(state.occupied, state.button, state.hero);
  $('hero-pos').innerHTML = `<small>Место ${state.hero} · ${activeCount()} за столом</small>${pos ? pos.name : '—'}`;
}

$('new-hand').onclick = () => {
  state.button = nextActive(state.occupied, state.button); // кнопка уходит к следующему игроку
  state.hole = [null, null];
  state.board = [null, null, null, null, null];
  state.preflop = 'none'; state.limpers = 1; state.raiseTo = 0;
  state.pot = 0; state.toCall = 0; state.opponents = 1;
  persist();
  render();
};

$('settings-btn').onclick = () => {
  openSheet(`
    <h2>Блайнды<button data-act="close">Готово</button></h2>
    <div class="steppers">${stepper('bb', 'Большой блайнд', 1, 1)}</div>
    <p class="note">Суммы — в деньгах стола (евро, рубли — как у вас), не в штуках фишек. Например, игра 1/2: малый блайнд 1, большой 2. Рейзы, банк и ставки вводи в тех же деньгах.</p>`);
  sheet.querySelector('[data-act="close"]').onclick = closeSheet;
  for (const b of sheet.querySelectorAll('button[data-step]')) b.onclick = () => {
    state.bb = Math.max(1, state.bb + Number(b.dataset.step));
    sheet.querySelector('input').value = fmt(state.bb);
    persist(); render();
  };
  const input = sheet.querySelector('input');
  input.onchange = () => { state.bb = Math.max(0.1, parseNum(input.value) || 1); persist(); render(); };
};

function render() {
  renderTable();
  renderHand();
  renderInputs();
  renderTicket();
}

buildTable();
render();

// Офлайн-режим (на localhost не включаем, чтобы при разработке не мешал кэш).
if ('serviceWorker' in navigator && location.hostname !== 'localhost') {
  navigator.serviceWorker.register('sw.js').catch(() => { /* без офлайна тоже работает */ });
}
