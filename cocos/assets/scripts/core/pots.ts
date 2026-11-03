// 对应原型 js/game.js：tailPos addPots launchPot launchSky nearestAgent updateFlying potHit receivePot crushNephew canThrowTo canFire inAimFan pickAim leadAngle sightClear raging bossRaging visionRange visionCone seenBy nephewGuardian caught fireThrow incomingTTI heat aiVal parryChance parryWin pressFire parry missThrow inWall updateThrows landThrow addBlame explode updateDue；设计依据《这锅你来背-核心玩法》。
import type { Match } from './match';
import type { Agent, Pot, Leader, Point, FlyingPot, ThrownPot } from './types';
import { OFFICE } from './levels';
import * as C from './config';

export const potsLogic = {

/* ---------------- 锅：加到身上 / 尾巴位置 ---------------- */
  // 当前尾巴位置（没有身体时为蛇头）
  tailPos(this: Match, a: Agent): Point {
    const p = a.sn.positions();
    return p.length ? p[p.length - 1] : { x: a.sn.x, y: a.sn.y };
  },

// 给某人加 n 口锅（从 (fx, fy) 飞到尾巴的动画只是视觉），连甩清零
  addPots(this: Match, a: Agent, n: number, fx: number, fy: number): void {
    for (let i = 0; i < n; i++) {
      const pot = this.newPot(this.S.t);
      if (a.crushed) break;
      this.receivePot(a, pot);
      this.S.arcs.push({ x0: fx, y0: fy, to: () => this.tailPos(a), t: -i * 0.08, dur: 0.4, label: pot.label });
    }
    a.combo = 0;
  },

/* ---------------- 飞行的锅 ---------------- */
  // 发射一口锅：warn > 0 时先在原地预警再起飞；target 为追踪的打工人
  launchPot(this: Match, x: number, y: number, target: Agent, warn: number, hot: boolean, src: string): void {
    this.S.flying.push({
      src, phase: warn > 0 ? 'warn' : 'fly', t: warn, warn0: warn, x, y, target, hot: !!hot,
      a: Math.atan2(target.sn.y - y, target.sn.x - x), spin: 0, life: C.POT_LIFE,
      label: hot ? '急件' : this.E.pick(OFFICE.potLabels),
    });
    this.S.spawned++;
  },

// 天降锅：只砸主角，脚下先出现阴影，SKY_TIME 秒后砸下来，躲不掉
  launchSky(this: Match, target: Agent, from?: Leader): void {
    // 领导出差期间跳过天降锅；老板随机派锅的替代路径由 updateLeader 处理。
    if (target.crushed || (target.isPlayer && this.S.buff === 'trip' && this.workT() < 30)) return;
    this.S.flying.push({ src: 'sky', phase: 'sky', t: C.SKY_TIME, warn0: C.SKY_TIME, x: target.sn.x, y: target.sn.y, target, hot: false, a: 0, spin: 0, life: C.POT_LIFE, label: this.E.pick(OFFICE.potLabels) });
    this.S.spawned++; this.S.skies++;
    if (target.isPlayer) {
      this.floats.add(`${from ? from.name : this.bossName()}：这个你来`, target.sn.x, target.sn.y - 60, '#E8504A');
      this.E.sfx('skyWarn');
    }
  },

// 离 (x, y) 最近的还没被压垮的打工人
  nearestAgent(this: Match, x: number, y: number, except?: Agent): Agent | null {
    let best = null, bd = Infinity;
    for (const a of this.S.agents) {
      if (a.crushed || a === except) continue;
      const d = this.E.dist(a.sn.x, a.sn.y, x, y);
      if (d < bd) { bd = d; best = a; }
    }
    return best;
  },

// 飞行锅每帧：预警 → 限速转向追踪目标 → 砸中路上碰到的任何人
  updateFlying(this: Match, dt: number): void {
    for (const f of this.S.flying) {
      if (f.phase === 'warn') {
        f.t -= dt;
        if (f.t <= 0) { f.phase = 'fly'; f.a = Math.atan2(f.target.sn.y - f.y, f.target.sn.x - f.x); }
        continue;
      }
      if (f.phase === 'drop') { f.t -= dt; if (f.t <= 0) f.dead = true; continue; }
      // 天降锅：阴影跟着目标走，到点直接砸中
      if (f.phase === 'sky') {
        f.t -= dt; f.x = f.target.sn.x; f.y = f.target.sn.y;
        if (f.target.crushed) f.dead = true;
        else if (f.t <= 0) { f.dead = true; this.potHit(f.target, f); }
        continue;
      }
      if (f.target.crushed) f.target = this.nearestAgent(f.x, f.y) || f.target;
      const tg = f.target.sn;
      const want = Math.atan2(tg.y - f.y, tg.x - f.x);
      const turn = f.hot ? C.POT_TURN * 1.6 : C.POT_TURN;
      f.a += this.E.clamp(this.E.angDiff(f.a, want), -turn * dt, turn * dt);
      f.x += Math.cos(f.a) * C.POT_SPEED * dt;
      f.y += Math.sin(f.a) * C.POT_SPEED * dt;
      f.spin += dt * 8;
      if (!f.hot) f.life -= dt;
      // 砸中路上碰到的第一个人——躲开了，锅可能就砸在别人头上
      const victim = this.S.agents.find((a) => !a.crushed && this.E.dist(f.x, f.y, a.sn.x, a.sn.y) < C.HEAD_R + 14);
      if (victim) { f.dead = true; this.potHit(victim, f); }
      else if (f.life <= 0 || this.inWall(f.x, f.y)) { f.phase = 'drop'; f.t = 0.5; } // 飞太久或撞墙就掉地上
    }
    this.S.flying = this.S.flying.filter((f) => !f.dead);
  },

// 飞行锅命中：收锅、记来源，并触发对应反馈。
  potHit(this: Match, a: Agent, f: FlyingPot): void {
    // 带教不计入复盘；只记录实际落到主角身上的锅。
    if (a.isPlayer && !this.S.tut && Object.hasOwn(a.hitsBy, f.src)) a.hitsBy[f.src]++;
    this.spawnFx('fx_impact', a.sn.x, a.sn.y - 26, 54);
    this.receivePot(a, this.newPot(this.S.t, f.hot, f.label));   // 截止时间从落到身上开始算
    a.combo = 0;
    if (a.isPlayer) this.tutEvent('potOnMe');
    if (f.hot) {
      if (a.isPlayer) { this.E.toast(`急件砸到你身上！${C.P0_LIFE} 秒内甩出去，炸了背锅 +${C.P0_BLAME}`, 2200); this.E.sfx('hotHit'); this.E.buzz(60); this.shake = 8; }
      return;
    }
    if (a.isPlayer) {
      this.floats.add('+1 ' + f.label, a.sn.x, a.sn.y - 34, '#E8504A');
      this.shake = 6;
      this.E.sfx(f.src === 'sky' ? 'skyLand' : 'hit'); this.E.buzz(35); // 被锅砸中：短震；天降锅用更重的落地声
    } else {
      this.floats.add('+1', a.sn.x, a.sn.y - 40, '#9AA6C4');
    }
  },

// 入袋统一记账：每口锅单独等 1–2 秒，后来接锅不延长先前的等待。
  receivePot(this: Match, a: Agent, pot: Pot, from?: Agent): void {
    if (a.key === 'nephew') {
      pot.passAt = this.S.t + this.E.rand(1, 2);
      pot.nephewSender = from || null; // 领导、散会直接派来的锅没有同事责任人
      a.received++;
      if (from) a.lastThrower = from;
    }
    a.sn.segs.push(pot);
    if (a.key === 'nephew' && this.potsOf(a) >= C.MAX_POTS) this.crushNephew(a);
  },

// 达到 12 口立即出局，避免同帧到期或塞锅把压垮吞掉；模拟不得写真实存档。
  crushNephew(this: Match, a: Agent): void {
    if (a.crushed) return;
    a.crushed = true; a.crushedAt = this.S.t; a.target = null;
    this.S.nephewCrushed = true;
    if (!this.simulating) {
      const p = this.loadProgress();
      p.achievements = { ...p.achievements, nephewCrushed: true };
      this.saveProgress(p);
    }
    this.E.toast('隐藏成就：把小舅子压垮了', 2200);
    this.E.sfx('crush', { vol: 0.6 });
    if (a.lastThrower && !a.lastThrower.crushed) this.leaderAlert(a.lastThrower, a);
  },

/* ---------------- 甩锅：按键把锅扔出去（所有人同一套规则） ---------------- */
  // 同事会不会主动把锅甩给 b（护盾中、刚甩给自己的人不考虑）
  canThrowTo(this: Match, a: Agent, b: Agent): boolean {
    return a !== b && !b.crushed && b.shield <= 0 && !((a.lock[b.id] || 0) > this.S.t);
  },

// a 现在能不能甩：身上有锅、没在冷却、没愣住
  canFire(this: Match, a: Agent): boolean { return !a.crushed && a.cool <= 0 && a.stun <= 0 && this.potsOf(a) > 0; },

// b 在不在 a 的瞄准扇形里（k 放大扇形，用于锁定目标后不轻易丢）
  inAimFan(this: Match, a: Agent, b: Agent, k: number): boolean {
    if (b === a || b.crushed || b.shield > 0) return false;
    if (this.headDist(a, b) > this.aimRange(a) * k) return false;
    return Math.abs(this.E.angDiff(a.sn.angle, Math.atan2(b.sn.y - a.sn.y, b.sn.x - a.sn.x))) <= this.aimCone(a) * k;
  },

// 自动瞄准：扇形内挑「近 + 正前方」的人；上一次锁定的人只要还在稍大一点的扇形里就继续锁着，避免目标来回跳
  // 扇形里没人返回 null（直线扔出去）
  pickAim(this: Match, a: Agent): Agent | null {
    const follow = this.followTarget(a, true);
    if (follow) { a.aimTgt = follow; return follow; }
    if (a.aimTgt && this.inAimFan(a, a.aimTgt, 1.25)) return a.aimTgt;
    let best = null, bs = Infinity;
    for (const b of this.S.agents) {
      if (b === a || b.crushed || b.shield > 0) continue;
      const d = this.headDist(a, b);
      if (d > this.aimRange(a)) continue;
      const off = Math.abs(this.E.angDiff(a.sn.angle, Math.atan2(b.sn.y - a.sn.y, b.sn.x - a.sn.x)));
      if (off > this.aimCone(a)) continue;
      const score = d * (1 + off * 1.5);
      if (score < bs) { bs = score; best = b; }
    }
    a.aimTgt = best;
    return best;
  },

// 从 a 朝 b 扔锅的角度：按锅的飞行时间预判 b 的走位
  leadAngle(this: Match, a: Agent, b: Agent): number {
    const tt = this.headDist(a, b) / C.THROW_SPEED;
    const x = b.sn.x + Math.cos(b.sn.angle) * b.sn.speed * tt, y = b.sn.y + Math.sin(b.sn.angle) * b.sn.speed * tt;
    return Math.atan2(y - a.sn.y, x - a.sn.x);
  },

// 两点之间有没有墙挡着视线（桌子不挡，每 12px 采样一次）
  sightClear(this: Match, ax: number, ay: number, bx: number, by: number): boolean {
    const n = Math.ceil(this.E.dist(ax, ay, bx, by) / 12);
    for (let k = 1; k < n; k++) if (this.inWall(ax + (bx - ax) * k / n, ay + (by - ay) * k / n)) return false;
    return true;
  },

// a 在不在某位领导的视野扇形里（隔墙看不见）；在就返回那位领导
  // 领导正在发火（老板发火事件）
  raging(this: Match, l: Leader): boolean { return (l.rageUntil || 0) > this.S.t; },

// 场上有没有正在发火的领导（同事跟着慌）
  bossRaging(this: Match): boolean { return !!this.S && this.S.leaders.some(this.raging); },

// 领导视野的长度和半角：发火时盯得更远更宽
  visionRange(this: Match, l: Leader): number { return C.VISION_RANGE * (this.raging(l) ? C.RAGE_VISION : 1); },

// 发火时按原倍率放大领导视野半角。
  visionCone(this: Match, l: Leader): number { return (l.cfg.visionCone ?? C.VISION_CONE) * (this.raging(l) ? C.RAGE_VISION : 1); },

// 返回第一位看得见此人的领导，保留领导遍历顺序。
  seenBy(this: Match, a: Agent, type?: string): Leader | null {
    for (const l of this.S.leaders) {
      if (type && l.type !== type) continue;
      if (this.E.dist(l.x, l.y, a.sn.x, a.sn.y) > this.visionRange(l)) continue;
      if (Math.abs(this.E.angDiff(l.face, Math.atan2(a.sn.y - l.y, a.sn.x - l.x))) > this.visionCone(l)) continue;
      if (this.sightClear(l.x, l.y, a.sn.x, a.sn.y)) return l;
    }
    return null;
  },

// 只认亲属的真实视野；重叠时姐姐优先，经理不护短，判断用命中时的位置。
  nephewGuardian(this: Match, a: Agent): Leader | null { return a.key === 'nephew' ? (this.seenBy(a, 'wife') || this.seenBy(a, 'boss')) : null; },

// 当着领导的面甩锅：锅不走，还要背锅 +1
  caught(this: Match, a: Agent, l: Leader): void {
    a.cool = C.THROW_CD;
    a.caught++;
    this.floats.add(`${l.name}：当着我的面甩锅？`, a.sn.x, a.sn.y - 60, '#E8504A');
    this.addBlame(a, 1, '被抓现行');
    if (a.isPlayer) this.E.sfx('caught');
  },

// 甩出去：扔身上最急的那口（P0 截止时间短，自然最先扔）；在领导视野里甩会被抓现行
  fireThrow(this: Match, a: Agent, target?: Agent | null, potIdx?: number): boolean {
    if (!this.potsOf(a)) return false;
    const eye = a.key === 'nephew' ? null : this.seenBy(a);
    if (eye) {
      // 金牌仅替主角免一次抓现行，之后仍按正常流程甩出这口锅。
      if (a.isPlayer && this.S.buff === 'gold' && !this.S.buffUsed) {
        this.S.buffUsed = true;
        this.floats.add('免死金牌：这次算了', a.sn.x, a.sn.y - 60, '#2F9E6B');
      } else { this.caught(a, eye); return true; }
    }
    const b = target || this.pickAim(a);
    const ang = b ? this.leadAngle(a, b) : a.sn.angle;
    const pot = a.sn.segs.splice(potIdx == null ? this.urgentIdx(a) : potIdx, 1)[0];
    this.S.throws.push({
      owner: a, target: b, x: a.sn.x + Math.cos(ang) * 12, y: a.sn.y + Math.sin(ang) * 12, a: ang,
      speed: C.THROW_SPEED, pot, label: pot.label, hot: pot.hot, dist: 0, range: this.hyped(a) ? C.THROW_RANGE + 50 : C.THROW_RANGE, bounces: 0, spin: 0, rolled: new Set(),
    });
    a.cool = C.THROW_CD;
    a.launched++;
    if (a.isPlayer) this.E.sfx('whoosh');
    return true;
  },

// 锅 f 离砸中 b 还有几秒；不是朝 b 飞的返回 Infinity
  incomingTTI(this: Match, f: ThrownPot, b: Agent): number {
    const dx = b.sn.x - f.x, dy = b.sn.y - f.y, d = Math.hypot(dx, dy);
    if (d < 1) return 0;
    const dot = (dx * Math.cos(f.a) + dy * Math.sin(f.a)) / d;
    if (dot < 0.6 && f.target !== b) return Infinity;
    return Math.max(0, d - C.THROW_HIT_R) / f.speed;
  },

// 关卡难度倍率：同事的积极度、反甩率（?auto 时 AI 玩家不吃倍率，方便对比）
  // 注意倍率可以是 0（第 1 关同事完全不反弹），不能用 || 兜底
  // 难度爬升进度：0（09:00）→ 1（18:00），带教时为 0；曲线前缓后陡，越到下班越狠
  heat(this: Match): number {
    if (!this.S || this.S.tut) return 0;
    return Math.pow(this.E.clamp(this.workT() / this.L.duration, 0, 1), C.RAMP_CURVE);
  },

// 关卡同事难度倍率：从 L.ai（开局）按爬升进度过渡到 L.aiEnd（下班），没写 aiEnd 的项保持不变
  // 急着下班（S.rushHour）时甩锅积极度再乘一档；老板发火时大家跟着慌，积极度再乘一档
  // focus 是加法量（默认 0），其余是乘法倍率（默认 1）；玩家托管时不吃关卡加成
  aiVal(this: Match, a: Agent, k: string): number {
    if (a.isPlayer) return k === 'focus' ? 0 : 1;
    const base = k === 'focus' ? 0 : 1;
    const v0 = this.L.ai && this.L.ai[k] != null ? this.L.ai[k] : base;
    const v1 = this.L.aiEnd && this.L.aiEnd[k] != null ? this.L.aiEnd[k] : v0;
    let v = v0 + (v1 - v0) * this.heat();
    if (k === 'aggr' && this.S.rushHour) v *= C.RUSH_AGGR;
    if (k === 'aggr' && this.bossRaging()) v *= C.RAGE_PANIC;
    return v;
  },

// 按人格和关卡倍率计算反甩概率，上限为九成。
  parryChance(this: Match, b: Agent): number { return Math.min(0.9, b.p.parry * this.aiVal(b, 'parry')); },

// 当前反甩窗口：每来回一次就缩小
  parryWin(this: Match, f: ThrownPot): number { return C.PARRY_WIN * Math.pow(C.PARRY_DECAY, f.bounces); },

// 玩家按下「甩」：锅正飞向自己且在窗口内 → 反甩；否则能甩就甩；都不行算按空
  pressFire(this: Match, a: Agent): void {
    if (a.crushed) return;
    if (this.S.tut && a.isPlayer && !this.tutCanFire(a)) return;
    let best = null, bt = Infinity;
    for (const f of this.S.throws) {
      if (f.owner === a || f.dead) continue;
      const t = this.incomingTTI(f, a);
      if (t <= this.parryWin(f) && t < bt) { bt = t; best = f; }
    }
    if (best && a.parryLock <= 0) { this.parry(a, best); return; }
    if (this.canFire(a) && this.fireThrow(a)) return;
    a.parryLock = C.WHIFF_LOCK;
  },

// b 把飞来的锅 f 原路弹回给扔锅的人：加速、窗口缩小
  parry(this: Match, b: Agent, f: ThrownPot): void {
    const back = f.owner;
    f.owner = b;
    f.target = back.crushed ? null : back;
    f.bounces++;
    f.speed *= C.PARRY_SPEEDUP;
    f.dist = 0;
    f.range = f.target ? Math.max(C.THROW_RANGE, this.headDist(b, back) + 80) : C.THROW_RANGE;
    f.a = f.target ? Math.atan2(back.sn.y - f.y, back.sn.x - f.x) : f.a + Math.PI;
    f.rolled = new Set();
    b.parries++;
    this.spawnFx('fx_impact', f.x, f.y, 40, 0.25); // 反甩：在锅的位置闪一下
    if (b.isPlayer) {
      this.floats.add(f.bounces >= 2 ? '再弹回去！' : '反甩！', b.sn.x, b.sn.y - 46, '#2F9E6B');
      this.E.sfx('parry');
      this.shake = 4;
    } else if (back.isPlayer) {
      this.floats.add(`${b.name}：这锅不是我的`, b.sn.x, b.sn.y - 40, '#E8504A');
      this.E.sfx('parry');
    } else this.floats.add('弹!', b.sn.x, b.sn.y - 40, '#5E6A84');
  },

// 甩空：锅立刻弹回扔锅的人身上（截止时间照旧）
  missThrow(this: Match, f: ThrownPot, why?: string): void {
    f.dead = true;
    const a = f.owner;
    a.combo = 0;
    if (a.crushed) return;
    if (a.key === 'nephew') f.pot.passAt = this.S.t + this.E.rand(1, 2);
    a.sn.segs.push(f.pot);
    if (a.key === 'nephew' && this.potsOf(a) >= C.MAX_POTS) this.crushNephew(a);
    this.S.arcs.push({ x0: f.x, y0: f.y, to: () => this.tailPos(a), t: 0, dur: 0.25, label: f.label });
    a.misses++;
    if (a.isPlayer) {
      this.floats.add(why === 'wife' ? '老板娘护短，锅弹回来' : why === 'nephew' ? `${this.bossName()}护短，锅弹回来` : why === 'shield' ? '他刚接锅，弹开了' : '甩空了！锅弹回来', a.sn.x, a.sn.y - 40, '#E8504A');
      this.E.sfx('miss');
    }
  },

// 砸中墙（摆设可以飞过去）
  inWall(this: Match, x: number, y: number): boolean {
    if (x < 0 || y < 0 || x > OFFICE.world.w || y > OFFICE.world.h) return true;
    for (const w of OFFICE.walls) if (x > w.x && x < w.x + w.w && y > w.y && y < w.y + w.h) return true;
    return false;
  },

// 每帧：甩出去的锅飞行 → 同事判断要不要反甩 → 砸中路上第一个人 / 飞满射程或撞墙算甩空
  updateThrows(this: Match, dt: number): void {
    for (const f of this.S.throws) {
      if (f.dead) continue;
      if (f.target && !f.target.crushed) {
        const want = Math.atan2(f.target.sn.y - f.y, f.target.sn.x - f.x);
        f.a += this.E.clamp(this.E.angDiff(f.a, want), -C.THROW_TURN * dt, C.THROW_TURN * dt);
      }
      const step = f.speed * dt;
      f.x += Math.cos(f.a) * step;
      f.y += Math.sin(f.a) * step;
      f.dist += step;
      f.spin += dt * 16;

      // 同事（以及 ?auto 时的玩家）：锅进入窗口时掷一次骰子决定接不接得住
      for (const b of this.S.agents) {
        if (b === f.owner || b.crushed || (b.isPlayer && !this.auto) || f.rolled.has(b.id)) continue;
        if (this.incomingTTI(f, b) > this.parryWin(f)) continue;
        f.rolled.add(b.id);
        if (b.parryLock <= 0 && this.E.random() < this.parryChance(b) * Math.pow(0.8, f.bounces)) { this.parry(b, f); break; }
      }

      let victim = null;
      for (const b of this.S.agents) {
        if (b === f.owner || b.crushed) continue;
        if (this.E.dist(f.x, f.y, b.sn.x, b.sn.y) < C.THROW_HIT_R) { victim = b; break; }
      }
      if (victim) {
        if (victim.shield > 0 && !this.nephewGuardian(victim)) this.missThrow(f, 'shield');
        else { f.dead = true; this.landThrow(f, victim); }
      } else if (f.dist >= f.range || this.inWall(f.x, f.y)) this.missThrow(f);
    }
    this.S.throws = this.S.throws.filter((f) => !f.dead);
  },

// 锅 f 砸中 b：归 b（截止时间照旧，越传越烫）；记连甩
  landThrow(this: Match, f: ThrownPot, b: Agent): void {
    const a = f.owner;
    const guardian = this.nephewGuardian(b);
    if (guardian) {
      // 抓现行已在出手时拦截；飞出的锅这里只罚护短，不再检查扔锅者的视野。
      this.missThrow(f, guardian.type === 'wife' ? 'wife' : 'nephew');
      this.addBlame(a, guardian.type === 'wife' ? 3 : 2, `${guardian.name}护短`);
      this.S.nephewProtected++;
      this.floats.add('他还小，你多担待点', guardian.x, guardian.y - 70, '#E8504A');
      return;
    }
    this.spawnFx('fx_impact', b.sn.x, b.sn.y - 26, f.hot ? 70 : 56); // 砸中瞬间的撞击星
    this.receivePot(b, f.pot, a);
    if (a !== b) b.lastMateHitAt = this.S.t; // 只认实际甩中，领导派锅和护短弹回不算
    // 同事甩中主角才记账，弹回自己的锅和带教都不计。
    if (b.isPlayer && !a.isPlayer && !this.S.tut) b.hitsBy.mate++;

    // 连甩：窗口内连续甩中（只做统计和飘字）
    a.combo = a.comboT > 0 ? a.combo + 1 : 1;
    a.comboT = C.COMBO_WINDOW;
    a.maxCombo = Math.max(a.maxCombo, a.combo);
    a.thrown++;
    a.victims[b.name] = (a.victims[b.name] || 0) + 1;

    // 接锅的人：短暂护盾 + 愣住 + 连甩清零 + 记仇
    b.shield = C.RECV_SHIELD;
    b.stun = C.RECV_STUN;
    b.lock[a.id] = this.S.t + C.NO_RETURN;
    b.combo = 0;
    b.angry = 2;
    if (b.key === 'intern') { b.cry = 2; if (this.potsOf(b) >= 3) this.leaderAlert(a, b); }

    if (a.isPlayer && f.bounces > 0) this.praise('parry');
    else if (a.isPlayer && f.bounces === 0 && this.S.player.blames === 0) this.praise('calm');
    if (a.isPlayer) this.tutEvent('land', b);
    if (a.isPlayer) {
      const wasTea = b.teaT > 0;
      if (f.hot) this.floats.add(`急件甩给${b.name}`, b.sn.x, b.sn.y - 44, '#2F9E6B');
      else if (b.key === 'veteran') this.floats.add(wasTea ? '老油条也有今天！' : '甩中老油条！', b.sn.x, b.sn.y - 44, '#2F9E6B');
      else this.floats.add(`甩给${b.name}`, b.sn.x, b.sn.y - 44, '#2F9E6B');
      if (a.combo >= 2) { this.floats.add(`连甩 ×${a.combo}`, a.sn.x, a.sn.y - 54, '#E8504A'); this.E.sfx('combo', { rate: 1 + Math.min(a.combo - 2, 6) * 0.08 }); }
      else this.E.sfx('throw');
    } else if (b.isPlayer) {
      this.floats.add(`${a.name}：这个你来`, b.sn.x, b.sn.y - 40, '#E8504A');
      this.shake = 7;
      this.E.sfx('back');
    } else {
      this.floats.add('甩!', b.sn.x, b.sn.y - 40, '#5E6A84');
    }
  },

/* ---------------- 截止时间：到点在谁身上谁背锅 ---------------- */
  // 给 a 记 n 次背锅，why 为飘字说明
  addBlame(this: Match, a: Agent, n: number, why: string): void {
    if (a.key === 'nephew') return; // 小舅子永远不背锅，截止归责由 explode 按口追溯
    a.blames += n;
    this.tutEvent('blame', a);
    if (a.isPlayer) {
      this.floats.add(`背锅 +${n}：${why}`, a.sn.x, a.sn.y - 40, '#E8504A');
      this.shake = Math.max(this.shake, n > 1 ? 14 : 9);
      this.E.sfx('blame');
    } else this.floats.add(`${a.name} 背锅 +${n}`, a.sn.x, a.sn.y - 40, '#5E6A84');
  },

// 一口锅到点出事：算在 a 头上，锅消失；onBody = 锅在人身上炸（特效跟着人走），否则是空中炸
  explode(this: Match, a: Agent, pot: Pot, pos: Point, onBody?: boolean): void {
    this.S.booms++;
    // 33 帧 × 30fps = 1.1 秒，整段放完；在人身上炸的跟着这个人走，空中炸的留在原地
    const fx = this.spawnFx('pot_explosion', pos.x, pos.y, pot.hot ? 110 : 92, 1.1);
    if (onBody) { fx.follow = a; fx.dx = pos.x - a.sn.x; fx.dy = pos.y - a.sn.y; }
    // 他拿着或正在塞出去的锅到期，算最后甩给他的同事；责任人已出局也照记。
    // 没人甩给他的领导/散会锅到期直接消失，不凭空栽给玩家。
    const liable = a.key === 'nephew' ? pot.nephewSender : a;
    if (liable) this.addBlame(liable, pot.hot ? C.P0_BLAME : 1, a.key === 'nephew' ? '小舅子的锅算你的' : pot.hot ? '急件炸了' : `${pot.label}出事了`);
    if (pot.hot) this.E.sfx('boom', { vol: liable && liable.isPlayer ? 1 : 0.5 });
    if (pot.hot && liable) this.E.toast(liable.isPlayer ? `急件炸在你手里，背锅 +${C.P0_BLAME}` : `急件炸在${liable.name}手里，背锅 +${C.P0_BLAME}`, 2000);
  },

// 每帧：身上到点的锅出事；还在飞的锅到点，算甩它的人
  updateDue(this: Match): void {
    for (const a of this.S.agents) {
      if (a.crushed) continue;
      // 删除前固定每口锅的位置，同帧多口到期也不会串位。
      const positions = a.sn.segs.some((pot) => pot.due <= this.S.t) ? a.sn.positions() : [];
      for (let i = a.sn.segs.length - 1; i >= 0; i--) {
        if (a.sn.segs[i].due > this.S.t) continue;
        const pot = a.sn.segs.splice(i, 1)[0];
        this.explode(a, pot, positions[i], true);
      }
    }
    for (const f of this.S.throws) if (!f.dead && f.pot.due <= this.S.t) { f.dead = true; if (!f.owner.crushed) this.explode(f.owner, f.pot, f); }
  },
};
