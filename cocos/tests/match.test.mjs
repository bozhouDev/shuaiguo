import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../assets/scripts/core/match.ts';
const plain = value => JSON.parse(JSON.stringify(value));

// 取未四舍五入的玩法状态，包含轨迹、对象身份引用和所有事件，检验同时多局不串状态。
function stateOf(m) {
  const refs = new Map(m.S.agents.map(a => [a, { agent: a.id }]));
  m.S.leaders.forEach((l, i) => refs.set(l, { leader: i }));
  function pack(v) {
    if (refs.has(v)) return refs.get(v);
    if (typeof v === 'function') return '<回调>';
    if (v instanceof Set) return [...v].map(pack);
    if (Array.isArray(v)) return v.map(pack);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, value]) => [k, pack(value)]));
    return v;
  }
  return { state: pack(m.S), agents: m.S.agents.map(a => pack({ ...a })),
    leaders: m.S.leaders.map(l => pack({ ...l })), rng: m.E.rngState(), hintTimer: m.hintTimer, msgTimer: m.msgTimer };
}
// 跑到时间或压垮，沿用黄金录像的固定步长；上限防止测试无声挂死。
function complete(m) {
  for (let step = 0; !m.S.over && step <= 10800; step++) m.update(1 / 60);
  assert.ok(m.S.over);
}

test('不同关卡和种子的两局交错推进，完整状态与分别单跑逐项一致', () => {
  const options = [{ level: 0, seed: 1001, auto: true, simulating: true }, { level: 4, seed: 1017, auto: true, simulating: true }];
  const solo = options.map(o => { const events = []; const m = new Match({itemDrops:false, ...o, onEvent: e => events.push(e) }); complete(m); return { state: stateOf(m), events }; });
  const events = [[], []];
  const pair = options.map((o, i) => new Match({itemDrops:false, ...o, onEvent: e => events[i].push(plain(e)) }));
  for (let step = 0; pair.some(m => !m.S.over) && step <= 10800; step++) {
    // 每帧反向交错，避免固定的先后次序掩盖共享随机流。
    for (const i of step % 2 ? [0, 1] : [1, 0]) if (!pair[i].S.over) pair[i].update(1 / 60);
  }
  pair.forEach((m, i) => { assert.ok(m.S.over); assert.deepEqual({ state: stateOf(m), events: events[i] }, solo[i]); });
});

test('传入的进度和另一局不被本局结算修改，返回计算结果可由调用方保存', () => {
  const progress = { unlocked: 1, best: {} };
  const first = new Match({itemDrops:false, seed: 1001, level: 0, auto: true, simulating: true, progress });
  const other = new Match({itemDrops:false, seed: 1001, level: 0, progress });
  complete(first);
  const result = first.calculateResult(first.S.over);
  const repeated = new Match({itemDrops:false, seed: 1001, level: 0, auto: true, simulating: true, progress });
  complete(repeated);
  assert.deepEqual(result, repeated.calculateResult(repeated.S.over));
  assert.deepEqual(result.rank.map(a => a.id), Array.from(first.ranking(), a => a.id));
  assert.deepEqual(progress, { unlocked: 1, best: {} });
  assert.deepEqual(other.loadProgress(), progress);
  assert.deepEqual(first.loadProgress(), progress);
});
