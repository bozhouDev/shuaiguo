// 用法：node tests/golden/record.cjs；录 0–4 关 × 1001–1020，输出本目录录像及 manifest.json。
// dt 固定 1/60 秒；每 30 步和结束时记录（结束恰逢第 30 步仍另记结束快照）。
// 裁定口径：auto=true、simulating=true、makeState(false)，跳过带教和整个表扬贴纸路径。
// praise / checkPraiseRank / E.praise 以及贴纸带出的音效、震动不进录像，由 TS 画面层人工验收。
// 每组使用独立空存档，老板称呼固定为“老板”；不运行 finish / HUD / 下班过场，只跑到 S.over。
// 事件记录接口调用意图（时间与参数），不代表音频实际播放或 DOM 展示成功。
// gzip 总量超过 8 MiB 时，只保留 1001–1005 的完整录像，其余保留快照哈希、事件哈希与最终结果。
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const { setup } = require('../game-harness.cjs');
const DT = 1 / 60, DIR = __dirname, LIMIT = 8 * 1024 * 1024;
// 所有浮点统一四位小数；特殊数显式保存，避免 JSON 静默转成 null。
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
// 单组执行器也供 verify 及将来的 TS 适配器复用契约：返回同结构的 snapshots / events / result。
function runCase(level, seed) {
  const { ctx, events } = setup(true, { events: true });
  ctx.E.seed(seed);
  const s = ctx.TEST.init(level, true), snapshots = [];
  let step = 0;
  while (!s.over) {
    ctx.TEST.update(DT); step++;
    if (step % 30 === 0) snapshots.push(snapshot(ctx, s, step));
    if (step > 60 * 180) throw new Error(`对局没有结束：关卡=${level} 种子=${seed}`);
  }
  const final = snapshot(ctx, s, step, true);
  snapshots.push(final);
  return { version: 1, level, seed, dt: DT, snapshots, events: normalize(events),
    result: { t: final.t, over: s.over, ranking: final.ranking, player: final.agents[0], rng: final.rng } };
}
// 精简录像对规范化后的 JSON 内容计算 SHA-256。
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
// 哈希录像同时保留时间和步号，使第一次差异仍能定位到关卡、种子和时刻。
function compact(record) {
  return { ...record, snapshots: record.snapshots.map(s => ({ step: s.step, t: s.t, final: s.final, hash: hash(s) })),
    events: record.events.map(e => ({ t: e.t, kind: e.kind, hash: hash(e) })), compact: true };
}
const filename = (level, seed) => `level-${level}-seed-${seed}.json.gz`;
// 分两遍决定存储策略，验证器不会重新生成或覆盖基准。
function recordAll() {
  const cases = [], durations = Array.from({ length: 5 }, () => []);
  let fullBytes = 0;
  for (let level = 0; level < 5; level++) {
    for (let seed = 1001; seed <= 1020; seed++) {
      const record = runCase(level, seed), file = filename(level, seed);
      const data = zlib.gzipSync(JSON.stringify(record));
      fs.writeFileSync(path.join(DIR, file), data); fullBytes += data.length;
      cases.push({ level, seed, file, bytes: data.length, compact: false });
      durations[level].push(record.result.t);
    }
    console.log(`已录关卡 ${level}，20 组`);
  }
  if (fullBytes > LIMIT) for (const c of cases.filter(c => c.seed > 1005)) {
    const file = path.join(DIR, c.file), record = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)));
    const data = zlib.gzipSync(JSON.stringify(compact(record)));
    fs.writeFileSync(file, data); c.bytes = data.length; c.compact = true;
  }
  const manifest = { version: 1, dt: DT, intervalSteps: 30, emptyStorage: true, praiseExcluded: true,
    fullBytes, bytes: cases.reduce((n, c) => n + c.bytes, 0),
    averageDuration: durations.map(ts => normalize(ts.reduce((a, b) => a + b, 0) / ts.length)), cases };
  fs.writeFileSync(path.join(DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify({ fullBytes, bytes: manifest.bytes, averageDuration: manifest.averageDuration }));
}
if (require.main === module) recordAll();
module.exports = { runCase, compact, hash, normalize };
