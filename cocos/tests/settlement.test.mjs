import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { prototype, summary, kinds, DT, state } = require('../../tests/golden/extra.cjs');
const { factory } = require('./extra-adapter.cjs');
const { normalize } = require('../../tests/golden/record.cjs');
// 仅移除 VM 原型身份，不改变字段和值。
const plain = (v) => JSON.parse(JSON.stringify(v));
// 真实 finish 的 oracle 除原字段外，验证画面中的广告资格与彩蛋、证书决定。
function compare(a, b, reason, namedReports) {
  a.m.finish(reason);
  const r = a.m.lastResult,
    actual = b.m.finish(reason);
  const { epilogue, ads, ...base } = actual;
  const expected = summary(r);
  // 只有明确提供自定义称呼的夹具允许两段报告变化，其余字段仍严格对照冻结原型。
  if (namedReports) {
    const { pieReport, nephewReport } = namedReports;
    Object.assign(expected, { pieReport, nephewReport });
    Object.assign(expected.shareInfo, { pieReport, nephewReport });
  }
  assert.deepEqual(summary(base), expected);
  assert.deepEqual(b.stored(), a.stored());
  assert.equal(epilogue, a.html().includes('我们是大小周，明天照常上班') ? '我们是大小周，明天照常上班' : '');
  assert.equal(ads.revive, a.html().includes('data-act="revive"'));
  assert.equal(ads.rescue, a.html().includes('data-act="rescue"'));
  const card = a.m.shareCard(r.shareInfo),
    out = b.m.shareOutcome(actual.shareInfo);
  assert.equal(out.achievement, card.title === '今天我把老板小舅子压垮了');
  assert.equal(
    out.certificate,
    card.pic.includes('关系户下班证书')
      ? '关系户下班证书'
      : card.pic.includes('凭本事下班证书')
        ? '凭本事下班证书'
        : null
  );
}
// 原有100组的真实终局全部执行 finish，不从精简录像反构造丢字段的状态。
test('原100组终局结算、总账、复盘、存档与分享判断完全一致', () => {
  for (let level = 0; level < 5; level++)
    for (let seed = 1001; seed <= 1020; seed++) {
      const c = { kind: 'auto', level, seed },
        a = prototype(c),
        b = factory(c);
      while (!a.m.S.over) a.m.update(DT);
      while (!b.m.S.over) b.m.update(DT);
      compare(a, b, a.m.S.over);
    }
});
test('旧存档按blames比较、新存档按debt比较，星级和解锁分支完全一致', () => {
  for (let level = 0; level < 5; level++)
    for (const old of [
      null,
      { stars: 3, blames: 2 },
      { stars: 3, blames: 1 },
      { stars: 3, debt: 2, blames: 99 },
      { stars: 3, debt: 1, blames: 99 },
      { stars: 3 },
      { stars: 1, debt: 0 },
      { stars: 3, debt: 1.5 }
    ]) {
      const progress = {
        unlocked: 1,
        best: old ? { [level + 1]: old } : {},
        tutDone: true,
        bossName: '张老板',
        achievements: { kept: true }
      };
      const c = { kind: 'auto', level, seed: 1001 },
        a = prototype(c, progress),
        b = factory(c, progress);
      for (const env of [a, b]) {
        const m = env.m,
          s = m.S;
        s.agents.forEach((a, i) => {
          a.sn.segs = [];
          a.blames = i + 10;
        });
        s.player.blames = 1;
        s.player.sn.segs = [{ label: '旧账', due: 100, hot: false }];
        s.player.piesEaten = 2;
      }
      compare(a, b, 'time', {
        pieReport: '今天吃了张老板 2 张饼',
        nephewReport: level >= 2 ? '张老板小舅子今天背锅 0 次，第一个下班' : ''
      });
    }
});
test('复盘各来源及平分优先级、成就持久化与模拟隔离一致', () => {
  const c = { kind: 'auto', level: 4, seed: 1001 },
    a = prototype(c),
    b = factory(c);
  for (const scores of [
    [0, 0, 0, 0],
    [1, 2, 2, 2],
    [0, 3, 3, 3],
    [0, 0, 4, 4],
    [0, 0, 0, 5]
  ]) {
    for (const { m } of [a, b]) {
      const p = m.S.player;
      p.caught = scores[0];
      Object.assign(p.hitsBy, { sky: scores[1], burst: scores[2], mate: scores[3], leader: 0 });
    }
    assert.deepEqual(plain(b.m.diagnose(b.m.S.player)), plain(a.m.diagnose(a.m.S.player)));
  }
  for (const env of [a, b]) {
    const n = env.m.S.agents.find((a) => a.key === 'nephew');
    env.m.addPots(n, 12, 0, 0);
  }
  assert.deepEqual(b.stored(), a.stored());
  assert.equal(b.stored().achievements.nephewCrushed, true);
  for (const env of [a, b]) {
    env.m.saveProgress({ unlocked: 1, best: {} });
    env.m.setSim?.(true);
    if (!env.m.setSim) env.m.simulating = true;
    const n = env.m.S.agents.find((a) => a.key === 'nephew');
    n.crushed = false;
    env.m.crushNephew(n);
  }
  assert.deepEqual(b.stored(), a.stored());
  assert.equal(b.stored().achievements, undefined);
});
// 精确跨过18:00的最后一帧；收尾期间只调用收尾入口，与原型外层循环一致。
test('18:00截断、倒计时去重、后台冻结及1.45秒收尾均一致', () => {
  for (let level = 0; level < 5; level++) {
    const c = { kind: 'auto', level, seed: 1001 },
      a = prototype(c),
      b = factory(c);
    for (const { m } of [a, b]) {
      m.S.t = m.L.duration - 9.5;
      m.updateClosingNotice();
      m.updateClosingNotice();
      m.S.t = m.L.duration - 0.005;
      m.S.player.sn.segs = [
        { label: '临界', due: m.L.duration, hot: false },
        { label: '次日', due: m.L.duration + 0.001, hot: true }
      ];
      m.update(DT);
      m.startClosing();
    }
    assert.deepEqual(plain(state(b.m)), plain(state(a.m)));
    assert.equal(b.m.S.t, b.m.L.duration);
    assert.equal(
      b.m.S.player.sn.segs.some((p) => p.label === '临界'),
      false
    );
    assert.equal(
      b.m.S.player.sn.segs.some((p) => p.label === '次日'),
      true
    );
    const frozen = state(b.m);
    a.closing(2, true);
    b.closing(2, true);
    assert.deepEqual(state(b.m), frozen);
    for (let frame = 0; frame < 87; frame++) {
      a.closing(DT, false);
      b.closing(DT, false);
      assert.deepEqual(plain(state(b.m)), plain(state(a.m)));
      assert.equal(b.m.S.t, b.m.L.duration);
    }
    assert.equal(b.m.mode, 'closing');
    a.closing(DT, false);
    b.closing(DT, false);
    assert.equal(b.m.mode, 'over');
    compare(a, b, 'time');
    assert.deepEqual(normalize(b.events.filter((e) => kinds.has(e.kind))), normalize(a.events));
  }
});
// 专项夹具锁住早/晚复活、无负背锅、广告资格和证书优先级；整局续跑由新增广告录像覆盖。
test('广告回调早晚复活、清理追踪锅、拨钟、顶包下限和证书判断均一致', () => {
  for (let level = 0; level < 5; level++)
    for (const late of [false, true]) {
      const c = { kind: 'auto', level, seed: 5001 },
        a = prototype(c),
        b = factory(c);
      for (const { m } of [a, b]) {
        const s = m.S;
        s.t = late ? m.L.duration - 5 : 5;
        s.player.sn.segs = Array.from({ length: 12 }, () => m.newPot(s.t));
        s.over = 'crushed';
        s.flying = [{ target: s.player }, { target: s.bots[0] }];
        s.throws = [{ target: s.player }, { target: s.bots[0] }];
        s.closing = { t: 0, passed: false };
        s.lastTick = 3;
      }
      compare(a, b, 'crushed');
      a.ad('revive');
      b.ad('revive');
      assert.deepEqual(plain(state(b.m)), plain(state(a.m)));
      assert.equal(b.m.S.player.sn.segs.length, 6);
      assert.equal(b.m.S.over, null);
      assert.equal(b.m.S.closing, null);
      assert.equal(b.m.S.lastTick, null);
      assert.equal(b.m.S.flying.length, 1);
      assert.equal(b.m.S.throws.length, 1);
      assert.equal(b.m.workT(), late ? b.m.L.duration - 15 : 5);
      compare(a, b, 'crushed');
      assert.equal(b.m.calculateResult('crushed').ads.revive, false);
    }
  for (const blames of [0, 1, 2, 3, 4]) {
    const c = { kind: 'auto', level: 4, seed: 5001 },
      a = prototype(c),
      b = factory(c);
    for (const { m } of [a, b]) {
      m.S.player.blames = blames;
      m.S.player.sn.segs = Array.from({ length: 11 }, () => m.newPot(0));
      m.S.agents
        .filter((a) => !a.isPlayer)
        .forEach((a) => {
          a.blames = 0;
          a.sn.segs = [];
        });
    }
    compare(a, b, 'time');
    a.ad('rescue');
    b.ad('rescue');
    assert.deepEqual(a.result(), b.result());
    assert.equal(b.m.S.player.blames, Math.max(0, blames - 3));
    assert.equal(b.m.calculateResult('time').ads.rescue, false);
  }
  for (const revived of [false, true])
    for (const rescued of [false, true])
      for (const kind of ['blame', 'brag', 'cert']) {
        const c = { kind: 'auto', level: 4, seed: 5001 },
          a = prototype(c),
          b = factory(c),
          info = { kind, nephewCrushed: true, revived, rescued, day: '周五' };
        const card = a.m.shareCard(info),
          out = b.m.shareOutcome(info);
        assert.equal(out.achievement, kind !== 'cert');
        if (kind === 'cert') assert(card.pic.includes(out.certificate));
      }
});
// 用真实输入走到第七步，验证确认前整局冻结，以及点击后不会把按住的输入带进正式局。
test('带教七步走完后等待按钮时冻结，开始上班清空输入并保存tutDone', () => {
  const { tutorialInput } = require('../../tests/golden/extra.cjs');
  const c = { kind: 'tutorial', level: 0, seed: 3001, aim: true },
    a = prototype(c),
    b = factory(c);
  let frame = 0;
  while (a.m.S.tut.step.do !== 'rank') {
    const input = tutorialInput(a.m);
    for (const { m } of [a, b]) {
      const [down, angle, mag, fire] = input;
      Object.assign(m.inp, { down, angle, mag, fire });
      m.update(DT);
      m.frameAim();
    }
    assert(++frame < 3000, '带教未完成');
  }
  assert.deepEqual(plain(state(b.m)), plain(state(a.m)));
  const frozen = plain(state(b.m));
  for (const { m } of [a, b]) {
    Object.assign(m.inp, { down: true, angle: Math.PI, mag: 1, fire: 3, keys: { w: true } });
    m.update(5);
  }
  assert.deepEqual(plain(state(b.m)), frozen);
  assert.deepEqual(plain(state(a.m)), frozen);
  a.start();
  b.start();
  for (const { m } of [a, b]) {
    assert.equal(m.inp.down, false);
    assert.equal(m.inp.mag, 0);
    assert.equal(m.inp.angle, null);
    assert.equal(m.inp.fire, 0);
    assert.deepEqual(plain(m.inp.keys), {});
    assert.equal(m.S.tut, null);
    assert.equal(m.workT(), 0);
  }
  assert.deepEqual(a.stored(), b.stored());
  assert.equal(b.stored().tutDone, true);
});
