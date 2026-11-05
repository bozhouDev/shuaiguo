// 逐帧哈希、完整检查点、输入、事件、所有结算及存档严格比对。
const path = require('node:path');
const { firstDiff } = require('./verify.cjs');
const x = require('./extra.cjs');
const { read, option, loadManifest, manifestPath, selectCases, assertHash } = require('./record-extra.cjs');

// 验证严格只读：录像缺失或哈希不符即失败，不补录，也不刷新清单。
function verify() {
  const args = process.argv.slice(2);
  const factory = option(args, '--adapter')
    ? require(path.resolve(option(args, '--adapter'))).factory
    : undefined;
  const manifest = loadManifest(args),
    dataDir = path.dirname(manifestPath(args)),
    cases = selectCases(manifest, args);
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    if (!require('node:fs').existsSync(path.join(dataDir, c.file)))
      throw Error(`录像缺失（验证只读，不自动录制）：${c.file}`);
    const old = read(c.file, dataDir);
    assertHash(c, old);
    const dependency = c.config.kind === 'input' && !c.config.aim
      ? manifest.cases.find((other) => x.id(other.config) === x.id({ ...c.config, aim: true }))
      : undefined;
    if (c.config.kind === 'input' && !c.config.aim && !dependency) throw Error(`缺少瞄准录像清单：${x.id(c.config)}`);
    const replay = dependency ? read(dependency.file, dataDir) : undefined;
    if (dependency) assertHash(dependency, replay);
    const fresh = x.run(c.config, factory, replay),
      diff = firstDiff(old, fresh);
    if (diff) {
      console.error(JSON.stringify({ case: x.id(c.config), ...diff }, null, 2));
      process.exitCode = 1;
      return;
    }
    if ((i + 1) % 10 === 0) console.log(`已核对 ${i + 1}/${cases.length}`);
  }
  console.log(`PASS ${cases.length}/${cases.length} 新录像（逐帧状态 + 输入 + 事件 + 结算 + 存档）`);
}

if (require.main === module) verify();
module.exports = { verify, read };
