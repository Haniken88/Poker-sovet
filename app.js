// Экран приложения: стол, выбор карт, ставки и совет.
import { makeCard, rankOf, suitOf } from './src/cards.js';
import { nicknameFor } from './src/nicknames.js';
import { preflopAdvice, preflopEquity } from './src/preflop.js';
import { postflopAdvice, whoBeatsYou, percentText } from './src/postflop.js';
import { handClass } from './src/hands.js';
import { preflopPot, currentPot, streetMoney } from './src/pot.js';
import { stepBB } from './src/blinds.js';
import { openTrainer, closeTrainer } from './trainer-view.js';
import { proStatus, checkCode, PRO_PRICE, SHORT_STACK_PRO_BB, TRIAL_DAYS, PRO_ENFORCED } from './src/pro.js';
import { GEOMETRY, DEALER_XY, SEAT_XY, SEAT_COUNT, activeSeats, seatPosition, nextActive } from './src/table.js';

// Номер версии — поднимать при каждом обновлении вместе с CACHE в sw.js.
const APP_VERSION = 37;
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
  stack: saved.stack || 0, // 0 — не указан
  style: saved.style || 'normal', // как блефует поставивший соперник
  anteOn: Boolean(saved.anteOn), // анте платит большой блайнд, размером с ББ (турнир владельца)
  levels: Array.isArray(saved.levels) ? saved.levels : [], // уровни турнира: большие блайнды по порядку
  hidden: false, // карты спрятаны от соседей (смахнуть влево / вправо)
  hole: [null, null],
  board: [null, null, null, null, null],
  preflop: 'none', limpers: 1, raiseTo: 0,
  raiser: 0, reraiser: 0, // места повысивших (0 — не отмечено)
  callers: [], // места тех, кто уравнял повышение (касанием на столе после повысившего)
  pot: 0, toCall: 0, opponents: 1,
  // Банк считается сам (src/pot.js): улица (-1 префлоп, 0 флоп, 1 тёрн, 2 ривер), что сделал ты префлоп,
  // прошедшие улицы после флопа и ручная поправка банка.
  street: -1, preMove: null, streetLog: [], potFix: null,
};
// ---------- Pro ----------
// Пробная неделя считается с первого запуска; купленный код запоминается. Всё — только в памяти телефона.
const proStore = (() => { try { return JSON.parse(localStorage.getItem('poker-pro')) || {}; } catch { return {}; } })();
// Неделя начинает считаться, только когда продажи включены (PRO_ENFORCED), — пока всё открыто, она не тратится.
const firstLaunch = PRO_ENFORCED && !proStore.trialStart;
if (firstLaunch) proStore.trialStart = Date.now();
const saveProStore = () => { try { localStorage.setItem('poker-pro', JSON.stringify(proStore)); } catch { /* приватный режим */ } };
saveProStore();
const pro = () => proStatus(proStore);
const isPro = () => pro().pro;
const anteNow = () => (state.anteOn && isPro() ? state.bb : 0);
const persist = () => {
  try {
    localStorage.setItem('poker-table', JSON.stringify(
      { occupied: state.occupied, hero: state.hero, button: state.button, bb: state.bb, stack: state.stack, style: state.style, anteOn: state.anteOn, levels: state.levels }));
  } catch { /* приватный режим — просто не запоминаем */ }
};

const boardCount = () => state.board.filter((c) => c !== null).length;
const usedCards = (except) => [...state.hole, ...state.board].filter((c, i) => c !== null && i !== except);
const activeCount = () => activeSeats(state.occupied).length;
const stackOrInf = () => (state.stack > 0 ? state.stack : Infinity);

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
    seat.addEventListener('click', () => (pickRaiser(n) || toggleCaller(n) ? render() : openSeatMenu(n)));
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

// Кого сейчас отметить на столе: 'raiser' (кто повысил первым), 'reraiser' (кто повысил ещё раз) или null.
function raiserToPick() {
  if (boardCount() > 0 || !['raise', '3bet'].includes(state.preflop)) return null;
  if (!state.raiser) return 'raiser';
  if (state.preflop === '3bet' && !state.reraiser) return 'reraiser';
  return null;
}
function pickRaiser(n) {
  const need = raiserToPick();
  if (!need || !state.occupied[n - 1]) return false;
  // При одном повышении это не ты; при двух первым мог повысить ты сам.
  if (need === 'raiser' && state.preflop === 'raise' && n === state.hero) return false;
  if (need === 'reraiser' && (n === state.raiser || n === state.hero)) return false;
  state[need] = n;
  return true;
}
// Повысивший отмечен — следующие касания отмечают тех, кто уравнял (повторное касание снимает).
const canMarkCallers = () => boardCount() === 0 && ['raise', '3bet'].includes(state.preflop) && state.raiser && !raiserToPick();
function toggleCaller(n) {
  if (!canMarkCallers() || !state.occupied[n - 1] || [state.hero, state.raiser, state.reraiser].includes(n)) return false;
  state.callers = state.callers.includes(n) ? state.callers.filter((c) => c !== n) : [...state.callers, n];
  return true;
}
// Отмечены места, которых уже нет за столом, — убираем.
const liveCallers = () => state.callers.filter((c) => state.occupied[c - 1] && ![state.hero, state.raiser, state.reraiser].includes(c));

