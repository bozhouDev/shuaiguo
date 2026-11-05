// 对应原型 js/game.js：navIdx navFree navPt navClear findPath walkTo leaderAlert nearestRoute pickTargets updateLeaderTut updateFace updateLeader；设计依据《这锅你来背-核心玩法》。
import type { Match } from './match';
import type { Agent, Leader, Point } from './types';
import * as C from './config';

export const leadersLogic = {

// 坐标 → 格子编号（越界夹到边上）
  navIdx(this: Match, x: number, y: number): number {
    const c = this.E.clamp(Math.floor(x / C.NAV_CELL), 0, this.NAV.cols - 1), r = this.E.clamp(Math.floor(y / C.NAV_CELL), 0, this.NAV.rows - 1);
    return r * this.NAV.cols + c;
  },

// 某格被堵住时，向外一圈圈找最近的空格
  navFree(this: Match, i: number): number {
    if (!this.NAV.block[i]) return i;
    const c0 = i % this.NAV.cols, r0 = (i / this.NAV.cols) | 0;
    for (let k = 1; k < 12; k++) {
      for (let dr = -k; dr <= k; dr++) for (let dc = -k; dc <= k; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== k) continue;
        const c = c0 + dc, r = r0 + dr;
        if (c < 0 || r < 0 || c >= this.NAV.cols || r >= this.NAV.rows) continue;
        if (!this.NAV.block[r * this.NAV.cols + c]) return r * this.NAV.cols + c;
      }
    }
    return i;
  },

// 格子编号转回格子中心坐标。
  navPt(this: Match, i: number): Point { return ({ x: (i % this.NAV.cols + 0.5) * C.NAV_CELL, y: (((i / this.NAV.cols) | 0) + 0.5) * C.NAV_CELL }); },

// 两点之间是否一路畅通（每 8px 采样一次）
  navClear(this: Match, ax: number, ay: number, bx: number, by: number): boolean {
    const d = this.E.dist(ax, ay, bx, by), n = Math.ceil(d / 8);
    for (let k = 1; k <= n; k++) if (this.NAV.block[this.navIdx(ax + (bx - ax) * k / n, ay + (by - ay) * k / n)]) return false;
    return true;
  },

// A* 寻路（8 方向，不切墙角），结果再拉直：能直线走到的中间点都省掉
  findPath(this: Match, x0: number, y0: number, x1: number, y1: number): Point[] {
    const start = this.navFree(this.navIdx(x0, y0)), goal = this.navFree(this.navIdx(x1, y1));
    const n = this.NAV.cols * this.NAV.rows, g = new Float32Array(n).fill(Infinity), from = new Int32Array(n).fill(-1);
    const gc = goal % this.NAV.cols, gr = (goal / this.NAV.cols) | 0;
    const h = (i: number) => { const dc = Math.abs(i % this.NAV.cols - gc), dr = Math.abs(((i / this.NAV.cols) | 0) - gr); return Math.max(dc, dr) + 0.414 * Math.min(dc, dr); };
    // 二叉堆：按 f = g + h 取最小
    const heap: [number, number][] = [], push = (i: number, f: number) => {
      heap.push([f, i]);
      let k = heap.length - 1;
      while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; }
    }, pop = () => {
      const top = heap[0], last = heap.pop()!;
      if (heap.length) {
        heap[0] = last;
        let k = 0;
        for (;;) {
          const l = 2 * k + 1, r = l + 1;
          let m = k;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === k) break;
          [heap[m], heap[k]] = [heap[k], heap[m]]; k = m;
        }
      }
      return top[1];
    };
    g[start] = 0; push(start, h(start));
    while (heap.length) {
      const i = pop();
      if (i === goal) break;
      const c = i % this.NAV.cols, r = (i / this.NAV.cols) | 0;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const nc = c + dc, nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= this.NAV.cols || nr >= this.NAV.rows) continue;
        const j = nr * this.NAV.cols + nc;
        if (this.NAV.block[j]) continue;
        if (dr && dc && (this.NAV.block[r * this.NAV.cols + nc] || this.NAV.block[nr * this.NAV.cols + c])) continue; // 不切墙角
        const ng = g[i] + (dr && dc ? 1.414 : 1);
        if (ng < g[j]) { g[j] = ng; from[j] = i; push(j, ng + h(j)); }
      }
    }
    if (goal !== start && from[goal] < 0) return [];            // 走不到：原地不动
    const cells = [];
    for (let i = goal; i !== start && i >= 0; i = from[i]) cells.push(this.navPt(i));
    cells.reverse();
    if (!this.NAV.block[this.navIdx(x1, y1)] && cells.length) cells[cells.length - 1] = { x: x1, y: y1 };
    // 拉直
    const out = [];
    let ax = x0, ay = y0, k = 0;
    while (k < cells.length) {
      let far = k;
      while (far + 1 < cells.length && this.navClear(ax, ay, cells[far + 1].x, cells[far + 1].y)) far++;
      out.push(cells[far]);
      ax = cells[far].x; ay = cells[far].y; k = far + 1;
    }
    return out;
  },

