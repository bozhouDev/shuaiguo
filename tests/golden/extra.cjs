// 录像外路径：独立输入随机流、逐帧完整玩法摘要，以及真实 finish 局部结果。
const assert = require('node:assert/strict');
const { setup } = require('../game-harness.cjs');
const { normalize, hash } = require('./record.cjs');
const path = require('node:path');
const DT = 1 / 60;
const kinds = new Set(['sfx', 'toast', 'buzz', 'floats', 'showMsg', 'showHint', 'spawnFx']);
// 不执行教学定时回调；只记录剩余时间，回调效果由后续帧与事件检验。
function state(m) {
  const s = m.S,
    refs = new Map(s.agents.map((a) => [a, { agent: a.id }]));
  s.leaders.forEach((l, i) => refs.set(l, { leader: i }));
  // 角色与领导转成稳定引用，集合转数组，避免循环引用和 VM 对象身份干扰。
  function pack(v) {
    if (refs.has(v)) return refs.get(v);
    if (typeof v === 'function') return '<回调>';
    if (Object.prototype.toString.call(v) === '[object Set]') return { set: Array.from(v, pack) };
    if (Array.isArray(v)) return Array.from(v, pack);
    if (v && typeof v === 'object')
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, pack(x)]));
    return v;
  }
  // praiseAt/outSince 归画面层；特效及弧线属于表现，不影响玩法。
  return normalize({
    state: pack(
      Object.fromEntries(
        Object.entries(s).filter(([k]) => !['fx', 'arcs', 'praiseAt', 'outSince'].includes(k))
      )
    ),
    agents: s.agents.map((a) => pack({ ...a })),
    leaders: s.leaders.map((l) => pack({ ...l })),
    rng: m.E.rngState(),
    ranking: Array.from(m.ranking(), (a) => a.id)
  });
}
// Match 和原型只有调用表不同，算法与结果均来自各自真实实现。
function prototype(c, progress) {
  const env = setup(true, { extended: true, events: true, sourceDir: path.resolve(__dirname, '../../js') });
  const { ctx, storage } = env,
    m = ctx.TEST;
  if (progress) storage.set('shuaiguo_v3', JSON.stringify(progress));
  ctx.E.seed(c.seed);
  m.boot(c.level, {
    auto: c.kind === 'buff' || c.kind === 'auto' || c.kind === 'ad',
    simulating: false,
    tutorial: c.kind === 'tutorial',
    buff: c.buff
  });
  Object.defineProperty(m, 'E', { value: ctx.E });
  // 保存真实结算面板和按钮回调；广告替身只跳过等待，仍执行原型成功回调。
  let handlers = {},
    html = '';
  ctx.E.showPanel = (h, f) => {
    html = h;
    handlers = f;
  };
  ctx.E.fakeAd = (cb) => cb();
  // 以下门面分别调用真实结算、广告按钮、教学按钮及收尾入口。
  return {
    ...env,
    m,
    // 真实 finish 写存档和面板后，读取内存暴露的局部计算结果。
    finish(reason) {
      m.finish(reason);
      return summary(m.lastResult);
    },
    // 只点击原型实际显示的广告按钮，缺少按钮或回调都使验收失败。
    ad(name) {
      assert(html.includes(`data-act="${name}"`), `未显示广告按钮 ${name}`);
      assert.equal(typeof handlers[name], 'function', `缺少广告回调 ${name}`);
      handlers[name]();
    },
    // 第七步确认走提示框的实际点击监听器。
    start() {
      ctx.document.getElementById('hint').querySelector('.h-go').listeners.click();
    },
    // 跳过教学走原按钮监听器，不直接清除教学状态。
    skip() {
      ctx.document.getElementById('btnSkip').listeners.click();
    },
    // 顶包会再次结算，因此读取上次 finish 的最新结果。
    result: () => summary(m.lastResult),
    // 验证原型真正写入的本地存档内容。
    stored: () => JSON.parse(storage.get('shuaiguo_v3')),
    // 供专项断言检查广告、彩蛋和证书的展示资格。
    html: () => html,
    // 模拟前后台切换，只推进真实收尾入口。
    closing(dt, hidden) {
      ctx.document.hidden = hidden;
      m.updateClosing(dt);
    }
  };
}
// 去除对象身份和关卡对象，保留结算全部纯计算字段；同结构用于真实原型结果和 TS 返回值。
function summary(r) {
  const { rank, next, epilogue, ads, ...rest } = r;
  return JSON.parse(
    JSON.stringify(normalize({ ...rest, rank: Array.from(rank, (a) => a.id), next: next?.id ?? null }))
  );
}
// 输入流与 gameplay RNG 完全分开；每段包含松手、轻推、急转、追人及冷却连按。
function inputGenerator(seed) {
  let n = seed >>> 0,
    angle = 0,
    mag = 0,
    down = false;
  // 独立 LCG 仅驱动输入选择，不改变对局里的随机序列。
  const random = () => {
    n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
    return n / 4294967296;
  };
  // 每 24 帧换方向，按飞锅到达时间触发反甩，其余时刻穿插空按和连按。
  return (m, step) => {
    const p = m.S.player;
    if (step % 24 === 0) {
      angle = random() * Math.PI * 2;
      mag = [0, 0.15, 0.34, 0.35, 0.7, 1][Math.floor(random() * 6)];
      down = mag > 0;
    }
    // 部分时段接近同事，保证扇形瞄准和命中路径有实际覆盖。
    if (step % 480 < 330) {
      const b = m.S.agents
        .filter((a) => a !== p && !a.crushed)
        .sort(
          (a, b) =>
            Math.hypot(a.sn.x - p.sn.x, a.sn.y - p.sn.y) - Math.hypot(b.sn.x - p.sn.x, b.sn.y - p.sn.y)
        )[0];
      if (b) {
        angle = Math.atan2(b.sn.y - p.sn.y, b.sn.x - p.sn.x);
        mag = Math.hypot(b.sn.x - p.sn.x, b.sn.y - p.sn.y) > 100 ? 1 : 0.2;
        down = true;
      }
    }
    const incoming = m.S.throws.some((f) => f.owner !== p && !f.dead && m.incomingTTI(f, p) <= m.parryWin(f));
    const fire = incoming && p.parryLock <= 0 ? 1 : step % 43 === 0 ? 1 : step % 173 === 0 ? 3 : 0;
    return [down, angle, mag, fire];
  };
}
// 带教按实际判定移动和甩出；目标点只取关卡 spots，不改位置、不直接触发完成事件。
function tutorialInput(m) {
  const t = m.S.tut,
    p = m.S.player;
  let goal = null,
    fire = 0;
  if (t.step.do === 'walk') goal = t.ring;
  if (['throw', 'dodge'].includes(t.step.do)) {
    const a = m.S.agents.find((a) => a.key === (t.step.do === 'throw' ? 'intern' : 'pm'));
    goal = a.sn;
    if (m.potsOf(p) > 0 && !m.seenBy(p) && m.S.agents.some((a) => m.inAimFan(p, a, 1))) fire = 1;
  }
  if (!goal) return [false, 0, 0, fire];
  const angle = Math.atan2(goal.y - p.sn.y, goal.x - p.sn.x),
    d = Math.hypot(goal.x - p.sn.x, goal.y - p.sn.y);
  return [true, angle, t.step.do === 'walk' || d > 95 ? 1 : 0.2, fire];
}
// 清单固定命名；对照组使用完全同一份输入，唯一差别为帧末瞄准调用。
function cases() {
  const out = [];
  for (let level = 0; level < 5; level++)
    for (let seed = 2001; seed <= 2010; seed++)
      out.push({ kind: 'input', level, seed, aim: true }, { kind: 'input', level, seed, aim: false });
  out.push(
    { kind: 'tutorial', level: 0, seed: 3001, aim: true },
    { kind: 'tutorial', level: 0, seed: 3002, aim: true, skip: true }
  );
  for (const buff of ['trip', 'gold', 'news', 'legs'])
    for (let level = 0; level < 5; level++)
      for (let seed = 4001; seed <= 4003; seed++) out.push({ kind: 'buff', buff, level, seed, aim: false });
  for (let level = 0; level < 5; level++)
    for (const ad of ['revive-early', 'revive-late', 'rescue'])
      out.push({
        kind: 'ad',
        ad,
        level,
        seed: level === 2 && ad !== 'revive-early' ? 5002 : 5001,
        aim: false
      });
  return out;
}
// 名称由模式、增益或广告、关卡、种子和瞄准配置确定，重建时保持稳定。
const id = (c) =>
  [c.kind, c.buff || c.ad || '', c.level, c.seed, c.skip ? 'skip' : c.aim ? 'aim' : 'noaim']
    .filter((x) => x !== '')
    .join('-');