function renderTable() {
  for (const el of table.querySelectorAll('.seat')) {
    const n = Number(el.dataset.seat);
    const occupied = state.occupied[n - 1];
    const pos = seatPosition(state.occupied, state.button, n);
    el.classList.toggle('is-hero', n === state.hero);
    el.classList.toggle('is-out', !occupied);
    el.classList.toggle('is-raiser', n === state.raiser && state.preflop !== 'none');
    el.classList.toggle('is-reraiser', n === state.reraiser && state.preflop === '3bet');
    el.classList.toggle('is-caller', ['raise', '3bet'].includes(state.preflop) && liveCallers().includes(n));
    el.classList.toggle('can-pick', Boolean(raiserToPick()) && occupied && n !== state.raiser
      && !(n === state.hero && !(state.preflop === '3bet' && !state.raiser)));
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
  const potChip = $('pot-chip');
  potChip.classList.toggle('ask', count >= 3 && !state.pot);
  potChip.innerHTML = count < 3 ? '' : state.pot ? `Банк <b>${fmt(state.pot)}</b> ✎` : 'Банк: нажми, введи сумму';
  renderStakes();
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
  syncStreets();
  render();
}

// ---------- Банк сам ----------
const streetOf = (count) => (count >= 5 ? 2 : count >= 4 ? 1 : count >= 3 ? 0 : -1);
// Что посоветовало приложение на этой улице (считаем, что ты так и сыграл; банк можно поправить).
const heroMoveFor = (street) => (lastAdvice && lastAdvice.street === street
  ? { action: lastAdvice.advice.action, amount: lastAdvice.advice.amount } : null);
// Сколько соперников на флопе по умолчанию: при лимпах — лимперы (и ББ, если это не ты), иначе один.
function flopOpponents() {
  if (['raise', '3bet'].includes(state.preflop)) {
    const inHand = new Set([state.raiser, state.reraiser, ...liveCallers()].filter((n) => n && n !== state.hero));
    return Math.max(1, Math.min(activeCount() - 1, inHand.size));
  }
  if (state.preflop !== 'limp') return 1;
  const pos = seatPosition(state.occupied, state.button, state.hero);
  return Math.max(1, Math.min(activeCount() - 1, state.limpers + (pos?.key === 'BB' ? 0 : 1)));
}
// Карта стола добавлена или убрана: запоминаем прошедшую улицу или возвращаемся назад.
function syncStreets() {
  const now = streetOf(boardCount());
  while (state.street < now) {
    if (state.street === -1) {
      state.preMove = heroMoveFor(-1);
      state.opponents = flopOpponents();
    } else {
      state.streetLog.push({ toCall: state.toCall, heroMove: heroMoveFor(state.street), opponents: state.opponents });
      state.toCall = 0;
    }
    state.street++;
  }
  while (state.street > now) {
    if (state.street === 0) state.preMove = null;
    else {
      const back = state.streetLog.pop();
      if (back) { state.toCall = back.toCall; state.opponents = back.opponents; }
    }
    if (state.potFix && state.potFix.street >= state.street) state.potFix = null;
    state.street--;
  }
}
function flopPotNow() {
  const pos = seatPosition(state.occupied, state.button, state.hero);
  const flopOpp = state.streetLog.length ? state.streetLog[0].opponents : state.opponents;
  return preflopPot({ bb: state.bb, ante: anteNow(), action: state.preflop, raiseTo: state.raiseTo, heroMove: state.preMove,
    players: flopOpp + 1, heroKey: pos?.key, headsUp: pos?.players === 2 });
}
// Из чего сложился банк — чтобы было видно, что приложение предположило.
function potLines() {
  if (state.street < 0) return '';
  const names = ['Флоп', 'Тёрн', 'Ривер'];
  const pre = PREFLOP_CHOICES.find(([k]) => k === state.preflop)[1].toLowerCase();
  const flopOpp = state.streetLog.length ? state.streetLog[0].opponents : state.opponents;
  const lines = [`До флопа (${pre}${state.anteOn ? ', анте' : ''}), игроков на флопе ${flopOpp + 1}: <b>${fmt(flopPotNow())}</b>`];
  state.streetLog.forEach((st, i) => {
    const stayed = i + 1 < state.streetLog.length ? state.streetLog[i + 1].opponents : state.opponents;
    const money = streetMoney({ ...st, stayed });
    const who = st.toCall > 0 ? `ставка соперника ${fmt(st.toCall)}` : money ? `твоя ставка ${fmt(money / (stayed + 1))} (по совету)` : 'без ставок';
    lines.push(`${names[i]}: ${who}${money ? ` × ${stayed + 1} = <b>+${fmt(money)}</b>` : ''}`);
  });
  return `<p class="note">${lines.join('<br>')}</p>`;
}
function syncPot() {
  state.pot = state.street < 0 ? 0
    : currentPot({ flopPot: flopPotNow(), streets: state.streetLog, opponentsNow: state.opponents, fix: state.potFix });
}

// ---------- Ввод ставок ----------
// Числа по-русски: 100 000 и 2,5.
const numberFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });
const fmt = (n) => numberFormat.format(Math.round(n * 10) / 10);
const parseNum = (s) => { const n = parseFloat(String(s).replace(/\s/g, '').replace(',', '.')); return Number.isFinite(n) && n >= 0 ? n : 0; };

function stepper(key, name, step, min = 0, max = 100000) {
  return `<label class="stepper"><span class="name">${name}</span>
    <input class="value" inputmode="decimal" data-key="${key}" value="${fmt(state[key])}" aria-label="${name}">
    <span class="btns"><button type="button" data-key="${key}" data-step="${-step}" data-min="${min}" data-max="${max}" aria-label="Меньше">−</button><button type="button" data-key="${key}" data-step="${step}" data-min="${min}" data-max="${max}" aria-label="Больше">+</button></span></label>`;
}

// Быстрые суммы под полем: [подпись, сумма]; нажатая подсвечивается.
function quick(key, items) {
  const list = items.filter(([, v]) => v > 0);
  if (!list.length) return '';
  return `<div class="quick">${list.map(([t, v]) => `<button type="button" data-quick="${key}" data-value="${v}" aria-pressed="${state[key] === v}">${t}</button>`).join('')}</div>`;
}
// Круглые суммы: до четверти блайнда.
const roundBet = (n) => Math.max(state.bb / 4, Math.round(n / (state.bb / 4)) * (state.bb / 4));

const PREFLOP_CHOICES = [
  ['none', 'Пас', 'Все до тебя <b>сбросили карты (пас)</b> — ты входишь первым (блайнды не в счёт).'],
  ['limp', 'Уравняли', 'Кто-то <b>просто уравнял</b> большой блайнд, не повышая (лимп).'],
  ['raise', 'Повысили', 'Кто-то <b>повысил</b> ставку (рейз).'],
  ['3bet', 'Повысили ×2', 'Повысили, а потом <b>повысили ещё раз</b> (3-бет).'],
];

