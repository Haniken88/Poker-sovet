// Экран «Тренажёр» (2026-10-13): тот же стол, что на главном экране; вопросы — src/trainer.js.
import { nextQuestion, TOPICS, SERIES, FREE_PER_DAY } from './src/trainer.js';
import { openSizeFor } from './src/preflop.js';
import { GEOMETRY, DEALER_XY, SEAT_XY, activeSeats } from './src/table.js';
import { rankOf, suitOf } from './src/cards.js';

const $ = (id) => document.getElementById(id);
const RANK_LABEL = { 10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
const SUIT_GLYPH = ['♠', '♥', '♦', '♣'];
const SUIT_CLASS = ['suit-s', 'suit-h', 'suit-d', 'suit-c'];
const SHORT = { BTN: 'BTN', SB: 'МБ', BB: 'ББ' };
const NAME = { BTN: 'баттон', SB: 'малый блайнд', BB: 'большой блайнд', CO: 'катофф', HJ: 'хайджек', LJ: 'лоуджек' };
const posName = (p) => NAME[p.key] || `ранняя позиция (${p.key})`;
const ru = (n) => String(Math.round(n * 10) / 10).replace('.', ',');
const card = (c) => `<span class="card big ${SUIT_CLASS[suitOf(c)]}"><b>${RANK_LABEL[rankOf(c)] || rankOf(c)}</b><i>${SUIT_GLYPH[suitOf(c)]}</i></span>`;
const rnd = Math.random;
const lowerFirst = (t) => t[0].toLowerCase() + t.slice(1);

let opts = null; // { isPro, openPro, onExit }
let topic = 'short';
let run = null; // { n, right, answered, q, results: [], repeat: [] }

// Сколько вопросов задано сегодня (для бесплатной версии — 10 в день).
const today = () => new Date().toISOString().slice(0, 10);
function usedToday() {
  try { const d = JSON.parse(localStorage.getItem('poker-trainer')) || {}; return d.date === today() ? d.count : 0; } catch { return 0; }
}
function countQuestion() {
  try { localStorage.setItem('poker-trainer', JSON.stringify({ date: today(), count: usedToday() + 1 })); } catch { /* приватный режим */ }
}

export function openTrainer(o) {
  opts = o;
  document.body.classList.add('training');
  $('trainer').hidden = false;
  $('tr-ticket').hidden = false;
  window.scrollTo(0, 0);
  buildTable();
  newSeries();
}
export function closeTrainer() {
  document.body.classList.remove('training');
  $('trainer').hidden = true;
  $('tr-ticket').hidden = true;
}

function buildTable() {
  const t = $('tr-table');
  if (t.dataset.built) return;
  const { W, H, CY, CX1, CX2, R } = GEOMETRY;
  t.style.setProperty('--sx', `${((CX1 - R) / W) * 100}%`);
  t.style.setProperty('--sy', `${((CY - R) / H) * 100}%`);
  t.style.setProperty('--sw', `${((CX2 - CX1 + 2 * R) / W) * 100}%`);
  t.style.setProperty('--sh', `${((2 * R) / H) * 100}%`);
  t.dataset.built = '1';
}
const pct = ([x, y]) => `left:${(x / GEOMETRY.W) * 100}%;top:${(y / GEOMETRY.H) * 100}%`;
const chipPoint = (seat) => { const [x, y] = SEAT_XY[seat]; const k = 0.32; return [x + (179 - x) * k, y + (GEOMETRY.CY - y) * k]; };

function newSeries() {
  run = { n: 0, right: 0, results: [], repeat: [] };
  next();
}

function next() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (!opts.isPro() && usedToday() >= FREE_PER_DAY) return renderLimit();
  run.n++;
  const due = run.repeat.findIndex((r) => r.at <= run.n);
  run.q = due >= 0 ? run.repeat.splice(due, 1)[0].q : nextQuestion(topic, rnd);
  run.answered = null;
  render();
}

// Места за столом: игроков N — раскладываем по 9 местам равномерно; кнопка — случайно.
function seating(q) {
  if (!q.seats) {
    const seats = [...new Set(Array.from({ length: q.players }, (_, i) => 1 + Math.round((i * 9) / q.players)))];
    const occupied = Array.from({ length: 9 }, (_, i) => seats.includes(i + 1));
    const active = activeSeats(occupied);
    const b = Math.floor(rnd() * active.length);
    q.seats = { occupied, active, b, seatOf: (off) => active[(b + off) % active.length] };
  }
  return q.seats;
}

