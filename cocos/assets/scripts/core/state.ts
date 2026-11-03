// 对应原型 js/game.js：passRank rankWords potsOf potLife newPot urgentIdx urgentLeft holdsHot carryOf debtOf fmtDebt headDist workT clockAt cleanBossName makeAgent giveStartPots makeLeader makeState incidentLeader buildSchedule；设计依据《这锅你来背-核心玩法》。
import type { Match } from './match';
import type { Agent, Pot, Leader, State, LeaderDef, Incident, ScheduleItem } from './types';
import type { Snake } from './engine';
import { OFFICE } from './levels';
import * as C from './config';

export const stateLogic = {

// 下班名额按关卡读取；旧关默认前三，显示文案保持不变。
  passRank(this: Match): number { return this.L.passRank ?? 3; },

// 下班名额转成界面使用的短文案。
  rankWords(this: Match): string { return this.passRank() === 3 ? '前三' : this.passRank() === 2 ? '前两名' : `前${this.passRank()}`; },

  /* ---------------- 工具 ---------------- */
  // 当前身上锅数
  potsOf(this: Match, a: Agent): number { return a.sn.segs.length; },

// 本关锅的截止时长
  potLife(this: Match): number { return this.L.potLife || C.DUE_DEFAULT; },

// 新的一口锅：label 锅上的字，due 到点时刻（对局秒数），hot 是否 P0
  // 带教期间的锅不走时间（due = Infinity），开始上班时再统一起算
  newPot(this: Match, t: number, hot?: boolean, label?: string): Pot {
    return { label: hot ? '急件' : label || this.E.pick(OFFICE.potLabels), due: this.S && this.S.tut ? Infinity : t + (hot ? C.P0_LIFE : this.potLife()), hot: !!hot };
  },

// 某人身上最急的一口锅的下标（没有锅返回 -1）
  urgentIdx(this: Match, a: Agent): number {
    let bi = -1;
    a.sn.segs.forEach((p, i) => { if (bi < 0 || p.due < a.sn.segs[bi].due) bi = i; });
    return bi;
  },

// 某人身上最急的一口锅还剩几秒（没有锅返回 Infinity）
  urgentLeft(this: Match, a: Agent): number { const i = this.urgentIdx(a); return i < 0 ? Infinity : a.sn.segs[i].due - this.S.t; },

// 某人身上有没有 P0
  holdsHot(this: Match, a: Agent): boolean { return a.sn.segs.some((p) => p.hot); },

// 总账 = 背锅次数（炸了的锅）+ 身上还背着的锅 × CARRY_W；急件按炸了的分量（P0_BLAME）折算。排名、HUD、结算都看它
  carryOf(this: Match, a: Agent): number { return a.sn.segs.reduce((sum, p) => sum + (p.hot ? C.P0_BLAME : 1), 0) * C.CARRY_W; },

// 总账等于背锅次数加上身上锅的折算。
  debtOf(this: Match, a: Agent): number { return a.blames + this.carryOf(a); },

// 总账显示：整数不带小数，半口显示成 .5
  fmtDebt(this: Match, x: number): string { return (Number.isInteger(x) ? String(x) : x.toFixed(1)); },

// 两个打工人蛇头之间的距离
  headDist(this: Match, a: Agent, b: Agent): number { return this.E.dist(a.sn.x, a.sn.y, b.sn.x, b.sn.y); },

// 上班时钟：开始上班后过了几秒（带教期间 t0 = Infinity，结果是 -Infinity，时钟停在 09:00）
  // S.t 是对局物理时间（锅的截止、动画都用它），派锅节奏、散会、下班判定都用上班时钟
  workT(this: Match): number { return this.S.t - this.S.t0; },

// 上班秒数 → 屏幕时钟文字（09:00 ~ 18:00）
  clockAt(this: Match, t: number): string {
    const mins = (this.E.clamp(t, 0, this.L.duration) / this.L.duration) * 9 * 60;
    const hh = 9 + Math.floor(mins / 60), mm = Math.floor(mins % 60);
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  },

// 自定义称呼按 Unicode 字符计数，去掉控制字符；空白恢复默认。
  cleanBossName(this: Match, value: unknown): string {
    return Array.from(typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f-\u009f]/g, '').trim() : '').slice(0, 6).join('');
  },