// Место повысившего (не ты) — для таблиц солверов.
const raiserPos = () => (state.raiser && state.raiser !== state.hero ? seatPosition(state.occupied, state.button, state.raiser) : null);

function seatLabel(n) {
  const pos = seatPosition(state.occupied, state.button, n);
  return n === state.hero ? 'ты' : `место ${n}${pos ? ` (${SHORT[pos.key] || pos.key})` : ''}`;
}
// Кто повысил — касанием на столе. Без этого таблицы солверов не знают, против кого играть.
function raiserLine() {
  const need = raiserToPick();
  if (need === 'raiser') {
    return state.preflop === '3bet'
      ? '<br><b class="pick">Нажми на столе, кто повысил первым</b> (если ты — нажми на своё место).'
      : '<br><b class="pick">Нажми на столе, кто повысил.</b>';
  }
  if (need === 'reraiser') return `<br>Первым повысил: ${seatLabel(state.raiser)}. <b class="pick">Теперь нажми, кто повысил ещё раз.</b>`;
  if (!['raise', '3bet'].includes(state.preflop) || !state.raiser) return '';
  const who = state.preflop === '3bet'
    ? `Повысил: ${seatLabel(state.raiser)}, ещё раз — ${seatLabel(state.reraiser)}.`
    : `Повысил: ${seatLabel(state.raiser)}.`;
  const calls = liveCallers();
  const callLine = calls.length
    ? `<br>Уравняли: ${calls.map(seatLabel).join(', ')}.`
    : '<br><b class="pick">Кто-то уравнял? Нажми на их места</b> (повторное касание — снять).';
  return `<br>${who} <button class="link" id="repick">изменить</button>${callLine}`;
}

function renderInputs() {
  const box = $('inputs');
  const preflop = boardCount() < 3;
  const others = Math.max(1, activeCount() - 1);
  if (preflop) {
    const current = PREFLOP_CHOICES.find(([k]) => k === state.preflop);
    const heroPos = seatPosition(state.occupied, state.button, state.hero);
    const huButton = heroPos && heroPos.players === 2 && heroPos.key === 'BTN';
    const huBB = heroPos && heroPos.players === 2 && heroPos.key === 'BB';
    box.innerHTML = `
      <div><div class="label">Что сделали игроки до тебя</div>
        <div class="segments">${PREFLOP_CHOICES.map(([k, t]) => `<button data-pre="${k}" aria-pressed="${state.preflop === k}">${t}</button>`).join('')}</div>
        <div class="explain">${huButton && state.preflop === 'none' ? 'Один на один ты ходишь <b>первым</b> — до тебя никто не ходил.'
          : huBB && state.preflop === 'none' ? 'Один на один соперник на баттоне ходит <b>раньше тебя</b> — отметь, что он сделал.' : current[2]}${raiserLine()}</div></div>
      ${state.preflop === 'limp' ? `<div class="steppers">${stepper('limpers', 'Сколько игроков уравняли', 1, 1, others)}</div>` : ''}
      ${state.preflop === 'raise' || state.preflop === '3bet' ? `<div><div class="steppers">${stepper('raiseTo', 'Повысили до', state.bb, state.bb)}</div>
        ${quick('raiseTo', [...(state.preflop === 'raise' ? [['2 ББ', 2 * state.bb], ['2,5 ББ', 2.5 * state.bb], ['3 ББ', 3 * state.bb]] : []), ['Ва-банк', state.stack]])}</div>` : ''}`;
    for (const b of box.querySelectorAll('[data-pre]')) b.onclick = () => {
      if (state.preflop !== b.dataset.pre) { state.raiser = 0; state.reraiser = 0; state.callers = []; }
      state.preflop = b.dataset.pre;
      if (state.preflop === 'raise' && state.raiseTo < 2 * state.bb) state.raiseTo = 3 * state.bb;
      if (state.preflop === '3bet' && state.raiseTo < 6 * state.bb) state.raiseTo = 9 * state.bb;
      render();
      revealInputs();
    };
  } else {
    const styles = [['rare', 'Редко блефует'], ['normal', 'Обычно'], ['often', 'Часто блефует']];
    box.innerHTML = `<div><div class="steppers">${stepper('toCall', 'Соперник поставил', state.bb)}</div>
      ${quick('toCall', [['½ банка', roundBet(state.pot / 2)], ['⅔ банка', roundBet(state.pot * 2 / 3)], ['Банк', roundBet(state.pot)], ['Ва-банк', state.stack]])}</div>
      <div class="steppers">${stepper('opponents', 'Соперников в игре', 1, 1, others)}</div>
      ${state.toCall ? `<div><div class="label">Как играет поставивший</div>
        <div class="segments">${styles.map(([k, t]) => `<button data-style="${k}" aria-pressed="${state.style === k}">${t}</button>`).join('')}</div>
        <div class="explain">Не знаешь — оставь «Обычно». Большой ставкой обычно ставят сильную руку.</div></div>` : ''}`;
    for (const b of box.querySelectorAll('[data-style]')) b.onclick = () => { state.style = b.dataset.style; persist(); render(); };
  }
  bindSteppers(box);
  const repick = box.querySelector('#repick');
  if (repick) repick.onclick = () => { state.raiser = 0; state.reraiser = 0; state.callers = []; render(); };
}

// Под кнопками появилось новое поле («Повысили до», «Сколько уравняли») — плавно прокручиваем страницу так,
// чтобы оно встало над карточкой совета (она прилеплена к низу экрана и иначе его закрывает).
function revealInputs() {
  const show = () => {
    const last = $('inputs').lastElementChild;
    if (!last) return;
    const ticketTop = $('ticket').getBoundingClientRect().top;
    const bottom = last.getBoundingClientRect().bottom;
    if (bottom > ticketTop - 12) window.scrollBy({ top: bottom - ticketTop + 16, behavior: 'smooth' });
  };
  // Совет считается с небольшой задержкой и может поменять высоту карточки — сверяемся ещё раз.
  requestAnimationFrame(show);
  setTimeout(show, 250);
}

