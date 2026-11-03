// 只读新增录像，汇总实际计数，并比较使用相同输入的有/无帧末瞄准两组。
const fs = require('node:fs'),
  assert = require('node:assert/strict');
const { firstDiff } = require('./verify.cjs');
const { read } = require('./verify-extra.cjs'),
  x = require('./extra.cjs');
// 汇总清单的体积与覆盖计数，再用完整录像比较帧末瞄准的状态和结算影响。
function report() {
  const manifest = JSON.parse(fs.readFileSync(__dirname + '/extra-manifest.json'));
  const groups = {};
  let changed = 0,
    resultChanged = 0,
    first = null;
  for (const c of manifest.cases) {
    const key = c.config.kind === 'input' ? (c.config.aim ? '手动' : '无瞄准对照') : c.config.kind;
    const g = (groups[key] ??= { cases: 0, bytes: 0, frames: 0, coverage: {} });
    g.cases++;
    g.bytes += c.bytes;
    g.frames += c.frames;
    if (key === '手动')
      for (const [k, v] of Object.entries(c.coverage)) g.coverage[k] = (g.coverage[k] || 0) + v;
    if (c.config.kind === 'input' && c.config.aim) {
      const a = read(c.file),
        b = read('input/' + x.id({ ...c.config, aim: false }) + '.json.gz');
      g.coverage.sharpTurns =
        (g.coverage.sharpTurns || 0) +
        a.inputs
          .slice(1)
          .filter(
            (v, i) =>
              Math.abs(Math.atan2(Math.sin(v[1] - a.inputs[i][1]), Math.cos(v[1] - a.inputs[i][1]))) > 2
          ).length;
      if (JSON.stringify(a.frames) !== JSON.stringify(b.frames)) {
        changed++;
        first ??= {
          case: x.id(c.config),
          firstDifferentFrame: a.frames.findIndex((f, i) => f.hash !== b.frames[i]?.hash) + 1,
          checkpoint: firstDiff(a.checkpoints, b.checkpoints)
        };
      }
      if (JSON.stringify(a.settlements) !== JSON.stringify(b.settlements)) resultChanged++;
    }
  }
  // 手动玩家的每次按键只可能是甩出、被抓、反甩或按空，四个分支互斥且穷尽。
  const c = groups['手动'].coverage;
  c.whiffCalls = c.presses - c.launched - c.caught - c.parries;
  assert.equal(groups['手动'].cases, 50);
  assert.equal(groups['无瞄准对照'].cases, 50);
  assert.equal(groups.tutorial.cases, 2);
  assert.equal(groups.buff.cases, 60);
  assert.equal(groups.ad.cases, 15);
  for (const k of [
    'launched',
    'thrown',
    'parries',
    'caught',
    'whiffCalls',
    'light',
    'releases',
    'turns',
    'coolPresses'
  ])
    assert(c[k] > 0, k + ' 没覆盖到');
  assert(changed > 0, '逐帧瞄准没有影响状态');
  const out = { groups, bytes: manifest.bytes, aimComparison: { changed, resultChanged, first } };
  console.log(JSON.stringify(out, null, 2));
  return out;
}
if (require.main === module) report();
module.exports = { report };
