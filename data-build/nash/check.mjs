// Проверка src/nashHU.js: доля рук каждого списка должна совпадать с процентом, подписанным в таблице.
import { NASH_HU, parseNashRange } from '../../src/nashHU.js';
import { combosOf } from '../../src/hands.js';
const pct = (set) => [...set].reduce((s, c) => s + combosOf(c), 0) / 1326 * 100;
let bad = 0;
for (const [es, row] of Object.entries(NASH_HU)) {
  const p = pct(parseNashRange(row.push)), c = pct(parseNashRange(row.call));
  const ok = Math.abs(p - row.pushPct) < 0.15 && Math.abs(c - row.callPct) < 0.15;
  if (!ok) bad++;
  console.log(`${es} ББ: ва-банк ${p.toFixed(1)} (в таблице ${row.pushPct}), колл ${c.toFixed(1)} (${row.callPct})${ok ? '' : '  ← НЕ СОВПАДАЕТ'}`);
}
process.exitCode = bad ? 1 : 0;
