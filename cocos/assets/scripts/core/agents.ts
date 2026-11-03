// 对应原型 js/game.js：blocked steerFree cleanestRival pickDumpTarget nephewTarget passNephewPot avoidsNephew think updateAgent ranking starsOfRank update diagnose；设计依据《这锅你来背-核心玩法》。
import type { Match } from './match';
import type { Agent, Diagnosis } from './types';
import { OFFICE } from './levels';
import * as C from './config';

export const agentsLogic = {

/* ---------------- 机器人大脑 ---------------- */
  // 某点是否被障碍物或地图边缘挡住
  blocked(this: Match, x: number, y: number): boolean {
    const pad = C.HEAD_R + 4;
    if (x < pad || y < pad || x > OFFICE.world.w - pad || y > OFFICE.world.h - pad) return true;
    for (const r of this.obstacles) if (x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad) return true;
    return false;
  },

// 绕障碍：在想去的方向左右依次试探，选第一个前方没被挡的方向
  steerFree(this: Match, a: Agent, ang: number): number {
    const look = 40 + a.sn.speed * 0.3;
    for (const o of C.STEER_OFFSETS) {
      const t = ang + o, c = Math.cos(t), s = Math.sin(t);
      if (!this.blocked(a.sn.x + c * look * 0.5, a.sn.y + s * look * 0.5) && !this.blocked(a.sn.x + c * look, a.sn.y + s * look)) return t;
    }
    return ang;
  },

// 同事里总账最少的人（不算自己和小舅子）：聪明的同事专挑账面干净的人甩，把领先的人拉下来
  cleanestRival(this: Match, a: Agent): Agent | null {
    let best = null;
    for (const b of this.S.agents) {
      if (b === a || b.crushed || b.key === 'nephew') continue;
      if (!best || this.debtOf(b) < this.debtOf(best)) best = b;
    }
    return best;
  },

// 想甩锅的对象：半径内能甩的人里最近的（已有目标且仍有效时不轻易换人）
  // 关卡 ai.focus > 0 时，总账最少的那个人算「更近」、也能从更远处被盯上（focus 越大越执着）
  pickDumpTarget(this: Match, a: Agent): Agent | null {
    const follow = this.followTarget(a, false);
    if (follow) return follow;
    const r = a.p.seekR, focus = this.aiVal(a, 'focus'); // 随时间爬升；玩家托管时不吃关卡加成
    if (a.target && !a.target.crushed && (a.lock[a.target.id] || 0) <= this.S.t && this.headDist(a, a.target) < r * 1.3) return a.target;
    const top = focus ? this.cleanestRival(a) : null;
    let best = null, bd = Infinity;
    for (const b of this.S.agents) {
      if (b === a || b.crushed || (a.lock[b.id] || 0) > this.S.t) continue;
      const d = this.headDist(a, b), isTop = b === top;
      if (d > r * (isTop ? 1 + focus * 0.6 : 1)) continue;
      const score = isTop ? d / (1 + focus) : d;
      if (score < bd) { bd = score; best = b; }
    }
    return best;
  },

// 小舅子随手挑最近的有效目标，不受朝向和记仇限制；隔墙、护盾和出局者排除。
  nephewTarget(this: Match, a: Agent, range: number): Agent | null {
    let best = null, distance = range;
    for (const b of this.S.agents) {
      if (b === a || b.crushed || b.shield > 0) continue;
      const d = this.headDist(a, b);
      if (d < distance && this.sightClear(a.sn.x, a.sn.y, b.sn.x, b.sn.y)) { best = b; distance = d; }
    }
    return best;
  },

// 到等待时间才塞锅；没人能接时先留在身上，追近后再塞，不重置截止时间。
  passNephewPot(this: Match, a: Agent): void {
    if (!this.canFire(a)) return;
    let index = -1;
    a.sn.segs.forEach((pot, i) => {
      if (pot.passAt! <= this.S.t && (index < 0 || pot.due < a.sn.segs[index].due)) index = i;
    });
    if (index < 0) return;
    const b = this.nephewTarget(a, this.aimRange(a));
    if (b) this.fireThrow(a, b, index);
  },

// 按人设谨慎程度忍住护短风险，连最莽的新同事也大多会忍一下。
  avoidsNephew(this: Match, a: Agent, b: Agent): boolean | null { return this.nephewGuardian(b) && this.E.random() < Math.min(0.98, 0.6 + a.p.sneak * 0.38); },

// 机器人每隔 react 秒想一次：把各种「想去 / 想躲」的力加起来，得出想走的方向
  think(this: Match, a: Agent): void {
    const me = a.sn, p = a.p, pots = this.potsOf(a);
    let vx = 0, vy = 0;
    const flee = (x: number, y: number, w: number) => { const d = Math.max(1, this.E.dist(me.x, me.y, x, y)); vx += ((me.x - x) / d) * w; vy += ((me.y - y) / d) * w; };
    const seek = (x: number, y: number, w: number) => { const d = Math.max(1, this.E.dist(me.x, me.y, x, y)); vx += ((x - me.x) / d) * w; vy += ((y - me.y) / d) * w; };

    const pie = this.desiredPie(a);
    // 小舅子不参加普通的积极甩锅/反甩决策，移动只为靠近能接锅的人。
    if (a.key === 'nephew') {
      a.target = pots ? this.nephewTarget(a, p.seekR) : null;
      a.want = this.steerFree(a, pie ? Math.atan2(pie.y - me.y, pie.x - me.x) : a.target ? Math.atan2(a.target.sn.y - me.y, a.target.sn.x - me.x) : me.angle + this.E.rand(-0.3, 0.3));
      return;
    }
    // 卡在墙角：随便换个方向冲一会儿
    if (a.panicT > 0) { a.want = this.steerFree(a, a.want); return; }

    // 1. 躲飞向自己的锅：往锅飞行方向的侧面闪
    for (const f of this.S.flying) {
      if (f.phase !== 'fly') continue;
      const dx = me.x - f.x, dy = me.y - f.y, d = Math.hypot(dx, dy);
      if (d > 260 || d < 1) continue;
      const fx = Math.cos(f.a), fy = Math.sin(f.a);
      if ((dx * fx + dy * fy) / d < 0.75) continue; // 不是冲自己来的
      const side = fx * dy - fy * dx >= 0 ? 1 : -1;
      const w = p.dodge * this.aiVal(a, 'dodge') * (1 - d / 260) * 3;
      vx += -fy * side * w; vy += fx * side * w;
    }
    // 领导瞄准自己时也提前横移
    for (const l of this.S.leaders) {
      if (l.state === 'aim' && l.targets.includes(a)) {
        const d = Math.max(1, this.E.dist(me.x, me.y, l.x, l.y));
        vx += (-(me.y - l.y) / d) * p.dodge * this.aiVal(a, 'dodge'); vy += ((me.x - l.x) / d) * p.dodge * this.aiVal(a, 'dodge');
      }
      // 2. 躲领导
      const d = this.E.dist(me.x, me.y, l.x, l.y);
      if (l.chase === a) flee(l.x, l.y, 4);
      else if (d < 230) flee(l.x, l.y, (1.5 + p.caution * 2.5) * (1 - d / 230));
    }
    // 3. P0：拿着就找最近的人传，没拿就躲着拿 P0 的人
    const hotMine = this.holdsHot(a), urgent = this.urgentLeft(a), rush = hotMine || urgent < C.DUE_WARN; // rush：有锅快到点了
    if (hotMine) {
      const b = this.nearestAgent(me.x, me.y, a);
      if (b) seek(b.sn.x, b.sn.y, 3.5);
    } else {
      for (const b of this.S.agents) {
        if (b === a || b.crushed || !this.holdsHot(b)) continue;
        const d = this.headDist(a, b);
        if (d < 260) flee(b.sn.x, b.sn.y, 2 * p.caution * (1 - d / 260));
      }
    }
    // 4. 找人甩锅：锅越多、越快到点越积极；预判对方走位
    a.target = null;
    if ((pots >= p.seekMin || rush) && !hotMine) {
      const b = this.pickDumpTarget(a);
      if (b) {
        a.target = b;
        const lead = 0.3;
        seek(b.sn.x + Math.cos(b.sn.angle) * b.sn.speed * lead, b.sn.y + Math.sin(b.sn.angle) * b.sn.speed * lead,
          p.aggr * this.aiVal(a, 'aggr') * (0.7 + Math.min(pots, 8) * 0.1) + (rush ? 1 : 0));
      }
    }
    // 5. 躲开想把锅甩给自己的人（自己没锅、或正被锁住不能还手时更想躲）
    for (const b of this.S.agents) {
      if (b === a || b.crushed || !this.potsOf(b) || !this.canThrowTo(b, a)) continue;
      const d = this.headDist(a, b);
      if (d > 150) continue;
      const scared = pots === 0 || (a.lock[b.id] || 0) > this.S.t ? 1.4 : 0.5;
      flee(b.sn.x, b.sn.y, p.caution * scared * (1 - d / 150) * (this.S.finale && this.S.tea > 0 ? 0.25 : 1)); // 收尾下午茶：忙着抢吃的，懒得躲
    }
    // 6. 下午茶 / 老油条泡茶：往茶水间走
    if (this.S.tea > 0 || a.teaT > 0) seek(OFFICE.tea.x, OFFICE.tea.y, this.S.finale && this.S.tea > 0 ? 2.2 : a.teaT > 0 ? 1.5 : 1.1);
    // 抢饼时更愿意靠近老板；顺风者主动绕开饼，但踩到仍会吃。
    if (pie) seek(pie.x, pie.y, 4.5);
    else for (const item of this.S.pies) {
      const d = this.E.dist(me.x, me.y, item.x, item.y);
      if (d < 75) flee(item.x, item.y, 2 * (1 - d / 75));
    }
    // 7. 没事干：保持方向慢慢晃，靠近边缘时往中间拐
    if (Math.hypot(vx, vy) < 0.15) {
      vx += Math.cos(me.angle) * 0.4 + this.E.rand(-0.2, 0.2);
      vy += Math.sin(me.angle) * 0.4 + this.E.rand(-0.2, 0.2);
      seek(OFFICE.world.w / 2, OFFICE.world.h / 2, 0.15);
    }
    a.want = this.steerFree(a, Math.atan2(vy, vx) + this.E.rand(-0.08, 0.08));

    // 8. 出手：前方瞄得到人、够近就甩（有锅快到点时不挑人；平时不主动瞄刚甩给自己的人）
    //    领导在看时，按性格忍住不甩（老油条从不当面甩，实习生经常被抓）
    if (this.canFire(a)) {
      const b = this.pickAim(a);
      if (b && this.headDist(a, b) < p.throwR * (this.hyped(a) ? 200 / 150 : 1) && (rush || (pots >= p.seekMin && (a.lock[b.id] || 0) <= this.S.t)) &&
        this.E.random() < 0.45 + 0.55 * p.aggr * this.aiVal(a, 'aggr') && !(this.seenBy(a) && this.E.random() < Math.min(1, p.sneak * this.aiVal(a, 'sneak'))) && !this.avoidsNephew(a, b)) this.fireThrow(a);
    }
  },

/* ---------------- 打工人每帧 ---------------- */
  updateAgent(this: Match, a: Agent, dt: number): void {
    if (a.crushed) return;
    a.cool -= dt; a.stun -= dt; a.shield -= dt; a.cry -= dt; a.angry -= dt; a.panicT -= dt; a.parryLock -= dt;
    if (a.key === 'nephew') this.passNephewPot(a);
    a.comboT -= dt;
    if (a.comboT <= 0) a.combo = 0;

    // 老油条定期去泡茶：泡茶时走得很慢，是甩锅的好时机（带教时不去）
    if (a.p.tea && !this.S.tut) {
      if (a.teaT > 0) a.teaT -= dt;
      else { a.teaCd -= dt; if (a.teaCd <= 0) { a.teaT = 3.5; a.teaCd = this.E.rand(9, 13); } }
    }

    // 速度：人设与泡茶倍率照旧，腿长只给主角加速，背锅不减速
    // 急着下班时同事走得更快（玩家不变）
    a.sn.speed = C.BASE_SPEED * a.p.speed * (this.hyped(a) ? 1.25 : 1) * (a.isPlayer && this.S.buff === 'legs' ? 1.1 : 1) * (a.teaT > 0 && this.E.dist(a.sn.x, a.sn.y, OFFICE.tea.x, OFFICE.tea.y) < 120 ? 0.4 : 1) * (!a.isPlayer && this.S.rushHour ? C.RUSH_SPEED : 1);

    // 方向：玩家用手指，机器人用 AI；带教时同事都站在原地当靶子
    const ai = !a.isPlayer || this.auto;
    let steer = null;     // 本帧想转向的角度（null = 不转）
    if (this.S.tut && !a.isPlayer) {
      a.sn.speed = 0;
    } else if (ai) {
      a.thinkT -= dt;
      if (a.thinkT <= 0) { a.thinkT = a.p.react * this.E.rand(0.8, 1.2) * (this.S.rushHour && !a.isPlayer ? C.RUSH_REACT : 1); this.think(a); } // 急着下班反应更快
      steer = a.want;
    } else {
      // 主角不会自己走：按住摇杆 / 方向键才动；摇杆轻推只原地转向
      const keyHeld = this.E.pollKeys(this.inp);
      const walk = keyHeld || (this.inp.down && this.inp.mag >= C.TURN_ONLY_MAG);
      if (!walk) a.sn.speed = 0;
      steer = keyHeld || this.inp.down ? this.inp.angle : null;
      // 玩家按了「甩」：本帧处理掉所有按键（一般就一次）
      while (this.inp.fire > 0) { this.inp.fire--; this.pressFire(a); }
    }
    a.sn.update(dt, steer);
    if (this.E.collide(a.sn, C.HEAD_R, this.obstacles)) a.sn.trail[0] = { x: a.sn.x, y: a.sn.y };
    if (a.sn.bounce(C.HEAD_R, C.HEAD_R, OFFICE.world.w - C.HEAD_R, OFFICE.world.h - C.HEAD_R)) {
      if (ai) a.want = a.sn.angle; else this.inp.angle = a.sn.angle;
    }

    // 卡墙检测：1.2 秒内几乎没动，就随机换个方向冲一会儿
    if (ai && !this.S.tut) {
      a.stuckT += dt;
      if (a.stuckT >= 1.2) {
        if (this.E.dist(a.sn.x, a.sn.y, a.lastX, a.lastY) < 30) { a.panicT = 0.7; a.want = this.E.rand(0, Math.PI * 2); }
        a.stuckT = 0; a.lastX = a.sn.x; a.lastY = a.sn.y;
      }
    }
  },

/* ---------------- 排名 ---------------- */
  // 排名：没被压垮的在前；总账（背锅次数 + 身上锅 × ½）少的在前；同分再比背锅次数少、甩出去的多；被压垮的人越晚压垮排越前
  ranking(this: Match): Agent[] {
    return this.S.agents.filter((a) => a.key !== 'nephew' || this.L.nephewRanked === true).sort((a, b) =>
      (Number(a.crushed) - Number(b.crushed)) ||
      (!a.crushed && (Number(b.key === 'nephew') - Number(a.key === 'nephew'))) ||
      (a.crushed ? b.crushedAt - a.crushedAt : (this.debtOf(a) - this.debtOf(b)) || (a.blames - b.blames)) ||
      (b.thrown - a.thrown));
  },

// 名次 → 星级：第 1 名 3 星，第 2 名 2 星，第 3 名 1 星，其余 0
  starsOfRank(this: Match, r: number): number { return (r <= this.passRank() ? (this.L.passStars ?? (4 - r)) : 0); },

/* ---------------- 主更新 ---------------- */
  update(this: Match, dt: number): void {
    // 最后一句等玩家确认，所有角色、飞锅和截止时间一起冻结。
    if (this.coachLocked()) return;
    // 截断最后一帧：18:00 之后到期的锅不能混入本局成绩。
    if (!this.S.tut) dt = Math.min(dt, Math.max(0, this.S.t0 + this.L.duration - this.S.t));
    this.S.t += dt;
    if (!this.S.tut && this.S.t0 + this.L.duration - this.S.t < 1e-7) this.S.t = this.S.t0 + this.L.duration;
    if (this.S.tea > 0) this.S.tea -= dt;
    if (this.S.tut) this.updateTutorial(dt);
    else this.updateSchedule();
    for (const a of this.S.agents) this.updateAgent(a, dt);
    for (const l of this.S.leaders) this.updateLeader(l, dt);
    this.updatePies();
    this.updateFlying(dt);
    this.updateThrows(dt);
    this.updateDue();

    // 甩锅动画推进
    for (const a of this.S.arcs) a.t += dt;
    this.S.arcs = this.S.arcs.filter((a) => a.t < a.dur);
    // 一次性特效推进
    for (const e of this.S.fx) e.t += dt;
    this.S.fx = this.S.fx.filter((e) => e.t < e.dur);

    // 快压垮提醒：玩家堆到 POT_ALARM 口提示一次，降下去后可以再提示
    const P = this.S.player, n = this.potsOf(P);
    if (n >= C.POT_ALARM && !P.alarmed) { P.alarmed = true; this.E.toast(`身上 ${n} 口锅了，堆满 ${C.MAX_POTS} 口会被压垮！`, 1800); this.E.sfx('alarm'); }
    else if (n < C.POT_ALARM - 2) P.alarmed = false;
    // 压垮：机器人出局（排最后），玩家当场失败
    for (const a of this.S.agents) {
      if (a.crushed || this.potsOf(a) < C.MAX_POTS) continue;
      if (a.key === 'nephew') { this.crushNephew(a); continue; }
      if (a.isPlayer) { this.S.over = 'crushed'; return; }
      a.crushed = true; a.crushedAt = this.S.t; a.target = null;
      this.E.toast(`${a.name}被锅压垮了！`, 1800);
      this.E.sfx('crush', { vol: 0.6 });
    }
    if (this.workT() >= this.L.duration - 1e-7) { this.S.t = this.S.t0 + this.L.duration; this.S.over = 'time'; }
  },

/* ---------------- 结算 ---------------- */
  // 按死因得分推荐增益；严格大于才替换，保留金牌、出差、消息、腿长的平分优先级。
  diagnose(this: Match, P: Agent): Diagnosis {
    const h = P.hitsBy;
    const scores: Record<string, number> = { gold: P.caught * 2, trip: h.sky, news: h.burst, legs: h.mate + h.leader };
    let buff = 'legs', best = 0;
    for (const id of ['gold', 'trip', 'news', 'legs']) {
      if (scores[id] > best) { buff = id; best = scores[id]; }
    }
    const reasons: Record<string, { img: string; html: string }> = {
      trip: { img: 'player_panic', html: `复盘：老板的天降锅砸了你 <b>${h.sky}</b> 口，躲都躲不掉。` },
      gold: { img: 'boss_aim', html: `复盘：你当着领导甩锅，被抓现行 <b>${P.caught}</b> 次，每次白背 1 次锅。` },
      news: { img: 'printer', html: `复盘：散会、打印机卡纸喷出来的锅，砸了你 <b>${h.burst}</b> 口。` },
      legs: { img: 'pm_angry', html: `复盘：同事和领导朝你扔的锅，你被砸中 <b>${scores.legs}</b> 口。` },
    };
    return { buff, ...reasons[buff] };
  },
};