function bindSteppers(box) {
  for (const b of box.querySelectorAll('[data-quick]')) b.onclick = () => {
    const key = b.dataset.quick;
    state[key] = Number(b.dataset.value);
    render();
  };
  for (const b of box.querySelectorAll('button[data-step]')) b.onclick = () => {
    const key = b.dataset.key;
    state[key] = key === 'bb' ? stepBB(state.bb, Number(b.dataset.step) > 0 ? 1 : -1)
      : Math.min(Number(b.dataset.max), Math.max(Number(b.dataset.min), state[key] + Number(b.dataset.step)));
    if (key === 'pot') state.potFix = { street: state.street, value: state.pot };
    if (box === sheet) { box.querySelector(`input[data-key="${key}"]`).value = fmt(state[key]); persist(); }
    render();
  };
  for (const input of box.querySelectorAll('input[data-key]')) {
    input.onchange = () => {
      state[input.dataset.key] = parseNum(input.value);
      if (input.dataset.key === 'pot') state.potFix = { street: state.street, value: state.pot };
      if (box === sheet) persist();
      render();
    };
    input.onfocus = () => input.select();
  }
}

// Банк — нажатием на стол.
$('pot-chip').onclick = () => {
  openSheet(`
    <h2>Банк<button data-act="close">Готово</button></h2>
    <div class="steppers">${stepper('pot', 'Деньги в центре стола', state.bb)}</div>
    ${potLines()}
    <p class="note">${state.potFix
      ? 'Банк поправлен вручную — дальше приложение прибавляет ставки к твоей сумме.'
      : 'Банк считается сам: блайнды, анте и все, кто уравнял, а на каждой улице — ставка × оставшихся игроков. Если в жизни было иначе (кто-то повысил или сбросил посреди улицы) — поправь сумму.'}
      Ставку соперника на этой улице вводи отдельно — «Соперник поставил».</p>
    ${state.potFix ? '<button class="remove" data-act="auto">Считать банк автоматически</button>' : ''}`);
  sheet.querySelector('[data-act="close"]').onclick = closeSheet;
  sheet.querySelector('[data-act="auto"]')?.addEventListener('click', () => { state.potFix = null; closeSheet(); render(); });
  bindSteppers(sheet);
};

// Блайнды и стек — строка вверху.
function renderStakes() {
  const sb = fmt(state.bb / 2), bb = fmt(state.bb);
  $('stakes').innerHTML = `Блайнды <b>${sb}/${bb}</b>${anteNow() ? ` · анте <b>${bb}</b>` : ''} · Твой стек ${state.stack
    ? `<b>${fmt(state.stack)}</b> (${fmt(Math.round(state.stack / state.bb))} ББ)`
    : '<span class="warn">укажи ✎</span>'}`;
}
$('stakes').onclick = openSettings;

// Уровни блайндов: следующий уровень одним касанием (анте = ББ подстраивается само).
const nextLevel = () => state.levels.find((v) => v > state.bb);
function renderLevel() {
  const btn = $('level-up');
  const next = isPro() ? nextLevel() : null;
  btn.hidden = !next;
  if (next) btn.innerHTML = `▲<small>ББ ${fmt(next)}</small>`;
}
$('level-up').onclick = () => {
  const next = nextLevel();
  if (!next) return;
  state.bb = next; persist(); render();
};
const levelsText = (list = state.levels) => (list.length
  ? `Уровни: ${list.map(fmt).join(' → ')}. Вверху кнопка «▲» — следующий уровень одним касанием.`
  : 'Впиши большие блайнды по порядку через запятую — вверху появится кнопка «▲».');
// «40 000, 50 000, 60 000» → [40000, 50000, 60000] (пробелы внутри чисел — тысячи).
const parseLevels = (text) => [...new Set(text.split(/[,;.\n]+/).map((t) => Number(t.replace(/[^\d]/g, ''))).filter((v) => v > 0))].sort((a, b) => a - b);

// ---------- Совет ----------
let adviceTimer = 0;
let lastAdvice = null;

const cardText = (c) => `${rankLabel(rankOf(c))}${SUIT_GLYPH[suitOf(c)]}`;

