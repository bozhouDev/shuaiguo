// 旧规则断言在 TS 上复用的调用门面；所有玩法、结算与广告均执行 Match。
require('./register-core.cjs');
const { Match } = require('../assets/scripts/core/match.ts');
const { OFFICE, LEVELS } = require('../assets/scripts/core/levels.ts');
// 每次 setup 隔离本地存档和活动 Match；门面跟随 init 切换到新对局。
function setup() {
  const storage = new Map();
  let m = new Match({itemDrops:false, level: 3, seed: 1001 }),
    ctx = { OFFICE, LEVELS };
  // 引擎方法绑定当前对局，固定随机数替身也传入当前引擎。
  const E = new Proxy(
    {},
    {
      get: (_, key) => {
        const v = m.E[key];
        return typeof v === 'function' ? v.bind(m.E) : v;
      },
      set: (_, key, v) => {
        m.E[key] = v;
        return true;
      }
    }
  );
  // 原型测试调用名映射到真实 Match；只有纯计算结果保存在 ctx.result。
  const t = new Proxy(
    {},
    {
      get: (_, key) =>
        key === 'init'
          ? (level = 3, recording = false) => {
              m = new Match({itemDrops:false,
                level,
                seed: 1001,
                auto: recording,
                simulating: recording,
                onEvent: (e) => {
                  if (e.kind === 'progress') storage.set('shuaiguo_v3', JSON.stringify(e.args[0]));
                }
              });
              // 断言使用的 makeState 之前设置固定随机数替身；首个占位对局不参与断言。
              if (override) {
                m.E.random = override;
                m.S = m.makeState(false);
              }
              return m.S;
            }
          : key === 'finish'
            ? (reason) => {
                ctx.result = m.finish(reason);
                return ctx.result;
              }
            : key === 'shareOutcome'
              ? (info) => m.shareOutcome(info)
              : key === 'revive'
                ? () => m.revive()
                : key === 'rescue'
                  ? () => {
                      ctx.result = m.rescue();
                      return ctx.result;
                    }
                  : typeof m[key] === 'function'
                    ? m[key].bind(m)
                    : m[key]
    }
  );
  let override;
  const randomE = new Proxy(E, {
    set: (target, key, v) => {
      if (key === 'random') override = v;
      target[key] = v;
      return true;
    }
  });
  ctx.E = randomE;
  ctx.TEST = t;
  return { ctx, storage };
}
module.exports = { setup };
