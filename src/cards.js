// Карты: номинал 2..14 (14 = туз), масть 0..3 (♠ ♥ ♦ ♣).
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
export const SUITS = ['s', 'h', 'd', 'c'];
export const SUIT_SYMBOLS = ['♠', '♥', '♦', '♣'];

// Карта хранится одним числом 0..51: номинал * 4 + масть.
export const makeCard = (rank, suit) => (rank - 2) * 4 + suit;
export const rankOf = (card) => (card >> 2) + 2;
export const suitOf = (card) => card & 3;

export function cardFromString(text) {
  const rank = RANKS.indexOf(text[0].toUpperCase()) + 2;
  const suit = SUITS.indexOf(text[1].toLowerCase());
  if (rank < 2 || suit < 0) throw new Error(`Непонятная карта: ${text}`);
  return makeCard(rank, suit);
}

export const cardToString = (card) => RANKS[rankOf(card) - 2] + SUITS[suitOf(card)];

// Несколько карт через пробел: "As Kd Th".
export const parseCards = (text) => text.trim().split(/\s+/).map(cardFromString);
