// Общий код макетов: живой стол на 9 мест и карты. Только для показа дизайна.
// Стол вытянутый (как в казино): дилер посередине верхней длинной стороны,
// место 1 справа от него, дальше по часовой стрелке до места 9 слева от дилера.
import { positionInfo } from '../src/positions.js';

const SUIT = { s: '♠', h: '♥', d: '♦', c: '♣' };
const RANK = { T: '10' };

export function card(code, extra = '') {
  const r = RANK[code[0]] || code[0];
  return `<span class="card suit-${code[1]} ${extra}"><b>${r}</b><i>${SUIT[code[1]]}</i></span>`;
}

// Размеры стола в макете (px), всё переводится в проценты.
const W = 358, H = 300, CY = 150, CX1 = 104, CX2 = 254, R = 84, RING = 108;
const pct = (x, y) => ({ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%` });
const onCurve = (cx, deg) => [cx + RING * Math.cos((deg * Math.PI) / 180), CY + RING * Math.sin((deg * Math.PI) / 180)];
const TOP = CY - RING, BOTTOM = CY + RING;

export const DEALER_XY = [179, TOP];
export const SEAT_XY = {
  1: [CX2, TOP], 2: onCurve(CX2, -38), 3: onCurve(CX2, 38), 4: [CX2, BOTTOM], 5: [179, BOTTOM],
  6: [CX1, BOTTOM], 7: onCurve(CX1, 142), 8: onCurve(CX1, 218), 9: [CX1, TOP],
};

// Пример раздачи: ты на месте 5, место 7 пустое, кнопка у места 2.
export const HERO = 5, EMPTY = [7], BUTTON = 2;

const SHORT = { BTN: 'BTN', SB: 'МБ', BB: 'ББ', CO: 'CO', HJ: 'HJ', LJ: 'LJ' };

export function placeSeats(table, { chipAt = 0.32, render, dealer }) {
  table.style.setProperty('--sx', `${((CX1 - R) / W) * 100}%`);
  table.style.setProperty('--sy', `${((CY - R) / H) * 100}%`);
  table.style.setProperty('--sw', `${((CX2 - CX1 + 2 * R) / W) * 100}%`);
  table.style.setProperty('--sh', `${((2 * R) / H) * 100}%`);

  const active = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((n) => !EMPTY.includes(n));
  const btnIndex = active.indexOf(BUTTON);
  for (let n = 1; n <= 9; n++) {
    const empty = EMPTY.includes(n);
    let pos = null;
    if (!empty) {
      const offset = (active.indexOf(n) - btnIndex + active.length) % active.length;
      const info = positionInfo(active.length, offset);
      pos = SHORT[info.key] || info.key;
    }
    const el = document.createElement('div');
    el.className = `seat${n === HERO ? ' is-hero' : ''}${empty ? ' is-out' : ''}`;
    Object.assign(el.style, pct(...SEAT_XY[n]));
    el.innerHTML = render(n, pos, empty, n === HERO);
    table.appendChild(el);
  }
  const d = document.createElement('div');
  d.className = 'croupier';
  Object.assign(d.style, pct(...DEALER_XY));
  d.innerHTML = dealer;
  table.appendChild(d);

  const [bx, by] = SEAT_XY[BUTTON];
  const chip = document.createElement('div');
  chip.className = 'dealer';
  chip.textContent = 'D';
  Object.assign(chip.style, pct(bx + (179 - bx) * chipAt, by + (CY - by) * chipAt));
  table.appendChild(chip);
}

export const picker = new URLSearchParams(location.search).has('picker');
if (picker) document.documentElement.classList.add('show-picker');
