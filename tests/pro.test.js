// Pro: пробная неделя и коды разблокировки (src/pro.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { proStatus, checkCode, normalizeCode, TRIAL_DAYS } from '../src/pro.js';

const DAY = 864e5;
const digest = async (t) => crypto.createHash('sha256').update(t).digest('hex');

test('первые 7 дней — Pro бесплатно, потом бесплатная версия', () => {
  const now = Date.now();
  assert.deepEqual(proStatus({ trialStart: now }, now, true), { pro: true, kind: 'trial', daysLeft: TRIAL_DAYS });
  assert.equal(proStatus({ trialStart: now - 6.5 * DAY }, now, true).daysLeft, 1);
  assert.equal(proStatus({ trialStart: now - 7 * DAY }, now, true).pro, false);
  assert.equal(proStatus({ trialStart: now - 30 * DAY, unlocked: true }, now, true).kind, 'bought');
});

test('код вводится как угодно: маленькими буквами, без дефисов, с пробелами', () => {
  assert.equal(normalizeCode('pro abcd efgh'), 'PRO-ABCD-EFGH');
  assert.equal(normalizeCode('PROABCDEFGH'), 'PRO-ABCD-EFGH');
});

test('чужой код не подходит', async () => {
  assert.equal(await checkCode('PRO-AAAA-BBBB', digest), false);
  assert.equal(await checkCode('', digest), false);
});

test('пока продажи не включены — всё открыто для всех, неделя не тратится', () => {
  assert.deepEqual(proStatus({}, Date.now(), false), { pro: true, kind: 'open' });
  assert.deepEqual(proStatus({ trialStart: 1 }, Date.now(), false), { pro: true, kind: 'open' });
});
