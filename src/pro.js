// Pro (2026-10-12): 7 дней бесплатно с первого запуска, потом «Pro навсегда» по коду разблокировки.
// Код хранится только хешем (SHA-256): из публичного кода его не узнать. Новые коды — scripts/pro-code.mjs.
// Замки Pro включены? Пока false (решение владельца 2026-10-12): кнопки и экран Pro есть, но всё открыто для всех.
// Включить продажи: true — тогда с этого момента у каждого начнётся пробная неделя.
export const PRO_ENFORCED = false;
export const TRIAL_DAYS = 7;
export const PRO_PRICE = 490;
// Короткий стек (до этого числа ББ) — советы «ва-банк или пас» в Pro.
export const SHORT_STACK_PRO_BB = 20;

const CODE_HASHES = new Set([
  '450cf875a824b0eb075bf2a89946fc15790ab776096549a7244c13e86c1bce71', // владелец
]);

/** store — { trialStart, unlocked } из памяти телефона; now — время (для тестов). */
export function proStatus(store = {}, now = Date.now(), enforced = PRO_ENFORCED) {
  if (store.unlocked) return { pro: true, kind: 'bought' };
  if (!enforced) return { pro: true, kind: 'open' };
  const start = store.trialStart || now;
  const daysLeft = TRIAL_DAYS - Math.floor((now - start) / 864e5);
  return daysLeft > 0 ? { pro: true, kind: 'trial', daysLeft } : { pro: false, kind: 'free', daysLeft: 0 };
}

export const normalizeCode = (code) => String(code).toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^PRO/, 'PRO-').replace(/^(PRO-.{4})/, '$1-');

/** digest — функция (text) => Promise<hex SHA-256>; в браузере crypto.subtle, в тестах node:crypto. */
export async function checkCode(code, digest) {
  return CODE_HASHES.has(await digest(normalizeCode(code)));
}
