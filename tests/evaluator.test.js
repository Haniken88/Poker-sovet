import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCards } from '../src/cards.js';
import { evaluate, categoryOf, handName, CATEGORY } from '../src/evaluator.js';

const value = (text) => evaluate(parseCards(text));
const category = (text) => categoryOf(value(text));
const stronger = (a, b) => assert.ok(value(a) > value(b), `${a} должна быть сильнее ${b}`);
const equal = (a, b) => assert.equal(value(a), value(b), `${a} и ${b} должны быть равны`);

test('все комбинации узнаются', () => {
  assert.equal(category('As Kd 9h 7c 2s 3d 4h'), CATEGORY.HIGH_CARD);
  assert.equal(category('As Ad 9h 7c 2s 3d Jh'), CATEGORY.PAIR);
  assert.equal(category('As Ad 9h 9c 2s 3d Jh'), CATEGORY.TWO_PAIR);
  assert.equal(category('As Ad Ah 9c 2s 3d Jh'), CATEGORY.TRIPS);
  assert.equal(category('5s 6d 7h 8c 9s Kd 2h'), CATEGORY.STRAIGHT);
  assert.equal(category('2s 7s 9s Js Ks Ad 3h'), CATEGORY.FLUSH);
  assert.equal(category('As Ad Ah 9c 9s 3d Jh'), CATEGORY.FULL_HOUSE);
  assert.equal(category('As Ad Ah Ac 9s 3d Jh'), CATEGORY.QUADS);
  assert.equal(category('5h 6h 7h 8h 9h Kd 2c'), CATEGORY.STRAIGHT_FLUSH);
  assert.equal(handName(value('As Ad Ah Ac 9s')), 'Каре');
});

test('стрит с тузом снизу (колесо) — самый младший стрит', () => {
  assert.equal(category('As 2d 3h 4c 5s'), CATEGORY.STRAIGHT);
  stronger('2s 3d 4h 5c 6s', 'As 2d 3h 4c 5s');
  stronger('Ts Jd Qh Kc As', '9s Td Jh Qc Ks');
  assert.equal(category('Ah 2h 3h 4h 5h'), CATEGORY.STRAIGHT_FLUSH);
});

test('старшинство категорий', () => {
  stronger('2s 2d 3h 3c 4s', 'As Ad Kh Qc Js'); // две пары > пара
  stronger('2s 2d 2h 3c 4s', 'As Ad Kh Kc Js'); // сет > две пары
  stronger('2s 3d 4h 5c 6s', 'As Ad Ah Kc Qs'); // стрит > сет
  stronger('2s 4s 6s 8s 9s', 'Ts Jd Qh Kc As'); // флеш > стрит
  stronger('2s 2d 2h 3c 3s', 'As Ks Qs Js 9s'); // фулл-хаус > флеш
  stronger('2s 2d 2h 2c 3s', 'As Ad Ah Kc Ks'); // каре > фулл-хаус
});

test('кикеры решают', () => {
  stronger('As Ad Kh 9c 3s', 'Ah Ac Qh Jc Ts');
  stronger('Ks Kd 9h 9c As', 'Kh Kc 9s 9d Qs');
  stronger('As Ks Qs Js 9s', 'Ah Kh Qh Jh 8h');
  equal('As Kd Qh Jc 9s', 'Ad Ks Qc Jh 9d'); // делёж банка
});

test('из 7 карт берутся лучшие 5', () => {
  // Три пары: в счёт идут две старшие и лучший кикер.
  equal('As Ad Ks Kd Qs Qd 2c', 'Ah Ac Kh Kc Qh 3d 2s');
  // Две тройки = фулл-хаус со старшей тройкой.
  equal('9s 9d 9h 5c 5s 5d 2c', '9c 9h 9d 5h 5c 2s 3d');
  // Шестая карта стрита не мешает: берётся старший стрит.
  equal('4s 5d 6h 7c 8s 9d 2c', '5s 6d 7h 8c 9s 2d 2h');
  // Флеш из 6 карт масти — пять старших.
  equal('2s 4s 6s 8s Ts Qs 3d', '4s 6s 8s Ts Qs 2d 3h');
});

test('7 карт = лучшая из 21 пятёрки (случайные раздачи)', () => {
  let seed = 12345;
  const random = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
  for (let round = 0; round < 3000; round++) {
    const deck = Array.from({ length: 52 }, (_, i) => i);
    for (let i = 0; i < 7; i++) {
      const j = i + Math.floor(random() * (52 - i));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    const seven = deck.slice(0, 7);
    let best = 0;
    for (let a = 0; a < 7; a++) {
      for (let b = a + 1; b < 7; b++) {
        best = Math.max(best, evaluate(seven.filter((_, i) => i !== a && i !== b)));
      }
    }
    assert.equal(evaluate(seven), best);
  }
});

test('все 2 598 960 пятёрок: число каждой комбинации как в учебнике', () => {
  const expected = [1302540, 1098240, 123552, 54912, 10200, 5108, 3744, 624, 40];
  const found = new Array(9).fill(0);
  const hand = [0, 0, 0, 0, 0];
  for (hand[0] = 0; hand[0] < 52; hand[0]++)
    for (hand[1] = hand[0] + 1; hand[1] < 52; hand[1]++)
      for (hand[2] = hand[1] + 1; hand[2] < 52; hand[2]++)
        for (hand[3] = hand[2] + 1; hand[3] < 52; hand[3]++)
          for (hand[4] = hand[3] + 1; hand[4] < 52; hand[4]++)
            found[categoryOf(evaluate(hand))]++;
  assert.deepEqual(found, expected);
});
