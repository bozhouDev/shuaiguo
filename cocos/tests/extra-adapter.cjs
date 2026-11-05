// 新录像接入只映射 API，输入和状态摘要共用测试契约，不修正任何状态。
require('./register-core.cjs');
const { Match } = require('../assets/scripts/core/match.ts');
const { summary } = require('../../tests/golden/extra.cjs');
// 一次工厂调用只创建一局，返回测试需要的结算入口、存档和事件。
function factory(c, progress) {
  const events = [];
  let lastResult;
  const m = new Match({itemDrops:false,
    seed: c.seed,
    level: c.level,
    auto: ['auto', 'buff', 'ad'].includes(c.kind),
    simulating: false,
    tutorial: c.kind === 'tutorial',
    buff: c.buff,
    progress,
    onEvent: (e) => {
      events.push(e);
      if (e.kind === 'finish') lastResult = e.args[0];
    }
  });
  // 结算、广告、教学与收尾直接调用 Match；不在适配器修值或替代算法。
  return {
    m,
    events,
    finish: (reason) => summary(m.finish(reason)),
    ad: (name) => m[name](),
    start: () => m.startWork(),
    skip: () => m.startWork(),
    result: () => summary(lastResult),
    stored: () => m.loadProgress(),
    closing: (dt, hidden) => m.updateClosing(dt, hidden)
  };
}
module.exports = { factory };
