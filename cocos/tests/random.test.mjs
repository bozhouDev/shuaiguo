import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { Mulberry32 } from '../assets/scripts/core/random.ts';

const require = createRequire(import.meta.url);
const { setup } = require('../../tests/game-harness.cjs');
const sourceDir = fileURLToPath(new URL('../../js/', import.meta.url));

// 使用真实原型引擎作对照，不能在测试里再抄一份随机算法。
test('mulberry32 与原型 E.random 逐项一致（每种子 1000 次）', () => {
  const { ctx } = setup(false, { sourceDir });
  for (const seed of [0, 1, 1001, 20261103, 0xffffffff]) {
    const random = new Mulberry32(seed);
    ctx.E.seed(seed);
    for (let i = 0; i < 1000; i++) {
      assert.equal(random.next(), ctx.E.random(), `seed=${seed}, index=${i}`);
    }
  }
});
