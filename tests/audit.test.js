// Большая проверка советов (scripts/audit.mjs): 600 раздач до флопа, 300 после, «дыры», сильные руки, сверка с солверами.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('большая проверка: нет ошибок, дыр и пасов с сильными руками', () => {
  let out = '';
  try { out = execFileSync(process.execPath, [new URL('../scripts/audit.mjs', import.meta.url).pathname], { encoding: 'utf8' }); }
  catch (err) { assert.fail(`audit.mjs нашёл проблемы:\n${err.stdout}`); }
  assert.match(out, /Проблем: 3 /); // только 3 известные поправки живой игры (HJ: A8o, JTo, J8s)
});