// «Не согласен»: раздача текстом — владелец вставляет её мне в чат, я разбираю пачкой.
// Последняя строка #data — для повтора раздачи скриптом scripts/replay.mjs.
async function copyHand() {
  const pos = seatPosition(state.occupied, state.button, state.hero);
  const board = state.board.filter((c) => c !== null);
  const pre = PREFLOP_CHOICES.find(([k]) => k === state.preflop)[1];
  const a = lastAdvice;
  const text = [
    'Раздача для разбора (Покер · совет)',
    `Стол: ${activeCount()} игроков, кнопка у места ${state.button}, я на месте ${state.hero} (${pos ? pos.name : '?'})`,
    `Блайнды ${fmt(state.bb / 2)}/${fmt(state.bb)}${state.anteOn ? `, анте ${fmt(state.bb)}` : ''}, мой стек ${state.stack ? fmt(state.stack) : 'не указан'}`,
    `Мои карты: ${state.hole.map(cardText).join(' ')}`,
    board.length ? `На столе: ${board.map(cardText).join(' ')}` : 'На столе: ничего (префлоп)',
    pos && pos.players === 2 && pos.key === 'BTN' && state.preflop === 'none' ? 'До меня префлоп: никто (один на один я хожу первым)' : `До меня префлоп: ${pre}${state.preflop === 'limp' ? ` (${state.limpers})` : ''}${state.raiseTo && /raise|3bet/.test(state.preflop) ? ` до ${fmt(state.raiseTo)}` : ''}${liveCallers().length && /raise|3bet/.test(state.preflop) ? `, уравняли ещё ${liveCallers().length}` : ''}`,
    board.length ? `Банк ${fmt(state.pot)}, соперник поставил ${fmt(state.toCall)}, соперников ${state.opponents}, блефует: ${{ rare: 'редко', normal: 'обычно', often: 'часто' }[state.style]}` : '',
    a ? `Совет приложения: ${a.title} · шанс ${percentText(a.equity)} % — ${a.advice.reason}` : '',
    'Я думаю: ',
    `#data ${JSON.stringify({ occupied: state.occupied, hero: state.hero, button: state.button, bb: state.bb, stack: state.stack,
      hole: state.hole, board: state.board, preflop: state.preflop, limpers: state.limpers, raiseTo: state.raiseTo,
      pot: state.pot, toCall: state.toCall, opponents: state.opponents, style: state.style, anteOn: state.anteOn, callers: liveCallers().length })}`,
  ].filter(Boolean).join('\n');
  // Главный путь с телефона — письмо разработчику (владельцу): Claude сам найдёт его в почте по теме.
  // Код публичный — адрес собираем из кусочков, чтобы роботы-сборщики не нашли его целиком (решение владельца 2026-10-12).
  openSheet(`<h2>Не согласен<button data-act="close">Закрыть</button></h2>
    <div class="menu">
      <a class="mail-btn" href="mailto:${devMail()}?subject=${encodeURIComponent(MAIL_SUBJECT)}&body=${encodeURIComponent(text)}">
        Отправить разработчику <small>адрес уже вписан — останется нажать «Отправить»</small></a>
      <button data-act="copy">Скопировать текстом <small>вставить в чат вручную</small></button>
    </div>
    <p class="note">В письме после «Я думаю:» допиши, как бы сыграл ты, — так разбор будет точнее.</p>`);
  sheet.querySelector('[data-act="close"]').onclick = closeSheet;
  sheet.querySelector('[data-act="copy"]').onclick = async () => {
    try {
      await navigator.clipboard.writeText(text);
      sheet.querySelector('[data-act="copy"]').innerHTML = 'Скопировано <small>вставь в чат с Claude</small>';
    } catch {
      // Если телефон не дал скопировать — показываем текст, его можно выделить вручную.
      openSheet(`<h2>Раздача<button data-act="close">Закрыть</button></h2>
        <textarea class="copy-box" readonly>${text.replace(/</g, '&lt;')}</textarea>
        <p class="note">Выдели весь текст и скопируй, потом вставь в чат с Claude.</p>`);
      sheet.querySelector('[data-act="close"]').onclick = closeSheet;
      sheet.querySelector('textarea').select();
    }
  };
}
const MAIL_SUBJECT = 'Покер — раздача для разбора';
// Адрес разработчика — по кусочкам и задом наперёд, целиком в коде его нет.
const devMail = () => [['moc', 'liamg'].map((p) => [...p].reverse().join('')).reverse().join('.'),
  String.fromCharCode(104, 55, 56, 57, 48, 53, 48, 48)].reverse().join('@');
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
  // Один на один префлоп баттон ходит первым: на ББ «все сбросили» не бывает, а до баттона никто не ходит.
  if (count === 0 && heroPos.players === 2) {
    if (heroPos.key === 'BB' && state.preflop === 'none') {
      ticket.innerHTML = `<div class="wait">Что сделал соперник?<small>Один на один баттон ходит раньше тебя: отметь ниже «Уравняли» или «Повысили». Если он сбросил — банк твой.</small></div>`;
      return;
    }
    if (heroPos.key === 'BTN' && ['limp', 'raise'].includes(state.preflop)) {
      ticket.innerHTML = `<div class="wait">До тебя никто не ходил<small>Один на один ты ходишь первым: выбери «Пас». Если ты повысил, а соперник ответил повышением, — «Повысили ×2».</small></div>`;
      return;
    }
  }
  // Короткий стек до флопа — в Pro (советы после флопа и при глубоком стеке бесплатные).
  const stackBB = state.stack ? state.stack / state.bb : Infinity;
  if (count === 0 && !isPro() && stackBB <= SHORT_STACK_PRO_BB && !(heroPos.key === 'BB' && state.preflop === 'none')) {
    ticket.classList.remove('busy');
    ticket.innerHTML = `<div class="wait">Стек ${fmt(stackBB)} ББ — короткий<small>Здесь играют «ва-банк или пас»: точный совет по таблицам Нэша — в Pro. Советы при глубоком стеке и после флопа — бесплатные.</small>
      <button class="pro-cta" data-act="pro">Что даёт Pro</button></div>`;
    ticket.querySelector('[data-act="pro"]').onclick = openPro;
    return;
  }
  if (count === 1 || count === 2) {
    ticket.innerHTML = `<div class="wait">Добавь остальные карты флопа<small>Флоп — это 3 карты</small></div>`;
    return;
  }
  if (count >= 3 && !state.pot) {
    ticket.innerHTML = `<div class="wait">Сколько в банке?<small>Нажми «Банк» в центре стола и введи сумму</small></div>`;
    return;
  }

  ticket.classList.add('busy');
  clearTimeout(adviceTimer);
  // Расчёт — доли секунды; даём экрану сначала отрисоваться.
  adviceTimer = setTimeout(() => {
    const hero = state.hole;
    let advice, equity, lines, gaugeNote = 'шанс выиграть';
    if (count === 0) {
      advice = preflopAdvice({ hero, position: heroPos, action: state.preflop, ante: anteNow(),
        limpers: state.limpers, raiseTo: state.raiseTo, bigBlind: state.bb, stack: stackOrInf(),
        opener: state.raiser && state.raiser !== state.hero ? seatPosition(state.occupied, state.button, state.raiser) : null,
        heroOpened: state.preflop === '3bet' && state.raiser === state.hero,
        threeBettor: state.reraiser ? seatPosition(state.occupied, state.button, state.reraiser) : null });
      const pe = preflopEquity({ hero, action: state.preflop, limpers: state.limpers, opener: raiserPos(), callers: liveCallers().length });
      equity = pe.equity;
      gaugeNote = pe.label;
      lines = [`<b>${handClass(hero[0], hero[1])}</b> · ${heroPos.name}`, advice.reason];
    } else {
      const board = state.board.filter((c) => c !== null);
      advice = postflopAdvice({ hero, board, opponents: state.opponents, pot: state.pot,
        toCall: state.toCall, preflopAction: state.preflop, stack: stackOrInf(), style: state.style, iterations: 6000,
        preflop: { action: state.preflop, hero: heroPos, raiser: raiserPos(), heroOpened: state.preflop === '3bet' && state.raiser === state.hero,
          reraiser: state.reraiser ? seatPosition(state.occupied, state.button, state.reraiser) : null } });
      equity = advice.equity;
      const diff = Math.abs(advice.randomEquity - advice.equity) >= 0.05;
      gaugeNote = (state.toCall ? 'шанс против его ставки' : 'шанс выиграть')
        + (diff ? `<br><small>со случайными картами — ${percentText(advice.randomEquity)} %</small>` : '');
      const need = advice.needPct != null ? ` · колл выгоден от ${advice.needPct} %` : '';
      const draws = advice.draws.names.length ? ` · ${advice.draws.names.join(', ')}, ${advice.draws.outs} аутов` : '';
      lines = [`<b>${advice.handName}</b>${draws}${need}`, advice.reason];
      if (advice.rangeHit) {
        const h = advice.rangeHit;
        lines.push(`<span class="about">Его руки на этом столе: ${h.made} % пара и лучше, ${h.draw} % дро, ${h.air} % ничего.</span>`);
      } else if (advice.about) lines.push(`<span class="about">Шанс посчитан ${advice.about}.</span>`);
      const danger = dangerLine(hero, board);
      if (danger) lines.push(danger);
    }
    const { title, blinds, chips } = howMuch(advice, count === 0, heroPos);
    if (chips) lines.unshift(chips);
    ticket.classList.remove('busy');
    ticket.innerHTML = `
      <div class="top-row">
        <div class="act ${advice.action === 'fold' ? 'fold' : ''}"><small>${advice.close ? 'Спорно — почти равно' : 'Совет'}${blinds ? ` · ${blinds}` : ''}</small>${title}</div>
        <div class="gauge"><b>${percentText(equity)}%</b><span>${count === 0 ? `шанс ${gaugeNote}` : gaugeNote}</span></div>
      </div>
      <hr>${lines.map((l) => `<div class="line">${l}</div>`).join('')}
      <button class="disagree" id="disagree">Не согласен — отправить раздачу</button>`;
    lastAdvice = { advice, equity, title, street: streetOf(count) };
    $('disagree').onclick = copyHand;
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
  const amount = advice.action === 'allin' ? advice.amount : roundToSB(advice.amount);
  // Префлоп блайнды уже лежат на столе — их не докладывают второй раз.
  const posted = preflop ? (heroPos.key === 'BB' ? state.bb : heroPos.key === 'SB' ? state.bb / 2 : 0) : 0;
  const blindNote = posted && advice.action !== 'fold' && advice.action !== 'check'
    ? `Твой блайнд ${fmt(posted)} уже на столе — доложи <b>${fmt(amount - posted)}</b>.` : '';
  const titles = { raise: 'Рейз', bet: 'Ставка', call: 'Колл', allin: 'Ва-банк' };
  if (!titles[advice.action]) return { title: advice.text, blinds: '', chips: '' };
  return { title: `${titles[advice.action]}: ${fmt(amount)}`, blinds: `${fmt(Math.round((amount / state.bb) * 10) / 10)} ББ`, chips: blindNote };
}

// ---------- Твоя рука ----------
// Спрятать карты от соседей: смахнуть влево — карты уезжают за край, вправо — возвращаются.
function enableHideSwipe() {
  const hand = $('hand');
  let startX = null, startY = 0, dx = 0;
  hand.addEventListener('pointerdown', (e) => { startX = e.clientX; startY = e.clientY; dx = 0; });
  hand.addEventListener('pointermove', (e) => {
    if (startX === null) return;
    dx = e.clientX - startX;
    // Двигаем карты вслед за пальцем, только если жест горизонтальный.
    if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(e.clientY - startY)) {
      const base = state.hidden ? -100 : 0;
      $('hero-cards').style.transform = `translateX(calc(${base}vw + ${Math.max(-400, Math.min(400, dx))}px))`;
      $('hero-cards').style.transition = 'none';
    }
  });
  const end = () => {
    if (startX === null) return;
    $('hero-cards').style.transform = '';
    $('hero-cards').style.transition = '';
    if (dx < -50 && !state.hidden) { state.hidden = true; suppressClick = true; render(); }
    else if (dx > 50 && state.hidden) { state.hidden = false; suppressClick = true; render(); }
    startX = null;
  };
  hand.addEventListener('pointerup', end);
  hand.addEventListener('pointercancel', end);
  // После смахивания не открывать выбор карты случайным «кликом».
  hand.addEventListener('click', (e) => { if (suppressClick) { e.stopPropagation(); e.preventDefault(); suppressClick = false; } }, true);
}
let suppressClick = false;