/* ---------------- 对局状态 ---------------- */
  // 创建一个打工人（玩家或机器人同事共用这一个结构）
  // noPots：带教时同事开局不带锅（开始上班时再发，见 startWork）
  makeAgent(this: Match, id: number, key: string, x: number, y: number, isPlayer: boolean, noPots?: boolean): Agent {
    const p = C.PERSONAS[key];
    const sn = new this.E.Snake(x, y, { speed: C.BASE_SPEED * p.speed, turn: p.turn, spacing: 22 }); // 锅缩小后尾巴间距同步收紧
    sn.angle = isPlayer ? 0 : this.E.rand(0, Math.PI * 2);
    if (!isPlayer && !noPots && key !== 'nephew') this.giveStartPots(sn, 0);
    return {
      id, key, p, name: p.name, isPlayer, sn,
      want: sn.angle, thinkT: this.E.rand(0, 0.3), target: null,   // AI：想去的方向、思考倒计时、想甩锅的对象
      blames: 0, caught: 0, alarmed: false,                    // 背锅次数、被领导抓现行次数、是否已提示快压垮
      hitsBy: { sky: 0, leader: 0, burst: 0, mate: 0, bump: 0 }, // 正式上班后的中锅来源
      thrown: 0, combo: 0, comboT: 0, maxCombo: 0, victims: {},
      cool: 0, stun: 0, shield: 0, lock: {},                  // lock[对方 id] = 到这个时间前同事不会主动瞄准他
      parryLock: 0, launched: 0, misses: 0, parries: 0,        // 按空惩罚、出手次数、甩空次数、反甩次数
      aimTgt: null,                                            // 当前锁定的瞄准目标
      cry: 0, teaCd: this.E.rand(8, 12), teaT: 0, angry: 0,
      piesEaten: 0, hypeUntil: 0, pieBatch: 0, wantsPie: false, lastMateHitAt: -Infinity,
      received: 0, lastThrower: null, // 小舅子接锅统计、最后实际甩中他的人
      crushed: false, crushedAt: 0,
      stuckT: 0, lastX: x, lastY: y, panicT: 0,                // 卡墙检测
    };
  },

// 同事开局自带的锅：截止时间打散，免得同一时刻一起到点
  giveStartPots(this: Match, sn: Snake, t: number): void {
    for (let i = 0; i < this.L.startPots; i++) { const pot = this.newPot(t); pot.due = t + this.E.rand(0.5, 1) * this.potLife(); sn.segs.push(pot); }
  },

// 创建一位领导
  makeLeader(this: Match, def: LeaderDef): Leader {
    const cfg = C.LEADER_TYPES[def.type], route = OFFICE.routes[def.route];
    return {
      type: def.type, cfg, name: def.type === 'boss' ? this.bossName() : cfg.name, route, x: route[0].x, y: route[0].y, i: 1, wait: 1.5,
      tgo: null, faceLock: null,                              // 带教剧本：要走去的点、锁死的视野朝向
      path: [], goal: null, repathT: 0,                       // 寻路：当前路径、目标点、下次重算倒计时
      state: 'patrol', st: 0, aimT: 0, targets: [], chase: null, hitCd: {}, alertCd: 0,
      throwCd: this.E.rand(0, 1.5),
      face: Math.PI / 2, baseFace: Math.PI / 2,               // 视野朝向：走路时朝前进方向，停下时左右张望
    };
  },

