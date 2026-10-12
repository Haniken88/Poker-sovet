// Банк считается сам (2026-10-12, просьба владельца: «не охота записывать вручную»).
// Владелец только отмечает, сколько соперников осталось и сколько поставили; банк складывается так:
//   на флопе — блайнды + анте + каждый, кто дошёл до флопа, вложил одинаково (последнее повышение);
//   на каждой следующей улице — + ставка улицы × (соперники, оставшиеся на следующей улице, + ты).
// Неизвестно, кто именно сбросил блайнды, поэтому считаем: малый блайнд сбросил (если это не ты),
// большой — в игре. Ошибка — не больше 1 ББ, владелец поправит касанием по «Банку».

/**
 * Банк на флопе.
 * action — что было до тебя ('none' | 'limp' | 'raise' | '3bet'), raiseTo — до скольки повысили;
 * heroMove — что сделал ты префлоп (совет приложения): { action, amount };
 * players — сколько игроков на флопе вместе с тобой; heroKey — твоё место ('SB', 'BB', …);
 * headsUp — вас двое за столом (тогда оба блайнда в игре); ante — анте ББ (0 — нет).
 */
export function preflopPot({ bb, ante = 0, action = 'none', raiseTo = 0, heroMove = null, players = 2, heroKey = '', headsUp = false }) {
  // Повышал первым ты (до тебя пас или лимпы) — банк от твоего повышения; если повышали до тебя —
  // считаем, что ты уравнял (3-бет и больше — поправишь банк сам).
  const heroOpened = (action === 'none' || action === 'limp') && heroMove
    && ['raise', 'allin'].includes(heroMove.action) && heroMove.amount > 0;
  let level;
  if (heroOpened) level = heroMove.amount;
  else if (action === 'raise' || action === '3bet') level = raiseTo;
  else level = bb; // лимпы или чек на ББ
  const deadSB = headsUp || heroKey === 'SB' ? 0 : bb / 2;
  return level * players + deadSB + ante;
}

/**
 * Сколько ушло в банк на улице: ставка × все, кто её уравнял (оставшиеся соперники + ты).
 * Если ставил соперник (toCall) — считаем, что ты уравнял (не повысил: повышение — поправишь банк сам).
 * Если соперник не ставил, а совет был «ставка» — считаем, что ставил ты и тебя уравняли.
 */
export function streetMoney({ toCall = 0, heroMove = null, stayed = 1 }) {
  const heroBet = heroMove && ['bet', 'allin'].includes(heroMove.action) ? heroMove.amount || 0 : 0;
  const level = toCall > 0 ? toCall : heroBet;
  return level * (stayed + 1);
}

/**
 * Банк на текущей улице.
 * flopPot — банк на флопе (preflopPot); streets — прошедшие улицы после флопа:
 * [{ toCall, heroMove, opponents }] (opponents — сколько соперников было на этой улице);
 * opponentsNow — соперников сейчас; fix — ручная поправка { street, value } (street: 0 флоп, 1 тёрн, 2 ривер).
 */
export function currentPot({ flopPot, streets = [], opponentsNow = 1, fix = null }) {
  const street = streets.length;
  const opp = (i) => (i < street ? streets[i].opponents : opponentsNow);
  let pot = flopPot, from = 0;
  if (fix && fix.street <= street) { pot = fix.value; from = fix.street; }
  for (let i = from; i < street; i++) pot += streetMoney({ ...streets[i], stayed: opp(i + 1) });
  return pot;
}
