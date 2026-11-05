// 原型已退役；这里只检查黄金录像文件与各自 manifest 中的 SHA-256 是否自洽。
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const dir = path.join(root, 'tests/golden');
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}
function fileFor(base, file) {
  const full = path.resolve(base, file);
  if (!full.startsWith(base + path.sep)) throw Error(`manifest 路径越界：${file}`);
  return full;
}
function checkManifest(name, getHash) {
  const manifestPath = path.join(dir, name);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!Array.isArray(manifest.cases) || !manifest.cases.length) throw Error(`manifest 没有录像组：${name}`);
  const seen = new Set();
  for (const entry of manifest.cases) {
    if (typeof entry.file !== 'string' || seen.has(entry.file)) throw Error(`manifest 文件名缺失或重复：${name}`);
    seen.add(entry.file);
    if (!/^[a-f0-9]{64}$/.test(entry.sha256 || '')) throw Error(`manifest 缺少 SHA-256：${name} / ${entry.file}`);
    const actual = getHash(fileFor(dir, entry.file));
    if (actual !== entry.sha256) throw Error(`录像 SHA-256 与 manifest 不一致：${entry.file} expected=${entry.sha256} actual=${actual}`);
  }
  return manifest.cases.length;
}

const goldenCount = checkManifest('manifest.json', (file) =>
  crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'));
const extraCount = checkManifest('extra-manifest.json', (file) => {
  const record = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)));
  return crypto.createHash('sha256').update(JSON.stringify(canonical(record))).digest('hex');
});
console.log(`PASS TS 黄金录像哈希自洽：${goldenCount} 组常规 + ${extraCount} 组 extra（不与 HEAD 比较）`);
