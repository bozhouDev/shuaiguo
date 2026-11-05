import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Mulberry32 } from '../assets/scripts/core/random.ts';
// 对同一实现重置种子后复现完整随机序列，不再依赖原型随机数实现。
test('mulberry32 同种子逐项复现（每种子 1000 次）', () => {
  for (const seed of [0, 1, 1001, 20261103, 0xffffffff]) {
    const random = new Mulberry32(seed), first = Array.from({ length: 1000 }, () => random.next());
    random.setState(seed);
    assert.deepEqual(Array.from({ length: 1000 }, () => random.next()), first, `seed=${seed}`);
  }
});
