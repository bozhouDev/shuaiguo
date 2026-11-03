// 与 tests/random.cjs 的每条断言对应，模拟入口改为对局持有的方法。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../assets/scripts/core/match.ts';
test('随机序列、零种子、表现隔离、模拟复现及异常恢复与原型契约相同', () => {
  const m = new Match({ seed: 1001 }),
    E = m.E;
  E.seed(1001);
  const start = E.rngState(),
    sequence = Array.from({ length: 100 }, () => E.random());
  assert(sequence.every((n) => n >= 0 && n < 1));
  E.seed(1001);
  assert.deepEqual(
    Array.from({ length: 100 }, () => E.random()),
    sequence
  );
  E.setRngState(start);
  assert.equal(E.random(), sequence[0]);
  E.seed(0);
  assert.equal(E.random(), 0.26642920868471265);
  const beforeFx = E.rngState();
  E.fxRand(-5, 5);
  assert.equal(E.rngState(), beforeFx);
  const a = JSON.stringify(m.simulate(0, 2, 1001));
  assert.equal(E.rngState(), beforeFx);
  assert.equal(JSON.stringify(m.simulate(0, 2, 1001)), a);
  const random = E.random,
    keep = m.S;
  E.random = () => {
    throw new Error('模拟异常');
  };
  assert.throws(() => m.simulate(0, 1, 999), /模拟异常/);
  assert.equal(E.rngState(), beforeFx);
  assert.equal(m.S, keep);
  E.random = random;
  m.simulate(0, 1);
  assert.notEqual(E.rngState(), beforeFx);
});
