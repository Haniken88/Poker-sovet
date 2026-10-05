// Позиция за столом. offset — сколько мест от баттона по часовой стрелке
// (0 = баттон, 1 = малый блайнд, 2 = большой блайнд, дальше ранние места).

/**
 * Возвращает { key, name, group, behind }:
 * behind — сколько игроков ходят после тебя префлоп (меньше = позиция лучше).
 */
export function positionInfo(players, offset) {
  if (players < 2 || players > 10) throw new Error('За столом должно быть от 2 до 10 игроков');
  if (offset < 0 || offset >= players) throw new Error('Нет такого места');

  if (players === 2) {
    return offset === 0
      ? { key: 'BTN', name: 'Баттон (он же малый блайнд)', group: 'late', behind: 2 }
      : { key: 'BB', name: 'Большой блайнд', group: 'blinds', behind: 0 };
  }
  if (offset === 0) return { key: 'BTN', name: 'Баттон', group: 'late', behind: 2 };
  if (offset === 1) return { key: 'SB', name: 'Малый блайнд', group: 'blinds', behind: 1 };
  if (offset === 2) return { key: 'BB', name: 'Большой блайнд', group: 'blinds', behind: 0 };

  const behind = players + 2 - offset;
  const fromEnd = players - 1 - offset; // 0 = катофф, 1 = хайджек, 2 = лоуджек
  if (fromEnd === 0) return { key: 'CO', name: 'Поздняя (катофф)', group: 'late', behind };
  if (fromEnd === 1) return { key: 'HJ', name: 'Средняя (хайджек)', group: 'middle', behind };
  if (fromEnd === 2) return { key: 'LJ', name: 'Средняя (лоуджек)', group: 'middle', behind };
  const step = offset - 3;
  const key = step === 0 ? 'UTG' : `UTG+${step}`;
  return { key, name: `Ранняя (${key})`, group: 'early', behind };
}
