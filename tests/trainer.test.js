// Тренажёр (src/trainer.js): ответ = совет приложения, спорных мест нет, вариантов хватает, «пас» не угадывается вслепую.
import test from 'node:test';
import assert from 'node:assert/strict';
import { nextQuestion, TOPICS } from '../src/trainer.js';
import { preflopAdvice } from '../src/preflop.js';
import { seededRandom } from '../src/equity.js';

test('правильный ответ всегда совпадает с советом приложения и есть среди кнопок', () => {
  const rnd = seededRandom(42);
  for (const [topic] of TOPICS) for (let i = 0; i < 300; i++) {
    const q = nextQuestion(topic, rnd);
    assert.ok(q.options.includes(q.correct), `${topic}: нет кнопки ${q.correct}`);
    assert.equal(q.options.length, q.topic === 'vsShove' ? 2 : 4);
    assert.ok(!q.advice.close, 'спорное место попало в вопросы');
    const again = preflopAdvice({ hero: q.hero, position: q.position, action: q.topic === 'short' || q.topic === 'open' ? 'none' : 'raise',
      raiseTo: q.topic === 'vsShove' ? q.stackBB : q.raiseTo, bigBlind: 1, stack: q.stackBB, opener: q.opener, ante: q.ante });
    assert.equal(again.action, q.advice.action);
  }
});

test('до тебя действуют только те, кто ходит раньше; повысивший — один', () => {
  const rnd = seededRandom(7);
  for (let i = 0; i < 300; i++) {
    const q = nextQuestion('mix', rnd);
    const acts = Object.values(q.seatsActs);
    assert.ok(acts.filter((a) => a !== 'fold').length <= 1);
    assert.equal(q.seatsActs[q.offset], undefined, 'у тебя самого не может быть действия');
  }
});

test('«пас» правильный не больше чем в ~60 % вопросов любой темы', () => {
  const rnd = seededRandom(3);
  for (const [topic] of TOPICS) {
    let folds = 0; for (let i = 0; i < 400; i++) if (nextQuestion(topic, rnd).correct === 'fold') folds++;
    assert.ok(folds / 400 < 0.62, `${topic}: пас в ${Math.round(folds / 4)} %`);
  }
});
