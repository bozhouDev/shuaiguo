// 新录像只作本地缓存；清单中的完整录像 SHA-256 是只读基准，不随重录更新。
// 用法：node tests/golden/record-extra.cjs [--mode input,tutorial,buff,ad] [--case 录像名] [--resume]
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { hash } = require('./record.cjs');
const x = require('./extra.cjs');

// 对象键排序后序列化完整 JSON；数组顺序和浮点原值不变，不受 gzip 压缩差异影响。
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])])
    );
  }
  return value;
}

// 每组的哈希覆盖完整录像，而非仅帧摘要、检查点或结算。
function recordHash(record) {
  return hash(canonical(record));
}

// 共用参数读取，保持 verify-extra 原有的模式和单组筛选口径。
function option(args, name) {
  return args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
}

// 正常录制和自动重建都必须读取已有清单，绝不为新行为自动刷新基准。
function loadManifest(args) {
  return JSON.parse(
    fs.readFileSync(option(args, '--manifest') || path.join(__dirname, 'extra-manifest.json'))
  );
}

// 指定单组或模式时只处理匹配项；无瞄准组所需的瞄准录像由依赖入口补齐。
function selectCases(manifest, args) {
  const mode = option(args, '--mode'),
    name = option(args, '--case');
  const cases = manifest.cases.filter(
    (c) => (!mode || mode.split(',').includes(c.config.kind)) && (!name || x.id(c.config) === name)
  );
  if (!cases.length) throw Error('没有匹配的录像');
  return cases;
}

// 读取 gzip 后返回 JSON，沿用原有录像解析方式。
function read(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname, file))));
}

// 写入之前检查冻结基准；缓存已有内容也检查，避免把损坏文件当成可信 oracle。
function assertHash(entry, record) {
  const actual = recordHash(record);
  if (actual !== entry.sha256) {
    throw Error(
      `录像 SHA-256 不一致：${entry.file}，expected=${entry.sha256}，actual=${actual}；原型行为或本地录像发生变化`
    );
  }
}

// 缺失时只从原型重建，已有时只读取；两条路径都会核对完整录像哈希。
function ensureCase(entry, manifest) {
  if (!fs.existsSync(path.join(__dirname, entry.file))) {
    console.log(`自动重建 ${entry.file}`);
    return recordCase(entry, manifest);
  }
  const record = read(entry.file);
  assertHash(entry, record);
  return record;
}

// 重录单组；无瞄准对照必须重放对应瞄准组的输入，不能独立生成另一份输入。
function recordCase(entry, manifest) {
  const c = entry.config;
  let replay;
  if (c.kind === 'input' && !c.aim) {
    const dependency = manifest.cases.find((other) => x.id(other.config) === x.id({ ...c, aim: true }));
    if (!dependency) throw Error(`缺少瞄准组清单：${x.id(c)}`);
    replay = ensureCase(dependency, manifest);
  }
  const record = x.run(c, undefined, replay);
  assertHash(entry, record);
  const file = path.join(__dirname, entry.file);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, zlib.gzipSync(JSON.stringify(record)));
  return record;
}

// 一键重录全部或指定组；--resume 只补缺失缓存，但仍逐组核验 SHA-256。
function recordAll(args = process.argv.slice(2)) {
  const manifest = loadManifest(args),
    cases = selectCases(manifest, args);
  let bytes = 0;
  for (let i = 0; i < cases.length; i++) {
    const entry = cases[i];
    if (args.includes('--resume')) ensureCase(entry, manifest);
    else recordCase(entry, manifest);
    bytes += fs.statSync(path.join(__dirname, entry.file)).size;
    if ((i + 1) % 10 === 0) console.log(`已录 ${i + 1}/${cases.length}`);
  }
  console.log(`PASS 新录像 ${cases.length} 组，${bytes} bytes，SHA-256 全部一致（清单未改）`);
}

if (require.main === module) recordAll();
module.exports = { recordAll, recordHash, assertHash, ensureCase, loadManifest, selectCases, option, read };
