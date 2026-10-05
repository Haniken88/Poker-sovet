// Классы стартовых рук: "AA", "AKs" (одной масти), "AKo" (разных мастей) — всего 169.
import { RANKS, rankOf, suitOf } from './cards.js';

export function handClass(a, b) {
  let high = rankOf(a), low = rankOf(b);
  if (low > high) [high, low] = [low, high];
  const name = RANKS[high - 2] + RANKS[low - 2];
  if (high === low) return name;
  return name + (suitOf(a) === suitOf(b) ? 's' : 'o');
}

export const combosOf = (cls) => (cls.length === 2 ? 6 : cls.endsWith('s') ? 4 : 12);

// Все 169 классов.
export function allClasses() {
  const result = [];
  for (let i = 12; i >= 0; i--) {
    for (let j = i; j >= 0; j--) {
      const name = RANKS[i] + RANKS[j];
      if (i === j) result.push(name);
      else result.push(name + 's', name + 'o');
    }
  }
  return result;
}

const rankIndex = (ch) => RANKS.indexOf(ch.toUpperCase()) + 2;

// Разбор записи диапазона: "22+, A2s+, KTs+, AJo+, T9s, 77-JJ, ATs-AQs".
export function parseRange(text) {
  const result = new Set();
  for (const raw of text.split(',')) {
    const part = raw.trim();
    if (!part) continue;
    if (part.includes('-')) {
      const [from, to] = part.split('-');
      const suffix = from.slice(2);
      if (from[0] === from[1]) {
        for (let r = rankIndex(from[0]); r <= rankIndex(to[0]); r++) result.add(RANKS[r - 2].repeat(2));
      } else {
        for (let r = rankIndex(from[1]); r <= rankIndex(to[1]); r++) result.add(from[0] + RANKS[r - 2] + suffix);
      }
    } else if (part.endsWith('+')) {
      const base = part.slice(0, -1);
      const high = rankIndex(base[0]);
      if (base[0] === base[1]) {
        for (let r = high; r <= 14; r++) result.add(RANKS[r - 2].repeat(2));
      } else {
        const suffix = base.slice(2);
        for (let r = rankIndex(base[1]); r < high; r++) result.add(base[0] + RANKS[r - 2] + suffix);
      }
    } else {
      result.add(part);
    }
  }
  for (const cls of result) {
    if (!/^[2-9TJQKA]{2}[so]?$/.test(cls)) throw new Error(`Ошибка в диапазоне: ${cls}`);
  }
  return result;
}
