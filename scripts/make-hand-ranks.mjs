// Считает силу всех 169 стартовых рук (шанс против двух случайных рук)
// и записывает их порядок в src/handRanks.js. Запуск: node scripts/make-hand-ranks.mjs
import { writeFileSync } from 'node:fs';
import { makeCard, RANKS } from '../src/cards.js';
import { allClasses } from '../src/hands.js';
import { calcEquity, seededRandom } from '../src/equity.js';

const random = seededRandom(7);
function ranking(opponents) {
  const rows = allClasses().map((cls) => {
    const high = RANKS.indexOf(cls[0]) + 2, low = RANKS.indexOf(cls[1]) + 2;
    const suited = cls.endsWith('s');
    const hero = [makeCard(high, 0), makeCard(low, suited ? 0 : 1)];
    const { equity } = calcEquity({ hero, opponents, iterations: 30000, random });
    return { cls, equity };
  });
  rows.sort((a, b) => b.equity - a.equity);
  console.log(`против ${opponents}:`, rows.slice(0, 12).map((r) => `${r.cls} ${(r.equity * 100).toFixed(1)}`).join(' | '));
  return rows.map((r) => `'${r.cls}'`).join(', ');
}
const multi = ranking(2);
const headsUp = ranking(1);
writeFileSync(new URL('../src/handRanks.js', import.meta.url),
  `// Создано scripts/make-hand-ranks.mjs: 169 стартовых рук от сильной к слабой.\n` +
  `// HAND_RANKS — по шансу против двух случайных рук (обычная игра),\n` +
  `// HAND_RANKS_HU — против одной (игра «ва-банк или пас», там чаще один на один).\n` +
  `export const HAND_RANKS = [${multi}];\nexport const HAND_RANKS_HU = [${headsUp}];\n`);
