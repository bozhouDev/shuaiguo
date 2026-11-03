// 对应原型 js/game.js：hyped aimRange aimCone followTarget startPieMeeting updatePieMeeting scatterPies desiredPie eatPie updatePies updateSchedule startFinale burst startEvent startIncident；设计依据《这锅你来背-核心玩法》。
import type { Match } from './match';
import type { Agent, Leader, Point, Incident, MeetingConfig, Pie, Finale } from './types';
import { OFFICE } from './levels';
import * as C from './config';

export const scheduleLogic = {

// 同一套增益同时用于玩家瞄准、同事出手、小舅子塞锅与扇形绘制。
  hyped(this: Match, a: Agent): boolean { return a.hypeUntil > this.S.t; },

// 鸡血期间扩大瞄准距离。
  aimRange(this: Match, a: Agent): number { return this.hyped(a) ? 200 : C.AIM_RANGE; },

// 鸡血期间扩大瞄准半角。
  aimCone(this: Match, a: Agent): number { return this.hyped(a) ? Math.PI / 8 : C.AIM_CONE; },

// 出纳优先选三秒内刚被甩中过的有效对象；多人同时中招时挑最近的。
  followTarget(this: Match, a: Agent, aiming: boolean): Agent | null {
    if (a.key !== 'cashier') return null;
    return this.S.agents.filter((b) => this.canThrowTo(a, b) && this.S.t - b.lastMateHitAt <= 3 &&
      this.headDist(a, b) <= a.p.seekR && this.sightClear(a.sn.x, a.sn.y, b.sn.x, b.sn.y) &&
      (!aiming || this.inAimFan(a, b, 1))).sort((b, c) => this.headDist(a, b) - this.headDist(a, c))[0] || null;
  },

// 会议打断老板当前瞄准；讲话期间不补发普通锅，经理照常工作。
  startPieMeeting(this: Match, config: MeetingConfig): void {
    const boss = this.S.leaders.find((l) => l.type === 'boss');
    if (!boss) return;
    boss.meeting = { ...config, elapsed: 0, lines: this.E.shuffle(C.PIE_PROMISES).slice(0, 3) };
    boss.state = 'patrol'; boss.targets = []; boss.chase = null;
    boss.pieSay = boss.meeting.lines[0];
  },

// 老板站在原地连讲三句，结束后撒饼，恢复正常巡逻与派活。
  updatePieMeeting(this: Match, boss: Leader, dt: number): void {
    const m = boss.meeting!;
    m.elapsed += dt;
    boss.pieSay = m.lines[Math.min(2, Math.floor(m.elapsed / (m.duration / 3)))];
    if (m.elapsed < m.duration) return;
    this.scatterPies(boss, m);
    boss.meeting = null; boss.pieSayUntil = this.S.t + 0.6;
    boss.throwCd = Math.max(boss.throwCd, 0.8);
    this.S.pieMeetingsDone++;
    if (boss.afterMeetingHot) { boss.afterMeetingHot = false; this.startEvent('p0'); }
  },

// 从老板周围的过道候选点选饼位：避开墙、桌子和碰撞圈，留出完整 40px 饼宽。
  scatterPies(this: Match, boss: Leader, config: MeetingConfig): void {
    const candidates = [];
    const phase = this.E.rand(0, Math.PI * 2);
    for (const radius of [90, 125, 160, 195]) {
      for (let i = 0; i < 24; i++) {
        const angle = phase + i * Math.PI / 12;
        const x = boss.x + Math.cos(angle) * radius, y = boss.y + Math.sin(angle) * radius;
        if (!this.blocked(x, y) && this.sightClear(boss.x, boss.y, x, y)) candidates.push({ x, y });
      }
    }
    this.S.pieBatch++;
    const picked: Point[] = [];
    for (const point of candidates) {
      if (picked.some((p) => this.E.dist(point.x, point.y, p.x, p.y) < 55)) continue;
      picked.push(point);
      this.S.pies.push({ ...point, boss, expires: this.S.t + config.life, batch: this.S.pieBatch });
      this.S.piesSpawned++;
      if (picked.length >= config.count) break;
    }
  },

// 一批饼只作一次意愿判断，避免每帧重抽把低概率变成必吃；已有鸡血先不追。
  desiredPie(this: Match, a: Agent): Pie | null {
    if (!this.S.pies.length || this.hyped(a)) return null;
    if (this.potsOf(a) + 2 >= C.MAX_POTS - 1) return null; // 再吃两口就快压垮了，机器人不去送死（踩到照样吃）
    if (a.pieBatch !== this.S.pieBatch) {
      a.pieBatch = this.S.pieBatch;
      const behind = this.ranking().indexOf(a) >= this.passRank();
      const chance = this.potsOf(a) >= 4 || behind ? 0.85 : a.key === 'nephew' ? 0.3 : 0.12;
      a.wantsPie = this.E.random() < chance;
    }
    if (!a.wantsPie) return null;
    return this.S.pies.filter((p) => p.expires > this.S.t && this.E.dist(a.sn.x, a.sn.y, p.x, p.y) < 650)
      .sort((p, q) => this.E.dist(a.sn.x, a.sn.y, p.x, p.y) - this.E.dist(a.sn.x, a.sn.y, q.x, q.y))[0] || null;
  },

// 吃饼马上加两口普通期限的锅，飞锅弧线只是视觉，不延迟负担与压垮判定。
  eatPie(this: Match, a: Agent, pie: Pie): void {
    a.piesEaten++; a.hypeUntil = this.S.t + 10; // 连吃刷新十秒，不叠加倍率或时间
    this.addPots(a, 2, pie.boss.x, pie.boss.y - 20);
    this.S.spawned += 2;
    a.pieSay = this.E.pick(C.PIE_PROMISES); a.pieSayUntil = this.S.t + 2.4;
    pie.boss.pieSay = '既然你这么积极，这些也交给你'; pie.boss.pieSayUntil = this.S.t + 2.4;
    this.floats.add('+2 口锅', a.sn.x, a.sn.y - 28, '#E8504A');
    if (a.isPlayer) { this.E.toast('多两口锅！打鸡血 10 秒', 1800); this.E.sfx('tea'); }
  },

// 按最近蛇头判定，一张饼只能被一个人吃；出局者不再拾取，过期先移除。
  updatePies(this: Match): void {
    this.S.pies = this.S.pies.filter((pie) => {
      if (pie.expires <= this.S.t) { this.S.piesExpired++; return false; }
      const eater = this.S.agents.filter((a) => !a.crushed && this.potsOf(a) < C.MAX_POTS && this.E.dist(a.sn.x, a.sn.y, pie.x, pie.y) <= C.HEAD_R + 14)
        .sort((a, b) => this.E.dist(a.sn.x, a.sn.y, pie.x, pie.y) - this.E.dist(b.sn.x, b.sn.y, pie.x, pie.y))[0];
      if (!eater) return true;
      this.eatPie(eater, pie); return false;
    });
  },

/* ---------------- 时间表：节奏、散会、随机事件、教学提示 ---------------- */
  updateSchedule(this: Match): void {
    const w = this.workT();
    // 领导丢锅节奏
    let idx = -1;
    this.L.pace.forEach((p, i) => { if (w >= p.t) idx = i; });
    if (idx !== this.S.paceIdx) {
      this.S.paceIdx = idx;
      this.S.pace = this.L.pace[idx] || null;
    }
    // 急着下班：到 rushAt 秒，同事们开始抢着甩锅（更快、更急、更狠），换紧张配乐；只提示这一次
    if (!this.S.rushHour && w >= (this.L.rushAt ?? this.L.duration * C.RUSH_AT)) {
      this.S.rushHour = true; this.S.rush = true;
      this.E.toast(`${this.clockAt(w)} 快下班了，大家都急着甩锅！`, 2200); this.E.sfx('rush'); this.shake = 8; this.E.bgm('rush');
    }
    // 散会、随机事件、临时事件
    while (this.S.schedule.length && w >= this.S.schedule[0].t) {
      const it = this.S.schedule.shift()!;
      if (it.act === 'msg') this.showMsg(it.text!);
      else if (it.act === 'burst') this.burst(it.src!, it.n!);
      else if (it.act === 'event') this.startEvent(it.kind!);
      else if (it.act === 'incident') this.startIncident(it.inc!);
      else if (it.act === 'pieMeeting') this.startPieMeeting(it.meeting!);
    }
    // 开局第一口锅：天降锅砸给主角
    if (this.S.skyFirst && w >= C.SKY_FIRST) { this.S.skyFirst = false; this.launchSky(this.S.player, this.S.leaders[0]); }
    // 教学提示：按时间弹的
    const h = (this.L.hints || [])[this.S.hintIdx];
    if (h && w >= h.t) { this.showHint(h); this.S.hintIdx++; }
    // 看情况弹的提示：当前没有横幅时才弹，每条每局一次
    if (this.L.tips && this.hintTimer <= 0) {
      for (const tip of this.L.tips) {
        if (this.S.tipsShown[tip.on] || !this.TIP_CHECKS[tip.on]()) continue;
        this.S.tipsShown[tip.on] = true;
        this.showHint(tip);
        break;
      }
    }
    // 收尾：先发群消息，2 秒后开下午茶、给主角塞锅
    const fin = this.L.finale;
    if (fin && !this.S.finDone) {
      if (!this.S.finMsg && w >= fin.t - 2 - (this.S.buff === 'news' ? 2 : 0)) { this.S.finMsg = true; this.showMsg(fin.msg); }
      if (w >= fin.t) { this.S.finDone = true; this.startFinale(fin); }
    }
  },

// 收尾（第 1 关）：同事都去茶水间挤着，老板给主角塞几口锅，期限卡在 18:00，正好冲过去一口气连甩
  startFinale(this: Match, fin: Finale): void {
    const P = this.S.player, l = this.S.leaders[0];
    this.S.finale = true;
    this.S.finBlame0 = P.blames; // 调试统计用：收尾期间主角背了几次锅
    this.S.tea = this.L.duration - fin.t + 1;
    this.addPots(P, fin.pots, l ? l.x : P.sn.x, l ? l.y : P.sn.y - 200);
    const end = this.S.t0 + this.L.duration - 0.6; // 赶在下班判定之前到点
    for (const pot of P.sn.segs.slice(-fin.pots)) pot.due = end;
    this.floats.add(this.bossText(fin.say), P.sn.x, P.sn.y - 60, '#E8504A');
    this.E.toast('同事都挤在茶水间，过去一口气甩掉！', 2400);
    this.E.sfx('tea');
    this.shake = 8;
  },

// 某个地点一口气喷出 n 口锅，依次瞄准离那里最近的几个人
  burst(this: Match, srcKey: string, n: number): void {
    const src = OFFICE.sources[srcKey];
    const near = this.S.agents.filter((a) => !a.crushed)
      .sort((a, b) => this.E.dist(a.sn.x, a.sn.y, src.x, src.y) - this.E.dist(b.sn.x, b.sn.y, src.x, src.y))
      .slice(0, 3);
    if (!near.length) return;
    for (let i = 0; i < n; i++) this.launchPot(src.x, src.y, near[i % near.length], 0.9 + i * 0.2, false, 'burst');
    this.E.sfx(srcKey === 'printer' ? 'printer' : 'burst');
    this.shake = Math.max(this.shake, 4);
  },

// 随机事件生效
  startEvent(this: Match, kind: string): void {
    if (kind === 'printer') this.burst('printer', 5);
    else if (kind === 'tea') { this.S.tea = 10; this.E.toast('同事们都去茶水间了，挤在一起正好连甩', 2200); this.E.sfx('tea'); }
    else if (kind === 'p0') {
      const l = this.S.leaders[0];
      if (l.meeting) { l.afterMeetingHot = true; return; }
      const target = this.pickTargets(l)[0] || this.nearestAgent(l.x, l.y);
      if (target) this.launchPot(l.x, l.y - 20, target, 0.9, true, 'leader');
    }
  },

// 临时事件生效：
  // rage 老板发火——RAGE_TIME 秒内走得快、派锅又密又多（一次多一口、不丢天降锅）、视野更大，同事跟着慌、抢着甩
  // inspect 领导查岗——INSPECT_TIME 秒内直奔你走过来，停在跟前盯着看，你在他视野里甩锅就被抓
  startIncident(this: Match, inc: Incident): void {
    const l = this.S.leaders.find((x) => x.type === (inc.who || 'boss'));
    if (!l) return;
    if (inc.kind === 'rage') {
      l.rageUntil = this.S.t + C.RAGE_TIME;
      l.throwCd = Math.min(l.throwCd, 0.4); // 一发火马上开始派
      l.wait = 0;
      this.floats.add('全部重做！', l.x, l.y - 70, '#E8504A');
      this.E.sfx('rush'); this.shake = 10;
    } else if (inc.kind === 'inspect') {
      l.inspectUntil = this.S.t + C.INSPECT_TIME;
      l.path = []; l.goal = null;
      this.floats.add('我看看谁在摸鱼', l.x, l.y - 70, '#E8504A');
      this.E.sfx('aim');
    }
  },
};
