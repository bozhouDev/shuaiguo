import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../assets/scripts/core/match.ts';
// 同一版 TS、同一批关卡与种子重复模拟，验证模拟入口稳定而不绑定旧原型的结果。
test('同种子模拟结果可重复', () => {
  const m = new Match({itemDrops:false, seed: 1001 });
  for (let level = 0; level < 5; level++) {
    const first = m.simulate(level, 50, 6011);
    assert.deepEqual(m.simulate(level, 50, 6011), first, `level=${level}`);
  }
});