// 领导沿路径走向 (tx, ty)：目标挪动较远或到了重算时间才重新寻路；返回离终点的直线距离
  walkTo(this: Match, l: Leader, tx: number, ty: number, spd: number, dt: number, repath: number): number {
    l.repathT -= dt;
    if (!l.goal || this.E.dist(l.goal.x, l.goal.y, tx, ty) > 30 || (repath && l.repathT <= 0)) {
      l.goal = { x: tx, y: ty };
      l.path = this.findPath(l.x, l.y, tx, ty);
      l.repathT = repath || 0;
    }
    let step = spd * dt;
    while (step > 0 && l.path.length) {
      const p = l.path[0], d = this.E.dist(l.x, l.y, p.x, p.y);
      if (d <= step) { l.x = p.x; l.y = p.y; step -= d; l.path.shift(); }
      else { l.x += (p.x - l.x) / d * step; l.y += (p.y - l.y) / d * step; step = 0; }
    }
    return this.E.dist(l.x, l.y, tx, ty);
  },

/* ---------------- 领导 ---------------- */
  // 实习生被欺负太狠：老板（第一位领导）看见了，就冲过来追欺负他的人
  // 老板得在附近才看得见；追完一次要冷却一会儿，否则同事们天天欺负实习生，老板会一直追人
  // 第 1 关（basic）还没讲到这个机制，不追
  leaderAlert(this: Match, bully: Agent, intern: Agent): void {
    const l = (intern.key === 'nephew' && this.S.leaders.find((leader) => leader.type === 'wife')) || this.S.leaders.find((leader) => leader.type === 'boss');
    // 小舅子压垮优先追责，不受新同事的距离、冷却和已有追人限制。
    if (intern.key === 'nephew') {
      if (!l) return;
      l.state = 'chase'; l.st = C.NEPHEW_CHASE; l.chase = bully; l.alertCd = this.S.t + C.ALERT_CD;
      l.path = []; l.goal = null; l.repathT = 0;
      this.E.toast(`${l.name}：${bully.isPlayer ? '你' : bully.name}，给我站住！`, 2000);
      return;
    }
    if (!l || this.L.basic || this.S.tut || l.state === 'chase' || this.S.t < l.alertCd) return;
    if (this.E.dist(l.x, l.y, intern.sn.x, intern.sn.y) > C.ALERT_SEE) return;
    l.state = 'chase'; l.st = C.ALERT_CHASE; l.chase = bully; l.alertCd = this.S.t + C.ALERT_CD;
    this.E.toast(bully.isPlayer ? `${l.name}：谁让新来的干这个的？` : `${l.name}盯上了${bully.name}`, 2000);
    if (bully.isPlayer) this.E.sfx('caught');
  },

// 找离领导最近的巡逻点，回到路线上
  nearestRoute(this: Match, l: Leader): number {
    let bi = 0, bd = Infinity;
    l.route.forEach((p, i) => { const d = this.E.dist(p.x, p.y, l.x, l.y); if (d < bd) { bd = d; bi = i; } });
    return bi;
  },

// 「谁闲着丢给谁」：视野里身上锅最少的几个人（锅数相同随机）
  // 关卡 leaderFocus：老板、经理每次派活有这个概率先点你的名（你在丢锅范围内才算），剩下的名额照旧丢给闲人
  // extra：这次多丢几口（老板发火时 +1）
  pickTargets(this: Match, l: Leader, extra?: number): Agent[] {
    // 查账按完整榜单选第一位在场同事，排除小舅子；距离和玩家身份都不改目标。
    if (l.type === 'wife') return this.ranking().filter((a) => !a.crushed && a.key !== 'nephew').slice(0, 1);
    const count = l.cfg.count + (extra || 0);
    const cand = this.S.agents.filter((a) => !a.crushed && this.E.dist(a.sn.x, a.sn.y, l.x, l.y) < l.cfg.range)
      .map((a) => ({ a, k: this.potsOf(a) + this.E.random() * 0.9 }))
      .sort((x, y) => x.k - y.k);
    const P = this.S.player;
    if (cand.some((c) => c.a === P) && this.E.random() < (this.L.leaderFocus || 0)) {
      return [P].concat(cand.filter((c) => c.a !== P).slice(0, count - 1).map((c) => c.a));
    }
    return cand.slice(0, count).map((c) => c.a);
  },

