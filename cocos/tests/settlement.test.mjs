import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Match } from '../assets/scripts/core/match.ts';
import { LEVELS } from '../assets/scripts/core/levels.ts';

const require = createRequire(import.meta.url);
const { tutorialInput, state, summary, DT } = require('../../tests/golden/extra.cjs');
const { factory } = require('./extra-adapter.cjs');
const plain = (value) => JSON.parse(JSON.stringify(value));

test('五关多种子终局结果可由 TS 独立复现并返回可保存的进度', () => {
  for (let level = 0; level < LEVELS.length; level++) {
    for (let seed = 1001; seed <= 1020; seed++) {
      const progress = { unlocked: 1, best: {}, tutDone: true };
      const first = new Match({ itemDrops: false, level, seed, auto: true, simulating: true, progress });
      const second = new Match({ itemDrops: false, level, seed, auto: true, simulating: true, progress });
      while (!first.S.over) first.update(DT);
      while (!second.S.over) second.update(DT);
      const a = first.finish(first.S.over), b = second.finish(second.S.over);
      assert.deepEqual(summary(a), summary(b), `level=${level} seed=${seed}`);
      assert.deepEqual(first.loadProgress(), a.prog);
      assert.deepEqual(progress, { unlocked: 1, best: {}, tutDone: true });
    }
  }
});

test('旧存档字段兼容与结算计算不会改写调用方传入的进度对象', () => {
  for (let level = 0; level < LEVELS.length; level++) {
    const cases = [
      [null, true],
      [{ stars: 3, blames: 2 }, true],
      [{ stars: 3, blames: 1 }, false],
      [{ stars: 3, debt: 2, blames: 99 }, true],
      [{ stars: 3, debt: 1, blames: 99 }, false],
      [{ stars: 3 }, true],
      [{ stars: 1, debt: 0 }, true],
      [{ stars: 3, debt: 1.5 }, false],
      [{ stars: 3, debt: 1.5, blames: 99 }, false],
    ];
    for (const [best, expectedIsBest] of cases) {
      const progress = { unlocked: 1, best: best ? { [level + 1]: best } : {}, tutDone: true, bossName: '张老板', achievements: { kept: true } };
      const before = plain(progress);
      const match = new Match({ itemDrops: false, level, seed: 1001, progress });
      match.S.agents.forEach((agent, i) => { agent.sn.segs = []; agent.blames = i + 10; });
      match.S.player.blames = 1;
      match.S.player.sn.segs = [{ label: '旧账', due: 100, hot: false }];
      match.S.player.piesEaten = 2;
      const result = match.calculateResult('time');
      assert.ok(result.rank.length > 0);
      assert.equal(result.isBest, expectedIsBest, `level=${level} best=${JSON.stringify(best)}`);
      assert.deepEqual(result.prog.best[level + 1], expectedIsBest ? { stars: 3, debt: 1.5, blames: 1 } : best);
      assert.deepEqual(progress, before);
      assert.deepEqual(match.loadProgress(), before);
    }
  }
});

test('复盘诊断按来源分数选择增益，成就持久化与模拟随机流隔离', () => {
  const match = new Match({ itemDrops: false, level: 4, seed: 1001 });
  const player = match.S.player;
  const cases = [
    [[0, 0, 0, 0], 'legs', 0, 'legs'],
    [[1, 2, 2, 2], 'gold', 1, 'gold'],
    [[0, 3, 3, 3], 'trip', 3, 'trip'],
    [[0, 0, 4, 4], 'news', 4, 'news'],
    [[0, 0, 0, 5], 'legs', 5, 'legs'],
  ];
  for (const [scores, buff, score, source] of cases) {
    player.caught = scores[0];
    Object.assign(player.hitsBy, { sky: scores[1], burst: scores[2], mate: scores[3], leader: 0 });
    const diagnosis = match.diagnose(player);
    assert.equal(diagnosis.buff, buff);
    assert.equal(diagnosis.img, { gold: 'boss_aim', trip: 'player_panic', news: 'printer', legs: 'pm_angry' }[source]);
    assert.match(diagnosis.html, new RegExp(`<b>${score}</b>`));
  }
  const nephew = match.S.agents.find((agent) => agent.key === 'nephew');
  match.addPots(nephew, 12, 0, 0);
  assert.equal(match.loadProgress().achievements.nephewCrushed, true);
  const randomBefore = match.E.rngState();
  match.simulate(0, 2, 1001);
  assert.equal(match.E.rngState(), randomBefore);
  match.saveProgress({ unlocked: 1, best: {} });
  match.simulating = true;
  nephew.crushed = false;
  match.crushNephew(nephew);
  assert.equal(match.loadProgress().achievements, undefined);
});