// 一局完整录像；TS 重放保存下来的输入，原型自验时重新生成，避免生成器变化被掩盖。
function run(c, factory = prototype, replay) {
  const env = factory(c),
    m = env.m,
    s = m.S,
    frames = [],
    checkpoints = [],
    inputs = [],
    settlements = [],
    stepsSeen = [];
  const generate = inputGenerator(c.seed ^ 0xa5a5a5a5);
  const coverage = {
    presses: 0,
    whiffs: 0,
    coolPresses: 0,
    light: 0,
    releases: 0,
    turns: 0,
    launched: 0,
    thrown: 0,
    parries: 0,
    caught: 0
  };
  let adDone = false,
    step = 0;
  while (!s.over || (c.ad?.startsWith('revive') && !adDone)) {
    // 压垮后先保存真实结算，再点复活继续同一局；不直接修改压垮标记。
    if (s.over) {
      settlements.push(env.finish(s.over));
      env.ad('revive');
      adDone = true;
    }
    const tut = s.tut;
    if (tut && !stepsSeen.includes(tut.step.do)) stepsSeen.push(tut.step.do);
    if (tut && ((c.skip && step === 30) || tut.step.do === 'rank')) {
      if (c.skip) env.skip();
      else env.start();
    }
    let inp = replay
      ? replay.inputs[step] || [false, 0, 0, 0]
      : s.tut
        ? tutorialInput(m)
        : c.kind === 'input'
          ? generate(m, step)
          : [false, 0, 0, 0];
    inputs.push(inp);
    const [down, angle, mag, fire] = inp;
    Object.assign(m.inp, { down, angle, mag, fire, keys: {} });
    coverage.presses += fire;
    if (fire && s.player.cool > 0) coverage.coolPresses += fire;
    if (down && mag < 0.35) coverage.light++;
    if (!down) coverage.releases++;
    if (step && Math.abs(angle - inputs[step - 1][1]) > 2) coverage.turns++;
    // 可审查的广告夹具：在指定时刻真实加锅并由 update 判压垮，覆盖最后 15 秒的拨钟分支。
    if (
      c.ad?.startsWith('revive') &&
      !adDone &&
      m.workT() >= (c.ad === 'revive-early' ? 5 : m.L.duration - 5)
    )
      m.addPots(s.player, 12 - m.potsOf(s.player), s.player.sn.x, s.player.sn.y);
    // 帧末瞄准严格在 update 后；它会更新 aimTgt，因此也是录像状态的一部分。
    m.update(DT);
    if (c.aim) m.frameAim();
    if (fire && s.player.parryLock === 0.4) coverage.whiffs++;
    const snap = state(m);
    frames.push({ step: ++step, t: s.t, hash: hash(snap) });
    if (step % 30 === 0 || s.over) checkpoints.push({ step, ...snap });
    if (step > 18000)
      throw Error(`对局未结束 ${id(c)} step=${s.tut?.step?.do} xy=${s.player.sn.x},${s.player.sn.y}`);
  }
  if (c.ad === 'rescue') {
    // 自然终局后构造恰好落榜的总账，再走实际顶包按钮，确保每关都有按钮。
    s.agents.forEach((a) => {
      a.crushed = false;
      a.sn.segs = [];
      a.blames = a.key === 'nephew' ? 0 : 1;
    });
    s.player.blames = 3;
    settlements.push(env.finish('time'));
    env.ad('rescue');
    settlements.push(env.result());
  } else settlements.push(env.finish(s.over));
  Object.assign(coverage, ...['launched', 'thrown', 'parries', 'caught'].map((k) => ({ [k]: s.player[k] })));
  const events = normalize(env.events.filter((e) => kinds.has(e.kind)));
  return {
    config: c,
    dt: DT,
    inputs,
    frames,
    checkpoints,
    events,
    settlements,
    progress: env.stored(),
    stepsSeen,
    coverage
  };
}
module.exports = { DT, kinds, state, prototype, summary, inputGenerator, tutorialInput, cases, id, run };