// 带教时的领导：原地站着（视野照常），只按剧本走位、给人派锅；不追人，撞上也不派锅
  updateLeaderTut(this: Match, l: Leader, dt: number): void {
    if (l.state === 'aim') {
      l.aimT -= dt;
      if (l.aimT <= 0) { for (const t of l.targets) this.addPots(t, 1, l.x, l.y - 20, {src:'leader',from:l.name,t:this.S.t}); l.state = 'patrol'; l.targets = []; l.wait = 99; }
      return;
    }
    // 走到了（或寻路失败没有路径）就算到位，免得带教卡住
    if (l.tgo && (this.walkTo(l, l.tgo.x, l.tgo.y, l.cfg.speed * C.TUT_BOSS_SPEED, dt, 0) < 4 || !l.path.length)) {
      l.tgo = null; l.wait = 99;
      this.tutEvent('arrive', l);
    }
  },

// 领导视野朝向：走路时转向前进方向；停下来左右张望；瞄准时盯着目标；带教剧本可以锁死朝向（faceLock）
  updateFace(this: Match, l: Leader, ox: number, oy: number, dt: number): void {
    if (l.faceLock != null) { l.face = l.baseFace = l.faceLock; return; }
    const dx = l.x - ox, dy = l.y - oy;
    if (l.state === 'aim' && l.targets.length) {
      const t = l.targets[0].sn;
      l.baseFace = Math.atan2(t.y - l.y, t.x - l.x);
      l.face = l.baseFace;
    } else if (dx * dx + dy * dy > 0.04) {
      const want = Math.atan2(dy, dx);
      l.baseFace = want;
      l.face += this.E.clamp(this.E.angDiff(l.face, want), -5 * dt, 5 * dt);
    } else {
      l.face = l.baseFace + Math.sin(this.S.t * 1.4 + l.cfg.count) * 0.8;
    }
  },

