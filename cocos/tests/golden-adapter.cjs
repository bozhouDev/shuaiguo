// 用法：node tests/golden/verify.cjs --adapter cocos/tests/golden-adapter.cjs。
// 和 record.cjs 一样：空存档、auto/simulating=true、无带教、只 update(1/60) 到 S.over。
// 不调用原型；snapshot/normalize 逐字采用 record.cjs 规则，适配器只读 core 状态。
require('./register-core.cjs');
const { Match } = require('../assets/scripts/core/match.ts');
const {levelForMatch} = require('../assets/scripts/core/remote-config.ts');
const DT = 1 / 60;
function normalize(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? (+value.toFixed(4) || 0) : String(value);
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, normalize(v)]));
  return value;
}
// 用稳定的身份引用替代对象环，其他字段完整保存，便于移植时排查遗漏的内部状态。
function snapshot(ctx, s, step, final = false) {
  const refs = new Map(s.agents.map(a => [a, { agent: a.id }]));
  s.leaders.forEach((l, i) => refs.set(l, { leader: i, type: l.type }));
  function pack(value) {
    if (refs.has(value)) return refs.get(value);
    if (typeof value === 'function') return pack(value()); // arcs.to 是尾巴位置查询，无副作用。
    if (Object.prototype.toString.call(value) === '[object Set]') return { set: Array.from(value, v => pack(v)) };
    if (Array.isArray(value)) return value.map(v => pack(v));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, pack(v)]));
    return value;
  }
  const agents = s.agents.map(a => ({
    id: a.id, key: a.key, x: a.sn.x, y: a.sn.y, angle: a.sn.angle,
    pots: a.sn.segs.map(p => ({ label: p.label, remaining: p.due - s.t, hot: p.hot, passAt: p.passAt ?? null })),
    blames: a.blames, crushed: a.crushed, caught: a.caught, thrown: a.thrown,
    misses: a.misses, parries: a.parries, piesEaten: a.piesEaten,
    aiTarget: a.target ? a.target.id : null,
  }));
  const leaders = s.leaders.map(l => ({ type: l.type, x: l.x, y: l.y, face: l.face, state: l.state,
    targets: l.targets.map(a => a.id), chase: l.chase ? l.chase.id : null,
    meeting: pack(l.meeting || null), afterMeetingHot: !!l.afterMeetingHot,
    rageUntil: l.rageUntil || 0, inspectUntil: l.inspectUntil || 0,
    rage: (l.rageUntil || 0) > s.t, inspect: (l.inspectUntil || 0) > s.t,
  }));
  // 对局级字段包含剩余日程、进度与临时事件；表扬和纯动画列表不进入玩法快照。
  const state = Object.fromEntries(Object.entries(s).filter(([key]) =>
    !['player', 'bots', 'agents', 'leaders', 'arcs', 'fx', 'praiseAt', 'outSince'].includes(key)));
  return normalize({ step, final, ...pack(state), agents, leaders,
    ranking: Array.from(ctx.TEST.ranking(), a => a.id), rng: ctx.E.rngState() });
}

// 对局事件按 harness 的原始调用时间复制，额外的画面事件不进入旧录像契约。
function runCase(level, seed) {
  const events = [], kinds = new Set(['sfx', 'toast', 'buzz', 'floats', 'showMsg', 'showHint', 'spawnFx']);
  // 空远程配置也走正式开局的参数快照注入，必须仍与冻结原型100/100一致。
  const match = new Match({ level, levelParams: levelForMatch(level,{version:0,levels:{}}), seed, auto: true, simulating: true, onEvent(event) {
    if (kinds.has(event.kind)) events.push({ t: event.t, kind: event.kind, args: JSON.parse(JSON.stringify(event.args)) });
  } });
  const s = match.S, snapshots = [], ctx = { TEST: match, E: match.E };
  let step = 0;
  while (!s.over) {
    match.update(DT); step++;
    if (step % 30 === 0) snapshots.push(snapshot(ctx, s, step));
    if (step > 60 * 180) throw new Error(`对局没有结束：关卡=${level} 种子=${seed}`);
  }
  const final = snapshot(ctx, s, step, true);
  snapshots.push(final);
  return { version: 1, level, seed, dt: DT, snapshots, events: normalize(events),
    result: { t: final.t, over: s.over, ranking: final.ranking, player: final.agents[0], rng: final.rng } };
}
module.exports = { runCase };
