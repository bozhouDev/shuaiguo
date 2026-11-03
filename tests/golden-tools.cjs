// 录像工具契约：四位小数在 JSON 往返后不误报，比较器能找出字段和数组差异。
const assert = require('node:assert/strict');
const { normalize, runCase, compact } = require('./golden/record.cjs');
const { firstDiff } = require('./golden/verify.cjs');
const { setup } = require('./game-harness.cjs');
assert.equal(Object.is(normalize(-0.00001), -0), false);
assert.equal(firstDiff(JSON.parse(JSON.stringify(normalize([-0.00001, Infinity]))), normalize([-0.00001, Infinity])), null);
assert.deepEqual(firstDiff({ snapshots: [{ x: 1 }] }, { snapshots: [{ x: 2 }] }),
  { field: '$.snapshots[0].x', old: 1, fresh: 2 });
assert.equal(firstDiff([1], [1, 2]).field, '$.length');
assert.equal(firstDiff({ x: 1 }, {}).field, '$.x');
// 单局只跑真实 update；漏掉的 Math.random 调用必须立即暴露。
const { ctx, events } = setup(true, { events: true });
ctx.Math.random = () => { throw new Error('对局路径用了非种子随机'); };
ctx.E.seed(1001);
const s = ctx.TEST.init(3, true);
while (!s.over) ctx.TEST.update(1 / 60);
for (const kind of ['sfx', 'toast', 'buzz', 'showMsg', 'showHint', 'floats', 'spawnFx']) assert(events.some(e => e.kind === kind), kind);
assert(!events.some(e => /praise/i.test(e.kind)));
const record = runCase(0, 1001), frames = record.snapshots;
assert.equal(frames[0].step, 30); assert.equal(frames[0].t, 0.5);
assert.equal(frames.at(-1).final, true); assert.equal(frames.at(-1).over, 'time');
assert.equal(frames.at(-1).t, 70);
assert(frames.slice(0, -1).every(f => f.step % 30 === 0));
assert(!('praiseAt' in frames[0])); assert(!('outSince' in frames[0]));
const changed = structuredClone(record); changed.snapshots[0].agents[0].x++;
assert.equal(firstDiff(record, changed).field, '$.snapshots[0].agents[0].x');
assert.equal(firstDiff(compact(record), compact(changed)).field, '$.snapshots[0].hash');
console.log('PASS 四位小数/JSON往返、差异定位、全部事件入口、禁用非种子随机、快照时点与哈希分支');