// 生成一局的初始状态；tut 为真时先走带教（同事站到带教位置、开局不带锅，上班时钟先不走）
  makeState(this: Match, tut = false, buff?: string | null): State {
    buff = tut ? null : buff || null; // 带教不带增益，时间表生成时就确定本局增益
    const spots = tut ? this.L.tutorial!.spots : {};
    const player = this.makeAgent(0, 'me', OFFICE.player.x, OFFICE.player.y, true);
    const bots = this.L.bots.map((k, i) => { const sp = spots[k] || OFFICE.spawns[i]; return this.makeAgent(i + 1, k, sp.x, sp.y, false, tut); });
    return {
      pies: [], pieBatch: 0, pieMeetingsDone: 0, piesSpawned: 0, piesExpired: 0,
      nephewProtected: 0, nephewCrushed: false, // 护短次数与本局隐藏成就
      praiseAt: {}, outSince: null, // 同类冷却与连续掉出前三的起点，每局重置
      buff, buffUsed: false,
      t: 0, t0: tut ? Infinity : 0, player, bots, agents: [player, ...bots],
      leaders: this.L.leaders.map(this.makeLeader),
      flying: [], throws: [], arcs: [], fx: [], tea: 0,
      pace: null, paceIdx: -1, schedule: this.buildSchedule(buff), hintIdx: 0, tipsShown: {},
      // 带教进度：i 当前步，timers 本步的定时器，ring 要走到的黄圈，victim 第一次甩中的同事
      tut: tut ? { i: -1, timers: [], ring: null, step: null, def: null, done: false, victim: null, showRank: false } : null,
      finale: false, finMsg: false, finDone: false,                  // 收尾（下午茶）：是否进行中 / 群消息发了没 / 触发过没
      skyFirst: !tut, revived: false, rescued: false, over: null, lastTick: 0, spawned: 0, leaderHits: 0, booms: 0, skies: 0,
    };
  },

// 临时事件由哪位领导发起：inc.who 写领导类型（默认老板），本关没有这位领导就不发生；返回关卡里的领导定义
  incidentLeader(this: Match, inc: Incident): LeaderDef | null {
    return this.L.leaders.find((d) => d.type === (inc.who || 'boss')) || null;
  },

// 排好本局的时间表：散会预告 + 散会喷锅 + 随机事件 + 临时事件
  buildSchedule(this: Match, buff?: string | null): ScheduleItem[] {
    const list = [];
    const early = buff === 'news' ? 2 : 0; // 只提前预告，不挪动事件发生时刻
    for (const b of this.L.bursts) {
      list.push({ t: b.t - 2.5 - early, act: 'msg', text: b.msg.replace('{time}', this.clockAt(b.t)) });
      list.push({ t: b.t, act: 'burst', src: b.src, n: b.n });
    }
    // 画饼会议只给老板：固定提前 2.5 秒通知，消息增益不改变这个节拍。
    for (const meeting of this.L.pieMeetings || []) {
      list.push({ t: meeting.t - 2.5, act: 'msg', text: `【全员群】${this.bossName()}：大家停一下，开个三分钟短会。` });
      list.push({ t: meeting.t, act: 'pieMeeting', meeting });
    }
    // 随机事件：从池子里抽 n 个不重复的，把时间窗切成 n 段，每段里随机一个时刻
    const ev = this.L.events;
    if (ev && ev.n) {
      const kinds = this.E.shuffle(ev.pool).slice(0, ev.n);
      const span = (ev.window[1] - ev.window[0]) / kinds.length;
      kinds.forEach((kind, i) => {
        const t = ev.window[0] + span * i + this.E.rand(0.15, 0.85) * span;
        list.push({ t: t - early, act: 'msg', text: this.bossText(C.EVENTS[kind].msg) });
        list.push({ t: t + 2, act: 'event', kind });
      });
    }
    // 临时事件（老板发火、领导查岗）：固定时刻，先发群消息，2 秒后生效
    for (const inc of this.L.incidents || []) {
      const who = this.incidentLeader(inc);
      if (!who) continue;
      // 与其余称呼出口一致，回调替换不把用户输入里的 $& 当作替换语法。
      const text = this.E.shuffle(C.INCIDENT_MSGS[inc.kind].slice())[0].replace('{boss}', () => this.bossName()).replace('{who}', () => who.type === 'boss' ? this.bossName() : C.LEADER_TYPES[who.type].name);
      list.push({ t: inc.t - 2 - early, act: 'msg', text });
      list.push({ t: inc.t, act: 'incident', inc });
    }
    return list.sort((a, b) => a.t - b.t);
  },
};