const ACT_TEXT = (a) => (a === 'fold' ? 'пас' : a === 'allin' ? 'ва-банк' : `рейз ${ru(a.raise)} ББ`);
function answerLabel(a, q) {
  if (a === 'fold') return 'Пас';
  if (a === 'allin') return 'Ва-банк';
  if (a === 'call') return q.topic === 'vsShove' ? 'Колл' : `Колл ${ru(q.raiseTo)} ББ`;
  return q.topic === 'vsRaise' ? 'Рейз (3-бет)' : `Рейз ${ru(openSizeFor(q.stackBB, q.players === 2))} ББ`;
}

function situation(q) {
  const p = q.position;
  const opener = Object.entries(q.seatsActs).find(([, a]) => a !== 'fold');
  const before = !opener ? 'до тебя все сбросили'
    : q.topic === 'vsShove' ? `${posName(q.opener)} пошёл ва-банк, остальные сбросили`
    : `${posName(q.opener)} повысил до ${ru(q.raiseTo)} ББ, остальные сбросили`;
  // Сколько ходит после тебя до флопа. Вдвоём после баттона — только ББ (в positions.js behind=2 — условность для таблиц).
  const left = q.players === 2 ? (p.key === 'BB' ? 0 : 1) : p.behind;
  const after = left === 1 ? ' После тебя ходит ещё один игрок.' : left > 1 ? ` После тебя ходят ещё ${left}.` : ' После тебя никто не ходит.';
  return `Ты — <b>${posName(p)}</b>, ${q.players} за столом, стек <b>${q.stackBB} ББ</b>${q.ante ? ', анте' : ''}. ${before[0].toUpperCase() + before.slice(1)}.${after}`;
}

function render() {
  const q = run.q;
  const { occupied, active, seatOf } = seating(q);
  // Стол: места, подписи позиций, кто что сделал.
  const heroSeat = seatOf(q.offset);
  const seatHtml = Array.from({ length: 9 }, (_, i) => {
    const n = i + 1;
    if (!occupied[i]) return `<div class="seat is-out" style="${pct(SEAT_XY[n])}"><b>${n}</b><span>пусто</span></div>`;
    const off = (active.indexOf(n) - active.indexOf(seatOf(0)) + active.length) % active.length;
    const key = (q.players === 2 ? (off === 0 ? 'BTN' : 'BB') : null) || positionKey(q.players, off);
    const act = q.seatsActs[off];
    const cls = act === undefined ? '' : act === 'fold' ? 'fold' : 'raise';
    // Подпись у мест у края стола прижимаем внутрь, чтобы не вылезала за экран.
    const x = SEAT_XY[n][0] / GEOMETRY.W, edge = x > 0.8 ? ' edge-r' : x < 0.2 ? ' edge-l' : '';
    return `<div class="seat${n === heroSeat ? ' is-hero' : ''}" style="${pct(SEAT_XY[n])}"><b>${n}</b><span>${SHORT[key] || key}</span>${act !== undefined ? `<em class="seat-act ${cls}${edge}">${ACT_TEXT(act)}</em>` : ''}</div>`;
  }).join('');
  $('tr-seats').innerHTML = `<div class="croupier" style="${pct(DEALER_XY)}">Дилер</div>${seatHtml}<div class="button-chip" style="${pct(chipPoint(seatOf(0)))}">D</div>`;
  $('tr-center').innerHTML = `<span class="tr-pot">В банке ${ru(1.5 + q.ante + (q.topic === 'vsShove' ? q.stackBB : q.topic === 'vsRaise' ? q.raiseTo : 0))} ББ</span>`;

  $('tr-topics').innerHTML = TOPICS.map(([k, t]) => `<button data-topic="${k}" aria-pressed="${k === topic}">${t}</button>`).join('');
  for (const b of $('tr-topics').querySelectorAll('button')) b.onclick = () => { topic = b.dataset.topic; newSeries(); };
  $('tr-progress').innerHTML = `<div class="tr-count"><span>Вопрос <b>${run.n}</b> из ${SERIES}</span><span>Верно <b>${run.right}</b> из ${run.results.length}</span></div>
    <div class="tr-dots">${Array.from({ length: SERIES }, (_, i) => `<i class="${i < run.results.length ? (run.results[i].ok ? 'ok' : 'no') : i === run.n - 1 ? 'now' : ''}"></i>`).join('')}</div>`;
  const [c1, c2] = [...q.hero].sort((x, y) => rankOf(y) - rankOf(x)); // старшая карта первой
  $('tr-hand').innerHTML = `<div class="hero-cards">${card(c1)}${card(c2)}</div><p class="tr-sit">${situation(q)}</p>`;
  const a = run.answered;
  $('tr-answers').innerHTML = `<h2 class="tr-q">Что делаешь?</h2><div class="tr-buttons">${q.options.map((o) => {
    const state = !a ? '' : o === q.correct ? 'right' : o === a ? 'wrong' : 'off';
    return `<button data-ans="${o}" class="${state}" ${a ? 'disabled' : ''}>${answerLabel(o, q)}</button>`;
  }).join('')}</div>`;
  for (const b of $('tr-answers').querySelectorAll('[data-ans]')) b.onclick = () => answer(b.dataset.ans);
  renderTicket();
}