function renderHand() {
  $('hand').classList.toggle('is-hidden', state.hidden);
  $('hero-cards').innerHTML = state.hole.map((c, i) =>
    `<button aria-label="Твоя карта ${i + 1}" data-hole="${i}">${c === null ? '<span class="card big empty">+</span>' : cardHtml(c, 'big')}</button>`).join('');
  for (const b of $('hero-cards').querySelectorAll('button')) b.onclick = () => openPicker('hole', Number(b.dataset.hole));
  const pos = seatPosition(state.occupied, state.button, state.hero);
  $('hero-pos').innerHTML = `<small>Место ${state.hero} · ${activeCount()} за столом</small>${pos ? pos.name : '—'}`;
  // Шуточное прозвище руки («Ракеты», «Сикс-севен»…). Пока карты спрятаны — тоже спрятано: выдаёт руку.
  const nick = !state.hidden && state.hole.every((c) => c !== null) ? nicknameFor(rankOf(state.hole[0]), rankOf(state.hole[1])) : null;
  const [title, note] = (nick || '').split(' · ');
  $('nickname').innerHTML = nick ? `«${title}»${note ? `<small>${note}</small>` : ''}` : '';
}

// Итог раздачи: выиграл / проиграл / сбросил — стек меняется сам.
function heroPosted() {
  const pos = seatPosition(state.occupied, state.button, state.hero);
  return pos?.key === 'BB' ? state.bb : pos?.key === 'SB' ? state.bb / 2 : 0;
}
// Сколько примерно вложил в банк ты (подсказка, владелец поправит).
const roundSB = (n) => Math.round(n / (state.bb / 2)) * (state.bb / 2);
function preflopInvested() {
  if (/raise|3bet/.test(state.preflop)) return state.raiseTo; // уравнял повышение
  if (state.preflop === 'limp') return state.bb;
  return Math.max(heroPosted(), 3 * state.bb); // повышал сам
}
function guessResult(kind) {
  const preflop = boardCount() < 3;
  if (kind === 'fold') return preflop ? heroPosted() : preflopInvested();
  if (kind === 'lose') return roundSB(preflop ? preflopInvested() : preflopInvested() + state.toCall);
  // Выиграл: всё, что положили соперники = банк минус твоя доля плюс их ставка на этой улице.
  return Math.max(state.bb, roundSB(preflop ? preflopInvested() + state.bb / 2 : state.pot - preflopInvested() + state.toCall));
}

