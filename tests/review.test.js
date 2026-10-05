import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

// Прогон 43 типичных раздач: каждый совет совпадает с тем, что сделал бы нормальный игрок.
test('проверка советов на типичных раздачах — без расхождений', () => {
  const out = execFileSync('node', [new URL('../scripts/review.mjs', import.meta.url).pathname], { encoding: 'utf8' });
  assert.match(out, /Не совпало с ожиданием: 0 из/, out.split('\n').filter((l) => l.includes('❌')).join('\n'));
});
