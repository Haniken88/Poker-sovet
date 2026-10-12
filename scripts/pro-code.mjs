// Новые коды «Pro навсегда»: node scripts/pro-code.mjs [сколько, по умолчанию 1]
// Печатает код (выдать покупателю) и хеш (вставить в CODE_HASHES в src/pro.js и выложить).
// Сами коды в репозиторий НЕ класть — он публичный.
import crypto from 'node:crypto';
const ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // без O/0, I/1 — чтобы не путали
const n = Number(process.argv[2]) || 1;
for (let i = 0; i < n; i++) {
  let s = ''; for (let k = 0; k < 8; k++) s += ABC[crypto.randomInt(ABC.length)];
  const code = `PRO-${s.slice(0, 4)}-${s.slice(4)}`;
  console.log(code, crypto.createHash('sha256').update(code).digest('hex'));
}
