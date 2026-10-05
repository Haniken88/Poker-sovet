// Живой стол на 9 мест: дилер посередине верхней длинной стороны,
// место 1 справа от него, по часовой стрелке до места 9 слева.
import { positionInfo } from './positions.js';

export const SEAT_COUNT = 9;

// Геометрия в условных пикселях стола 358×300 (на экране — в процентах).
export const GEOMETRY = { W: 358, H: 300, CY: 150, CX1: 104, CX2: 254, R: 84, RING: 108 };
const { CY, CX1, CX2, RING } = GEOMETRY;
const onCurve = (cx, deg) => [cx + RING * Math.cos((deg * Math.PI) / 180), CY + RING * Math.sin((deg * Math.PI) / 180)];
const TOP = CY - RING, BOTTOM = CY + RING;
export const DEALER_XY = [179, TOP];
export const SEAT_XY = {
  1: [CX2, TOP], 2: onCurve(CX2, -38), 3: onCurve(CX2, 38), 4: [CX2, BOTTOM], 5: [179, BOTTOM],
  6: [CX1, BOTTOM], 7: onCurve(CX1, 142), 8: onCurve(CX1, 218), 9: [CX1, TOP],
};

// Занятые места по часовой стрелке (по возрастанию номера).
export const activeSeats = (occupied) =>
  [...Array(SEAT_COUNT).keys()].map((i) => i + 1).filter((n) => occupied[n - 1]);

// Позиция игрока на месте seat при кнопке на месте button.
export function seatPosition(occupied, button, seat) {
  const active = activeSeats(occupied);
  if (active.length < 2 || !active.includes(seat) || !active.includes(button)) return null;
  const offset = (active.indexOf(seat) - active.indexOf(button) + active.length) % active.length;
  return positionInfo(active.length, offset);
}

// Следующее занятое место по часовой стрелке (для переезда кнопки).
export function nextActive(occupied, seat) {
  for (let step = 1; step <= SEAT_COUNT; step++) {
    const n = ((seat - 1 + step) % SEAT_COUNT) + 1;
    if (occupied[n - 1]) return n;
  }
  return seat;
}