test('复活和顶包只按 TS 结算入口修改本局及广告结果', () => {
  for (let level = 0; level < LEVELS.length; level++) {
    for (const late of [false, true]) {
      const env = factory({ kind: 'auto', level, seed: 5001 });
      const match = env.m;
      match.S.t = late ? match.L.duration - 5 : 5;
      match.S.player.sn.segs = Array.from({ length: 12 }, () => match.newPot(match.S.t));
      match.S.over = 'crushed';
      match.S.flying = [{ target: match.S.player }, { target: match.S.bots[0] }];
      match.S.throws = [{ target: match.S.player }, { target: match.S.bots[0] }];
      match.S.closing = { t: 0, passed: false };
      match.S.lastTick = 3;
      match.calculateResult('crushed');
      assert.equal(match.calculateResult('crushed').ads.revive, true);
      env.ad('revive');
      assert.equal(match.S.player.sn.segs.length, 6);
      assert.equal(match.S.over, null);
      assert.equal(match.S.closing, null);
      assert.equal(match.S.lastTick, null);
      assert.equal(match.S.flying.length, 1);
      assert.equal(match.S.throws.length, 1);
      assert.equal(match.workT(), late ? match.L.duration - 15 : 5);
      assert.equal(match.calculateResult('crushed').ads.revive, false);
    }
  }
  for (const blames of [0, 1, 2, 3, 4]) {
    const env = factory({ kind: 'auto', level: 4, seed: 5001 });
    const match = env.m;
    match.S.player.blames = blames;
    match.S.player.sn.segs = Array.from({ length: 11 }, () => match.newPot(0));
    match.S.agents.filter((agent) => !agent.isPlayer).forEach((agent) => { agent.blames = 0; agent.sn.segs = []; });
    match.calculateResult('time');
    assert.equal(match.calculateResult('time').ads.rescue, false, '仍带11口锅的夹具减三也进不了线');
    env.ad('rescue');
    assert.equal(match.S.player.blames, Math.max(0, blames - 3));
    assert.equal(match.calculateResult('time').ads.rescue, false);
  }
});

test('最后 10 秒滴答去重，18:00 收尾后台冻结并在反馈后结算', () => {
  const events = [];
  const match = new Match({ itemDrops: false, level: 0, seed: 1001, onEvent: (event) => events.push(event) });
  match.S.t = match.L.duration - 9.5;
  match.updateClosingNotice();
  match.updateClosingNotice();
  assert.equal(events.filter((event) => event.kind === 'sfx' && event.args[0] === 'tick').length, 1);

  match.startClosing();
  const frozen = plain(state(match));
  match.updateClosing(2, true);
  assert.deepEqual(plain(state(match)), frozen);
  match.updateClosing(0.45, false);
  assert.equal(match.mode, 'closing');
  match.updateClosing(0.99, false);
  assert.equal(match.mode, 'closing');
  match.updateClosing(0.01, false);
  assert.equal(match.mode, 'over');
});

test('分享结果覆盖关系户成就、复活与顶包组合', () => {
  const match = new Match({ itemDrops: false, level: 4, seed: 5001 });
  for (const revived of [false, true])
    for (const rescued of [false, true])
      for (const kind of ['blame', 'brag', 'cert']) {
        const info = { kind, nephewCrushed: true, revived, rescued, day: '周五' };
        const out = match.shareOutcome(info);
        assert.equal(out.achievement, kind !== 'cert');
        if (kind === 'cert') {
          assert.equal(out.certificate, revived || rescued ? '关系户下班证书' : '凭本事下班证书');
          assert.deepEqual(out.helps, [revived && '复活 1 次', rescued && '顶包 1 次'].filter(Boolean));
        }
      }
});

test('带教到名次步骤后等待确认会冻结，开始正式上班清空输入并保存完成状态', () => {
  const env = factory({ kind: 'tutorial', level: 0, seed: 3001 });
  const match = env.m;
  let frame = 0;
  while (match.S.tut.step.do !== 'rank') {
    const [down, angle, mag, fire] = tutorialInput(match);
    Object.assign(match.inp, { down, angle, mag, fire, keys: {} });
    match.update(DT);
    match.frameAim();
    assert(++frame < 3000, '带教未完成');
  }
  const frozen = plain(state(match));
  Object.assign(match.inp, { down: true, angle: Math.PI, mag: 1, fire: 3, keys: { w: true } });
  match.update(5);
  assert.deepEqual(plain(state(match)), frozen);
  match.startWork();
  assert.equal(match.inp.down, false);
  assert.equal(match.inp.mag, 0);
  assert.equal(match.inp.angle, null);
  assert.equal(match.inp.fire, 0);
  assert.deepEqual(plain(match.inp.keys), {});
  assert.equal(match.S.tut, null);
  assert.equal(match.workT(), 0);
  assert.equal(match.loadProgress().tutDone, true);
});
