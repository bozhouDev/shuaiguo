// 逐帧哈希、完整检查点、输入、事件、所有结算及存档严格比对。旧 verify 不变。
const path = require('node:path');
const { firstDiff } = require('./verify.cjs');
const x = require('./extra.cjs');
const { read, option, loadManifest, selectCases, ensureCase } = require('./record-extra.cjs');

// 缺失基准先从冻结原型重建并核对清单哈希，再按原有规则执行原型或 TS 比对。
function verify() {
  const args = process.argv.slice(2);
  const factory = option(args, '--adapter')
    ? require(path.resolve(option(args, '--adapter'))).factory
    : undefined;
  const manifest = loadManifest(args),
    cases = selectCases(manifest, args);
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i],
      old = ensureCase(c, manifest);
    const replay = factory
      ? old
      : c.config.kind === 'input' && !c.config.aim
        ? ensureCase(
            manifest.cases.find((other) => x.id(other.config) === x.id({ ...c.config, aim: true })),
            manifest
          )
        : undefined;
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
