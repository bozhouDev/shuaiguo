// 用法：在 cocos/ 下 npm run golden:record；通过 TS adapter 录 0–4 关 × 1001–1020。
// dt 固定 1/60 秒；每 30 步和结束时记录（结束恰逢第 30 步仍另记结束快照）。
// 裁定口径由 cocos/tests/golden-adapter.cjs 唯一实现：auto=true、simulating=true、跳过带教。
// praise / checkPraiseRank / E.praise 以及贴纸带出的音效、震动不进录像，由 TS 画面层人工验收。
// 每组使用独立空存档，老板称呼固定为“老板”；不运行 finish / HUD / 下班过场，只跑到 S.over。
// 事件记录接口调用意图（时间与参数），不代表音频实际播放或 DOM 展示成功。
// gzip 总量超过 8 MiB 时，只保留 1001–1005 的完整录像，其余保留快照哈希、事件哈希与最终结果。
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const DT = 1 / 60, DIR = __dirname, LIMIT = 8 * 1024 * 1024;
// 录像执行时才载入 TS adapter；读取 hash/compact 的纯工具不依赖 Node TS loader。
function runCase(level, seed) {
  return require('../../cocos/tests/golden-adapter.cjs').runCase(level, seed);
}
// 所有浮点统一四位小数；特殊数显式保存，避免 JSON 静默转成 null。
function normalize(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? (+value.toFixed(4) || 0) : String(value);
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, normalize(v)]));
  return value;
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
      cases.push({ level, seed, file, bytes: data.length, sha256: crypto.createHash('sha256').update(data).digest('hex'), compact: false });
      durations[level].push(record.result.t);
    }
    console.log(`已录关卡 ${level}，20 组`);
  }
  if (fullBytes > LIMIT) for (const c of cases.filter(c => c.seed > 1005)) {
    const file = path.join(DIR, c.file), record = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)));
    const data = zlib.gzipSync(JSON.stringify(compact(record)));
    fs.writeFileSync(file, data); c.bytes = data.length; c.sha256 = crypto.createHash('sha256').update(data).digest('hex'); c.compact = true;
  }
  const manifest = { version: 1, dt: DT, intervalSteps: 30, emptyStorage: true, praiseExcluded: true,
    fullBytes, bytes: cases.reduce((n, c) => n + c.bytes, 0),
    averageDuration: durations.map(ts => normalize(ts.reduce((a, b) => a + b, 0) / ts.length)), cases };
  fs.writeFileSync(path.join(DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify({ fullBytes, bytes: manifest.bytes, averageDuration: manifest.averageDuration }));
}
if (require.main === module) recordAll();
module.exports = { runCase, compact, hash, normalize };
