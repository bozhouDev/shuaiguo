// 用法：node tests/golden/verify.cjs；只读基准，任一差异退出 1，成功退出 0。
// 将来 TS 版：node tests/golden/verify.cjs --adapter ./路径/ts-adapter.cjs
// 适配器导出 runCase(level, seed)，返回与 record.cjs 一致的结构；哈希仍由本脚本生成。
// 完整录像报告字段路径、新旧值；精简录像报告首次不同的快照/事件哈希及对应时间。
// 定向检查：--level 0 --seed 1001；--data /目录 可验证副本，不覆盖正式录像。
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { runCase, compact } = require('./record.cjs');
// 按保存顺序递归比较，长度、缺失字段和类型也必须相同。
function firstDiff(old, fresh, field = '$') {
  if (Object.is(old, fresh)) return null;
  if (!old || !fresh || typeof old !== 'object' || typeof fresh !== 'object' || Array.isArray(old) !== Array.isArray(fresh)) return { field, old, fresh };
  if (Array.isArray(old) && old.length !== fresh.length) return { field: field + '.length', old: old.length, fresh: fresh.length };
  const keys = [...new Set([...Object.keys(old), ...Object.keys(fresh)])];
  for (const k of keys) {
    const diff = firstDiff(old[k], fresh[k], field + (Array.isArray(old) ? `[${k}]` : `.${k}`));
    if (diff) return diff;
  }
  return null;
}
// 按清单重跑，遇到第一处差异就报告并返回失败。
function verify() {
  const args = process.argv.slice(2), option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
  const dir = path.resolve(option('--data') || __dirname);
  const runner = option('--adapter') ? require(path.resolve(option('--adapter'))).runCase : runCase;
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json')));
  const cases = manifest.cases.filter(c => (option('--level') === undefined || c.level === +option('--level')) && (option('--seed') === undefined || c.seed === +option('--seed')));
  if (!cases.length) throw new Error('没有匹配的录像');
  let count = 0;
  for (const c of cases) {
    const old = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, c.file))));
    const record = runner(c.level, c.seed), fresh = c.compact ? compact(record) : record;
    const diff = firstDiff(old, fresh);
    if (diff) {
      const match = diff.field.match(/\.(snapshots|events)\[(\d+)\]/);
      const time = match ? (old[match[1]][+match[2]] || fresh[match[1]][+match[2]])?.t : old.result.t;
      console.error(JSON.stringify({ level: c.level, seed: c.seed, time, ...diff },
        (_key, value) => value === undefined ? '<undefined>' : value, 2));
      process.exitCode = 1; return;
    }
    count++;
    if (count % 20 === 0) console.log(`已核对 ${count}/${cases.length} 组`);
  }
  console.log(`PASS ${count}/${cases.length} 组黄金录像完全一致（快照 + 事件 + 最终结果）`);
}
if (require.main === module) verify();
module.exports = { firstDiff };
