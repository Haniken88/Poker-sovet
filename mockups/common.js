// Общий код макетов: рассадка мест по овалу и карты. Только для показа дизайна.
import { positionInfo } from '../src/positions.js';

const SUIT = { s: '♠', h: '♥', d: '♦', c: '♣' };
const RANK = { T: '10' };

export function card(code, extra = '') {
  const r = RANK[code[0]] || code[0];
  return `<span class="card suit-${code[1]} ${extra}"><b>${r}</b><i>${SUIT[code[1]]}</i></span>`;
}
export const back = () => '<span class="card back"></span>';

// Место 0 — ты (внизу по центру), дальше по часовой стрелке.
export const SEATS = [
  { name: 'Ты' }, { name: 'Игрок 2' }, { name: 'Игрок 3', out: true }, { name: 'Игрок 4' },
  { name: 'Игрок 5' }, { name: 'Игрок 6' }, { name: 'Игрок 7' }, { name: 'Игрок 8' },
];
export const BUTTON_SEAT = 5;

const SHORT = { BTN: 'BTN', SB: 'МБ', BB: 'ББ', CO: 'CO', HJ: 'HJ', LJ: 'LJ' };

export function placeSeats(table, { rx = 0.5, ry = 0.5, chipAt = 0.7, render }) {
  const active = SEATS.map((s, i) => i).filter((i) => !SEATS[i].out);
  const btnIndex = active.indexOf(BUTTON_SEAT);
  const angleOf = (i) => Math.PI / 2 + (i / SEATS.length) * Math.PI * 2; // 0 = низ, по часовой
  SEATS.forEach((seat, i) => {
    const a = angleOf(i);
    const x = 50 + Math.cos(a) * rx * 100, y = 50 + Math.sin(a) * ry * 100;
    let pos = null;
    if (!seat.out) {
      const offset = (active.indexOf(i) - btnIndex + active.length) % active.length;
      const info = positionInfo(active.length, offset);
      pos = SHORT[info.key] || info.key;
    }
    const el = document.createElement('div');
    el.className = `seat${i === 0 ? ' is-hero' : ''}${seat.out ? ' is-out' : ''}`;
    el.style.left = `${x}%`; el.style.top = `${y}%`;
    el.innerHTML = render(seat, pos, i);
    table.appendChild(el);
  });
  const a = angleOf(BUTTON_SEAT);
  const chip = document.createElement('div');
  chip.className = 'dealer';
  chip.textContent = 'D';
  chip.style.left = `${50 + Math.cos(a) * rx * 100 * chipAt}%`;
  chip.style.top = `${50 + Math.sin(a) * ry * 100 * chipAt}%`;
  table.appendChild(chip);
}

export const picker = new URLSearchParams(location.search).has('picker');
if (picker) document.documentElement.classList.add('show-picker');