function positionKey(players, off) {
  // Та же раскладка, что в src/positions.js (не тянем весь модуль ради ключа).
  if (off === 0) return 'BTN'; if (off === 1) return 'SB'; if (off === 2) return 'BB';
  const fromEnd = players - 1 - off;
  if (fromEnd === 0) return 'CO'; if (fromEnd === 1) return 'HJ'; if (fromEnd === 2) return 'LJ';
  return off === 3 ? 'UTG' : `UTG+${off - 3}`;
}

function answer(a) {
  const q = run.q;
  run.answered = a;
  const ok = a === q.correct;
  if (ok) run.right++;
  else run.repeat.push({ q, at: run.n + 3 }); // ошибся — эта раздача вернётся через несколько вопросов
  run.results.push({ ok, topic: q.topic, pos: q.position.key });
  countQuestion();
  render();
  // Кнопки с отметкой «верно/неверно» должны быть видны над карточкой с объяснением.
  // Ждём, пока карточка с объяснением вырастет и под страницей появится запас, — потом прокручиваем.
  setTimeout(() => {
    const btns = $('tr-answers').getBoundingClientRect(), top = $('tr-ticket').getBoundingClientRect().top;
    if (btns.bottom > top - 16) window.scrollBy({ top: btns.bottom - top + 20, behavior: 'smooth' });
  }, 120);
}

function renderTicket() {
  const t = $('tr-ticket');
  const q = run.q, a = run.answered;
  if (!a) { t.innerHTML = `<p class="tr-wait">Выбери ответ — объяснение появится сразу после.</p>`; return; }
  const ok = a === q.correct;
  const last = run.results.length >= SERIES;
  t.innerHTML = `<div class="tr-verdict ${ok ? 'ok' : 'no'}">${ok ? 'Верно' : 'Неверно'} — ${ok ? '' : 'правильно: '}${lowerFirst(answerLabel(q.correct, q))}</div>
    <p class="tr-why">${q.advice.reason}</p>
    <button class="tr-next" id="tr-next">${last ? 'Итог серии' : 'Дальше'}</button>`;
  $('tr-next').onclick = last ? summary : next;
}

function summary() {
  const wrong = run.results.filter((r) => !r.ok);
  const topicName = Object.fromEntries(TOPICS);
  const groups = {};
  for (const r of wrong) { const k = `${topicName[r.topic]} · ${NAME[r.pos] || r.pos}`; groups[k] = (groups[k] || 0) + 1; }
  const top = Object.entries(groups).sort((x, y) => y[1] - x[1]).slice(0, 3);
  $('tr-ticket').innerHTML = `<div class="tr-verdict ${run.right >= SERIES * 0.8 ? 'ok' : ''}">${run.right} из ${SERIES}</div>
    <p class="tr-why">${top.length ? `Чаще всего ошибался: ${top.map(([k, n]) => `${k} — ${n}`).join('; ')}.` : 'Без единой ошибки — отлично.'}</p>
    <div class="tr-row"><button class="tr-next" id="tr-again">Ещё серия</button><button class="tr-exit" id="tr-quit">Выйти</button></div>`;
  $('tr-again').onclick = newSeries;
  $('tr-quit').onclick = () => opts.onExit();
}

function renderLimit() {
  $('tr-ticket').innerHTML = `<div class="tr-verdict">На сегодня ${FREE_PER_DAY} вопросов</div>
    <p class="tr-why">В бесплатной версии — ${FREE_PER_DAY} вопросов в день. С Pro тренажёр без ограничений.</p>
    <div class="tr-row"><button class="tr-next" id="tr-pro">Что даёт Pro</button><button class="tr-exit" id="tr-quit">Выйти</button></div>`;
  $('tr-pro').onclick = opts.openPro;
  $('tr-quit').onclick = () => opts.onExit();
}
