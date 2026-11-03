import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { Match } from '../assets/scripts/core/match.ts';
const require = createRequire(import.meta.url);
const { setup } = require('../../tests/game-harness.cjs');
const sourceDir = fileURLToPath(new URL('../../js/', import.meta.url));
// 原型真实统计作 oracle，不做四舍五入以外的误差容忍。
test('相同种子下五关各50局的模拟统计逐字段完全相同', () => {
  const { ctx } = setup(true, { sourceDir });
  const m = new Match({ seed: 1001 });
  for (let level = 0; level < 5; level++)
    assert.deepEqual(
      m.simulate(level, 50, 6011),
      JSON.parse(JSON.stringify(ctx.SG_DEBUG.simulate(level, 50, 6011))),
      `level=${level}`
    );
});
