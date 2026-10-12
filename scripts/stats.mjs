// Статистика посещений из GoatCounter для владельца: node scripts/stats.mjs [дней, по умолчанию 14]
// Ключ (только чтение) — в .env.local (GOATCOUNTER_KEY), файл не попадает в git.
import fs from 'node:fs';

const env = fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const key = env.match(/^GOATCOUNTER_KEY=(.+)$/m)?.[1]?.trim();
if (!key) throw new Error('Нет ключа GOATCOUNTER_KEY в .env.local');
const days = Number(process.argv[2]) || 14;
const day = (d) => d.toISOString().slice(0, 10);
const end = new Date(Date.now() + 864e5), start = new Date(Date.now() - (days - 1) * 864e5);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(path) {
  for (let i = 0; i < 5; i++) {
    const res = await fetch(`https://poker-sovet.goatcounter.com/api/v0/${path}${path.includes('?') ? '&' : '?'}start=${day(start)}&end=${day(end)}`,
      { headers: { Authorization: `Bearer ${key}` } });
    if (res.status === 429) { await sleep(1000); continue; } // ограничение частоты запросов
    if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
    return res.json();
  }
  throw new Error(`${path}: сервер просит подождать`);
}
const list = (stats) => stats.filter((s) => s.count).map((s) => `${s.name || s.id || 'напрямую (иконка, закладка, ссылка в чате)'} ${s.count}`).join(', ') || '—';

const hits = await get('stats/hits?limit=20');
const perDay = new Map();
let total = 0;
for (const h of hits.hits) {
  total += h.count;
  for (const s of h.stats) perDay.set(s.day, (perDay.get(s.day) || 0) + s.daily);
}
console.log(`Посещения за ${days} дн. (${day(start)} — ${day(new Date())}): ${total}`);
console.log('По дням:', [...perDay].filter(([, n]) => n).map(([d, n]) => `${d.slice(5)}: ${n}`).join(', ') || 'нет');
for (const [name, path] of [['Устройства', 'sizes'], ['Системы', 'systems'], ['Браузеры', 'browsers'], ['Страны', 'locations'], ['Откуда пришли', 'toprefs']]) {
  await sleep(400);
  console.log(`${name}:`, list((await get(`stats/${path}`)).stats));
}