// 领导每帧：巡逻 → 瞄准（预警）→ 丢锅；或追欺负实习生的人；撞上谁就给谁派 3 口
  // 老板丢锅时有 L.skyChance 的概率改成天降锅，只砸主角
  // 领导走路都走寻路路径，不会穿墙 / 穿桌子
  updateLeader(this: Match, l: Leader, dt: number): void {
    const ox = l.x, oy = l.y;
    if (this.S.tut) { this.updateLeaderTut(l, dt); this.updateFace(l, ox, oy, dt); return; }
    // 清账取消待发瞄准和发火，巡逻/查岗/追人/碰撞照常，冷却不再消耗。
    const clearing = this.isClearing();
    if (clearing) {
      if (l.state === 'aim') l.state = 'patrol';
      l.targets = []; l.rageUntil = 0; l.afterMeetingHot = false;
    }
    if (l.meeting) { this.updatePieMeeting(l, dt); return; } // 讲话时站定，不瞄准、不派锅、不碰撞派活
    if (l.state === 'chase') {
      l.st -= dt;
      this.walkTo(l, l.chase!.sn.x, l.chase!.sn.y, C.ALERT_SPEED, dt, 0.4);
      if (l.st <= 0 || l.chase!.crushed) { l.state = 'patrol'; l.chase = null; l.i = this.nearestRoute(l); }
    } else if (l.state === 'aim') {
      l.aimT -= dt;
      if (l.aimT <= 0) {
        for (const t of l.targets) if (!t.crushed) this.launchPot(l.x, l.y - 20, t, 0, false, 'leader', l.name);
        if (l.targets.includes(this.S.player)) this.E.sfx('leaderThrow');
        l.state = 'patrol';
      }
    } else {
      const mad = this.raging(l), inspecting = (l.inspectUntil || 0) > this.S.t && !this.S.player.crushed;
      if (inspecting) {
        // 查岗：直奔主角走过去（绕障碍），走到跟前约 110 停下盯着你看——视野罩住你，这时甩锅就被抓
        const P = this.S.player.sn;
        if (this.E.dist(l.x, l.y, P.x, P.y) > C.INSPECT_STOP) { l.faceLock = null; this.walkTo(l, P.x, P.y, l.cfg.speed * C.INSPECT_SPEED, dt, 0.5); }
        else l.faceLock = Math.atan2(P.y - l.y, P.x - l.x);
      } else if (l.inspectUntil) {
        l.inspectUntil = 0; l.faceLock = null; l.i = this.nearestRoute(l); l.path = []; l.goal = null; // 查完回到巡逻路线
      } else if (l.wait > 0) l.wait -= mad ? dt * 3 : dt; // 发火时坐不住
      else {
        const p = l.route[l.i];
        if (this.walkTo(l, p.x, p.y, l.cfg.speed * (mad ? C.RAGE_SPEED : 1), dt, 0) < 4 || !l.path.length) { l.wait = p.wait || 0; l.i = (l.i + 1) % l.route.length; }
      }
      if (this.S.pace && !clearing) {
        l.throwCd -= dt;
        if (l.throwCd <= 0) {
          l.throwCd = this.S.pace.every * l.cfg.everyMul * (mad ? C.RAGE_EVERY : 1) * this.E.rand(0.85, 1.15);
          l.targets = [];
          // 保护期内随机到天降锅也走普通瞄准派锅，保留原派锅节奏。发火时不丢天降锅，全部瞄准丢、一次多丢一口
          // 天降锅保底：上一口天降锅落下不到 SKY_GAP 秒，这次照常瞄准派锅（随机数照样消耗，节奏不变）
          // 预警落地也须早于清账，临界摇到天降仍走普通瞄准，不吞掉这次派锅。
          const skyReady = this.S.t - this.S.lastSkyT >= C.SKY_GAP && this.workT() + C.SKY_TIME < this.L.duration - C.CLEARING;
          if (!mad && l.type === 'boss' && this.E.random() < (this.L.skyChance || 0) && skyReady && !(this.S.buff === 'trip' && this.workT() < 30)) this.launchSky(this.S.player, l);
          else l.targets = this.pickTargets(l, mad ? 1 : 0);
          if (l.targets.length) {
            l.state = 'aim'; l.aimT = (l.cfg.aimTime ?? C.AIM_TIME) * (mad ? C.RAGE_AIM : 1);
            if (l.type === 'wife') {
              l.pieSay = '账做得这么干净？我查查'; l.pieSayUntil = this.S.t + 2;
              // 提示 20 秒最多一次，免得玩家一直领先时每次派锅都刷屏；头顶气泡和瞄准音效照常
              // 提示每局只弹一次（之后靠头顶气泡和瞄准音效），免得玩家一直领先时刷屏
              if (l.targets.includes(this.S.player) && !this.S.wifeToastAt) { this.S.wifeToastAt = this.S.t; this.E.toast('同事里你排第 1，老板娘查你账！快躲红线', 2400); }
            }
            if (l.targets.includes(this.S.player)) this.E.sfx('aim');
          }
        }
      }
    }
    this.updateFace(l, ox, oy, dt);
    // 撞上领导：+3 口
    for (const a of this.S.agents) {
      if (a.crushed || this.itemInvincible(a) || (l.hitCd[a.id] || 0) > this.S.t) continue;
      if (this.E.dist(l.x, l.y, a.sn.x, a.sn.y) < C.HEAD_R + 28) {
        this.addPots(a, C.LEADER_HIT_POTS, l.x, l.y, {src:'bump', from:l.name, t:this.S.t, id:this.S.leaderHits + 1});
        if (a.isPlayer && !this.S.tut) a.hitsBy.bump += C.LEADER_HIT_POTS; // 碰撞单独统计，不混入飞行锅
        this.spawnFx('fx_impact', a.sn.x, a.sn.y - 26, 72, 0.45);
        this.S.leaderHits++;
        l.hitCd[a.id] = this.S.t + 3;
        if (l.chase === a) { l.state = 'patrol'; l.chase = null; l.i = this.nearestRoute(l); }
        if (a.isPlayer) { this.floats.add(`${l.name}：这几个你跟一下`, a.sn.x, a.sn.y - 44, '#E8504A'); this.shake = 13; this.E.sfx('bump'); this.E.buzz(80); }
        else this.floats.add(`+${C.LEADER_HIT_POTS}`, a.sn.x, a.sn.y - 40, '#E8504A');
      }
    }
  },
};