$('new-hand').onclick = () => {
  if (!state.stack || state.hole.some((c) => c === null)) return startNewHand();
  state.resultKind = 'win';
  state.result = guessResult('win');
  const kinds = [['win', 'Выиграл'], ['lose', 'Проиграл'], ['fold', 'Сбросил']];
  const draw = () => {
    openSheet(`
      <h2>Чем кончилась раздача?<button data-act="skip">Не считать</button></h2>
      <div class="segments">${kinds.map(([k, t]) => `<button data-kind="${k}" aria-pressed="${state.resultKind === k}">${t}</button>`).join('')}</div>
      <div class="steppers" style="margin-top:12px">${stepper('result', state.resultKind === 'win' ? 'Сколько выиграл (чистыми)' : 'Сколько потерял', state.bb / 2)}</div>
      <p class="note">Сумму приложение прикинуло само — поправь, если не так. Стек сейчас ${fmt(state.stack)}, станет
        <b>${fmt(Math.max(0, state.stack + (state.resultKind === 'win' ? 1 : -1) * state.result))}</b>.</p>
      <button class="new-hand big" data-act="done">Готово — новая раздача</button>`);
    for (const b of sheet.querySelectorAll('[data-kind]')) b.onclick = () => {
      state.resultKind = b.dataset.kind; state.result = guessResult(state.resultKind); draw();
    };
    bindSteppers(sheet);
    for (const b of sheet.querySelectorAll('button[data-step], input[data-key]')) {
      b.addEventListener(b.tagName === 'INPUT' ? 'change' : 'click', () => setTimeout(draw, 0));
    }
    sheet.querySelector('[data-act="skip"]').onclick = () => { closeSheet(); startNewHand(); };
    sheet.querySelector('[data-act="done"]').onclick = () => {
      state.stack = Math.max(0, state.stack + (state.resultKind === 'win' ? 1 : -1) * state.result);
      closeSheet(); startNewHand();
    };
  };
  draw();
};

function startNewHand() {
  state.button = nextActive(state.occupied, state.button); // кнопка уходит к следующему игроку
  state.hole = [null, null];
  state.board = [null, null, null, null, null];
  state.preflop = 'none'; state.limpers = 1; state.raiseTo = 0; state.raiser = 0; state.reraiser = 0; state.callers = [];
  state.pot = 0; state.toCall = 0; state.opponents = 1;
  state.street = -1; state.preMove = null; state.streetLog = []; state.potFix = null;
  lastAdvice = null;
  persist();
  render();
}

// Строка статуса Pro в настройках.
function proRow() {
  const st = pro();
  const text = st.kind === 'open' ? 'Pro: сейчас всё открыто бесплатно'
    : st.kind === 'bought' ? 'Pro навсегда — спасибо!'
    : st.kind === 'trial' ? `Pro бесплатно: осталось ${st.daysLeft} ${st.daysLeft === 1 ? 'день' : st.daysLeft < 5 ? 'дня' : 'дней'}`
    : 'Бесплатная версия';
  return `<button class="pro-row ${st.kind}" data-act="pro"><span class="pro-badge">PRO</span>${text}<b>›</b></button>`;
}
// Экран Pro: что даёт, статус, цена, код.
function openPro() {
  const st = pro();
  openSheet(`
    <h2>Покер · совет Pro<button data-act="close">Закрыть</button></h2>
    <ul class="pro-list">
      <li><b>Короткий стек</b> — когда ва-банк, а когда пас (до ${SHORT_STACK_PRO_BB} ББ), и с чем уравнивать чужой ва-банк. По таблицам Нэша, сверенным с HoldemResources.</li>
      <li><b>Анте</b> — советы и таблицы с анте, как в турнирах.</li>
      <li><b>Уровни турнира</b> — блайнды и анте меняются одной кнопкой «▲».</li>
      <li><b>Тренажёр</b> без ограничений (бесплатно — 10 вопросов в день).</li>
      <li class="soon"><b>Статистика</b> турниров — скоро.</li>
    </ul>
    <p class="pro-status">${st.kind === 'open' ? 'Сейчас всё открыто бесплатно для всех — идёт проверка приложения.'
      : st.kind === 'bought' ? 'У тебя Pro навсегда.'
      : st.kind === 'trial' ? `Сейчас всё открыто: пробная неделя, осталось ${st.daysLeft} дн.`
      : `Пробная неделя (${TRIAL_DAYS} дней) закончилась.`}</p>
    ${st.kind === 'bought' ? '' : `<div class="pro-buy">Pro навсегда — <b>${PRO_PRICE} ₽</b><small>Оплата скоро появится. Есть код — введи ниже. Сохрани код: на новом телефоне или в другом браузере его можно ввести снова.</small></div>
    <div class="pro-code"><input id="pro-code" placeholder="PRO-XXXX-XXXX" autocapitalize="characters" autocomplete="off">
      <button data-act="code">Активировать</button></div><p class="note" id="pro-msg"></p>`}`);
  sheet.querySelector('[data-act="close"]').onclick = closeSheet;
  const btn = sheet.querySelector('[data-act="code"]');
  if (btn) btn.onclick = async () => {
    const digest = async (t) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)))]
      .map((x) => x.toString(16).padStart(2, '0')).join('');
    const ok = await checkCode(sheet.querySelector('#pro-code').value, digest).catch(() => false);
    if (ok) { proStore.unlocked = true; saveProStore(); render(); openPro(); }
    else sheet.querySelector('#pro-msg').textContent = 'Код не подошёл — проверь буквы и цифры.';
  };
}

