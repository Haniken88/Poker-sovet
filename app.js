// Экран приложения: стол, выбор карт, ставки и совет.
import { makeCard, rankOf, suitOf } from './src/cards.js';
import { nicknameFor } from './src/nicknames.js';
import { preflopAdvice, preflopEquity } from './src/preflop.js';
import { postflopAdvice, whoBeatsYou, percentText } from './src/postflop.js';
import { handClass } from './src/hands.js';
import { GEOMETRY, DEALER_XY, SEAT_XY, SEAT_COUNT, activeSeats, seatPosition, nextActive } from './src/table.js';

// Номер версии — поднимать при каждом обновлении вместе с CACHE в sw.js.
const APP_VERSION = 19;
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
  hidden: false, // карты спрятаны от соседей (смахнуть влево / вправо)
  hole: [null, null],
  board: [null, null, null, null, null],
  preflop: 'none', limpers: 1, raiseTo: 0,
  raiser: 0, reraiser: 0, // места повысивших (0 — не отмечено)
  pot: 0, toCall: 0, opponents: 1,
};
const persist = () => {
  try {
    localStorage.setItem('poker-table', JSON.stringify(
      { occupied: state.occupied, hero: state.hero, button: state.button, bb: state.bb, stack: state.stack, style: state.style }));
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
    seat.addEventListener('click', () => (pickRaiser(n) ? render() : openSeatMenu(n)));
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

function renderTable() {
  for (const el of table.querySelectorAll('.seat')) {
    const n = Number(el.dataset.seat);
    const occupied = state.occupied[n - 1];
    const pos = seatPosition(state.occupied, state.button, n);
    el.classList.toggle('is-hero', n === state.hero);
    el.classList.toggle('is-out', !occupied);
    el.classList.toggle('is-raiser', n === state.raiser && state.preflop !== 'none');
    el.classList.toggle('is-reraiser', n === state.reraiser && state.preflop === '3bet');
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
  // На флопе по умолчанию: банк и соперники с префлопа.
  if (boardCount() >= 3 && !state.pot) {
    state.pot = state.preflop === 'none' || state.preflop === 'limp'
      ? state.bb * (1.5 + (state.preflop === 'limp' ? state.limpers : 0))
      : state.raiseTo * 2 + state.bb / 2;
  }
  render();
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
  return `<br>${who} <button class="link" id="repick">изменить</button>`;
}

function renderInputs() {
  const box = $('inputs');
  const preflop = boardCount() < 3;
  const others = Math.max(1, activeCount() - 1);
  if (preflop) {
    const current = PREFLOP_CHOICES.find(([k]) => k === state.preflop);
    box.innerHTML = `
      <div><div class="label">Что сделали игроки до тебя</div>
        <div class="segments">${PREFLOP_CHOICES.map(([k, t]) => `<button data-pre="${k}" aria-pressed="${state.preflop === k}">${t}</button>`).join('')}</div>
        <div class="explain">${current[2]}${raiserLine()}</div></div>
      ${state.preflop === 'limp' ? `<div class="steppers">${stepper('limpers', 'Сколько игроков уравняли', 1, 1, others)}</div>` : ''}
      ${state.preflop === 'raise' || state.preflop === '3bet' ? `<div class="steppers">${stepper('raiseTo', 'Повысили до', state.bb, state.bb)}</div>` : ''}`;
    for (const b of box.querySelectorAll('[data-pre]')) b.onclick = () => {
      if (state.preflop !== b.dataset.pre) { state.raiser = 0; state.reraiser = 0; }
      state.preflop = b.dataset.pre;
      if (state.preflop === 'raise' && state.raiseTo < 2 * state.bb) state.raiseTo = 3 * state.bb;
      if (state.preflop === '3bet' && state.raiseTo < 6 * state.bb) state.raiseTo = 9 * state.bb;
      render();
    };
  } else {
    const styles = [['rare', 'Редко блефует'], ['normal', 'Обычно'], ['often', 'Часто блефует']];
    box.innerHTML = `<div class="steppers">
      ${stepper('toCall', 'Соперник поставил', state.bb)}
      ${stepper('opponents', 'Соперников в игре', 1, 1, others)}</div>
      ${state.toCall ? `<div><div class="label">Как играет поставивший</div>
        <div class="segments">${styles.map(([k, t]) => `<button data-style="${k}" aria-pressed="${state.style === k}">${t}</button>`).join('')}</div>
        <div class="explain">Не знаешь — оставь «Обычно». Большой ставкой обычно ставят сильную руку.</div></div>` : ''}`;
    for (const b of box.querySelectorAll('[data-style]')) b.onclick = () => { state.style = b.dataset.style; persist(); render(); };
  }
  bindSteppers(box);
  const repick = box.querySelector('#repick');
  if (repick) repick.onclick = () => { state.raiser = 0; state.reraiser = 0; render(); };
}

function bindSteppers(box) {
  for (const b of box.querySelectorAll('button[data-step]')) b.onclick = () => {
    const key = b.dataset.key;
    state[key] = Math.min(Number(b.dataset.max), Math.max(Number(b.dataset.min), state[key] + Number(b.dataset.step)));
    if (box === sheet) { box.querySelector(`input[data-key="${key}"]`).value = fmt(state[key]); persist(); }
    render();
  };
  for (const input of box.querySelectorAll('input[data-key]')) {
    input.onchange = () => { state[input.dataset.key] = parseNum(input.value); if (box === sheet) persist(); render(); };
    input.onfocus = () => input.select();
  }
}

// Банк — нажатием на стол.
$('pot-chip').onclick = () => {
  openSheet(`
    <h2>Банк<button data-act="close">Готово</button></h2>
    <div class="steppers">${stepper('pot', 'Деньги в центре стола', state.bb)}</div>
    <p class="note">Только то, что уже в центре. Ставку соперника на этой улице вводи отдельно — «Соперник поставил».</p>`);
  sheet.querySelector('[data-act="close"]').onclick = closeSheet;
  bindSteppers(sheet);
};

// Блайнды и стек — строка вверху.
function renderStakes() {
  const sb = fmt(state.bb / 2), bb = fmt(state.bb);
  $('stakes').innerHTML = `Блайнды <b>${sb}/${bb}</b> · Твой стек ${state.stack
    ? `<b>${fmt(state.stack)}</b> (${fmt(Math.round(state.stack / state.bb))} ББ)`
    : '<span class="warn">укажи ✎</span>'}`;
}
$('stakes').onclick = openSettings;

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
    `Блайнды ${fmt(state.bb / 2)}/${fmt(state.bb)}, мой стек ${state.stack ? fmt(state.stack) : 'не указан'}`,
    `Мои карты: ${state.hole.map(cardText).join(' ')}`,
    board.length ? `На столе: ${board.map(cardText).join(' ')}` : 'На столе: ничего (префлоп)',
    `До меня префлоп: ${pre}${state.preflop === 'limp' ? ` (${state.limpers})` : ''}${state.raiseTo && /raise|3bet/.test(state.preflop) ? ` до ${fmt(state.raiseTo)}` : ''}`,
    board.length ? `Банк ${fmt(state.pot)}, соперник поставил ${fmt(state.toCall)}, соперников ${state.opponents}, блефует: ${{ rare: 'редко', normal: 'обычно', often: 'часто' }[state.style]}` : '',
    a ? `Совет приложения: ${a.title} · шанс ${percentText(a.equity)} % — ${a.advice.reason}` : '',
    'Я думаю: ',
    `#data ${JSON.stringify({ occupied: state.occupied, hero: state.hero, button: state.button, bb: state.bb, stack: state.stack,
      hole: state.hole, board: state.board, preflop: state.preflop, limpers: state.limpers, raiseTo: state.raiseTo,
      pot: state.pot, toCall: state.toCall, opponents: state.opponents, style: state.style })}`,
  ].filter(Boolean).join('\n');
  // Главный путь с телефона — письмо себе: Claude сам найдёт его в почте по теме.
  // Адрес не вшиваем (код публичный) — айфон подставит свой адрес по первым буквам.
  openSheet(`<h2>Не согласен<button data-act="close">Закрыть</button></h2>
    <div class="menu">
      <a class="mail-btn" href="mailto:?subject=${encodeURIComponent(MAIL_SUBJECT)}&body=${encodeURIComponent(text)}">
        Отправить письмом себе <small>потом скажи Claude «проверь раздачи на почте»</small></a>
      <button data-act="copy">Скопировать текстом <small>вставить в чат вручную</small></button>
    </div>
    <p class="note">В письме после «Я думаю:» допиши своё мнение. Получатель — ты сам: начни набирать свой адрес.</p>`);
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
      advice = preflopAdvice({ hero, position: heroPos, action: state.preflop,
        limpers: state.limpers, raiseTo: state.raiseTo, bigBlind: state.bb, stack: stackOrInf(),
        opener: state.raiser && state.raiser !== state.hero ? seatPosition(state.occupied, state.button, state.raiser) : null,
        heroOpened: state.preflop === '3bet' && state.raiser === state.hero,
        threeBettor: state.reraiser ? seatPosition(state.occupied, state.button, state.reraiser) : null });
      const pe = preflopEquity({ hero, action: state.preflop, limpers: state.limpers, opener: raiserPos() });
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
    lastAdvice = { advice, equity, title };
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
  state.preflop = 'none'; state.limpers = 1; state.raiseTo = 0; state.raiser = 0; state.reraiser = 0;
  state.pot = 0; state.toCall = 0; state.opponents = 1;
  persist();
  render();
}

function openSettings() {
  openSheet(`
    <h2>Блайнды и стек<button data-act="close">Готово</button></h2>
    <div class="steppers">
      ${stepper('bb', 'Большой блайнд', 1, 1)}
      ${stepper('stack', 'Твой стек', state.bb * 10)}
    </div>
    <p class="note">Суммы — в деньгах стола, не в штуках фишек. Игра 250/500: большой блайнд 500.
      Стек решает многое: при глубоких стеках выгодно дёшево уравнивать с маленькими парами и одномастными
      связками (попадёшь — выиграешь много), а с коротким (до 15 ББ) играют «ва-банк или пас».
      Если у соперника денег заметно меньше, чем у тебя, помни: больше них с него не выиграешь.</p>
    <p class="note">Версия приложения: <b>${APP_VERSION}</b></p>`);
  sheet.querySelector('[data-act="close"]').onclick = closeSheet;
  bindSteppers(sheet);
}
$('settings-btn').onclick = openSettings;

function render() {
  renderTable();
  renderHand();
  renderInputs();
  renderTicket();
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
