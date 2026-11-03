// 种子接口与模拟隔离回归：用真实引擎检查序列、恢复及异常退出。
const assert = require('node:assert/strict');
const { setup } = require('./game-harness.cjs');
const { ctx } = setup(), E = ctx.E;
E.seed(1001);
const start = E.rngState(), sequence = Array.from({ length: 100 }, () => E.random());
assert(sequence.every(n => n >= 0 && n < 1));
E.seed(1001);
assert.deepEqual(Array.from({ length: 100 }, () => E.random()), sequence);
E.setRngState(start);
assert.equal(E.random(), sequence[0]);
E.seed(0);
assert.equal(E.random(), 0.26642920868471265); // mulberry32 的已知首值，包含零种子。
const beforeFx = E.rngState();
E.fxRand(-5, 5);
assert.equal(E.rngState(), beforeFx);
const a = JSON.stringify(ctx.SG_DEBUG.simulate(0, 2, 1001));
assert.equal(E.rngState(), beforeFx);
assert.equal(JSON.stringify(ctx.SG_DEBUG.simulate(0, 2, 1001)), a);
const random = E.random;
E.random = () => { throw new Error('模拟异常'); };
assert.throws(() => ctx.SG_DEBUG.simulate(0, 1, 999), /模拟异常/);
assert.equal(E.rngState(), beforeFx);
E.random = random;
ctx.SG_DEBUG.simulate(0, 1);
assert.notEqual(E.rngState(), beforeFx); // 无种子模拟继续消费当前随机流。
console.log('PASS 随机序列、零种子、表现隔离、模拟复现及异常恢复');
