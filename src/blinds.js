// Большой блайнд «+/−» шагает как в турнирах (просьба владельца 2026-10-12): до 1 000 — по 100,
// до 5 000 — по 500, до 15 000 — по 1 000, дальше — по 5 000. Некруглое число сначала доводится до круглого.
export function stepBB(value, dir) {
  const stepAt = (v) => (v < 1000 ? 100 : v < 5000 ? 500 : v < 15000 ? 1000 : 5000);
  if (dir > 0) { const st = stepAt(value); return Math.floor(value / st) * st + st; }
  const st = stepAt(value - 1);
  const down = Math.ceil(value / st) * st - st;
  return Math.max(100, down);
}