function openSettings() {
  openSheet(`
    <h2>Блайнды и стек<button data-act="close">Готово</button></h2>
    ${proRow()}
    <div class="steppers">
      ${stepper('bb', 'Большой блайнд', 1, 1)}
      ${stepper('stack', 'Твой стек', state.bb * 10)}
    </div>
    ${isPro() ? `<div style="margin-top:14px"><div class="label">Анте (платит большой блайнд, размером с ББ)</div>
      <div class="segments">${[[false, 'Нет'], [true, 'Есть']].map(([v, t]) => `<button data-ante="${v}" aria-pressed="${state.anteOn === v}">${t}</button>`).join('')}</div></div>
    <div style="margin-top:14px"><div class="label">Уровни турнира — большие блайнды через запятую</div>
      <input class="levels-input" id="levels" inputmode="decimal" placeholder="40000, 50000, 60000, 80000" value="${state.levels.join(', ')}">
      <p class="note" id="levels-seen">${levelsText()}</p></div>`
    : `<button class="locked-row" data-act="pro">Анте и уровни турнира <span>PRO</span></button>`}
    <p class="note">Суммы — в деньгах стола, не в штуках фишек. Игра 250/500: большой блайнд 500.
      Стек решает многое: при глубоких стеках выгодно дёшево уравнивать с маленькими парами и одномастными
      связками (попадёшь — выиграешь много), а с коротким (до 15 ББ) играют «ва-банк или пас».
      Если у соперника денег заметно меньше, чем у тебя, помни: больше них с него не выиграешь.</p>
    <p class="note">Версия приложения: <b>${APP_VERSION}</b></p>`);
  sheet.querySelector('[data-act="close"]').onclick = closeSheet;
  const levels = sheet.querySelector('#levels');
  // Клавиатура «цифры с запятой» (на iPhone у чисто цифровой нет запятой). Сразу показываем, что поняли.
  if (levels) {
    levels.oninput = (e) => { sheet.querySelector('#levels-seen').innerHTML = levelsText(parseLevels(e.target.value)); };
    levels.onchange = (e) => { state.levels = parseLevels(e.target.value); persist(); render(); };
  }
  for (const b of sheet.querySelectorAll('[data-act="pro"]')) b.onclick = openPro;
  for (const b of sheet.querySelectorAll('[data-ante]')) b.onclick = () => {
    state.anteOn = b.dataset.ante === 'true'; persist(); openSettings(); render();
  };
  bindSteppers(sheet);
}
$('settings-btn').onclick = openSettings;

// Тренажёр: отдельный экран со своим столом — твой стол, стек и уровни не трогаются.
function exitTrainer() { closeTrainer(); $('train-btn').textContent = 'Тренажёр'; render(); }
$('train-btn').onclick = () => {
  if (document.body.classList.contains('training')) return exitTrainer();
  $('train-btn').textContent = 'Выйти';
  openTrainer({ isPro, openPro, onExit: exitTrainer });
};

function render() {
  syncPot();
  renderLevel();
  renderTable();
  renderHand();
  renderInputs();
  renderTicket();
}

// Карточка совета прилеплена к низу экрана: запас под страницей = её высота, чтобы она не закрывала поля и кнопки.
if ('ResizeObserver' in window) {
  const ro = new ResizeObserver(() => {
    const t = document.body.classList.contains('training') ? $('tr-ticket') : $('ticket');
    document.body.style.paddingBottom = `calc(${t.offsetHeight + 24}px + var(--safe-bottom))`;
  });
  ro.observe($('ticket')); ro.observe($('tr-ticket'));
}

// Первый запуск: неделя Pro в подарок (не мешает нажатиям, сама пропадает).
if (firstLaunch) {
  const toast = document.createElement('button');
  toast.className = 'toast';
  toast.innerHTML = `<span class="pro-badge">PRO</span> ${TRIAL_DAYS} дней Pro бесплатно — всё открыто <b>›</b>`;
  toast.onclick = () => { toast.remove(); openPro(); };
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 7000);
}

buildTable();
enableHideSwipe();
render();

// Офлайн-режим (на localhost не включаем, чтобы при разработке не мешал кэш).
if ('serviceWorker' in navigator && location.hostname !== 'localhost') {
  // updateViaCache: 'none' — сам офлайн-помощник тоже всегда берём свежий.
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
    .then((reg) => {
      reg.update();
      // Айфон не перезагружает приложение с экрана «Домой», а разворачивает его из памяти —
      // поэтому при каждом возвращении в приложение проверяем, нет ли новой версии.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update();
      });
    })
    .catch(() => { /* без офлайна тоже работает */ });
  // Пришла новая версия: если раздача пустая — обновляемся сразу, иначе предлагаем кнопку.
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    if (state.hole.every((c) => c === null) && boardCount() === 0) {
      reloading = true;
      location.reload();
      return;
    }
    const bar = document.createElement('button');
    bar.className = 'update-bar';
    bar.textContent = 'Есть новая версия — нажми, чтобы обновить';
    bar.onclick = () => { reloading = true; location.reload(); };
    document.body.appendChild(bar);
  });
}
