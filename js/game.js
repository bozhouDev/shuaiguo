/* =========================================================
 * 甩锅侠 · 主逻辑（v2：所有人都在甩锅）
 * 核心循环：领导远程丢锅 / 会议室散会喷锅 / 随机事件 → 被砸中就粘在身后（锅多不减速）
 *          → 按「甩」把尾巴上的锅扔出去：砸中谁就是谁的，甩空立刻弹回自己身上；锅飞来时按「甩」能反甩
 *          → 18:00 按身上剩余锅数排名，进前三过关
 * 玩家和机器人同事是同一种「打工人」，唯一区别是方向由手指给还是由 AI 给
 * ========================================================= */
(function () {
  'use strict';

  const OFFICE = window.OFFICE, LEVELS = window.LEVELS;
  const st = E.createStage(), ctx = st.ctx, inp = E.createInput(st.c, document.getElementById('btnThrow'));

  // 像素素材（assets/px/*.png）。角色图按「基础名_状态」命名，见 personSprite / leaderSprite
  const SPRITES = [
    'player_normal', 'player_panic', 'player_crushed', 'player_win',
    'pm_normal', 'pm_hit', 'pm_angry', 'pm_flat', 'tester_normal', 'tester_hit', 'tester_angry', 'tester_flat',
    'designer_normal', 'designer_hit', 'designer_angry', 'designer_flat',
    'veteran_normal', 'veteran_tea', 'veteran_hit', 'veteran_flat', 'intern_normal', 'intern_cry', 'intern_hit', 'intern_flat',
    'boss_walk', 'boss_aim', 'boss_chase', 'boss_idle', 'director_walk', 'director_aim', 'director_chase', 'director_idle',
    'wok', 'wok_flying', 'fx_anger', 'fx_tears', 'fx_sweat', 'fx_dizzy', 'fx_impact', 'ui_wok', 'desk', 'meeting_table', 'boss_desk', 'plant', 'plant_small', 'printer', 'cooler',
    'cabinet', 'whiteboard', 'tea_counter', 'sofa'];
  for (const who of ['player', 'pm', 'tester', 'designer', 'veteran', 'intern', 'boss', 'director'])
    for (const d of 'dus') for (let i = 0; i < 4; i++) SPRITES.push(`${who}_walk_${d}${i}`);
  // 角色绘制尺寸：脚底相对蛇头坐标的下移量、各类人物的高度、躺平时的宽度
  const FOOT_DY = 20, PLAYER_H = 70, NPC_H = 64, FLAT_W = 74;

  /* ---------------- 手感参数（调数值主要改这里） ---------------- */
  const BASE_SPEED = 145;      // 移动速度（手机屏幕小，不能太快；背多少锅都不减速）
  const TURN_ONLY_MAG = 0.35;  // 摇杆只轻推（小于底座半径的这个比例）时原地转向不走，方便站着瞄准
  const HEAD_R = 18;           // 蛇头碰撞半径
  const THROW_SPEED = 620;     // 甩出去的锅飞多快（要快，慢了没意义）
  const THROW_TURN = 6;        // 甩出去的锅追踪目标的转向速度（擦边也能拐进去）
  const THROW_RANGE = 200;     // 甩出去的锅最远飞多远，飞满还没砸中人就算甩空（比扇形略远，留点余量给走动的目标）
  const THROW_HIT_R = HEAD_R + 22; // 甩出去的锅砸中判定半径（比领导的锅宽松）
  const AIM_RANGE = 150;       // 自动瞄准：扇形半径（v2.5 从 300 减半，要贴近了才甩得中）
  const AIM_CONE = 0.26;       // 自动瞄准：扇形半角，前进方向左右各约 15°（总开角约 30°）
  const THROW_CD = 0.6;        // 甩一次后多久才能再甩
  const PARRY_WIN = 0.22;      // 反甩判定窗口：锅离砸中你还剩几秒内按「甩」才算
  const PARRY_DECAY = 0.75;    // 每反甩一次，下一次判定窗口缩小到几倍（来回几次必有人接住）
  const PARRY_SPEEDUP = 1.12;  // 每反甩一次锅加速
  const PARRY_PTS = 15;        // 反甩成功得分
  const WHIFF_LOCK = 0.4;      // 按空（没锅可甩也没东西可弹）后多久不能反甩，防止狂按
  const COMBO_WINDOW = 2.5;    // 连甩判定窗口（秒）
  const RECV_SHIELD = 0.8;     // 刚接锅的人多久内甩不中（锅会弹开，算甩空）
  const RECV_STUN = 0.4;       // 接锅后愣多久才能甩出去
  const NO_RETURN = 1.5;       // 同事接锅后多久内不会主动瞄准刚甩给他的人（玩家不受限）
  const DIGEST_TIME = 15;      // 每人每隔几秒自己消化掉一口锅（所有人相同）
  const MAX_POTS = 20;         // 背满即被压垮
  const POT_SPEED = 105;       // 领导 / 散会飞出来的锅速度（按移动速度同比例放慢，保证横移躲得开）
  const POT_TURN = 1.5;        // 飞行锅转向速度（越小越好躲）
  const POT_LIFE = 7;          // 飞行锅存活时间
  const AIM_TIME = 0.8;        // 领导瞄准预警时长
  const LEADER_HIT_POTS = 3;   // 撞上领导一次派几口
  const ALERT_SEE = 480;       // 老板离实习生多近才「看得见」有人欺负他
  const ALERT_CD = 15;         // 老板追完一次后多久内不再追
  const ALERT_CHASE = 4;       // 老板追人时长
  const ALERT_SPEED = 120;     // 老板追人速度（略慢于人，绕障碍追）
  const HOT_TIME = 10;         // P0 烫手山芋倒计时
  const HOT_POTS = 4;          // P0 炸在谁手里，谁 +几口
  const FINAL_RUSH = 10;       // 最后几秒进入排名冲刺
  const PASS_RANK = 3;         // 进前几名过关

  // 同事人格：speed 速度倍率；turn 转向；react 思考间隔；aggr 甩锅积极度；seekR 找人半径；
  // seekMin 身上几口锅才开始找人甩；dodge 躲锅能力；caution 躲人/躲领导；mult 甩中他的得分倍率；
  // parry 锅飞来时反甩成功的概率；throwR 目标进入多近才出手
  const PERSONAS = {
    me:       { name: '你', sprite: 'player', speed: 1, turn: 5.2, react: 0.2, aggr: 1, seekR: 520, seekMin: 1, dodge: 0.9, caution: 0.7, mult: 1, parry: 0.5, throwR: 130 },
    pm:       { name: '产品经理', sprite: 'pm', speed: 0.93, turn: 4.6, react: 0.22, aggr: 1, seekR: 520, seekMin: 1, dodge: 0.8, caution: 0.6, mult: 1, parry: 0.35, throwR: 120 },
    tester:   { name: '测试小王', sprite: 'tester', speed: 0.88, turn: 4.4, react: 0.24, aggr: 0.85, seekR: 440, seekMin: 1, dodge: 1, caution: 0.8, mult: 1, parry: 0.4, throwR: 110 },
    intern:   { name: '实习生', sprite: 'intern', speed: 0.85, turn: 4, react: 0.36, aggr: 0.4, seekR: 260, seekMin: 3, dodge: 0.45, caution: 1, mult: 1, parry: 0.1, throwR: 90 },
    veteran:  { name: '老油条', sprite: 'veteran', speed: 0.95, turn: 4.8, react: 0.2, aggr: 0.65, seekR: 320, seekMin: 2, dodge: 1.3, caution: 1.3, mult: 3, parry: 0.65, throwR: 110, tea: true },
    designer: { name: '设计师', sprite: 'designer', speed: 0.9, turn: 4.5, react: 0.26, aggr: 0.75, seekR: 400, seekMin: 1, dodge: 0.9, caution: 0.9, mult: 1, parry: 0.3, throwR: 115 },
  };

  // 领导类型：count 一次丢几口（分别瞄准锅最少的几个人）；range 视野；everyMul 丢锅间隔倍率
  const LEADER_TYPES = {
    boss:     { name: '老板', sprite: 'boss', h: 94, emoji: '🤵', speed: 68, count: 1, range: 700, everyMul: 1 },
    director: { name: '总监', sprite: 'director', h: 86, emoji: '👔', speed: 80, count: 2, range: 600, everyMul: 1.3 },
  };

  // 随机事件：先发群消息，2 秒后生效
  const EVENTS = {
    printer: { msg: '【全员群】行政：打印机又卡纸了！谁离得近去看一下' },
    tea: { msg: '【全员群】HR：下午茶到了，茶水间自取 🧋' },
    p0: { msg: '【技术群】老板：@所有人 线上 P0 事故，谁来跟一下？' },
  };

  // 所有碰撞体：墙 + 有碰撞框的摆设
  const obstacles = OFFICE.walls.concat(OFFICE.props.filter((p) => p.hit).map((p) => p.hit));
  const floats = new E.Floats();
  const query = new URLSearchParams(location.search);
  let auto = query.has('auto');  // ?auto=1：玩家也交给 AI（调试 / 平衡测试用）
  let L = LEVELS[0];             // 当前关卡
  let S = null;                  // 当前对局状态
  let mode = 'loading';          // loading | intro | play | pause | over
  let shake = 0;                 // 屏幕震动
  let hintTimer = 0;             // 当前提示剩余显示时间
  let msgTimer = 0;              // 群消息剩余显示时间
  let rankSig = '';              // 排名面板内容签名（不变就不刷新 DOM）

  /* ---------------- 工具 ---------------- */
  // 当前身上锅数
  const potsOf = (a) => a.sn.segs.length;
  // 两个打工人蛇头之间的距离
  const headDist = (a, b) => E.dist(a.sn.x, a.sn.y, b.sn.x, b.sn.y);
  // 对局秒数 → 屏幕时钟文字（09:00 ~ 18:00）
  function clockAt(t) {
    const mins = (E.clamp(t, 0, L.duration) / L.duration) * 9 * 60;
    const hh = 9 + Math.floor(mins / 60), mm = Math.floor(mins % 60);
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }
  // 读取 / 保存闯关进度（存储不可用时静默失败）
  function loadProgress() {
    try { return JSON.parse(localStorage.getItem('shuaiguo_v2')) || { unlocked: 1, best: {} }; } catch (_) { return { unlocked: 1, best: {} }; }
  }
  function saveProgress(p) { try { localStorage.setItem('shuaiguo_v2', JSON.stringify(p)); } catch (_) { /* 忽略 */ } }

  /* ---------------- 对局状态 ---------------- */
  // 创建一个打工人（玩家或机器人同事共用这一个结构）
  function makeAgent(id, key, x, y, isPlayer) {
    const p = PERSONAS[key];
    const sn = new E.Snake(x, y, { speed: BASE_SPEED * p.speed, turn: p.turn, spacing: 22 }); // 锅缩小后尾巴间距同步收紧
    sn.angle = isPlayer ? 0 : E.rand(0, Math.PI * 2);
    for (let i = 0; i < L.startPots; i++) sn.segs.push(E.pick(OFFICE.potLabels));
    return {
      id, key, p, name: p.name, isPlayer, sn,
      want: sn.angle, thinkT: E.rand(0, 0.3), target: null,   // AI：想去的方向、思考倒计时、想甩锅的对象
      score: 0, thrown: 0, combo: 0, comboT: 0, maxCombo: 0, victims: {},
      cool: 0, stun: 0, shield: 0, lock: {},                  // lock[对方 id] = 到这个时间前同事不会主动瞄准他
      parryLock: 0, launched: 0, misses: 0, parries: 0,        // 按空惩罚、出手次数、甩空次数、反甩次数
      aimTgt: null,                                            // 当前锁定的瞄准目标
      digestT: DIGEST_TIME, cry: 0, teaCd: E.rand(8, 12), teaT: 0, angry: 0,
      crushed: false, crushedAt: 0,
      stuckT: 0, lastX: x, lastY: y, panicT: 0,                // 卡墙检测
    };
  }
  // 创建一位领导
  function makeLeader(def) {
    const cfg = LEADER_TYPES[def.type], route = OFFICE.routes[def.route];
    return {
      type: def.type, cfg, name: cfg.name, route, x: route[0].x, y: route[0].y, i: 1, wait: 1.5,
      path: [], goal: null, repathT: 0,                       // 寻路：当前路径、目标点、下次重算倒计时
      state: 'patrol', st: 0, aimT: 0, targets: [], chase: null, hitCd: {}, alertCd: 0,
      throwCd: E.rand(0, 1.5),
    };
  }
  // 生成一局的初始状态
  function makeState() {
    const player = makeAgent(0, 'me', OFFICE.player.x, OFFICE.player.y, true);
    const bots = L.bots.map((k, i) => makeAgent(i + 1, k, OFFICE.spawns[i].x, OFFICE.spawns[i].y, false));
    return {
      t: 0, player, bots, agents: [player, ...bots],
      leaders: L.leaders.map(makeLeader),
      flying: [], throws: [], arcs: [], fx: [], hot: null, tea: 0,
      pace: null, paceIdx: -1, schedule: buildSchedule(), hintIdx: 0,
      firstThrow: true, revived: false, rescued: false, over: null, lastTick: 0, spawned: 0, leaderHits: 0, hotBooms: 0,
    };
  }
  // 排好本局的时间表：散会预告 + 散会喷锅 + 随机事件
  function buildSchedule() {
    const list = [];
    for (const b of L.bursts) {
      list.push({ t: b.t - 2.5, act: 'msg', text: b.msg.replace('{time}', clockAt(b.t)) });
      list.push({ t: b.t, act: 'burst', src: b.src, n: b.n });
    }
    // 随机事件：从池子里抽 n 个不重复的，把时间窗切成 n 段，每段里随机一个时刻
    const ev = L.events;
    if (ev && ev.n) {
      const kinds = E.shuffle(ev.pool).slice(0, ev.n);
      const span = (ev.window[1] - ev.window[0]) / kinds.length;
      kinds.forEach((kind, i) => {
        const t = ev.window[0] + span * i + E.rand(0.15, 0.85) * span;
        list.push({ t, act: 'msg', text: EVENTS[kind].msg });
        list.push({ t: t + 2, act: 'event', kind });
      });
    }
    return list.sort((a, b) => a.t - b.t);
  }

  /* ---------------- 锅：加到身上 / 尾巴位置 ---------------- */
  // 当前尾巴位置（没有身体时为蛇头）
  function tailPos(a) {
    const p = a.sn.positions();
    return p.length ? p[p.length - 1] : { x: a.sn.x, y: a.sn.y };
  }
  // 给某人加 n 口锅（从 (fx, fy) 飞到尾巴的动画只是视觉），连甩清零
  function addPots(a, n, fx, fy) {
    for (let i = 0; i < n; i++) {
      const label = E.pick(OFFICE.potLabels);
      a.sn.segs.push(label);
      S.arcs.push({ x0: fx, y0: fy, to: () => tailPos(a), t: -i * 0.08, dur: 0.4, label });
    }
    a.combo = 0;
  }

  /* ---------------- 飞行的锅 ---------------- */
  // 发射一口锅：warn > 0 时先在原地预警再起飞；target 为追踪的打工人
  function launchPot(x, y, target, warn, hot) {
    S.flying.push({
      phase: warn > 0 ? 'warn' : 'fly', t: warn, warn0: warn, x, y, target, hot: !!hot,
      a: Math.atan2(target.sn.y - y, target.sn.x - x), spin: 0, life: POT_LIFE,
      label: hot ? 'P0' : E.pick(OFFICE.potLabels),
    });
    S.spawned++;
  }
  // 离 (x, y) 最近的还没被压垮的打工人
  function nearestAgent(x, y, except) {
    let best = null, bd = Infinity;
    for (const a of S.agents) {
      if (a.crushed || a === except) continue;
      const d = E.dist(a.sn.x, a.sn.y, x, y);
      if (d < bd) { bd = d; best = a; }
    }
    return best;
  }
  // 飞行锅每帧：预警 → 限速转向追踪目标 → 砸中路上碰到的任何人
  function updateFlying(dt) {
    for (const f of S.flying) {
      if (f.phase === 'warn') {
        f.t -= dt;
        if (f.t <= 0) { f.phase = 'fly'; f.a = Math.atan2(f.target.sn.y - f.y, f.target.sn.x - f.x); }
        continue;
      }
      if (f.phase === 'drop') { f.t -= dt; if (f.t <= 0) f.dead = true; continue; }
      if (f.target.crushed) f.target = nearestAgent(f.x, f.y) || f.target;
      const tg = f.target.sn;
      const want = Math.atan2(tg.y - f.y, tg.x - f.x);
      const turn = f.hot ? POT_TURN * 1.6 : POT_TURN;
      f.a += E.clamp(E.angDiff(f.a, want), -turn * dt, turn * dt);
      f.x += Math.cos(f.a) * POT_SPEED * dt;
      f.y += Math.sin(f.a) * POT_SPEED * dt;
      f.spin += dt * 8;
      if (!f.hot) f.life -= dt;
      // 砸中路上碰到的第一个人——躲开了，锅可能就砸在别人头上
      const victim = S.agents.find((a) => !a.crushed && E.dist(f.x, f.y, a.sn.x, a.sn.y) < HEAD_R + 14);
      if (victim) { f.dead = true; potHit(victim, f); }
      else if (f.life <= 0 || inWall(f.x, f.y)) { f.phase = 'drop'; f.t = 0.5; } // 飞太久或撞墙就掉地上
    }
    S.flying = S.flying.filter((f) => !f.dead);
  }
  // 飞行锅砸中某人
  // 冒一个一次性特效（如撞击星）：name 贴图名，size 绘制宽度，dur 持续秒数
  function spawnFx(name, x, y, size, dur) {
    S.fx.push({ name, x, y, size, t: 0, dur: dur || 0.35 });
  }
  function potHit(a, f) {
    spawnFx('fx_impact', a.sn.x, a.sn.y - 26, 54);
    if (f.hot) { grabHot(a, null); return; }
    a.sn.segs.push(f.label);
    a.combo = 0;
    if (a.isPlayer) {
      floats.add('+1 ' + f.label, a.sn.x, a.sn.y - 34, '#E8504A');
      shake = 6;
      E.sfx('hit');
    } else {
      floats.add('+1', a.sn.x, a.sn.y - 40, '#9AA6C4');
    }
  }

  /* ---------------- 甩锅：按键把锅扔出去（所有人同一套规则） ---------------- */
  // 同事会不会主动把锅甩给 b（护盾中、刚甩给自己的人不考虑）
  function canThrowTo(a, b) {
    return a !== b && !b.crushed && b.shield <= 0 && !((a.lock[b.id] || 0) > S.t);
  }
  // a 手里有没有能甩的东西：没在飞的 P0，或者尾巴上的锅
  function holdsHot(a) { return !!(S.hot && S.hot.holder === a && !S.hot.inFlight); }
  function canFire(a) { return !a.crushed && a.cool <= 0 && a.stun <= 0 && (holdsHot(a) || potsOf(a) > 0); }
  // b 在不在 a 的瞄准扇形里（k 放大扇形，用于锁定目标后不轻易丢）
  function inAimFan(a, b, k) {
    if (b === a || b.crushed || b.shield > 0) return false;
    if (headDist(a, b) > AIM_RANGE * k) return false;
    return Math.abs(E.angDiff(a.sn.angle, Math.atan2(b.sn.y - a.sn.y, b.sn.x - a.sn.x))) <= AIM_CONE * k;
  }
  // 自动瞄准：扇形内挑「近 + 正前方」的人；上一次锁定的人只要还在稍大一点的扇形里就继续锁着，避免目标来回跳
  // 扇形里没人返回 null（直线扔出去）
  function pickAim(a) {
    if (a.aimTgt && inAimFan(a, a.aimTgt, 1.25)) return a.aimTgt;
    let best = null, bs = Infinity;
    for (const b of S.agents) {
      if (b === a || b.crushed || b.shield > 0) continue;
      const d = headDist(a, b);
      if (d > AIM_RANGE) continue;
      const off = Math.abs(E.angDiff(a.sn.angle, Math.atan2(b.sn.y - a.sn.y, b.sn.x - a.sn.x)));
      if (off > AIM_CONE) continue;
      const score = d * (1 + off * 1.5);
      if (score < bs) { bs = score; best = b; }
    }
    a.aimTgt = best;
    return best;
  }
  // 从 a 朝 b 扔锅的角度：按锅的飞行时间预判 b 的走位
  function leadAngle(a, b) {
    const tt = headDist(a, b) / THROW_SPEED;
    const x = b.sn.x + Math.cos(b.sn.angle) * b.sn.speed * tt, y = b.sn.y + Math.sin(b.sn.angle) * b.sn.speed * tt;
    return Math.atan2(y - a.sn.y, x - a.sn.x);
  }
  // 甩出去：P0 优先，否则扔尾巴最后一口锅
  function fireThrow(a) {
    const hot = holdsHot(a);
    if (!hot && !potsOf(a)) return false;
    const b = pickAim(a);
    const ang = b ? leadAngle(a, b) : a.sn.angle;
    const label = hot ? 'P0' : a.sn.segs.pop();
    if (hot) S.hot.inFlight = true;
    S.throws.push({
      owner: a, target: b, x: a.sn.x + Math.cos(ang) * 12, y: a.sn.y + Math.sin(ang) * 12, a: ang,
      speed: THROW_SPEED, label, hot, dist: 0, range: THROW_RANGE, bounces: 0, spin: 0, rolled: new Set(),
    });
    a.cool = THROW_CD;
    a.launched++;
    if (a.isPlayer) E.sfx('whoosh');
    return true;
  }
  // 锅 f 离砸中 b 还有几秒；不是朝 b 飞的返回 Infinity
  function incomingTTI(f, b) {
    const dx = b.sn.x - f.x, dy = b.sn.y - f.y, d = Math.hypot(dx, dy);
    if (d < 1) return 0;
    const dot = (dx * Math.cos(f.a) + dy * Math.sin(f.a)) / d;
    if (dot < 0.6 && f.target !== b) return Infinity;
    return Math.max(0, d - THROW_HIT_R) / f.speed;
  }
  // 关卡难度倍率：同事的积极度、反甩率（?auto 时 AI 玩家不吃倍率，方便对比）
  const aiMul = (a, k) => (a.isPlayer ? 1 : (L.ai && L.ai[k]) || 1);
  const parryChance = (b) => Math.min(0.9, b.p.parry * aiMul(b, 'parry'));
  // 当前反甩窗口：每来回一次就缩小
  function parryWin(f) { return PARRY_WIN * Math.pow(PARRY_DECAY, f.bounces); }
  // 玩家按下「甩」：锅正飞向自己且在窗口内 → 反甩；否则能甩就甩；都不行算按空
  function pressFire(a) {
    if (a.crushed) return;
    let best = null, bt = Infinity;
    for (const f of S.throws) {
      if (f.owner === a || f.dead) continue;
      const t = incomingTTI(f, a);
      if (t <= parryWin(f) && t < bt) { bt = t; best = f; }
    }
    if (best && a.parryLock <= 0) { parry(a, best); return; }
    if (canFire(a) && fireThrow(a)) return;
    a.parryLock = WHIFF_LOCK;
  }
  // b 把飞来的锅 f 原路弹回给扔锅的人：加速、窗口缩小
  function parry(b, f) {
    const back = f.owner;
    f.owner = b;
    f.target = back.crushed ? null : back;
    f.bounces++;
    f.speed *= PARRY_SPEEDUP;
    f.dist = 0;
    f.range = f.target ? Math.max(THROW_RANGE, headDist(b, back) + 80) : THROW_RANGE;
    f.a = f.target ? Math.atan2(back.sn.y - f.y, back.sn.x - f.x) : f.a + Math.PI;
    f.rolled = new Set();
    b.score += PARRY_PTS;
    b.parries++;
    spawnFx('fx_impact', f.x, f.y, 40, 0.25); // 反甩：在锅的位置闪一下
    if (b.isPlayer) {
      floats.add(f.bounces >= 2 ? `再弹回去！+${PARRY_PTS}` : `反甩！+${PARRY_PTS}`, b.sn.x, b.sn.y - 46, '#2F9E6B');
      E.sfx('parry');
      shake = 4;
    } else if (back.isPlayer) {
      floats.add(`${b.name}：这锅不是我的`, b.sn.x, b.sn.y - 40, '#E8504A');
      E.sfx('parry');
    } else floats.add('弹!', b.sn.x, b.sn.y - 40, '#5E6A84');
  }
  // 甩空：锅立刻弹回扔锅的人身上（P0 回到他手里）
  function missThrow(f, why) {
    f.dead = true;
    const a = f.owner;
    a.combo = 0;
    if (f.hot) {
      if (S.hot) { S.hot.holder = a; S.hot.inFlight = false; }
    } else {
      if (a.crushed) return;
      a.sn.segs.push(f.label);
      S.arcs.push({ x0: f.x, y0: f.y, to: () => tailPos(a), t: 0, dur: 0.25, label: f.label });
    }
    a.misses++;
    if (a.isPlayer) {
      floats.add(why === 'shield' ? '他刚接锅，弹开了' : '甩空了！锅弹回来', a.sn.x, a.sn.y - 40, '#E8504A');
      E.sfx('miss');
    }
  }
  // 砸中墙（摆设可以飞过去）
  function inWall(x, y) {
    if (x < 0 || y < 0 || x > OFFICE.world.w || y > OFFICE.world.h) return true;
    for (const w of OFFICE.walls) if (x > w.x && x < w.x + w.w && y > w.y && y < w.y + w.h) return true;
    return false;
  }
  // 每帧：甩出去的锅飞行 → 同事判断要不要反甩 → 砸中路上第一个人 / 飞满射程或撞墙算甩空
  function updateThrows(dt) {
    for (const f of S.throws) {
      if (f.dead) continue;
      if (f.target && !f.target.crushed) {
        const want = Math.atan2(f.target.sn.y - f.y, f.target.sn.x - f.x);
        f.a += E.clamp(E.angDiff(f.a, want), -THROW_TURN * dt, THROW_TURN * dt);
      }
      const step = f.speed * dt;
      f.x += Math.cos(f.a) * step;
      f.y += Math.sin(f.a) * step;
      f.dist += step;
      f.spin += dt * 16;

      // 同事（以及 ?auto 时的玩家）：锅进入窗口时掷一次骰子决定接不接得住
      for (const b of S.agents) {
        if (b === f.owner || b.crushed || (b.isPlayer && !auto) || f.rolled.has(b.id)) continue;
        if (incomingTTI(f, b) > parryWin(f)) continue;
        f.rolled.add(b.id);
        if (b.parryLock <= 0 && Math.random() < parryChance(b) * Math.pow(0.8, f.bounces)) { parry(b, f); break; }
      }

      let victim = null;
      for (const b of S.agents) {
        if (b === f.owner || b.crushed) continue;
        if (E.dist(f.x, f.y, b.sn.x, b.sn.y) < THROW_HIT_R) { victim = b; break; }
      }
      if (victim) {
        if (victim.shield > 0) missThrow(f, 'shield');
        else { f.dead = true; landThrow(f, victim); }
      } else if (f.dist >= f.range || inWall(f.x, f.y)) missThrow(f);
    }
    S.throws = S.throws.filter((f) => !f.dead);
  }
  // 锅 f 砸中 b：归 b；扔锅的人得分、连甩
  function landThrow(f, b) {
    const a = f.owner;
    spawnFx('fx_impact', b.sn.x, b.sn.y - 26, f.hot ? 70 : 56); // 砸中瞬间的撞击星
    if (f.hot) {
      a.score += 20;
      if (a.isPlayer) { floats.add(`P0 甩给${b.name} +20`, b.sn.x, b.sn.y - 44, '#2F9E6B'); E.sfx('combo'); }
      grabHot(b, a);
      b.shield = RECV_SHIELD; b.stun = RECV_STUN;
      return;
    }
    b.sn.segs.push(f.label);

    // 连甩：窗口内连续甩中，倍率递增（最高 ×3）
    a.combo = a.comboT > 0 ? a.combo + 1 : 1;
    a.comboT = COMBO_WINDOW;
    a.maxCombo = Math.max(a.maxCombo, a.combo);
    const pts = Math.round(10 * Math.min(3, 1 + 0.5 * (a.combo - 1)) * b.p.mult);
    a.score += pts;
    a.thrown++;
    a.victims[b.name] = (a.victims[b.name] || 0) + 1;

    // 接锅的人：短暂护盾 + 愣住 + 连甩清零 + 记仇
    b.shield = RECV_SHIELD;
    b.stun = RECV_STUN;
    b.lock[a.id] = S.t + NO_RETURN;
    b.combo = 0;
    b.angry = 2;
    if (b.key === 'intern') { b.cry = 2; if (potsOf(b) >= 3) leaderAlert(a, b); }

    if (a.isPlayer) {
      const wasTea = b.teaT > 0;
      if (b.key === 'veteran') floats.add(`${wasTea ? '老油条也有今天！' : '甩中老油条！'} +${pts}`, b.sn.x, b.sn.y - 44, '#2F9E6B');
      else floats.add(`甩给${b.name} +${pts}`, b.sn.x, b.sn.y - 44, '#2F9E6B');
      if (a.combo >= 2) { floats.add(`连甩 ×${a.combo}`, a.sn.x, a.sn.y - 54, '#E8504A'); E.sfx('combo'); }
      else E.sfx('throw');
    } else if (b.isPlayer) {
      floats.add(`${a.name}：这个你来`, b.sn.x, b.sn.y - 40, '#E8504A');
      shake = 7;
      E.sfx('back');
    } else {
      floats.add('甩!', b.sn.x, b.sn.y - 40, '#5E6A84');
    }
  }

  /* ---------------- P0 烫手山芋 ---------------- */
  // 某人拿到 P0（from 为扔给他的人，被领导砸中时为 null）
  function grabHot(a, from) {
    S.hot = { holder: a, t: S.hot ? S.hot.t : HOT_TIME, from, inFlight: false };
    if (a.isPlayer) { E.toast('P0 在你手里！按「甩」扔给别人', 1800); E.sfx('boss'); shake = 6; }
  }
  // 每帧：倒计时；扔出去还在飞时到点，炸在扔的人手里；炸在谁手里谁 +4
  function updateHot(dt) {
    const h = S.hot;
    if (!h) return;
    h.t -= dt;
    if (h.inFlight) {
      if (h.t > 0) return;
      const f = S.throws.find((x) => x.hot && !x.dead);
      if (f) { f.dead = true; h.holder = f.owner; }
      h.inFlight = false;
    }
    const a = h.holder;
    if (a.crushed) h.t = 0;
    if (h.t <= 0) {
      S.hot = null;
      if (a.crushed) return;
      addPots(a, HOT_POTS, a.sn.x, a.sn.y - 40);
      S.hotBooms++;
      shake = a.isPlayer ? 14 : 6;
      E.toast(a.isPlayer ? `P0 炸在你手里，+${HOT_POTS} 口锅` : `P0 炸在${a.name}手里，+${HOT_POTS} 口锅`, 2000);
      E.sfx(a.isPlayer ? 'back' : 'win');
    }
  }

  /* ---------------- 领导寻路：网格 A*，领导不再穿墙 / 穿桌子 ---------------- */
  const NAV_CELL = 20;   // 网格大小
  const LEADER_R = 20;   // 领导身体半径（障碍物按这个外扩）
  // 预先算好每个格子能不能走：格子中心落在外扩后的障碍物里就算堵住
  const NAV = (() => {
    const W = OFFICE.world, cols = Math.ceil(W.w / NAV_CELL), rows = Math.ceil(W.h / NAV_CELL);
    const block = new Uint8Array(cols * rows);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = (c + 0.5) * NAV_CELL, y = (r + 0.5) * NAV_CELL;
      let b = x < LEADER_R || y < LEADER_R || x > W.w - LEADER_R || y > W.h - LEADER_R;
      for (const o of obstacles) {
        if (b) break;
        b = x > o.x - LEADER_R && x < o.x + o.w + LEADER_R && y > o.y - LEADER_R && y < o.y + o.h + LEADER_R;
      }
      block[r * cols + c] = b ? 1 : 0;
    }
    return { cols, rows, block };
  })();
  // 坐标 → 格子编号（越界夹到边上）
  function navIdx(x, y) {
    const c = E.clamp(Math.floor(x / NAV_CELL), 0, NAV.cols - 1), r = E.clamp(Math.floor(y / NAV_CELL), 0, NAV.rows - 1);
    return r * NAV.cols + c;
  }
  // 某格被堵住时，向外一圈圈找最近的空格
  function navFree(i) {
    if (!NAV.block[i]) return i;
    const c0 = i % NAV.cols, r0 = (i / NAV.cols) | 0;
    for (let k = 1; k < 12; k++) {
      for (let dr = -k; dr <= k; dr++) for (let dc = -k; dc <= k; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== k) continue;
        const c = c0 + dc, r = r0 + dr;
        if (c < 0 || r < 0 || c >= NAV.cols || r >= NAV.rows) continue;
        if (!NAV.block[r * NAV.cols + c]) return r * NAV.cols + c;
      }
    }
    return i;
  }
  const navPt = (i) => ({ x: (i % NAV.cols + 0.5) * NAV_CELL, y: (((i / NAV.cols) | 0) + 0.5) * NAV_CELL });
  // 两点之间是否一路畅通（每 8px 采样一次）
  function navClear(ax, ay, bx, by) {
    const d = E.dist(ax, ay, bx, by), n = Math.ceil(d / 8);
    for (let k = 1; k <= n; k++) if (NAV.block[navIdx(ax + (bx - ax) * k / n, ay + (by - ay) * k / n)]) return false;
    return true;
  }
  // A* 寻路（8 方向，不切墙角），结果再拉直：能直线走到的中间点都省掉
  function findPath(x0, y0, x1, y1) {
    const start = navFree(navIdx(x0, y0)), goal = navFree(navIdx(x1, y1));
    const n = NAV.cols * NAV.rows, g = new Float32Array(n).fill(Infinity), from = new Int32Array(n).fill(-1);
    const gc = goal % NAV.cols, gr = (goal / NAV.cols) | 0;
    const h = (i) => { const dc = Math.abs(i % NAV.cols - gc), dr = Math.abs(((i / NAV.cols) | 0) - gr); return Math.max(dc, dr) + 0.414 * Math.min(dc, dr); };
    // 二叉堆：按 f = g + h 取最小
    const heap = [], push = (i, f) => {
      heap.push([f, i]);
      let k = heap.length - 1;
      while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; }
    }, pop = () => {
      const top = heap[0], last = heap.pop();
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
      const c = i % NAV.cols, r = (i / NAV.cols) | 0;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const nc = c + dc, nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= NAV.cols || nr >= NAV.rows) continue;
        const j = nr * NAV.cols + nc;
        if (NAV.block[j]) continue;
        if (dr && dc && (NAV.block[r * NAV.cols + nc] || NAV.block[nr * NAV.cols + c])) continue; // 不切墙角
        const ng = g[i] + (dr && dc ? 1.414 : 1);
        if (ng < g[j]) { g[j] = ng; from[j] = i; push(j, ng + h(j)); }
      }
    }
    if (goal !== start && from[goal] < 0) return [];            // 走不到：原地不动
    const cells = [];
    for (let i = goal; i !== start && i >= 0; i = from[i]) cells.push(navPt(i));
    cells.reverse();
    if (!NAV.block[navIdx(x1, y1)] && cells.length) cells[cells.length - 1] = { x: x1, y: y1 };
    // 拉直
    const out = [];
    let ax = x0, ay = y0, k = 0;
    while (k < cells.length) {
      let far = k;
      while (far + 1 < cells.length && navClear(ax, ay, cells[far + 1].x, cells[far + 1].y)) far++;
      out.push(cells[far]);
      ax = cells[far].x; ay = cells[far].y; k = far + 1;
    }
    return out;
  }
  // 领导沿路径走向 (tx, ty)：目标挪动较远或到了重算时间才重新寻路；返回离终点的直线距离
  function walkTo(l, tx, ty, spd, dt, repath) {
    l.repathT -= dt;
    if (!l.goal || E.dist(l.goal.x, l.goal.y, tx, ty) > 30 || (repath && l.repathT <= 0)) {
      l.goal = { x: tx, y: ty };
      l.path = findPath(l.x, l.y, tx, ty);
      l.repathT = repath || 0;
    }
    let step = spd * dt;
    while (step > 0 && l.path.length) {
      const p = l.path[0], d = E.dist(l.x, l.y, p.x, p.y);
      if (d <= step) { l.x = p.x; l.y = p.y; step -= d; l.path.shift(); }
      else { l.x += (p.x - l.x) / d * step; l.y += (p.y - l.y) / d * step; step = 0; }
    }
    return E.dist(l.x, l.y, tx, ty);
  }

  /* ---------------- 领导 ---------------- */
  // 实习生被欺负太狠：老板（第一位领导）看见了，就冲过来追欺负他的人
  // 老板得在附近才看得见；追完一次要冷却一会儿，否则同事们天天欺负实习生，老板会一直追人
  function leaderAlert(bully, intern) {
    const l = S.leaders[0];
    if (!l || l.state === 'chase' || S.t < l.alertCd) return;
    if (E.dist(l.x, l.y, intern.sn.x, intern.sn.y) > ALERT_SEE) return;
    l.state = 'chase'; l.st = ALERT_CHASE; l.chase = bully; l.alertCd = S.t + ALERT_CD;
    E.toast(bully.isPlayer ? `${l.name}：谁让实习生干这个的？` : `${l.name}盯上了${bully.name}`, 2000);
    if (bully.isPlayer) E.sfx('boss');
  }
  // 找离领导最近的巡逻点，回到路线上
  function nearestRoute(l) {
    let bi = 0, bd = Infinity;
    l.route.forEach((p, i) => { const d = E.dist(p.x, p.y, l.x, l.y); if (d < bd) { bd = d; bi = i; } });
    return bi;
  }
  // 「谁闲着丢给谁」：视野里身上锅最少的几个人（锅数相同随机）
  function pickTargets(l) {
    if (S.firstThrow && L.id === 1) { S.firstThrow = false; return [S.player]; } // 第一关第一口锅固定丢给玩家，配合教学
    const cand = S.agents.filter((a) => !a.crushed && E.dist(a.sn.x, a.sn.y, l.x, l.y) < l.cfg.range)
      .map((a) => ({ a, k: potsOf(a) + Math.random() * 0.9 }))
      .sort((x, y) => x.k - y.k);
    return cand.slice(0, l.cfg.count).map((c) => c.a);
  }
  // 领导每帧：巡逻 → 瞄准（预警）→ 丢锅；或追欺负实习生的人；撞上谁就给谁派 3 口
  // 领导走路都走寻路路径，不会穿墙 / 穿桌子
  function updateLeader(l, dt) {
    if (l.state === 'chase') {
      l.st -= dt;
      walkTo(l, l.chase.sn.x, l.chase.sn.y, ALERT_SPEED, dt, 0.4);
      if (l.st <= 0 || l.chase.crushed) { l.state = 'patrol'; l.chase = null; l.i = nearestRoute(l); }
    } else if (l.state === 'aim') {
      l.aimT -= dt;
      if (l.aimT <= 0) {
        for (const t of l.targets) if (!t.crushed) launchPot(l.x, l.y - 20, t, 0, false);
        l.state = 'patrol';
      }
    } else {
      if (l.wait > 0) l.wait -= dt;
      else {
        const p = l.route[l.i];
        if (walkTo(l, p.x, p.y, l.cfg.speed, dt, 0) < 4 || !l.path.length) { l.wait = p.wait || 0; l.i = (l.i + 1) % l.route.length; }
      }
      if (S.pace) {
        l.throwCd -= dt;
        if (l.throwCd <= 0) {
          l.throwCd = S.pace.every * l.cfg.everyMul * E.rand(0.85, 1.15);
          l.targets = pickTargets(l);
          if (l.targets.length) {
            l.state = 'aim'; l.aimT = AIM_TIME;
            if (l.targets.includes(S.player)) E.sfx('warn');
          }
        }
      }
    }
    // 撞上领导：+3 口
    for (const a of S.agents) {
      if (a.crushed || (l.hitCd[a.id] || 0) > S.t) continue;
      if (E.dist(l.x, l.y, a.sn.x, a.sn.y) < HEAD_R + 28) {
        addPots(a, LEADER_HIT_POTS, l.x, l.y);
        spawnFx('fx_impact', a.sn.x, a.sn.y - 26, 72, 0.45);
        S.leaderHits++;
        l.hitCd[a.id] = S.t + 3;
        if (l.chase === a) { l.state = 'patrol'; l.chase = null; l.i = nearestRoute(l); }
        if (a.isPlayer) { floats.add(`${l.name}：这几个你跟一下`, a.sn.x, a.sn.y - 44, '#E8504A'); shake = 13; E.sfx('boss'); }
        else floats.add(`+${LEADER_HIT_POTS}`, a.sn.x, a.sn.y - 40, '#E8504A');
      }
    }
  }

  /* ---------------- 时间表：节奏、散会、随机事件、教学提示 ---------------- */
  function updateSchedule() {
    // 领导丢锅节奏
    let idx = -1;
    L.pace.forEach((w, i) => { if (S.t >= w.t) idx = i; });
    if (idx !== S.paceIdx) {
      S.paceIdx = idx;
      S.pace = L.pace[idx] || null;
      if (S.pace && S.pace.toast) { E.toast(S.pace.toast, 2200); E.sfx('boss'); shake = 8; }
    }
    // 散会、随机事件
    while (S.schedule.length && S.t >= S.schedule[0].t) {
      const it = S.schedule.shift();
      if (it.act === 'msg') showMsg(it.text);
      else if (it.act === 'burst') burst(it.src, it.n);
      else if (it.act === 'event') startEvent(it.kind);
    }
    // 教学提示
    const h = L.hints[S.hintIdx];
    if (h && S.t >= h.t) { showHint(h.text); S.hintIdx++; }
  }
  // 某个地点一口气喷出 n 口锅，依次瞄准离那里最近的几个人
  function burst(srcKey, n) {
    const src = OFFICE.sources[srcKey];
    const near = S.agents.filter((a) => !a.crushed)
      .sort((a, b) => E.dist(a.sn.x, a.sn.y, src.x, src.y) - E.dist(b.sn.x, b.sn.y, src.x, src.y))
      .slice(0, 3);
    if (!near.length) return;
    for (let i = 0; i < n; i++) launchPot(src.x, src.y, near[i % near.length], 0.9 + i * 0.2, false);
    E.sfx('warn');
    shake = Math.max(shake, 4);
  }
  // 随机事件生效
  function startEvent(kind) {
    if (kind === 'printer') burst('printer', 5);
    else if (kind === 'tea') { S.tea = 10; E.toast('同事们都去茶水间了，挤在一起正好连甩', 2200); }
    else if (kind === 'p0') {
      const l = S.leaders[0];
      const target = pickTargets(l)[0] || nearestAgent(l.x, l.y);
      if (target) launchPot(l.x, l.y - 20, target, 0.9, true);
    }
  }

  /* ---------------- 机器人大脑 ---------------- */
  // 某点是否被障碍物或地图边缘挡住
  function blocked(x, y) {
    const pad = HEAD_R + 4;
    if (x < pad || y < pad || x > OFFICE.world.w - pad || y > OFFICE.world.h - pad) return true;
    for (const r of obstacles) if (x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad) return true;
    return false;
  }
  const STEER_OFFSETS = [0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05, 1.5, -1.5, 2, -2, 2.6, -2.6, Math.PI];
  // 绕障碍：在想去的方向左右依次试探，选第一个前方没被挡的方向
  function steerFree(a, ang) {
    const look = 40 + a.sn.speed * 0.3;
    for (const o of STEER_OFFSETS) {
      const t = ang + o, c = Math.cos(t), s = Math.sin(t);
      if (!blocked(a.sn.x + c * look * 0.5, a.sn.y + s * look * 0.5) && !blocked(a.sn.x + c * look, a.sn.y + s * look)) return t;
    }
    return ang;
  }
  // 想甩锅的对象：半径内能甩的人里最近的（已有目标且仍有效时不轻易换人）
  function pickDumpTarget(a) {
    const r = a.p.seekR;
    if (a.target && !a.target.crushed && (a.lock[a.target.id] || 0) <= S.t && headDist(a, a.target) < r * 1.3) return a.target;
    let best = null, bd = r;
    for (const b of S.agents) {
      if (b === a || b.crushed || (a.lock[b.id] || 0) > S.t) continue;
      const d = headDist(a, b);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }
  // 机器人每隔 react 秒想一次：把各种「想去 / 想躲」的力加起来，得出想走的方向
  function think(a) {
    const me = a.sn, p = a.p, pots = potsOf(a);
    let vx = 0, vy = 0;
    const flee = (x, y, w) => { const d = Math.max(1, E.dist(me.x, me.y, x, y)); vx += ((me.x - x) / d) * w; vy += ((me.y - y) / d) * w; };
    const seek = (x, y, w) => { const d = Math.max(1, E.dist(me.x, me.y, x, y)); vx += ((x - me.x) / d) * w; vy += ((y - me.y) / d) * w; };

    // 卡在墙角：随便换个方向冲一会儿
    if (a.panicT > 0) { a.want = steerFree(a, a.want); return; }

    // 1. 躲飞向自己的锅：往锅飞行方向的侧面闪
    for (const f of S.flying) {
      if (f.phase !== 'fly') continue;
      const dx = me.x - f.x, dy = me.y - f.y, d = Math.hypot(dx, dy);
      if (d > 260 || d < 1) continue;
      const fx = Math.cos(f.a), fy = Math.sin(f.a);
      if ((dx * fx + dy * fy) / d < 0.75) continue; // 不是冲自己来的
      const side = fx * dy - fy * dx >= 0 ? 1 : -1;
      const w = p.dodge * (1 - d / 260) * 3;
      vx += -fy * side * w; vy += fx * side * w;
    }
    // 领导瞄准自己时也提前横移
    for (const l of S.leaders) {
      if (l.state === 'aim' && l.targets.includes(a)) {
        const d = Math.max(1, E.dist(me.x, me.y, l.x, l.y));
        vx += (-(me.y - l.y) / d) * p.dodge; vy += ((me.x - l.x) / d) * p.dodge;
      }
      // 2. 躲领导
      const d = E.dist(me.x, me.y, l.x, l.y);
      if (l.chase === a) flee(l.x, l.y, 4);
      else if (d < 230) flee(l.x, l.y, (1.5 + p.caution * 2.5) * (1 - d / 230));
    }
    // 3. P0：拿着就找人传，没拿就躲着拿的人
    const h = S.hot;
    if (h && h.holder === a) {
      const b = nearestAgent(me.x, me.y, a);
      if (b) seek(b.sn.x, b.sn.y, 3.5);
    } else if (h) {
      const d = E.dist(me.x, me.y, h.holder.sn.x, h.holder.sn.y);
      if (d < 260) flee(h.holder.sn.x, h.holder.sn.y, 2 * p.caution * (1 - d / 260));
    }
    // 4. 找人甩锅：锅越多越积极；预判对方走位
    a.target = null;
    if (pots >= p.seekMin && !(h && h.holder === a)) {
      const b = pickDumpTarget(a);
      if (b) {
        a.target = b;
        const lead = 0.3;
        seek(b.sn.x + Math.cos(b.sn.angle) * b.sn.speed * lead, b.sn.y + Math.sin(b.sn.angle) * b.sn.speed * lead,
          p.aggr * aiMul(a, 'aggr') * (0.7 + Math.min(pots, 8) * 0.1));
      }
    }
    // 5. 躲开想把锅甩给自己的人（自己没锅、或正被锁住不能还手时更想躲）
    for (const b of S.agents) {
      if (b === a || b.crushed || !potsOf(b) || !canThrowTo(b, a)) continue;
      const d = headDist(a, b);
      if (d > 150) continue;
      const scared = pots === 0 || (a.lock[b.id] || 0) > S.t ? 1.4 : 0.5;
      flee(b.sn.x, b.sn.y, p.caution * scared * (1 - d / 150));
    }
    // 6. 下午茶 / 老油条泡茶：往茶水间走
    if (S.tea > 0 || a.teaT > 0) seek(OFFICE.tea.x, OFFICE.tea.y, a.teaT > 0 ? 1.5 : 1.1);
    // 7. 没事干：保持方向慢慢晃，靠近边缘时往中间拐
    if (Math.hypot(vx, vy) < 0.15) {
      vx += Math.cos(me.angle) * 0.4 + E.rand(-0.2, 0.2);
      vy += Math.sin(me.angle) * 0.4 + E.rand(-0.2, 0.2);
      seek(OFFICE.world.w / 2, OFFICE.world.h / 2, 0.15);
    }
    a.want = steerFree(a, Math.atan2(vy, vx) + E.rand(-0.08, 0.08));

    // 8. 出手：前方瞄得到人、够近就甩（P0 优先、不挑人；平时不主动瞄刚甩给自己的人）
    if (canFire(a)) {
      const hot = holdsHot(a), b = pickAim(a);
      if (b && headDist(a, b) < p.throwR && (hot || (pots >= p.seekMin && (a.lock[b.id] || 0) <= S.t)) &&
        Math.random() < 0.45 + 0.55 * p.aggr * aiMul(a, 'aggr')) fireThrow(a);
    }
  }

  /* ---------------- 打工人每帧 ---------------- */
  function updateAgent(a, dt) {
    if (a.crushed) return;
    a.cool -= dt; a.stun -= dt; a.shield -= dt; a.cry -= dt; a.angry -= dt; a.panicT -= dt; a.parryLock -= dt;
    a.comboT -= dt;
    if (a.comboT <= 0) a.combo = 0;

    // 慢慢消化身上的锅（所有人相同）
    if (potsOf(a)) {
      a.digestT -= dt;
      if (a.digestT <= 0) {
        a.digestT = DIGEST_TIME;
        a.sn.segs.shift();
        if (a.isPlayer) floats.add('搞定一口', a.sn.x, a.sn.y - 34, '#2F9E6B');
      }
    } else a.digestT = DIGEST_TIME;

    // 老油条定期去泡茶：泡茶时走得很慢，是甩锅的好时机
    if (a.p.tea) {
      if (a.teaT > 0) a.teaT -= dt;
      else { a.teaCd -= dt; if (a.teaCd <= 0) { a.teaT = 3.5; a.teaCd = E.rand(9, 13); } }
    }

    // 速度：只看人设和是否在泡茶，背锅不减速
    a.sn.speed = BASE_SPEED * a.p.speed * (a.teaT > 0 && E.dist(a.sn.x, a.sn.y, OFFICE.tea.x, OFFICE.tea.y) < 120 ? 0.4 : 1);

    // 方向：玩家用手指，机器人用 AI
    const ai = !a.isPlayer || auto;
    let steer = null;     // 本帧想转向的角度（null = 不转）
    if (ai) {
      a.thinkT -= dt;
      if (a.thinkT <= 0) { a.thinkT = a.p.react * E.rand(0.8, 1.2); think(a); }
      steer = a.want;
    } else {
      // 主角不会自己走：按住摇杆 / 方向键才动；摇杆轻推只原地转向
      const keyHeld = E.pollKeys(inp);
      const walk = keyHeld || (inp.down && inp.mag >= TURN_ONLY_MAG);
      if (!walk) a.sn.speed = 0;
      steer = keyHeld || inp.down ? inp.angle : null;
      // 玩家按了「甩」：本帧处理掉所有按键（一般就一次）
      while (inp.fire > 0) { inp.fire--; pressFire(a); }
    }
    a.sn.update(dt, steer);
    if (E.collide(a.sn, HEAD_R, obstacles)) a.sn.trail[0] = { x: a.sn.x, y: a.sn.y };
    if (a.sn.bounce(HEAD_R, HEAD_R, OFFICE.world.w - HEAD_R, OFFICE.world.h - HEAD_R)) {
      if (ai) a.want = a.sn.angle; else inp.angle = a.sn.angle;
    }

    // 卡墙检测：1.2 秒内几乎没动，就随机换个方向冲一会儿
    if (ai) {
      a.stuckT += dt;
      if (a.stuckT >= 1.2) {
        if (E.dist(a.sn.x, a.sn.y, a.lastX, a.lastY) < 30) { a.panicT = 0.7; a.want = E.rand(0, Math.PI * 2); }
        a.stuckT = 0; a.lastX = a.sn.x; a.lastY = a.sn.y;
      }
    }
  }

  /* ---------------- 排名 ---------------- */
  // 排名：没被压垮的在前；锅少的在前；锅数相同比甩锅得分；被压垮的人越晚压垮排越前
  function ranking() {
    return S.agents.slice().sort((a, b) =>
      (a.crushed - b.crushed) ||
      (a.crushed ? b.crushedAt - a.crushedAt : potsOf(a) - potsOf(b)) ||
      (b.score - a.score));
  }
  // 名次 → 星级：第 1 名 3 星，第 2 名 2 星，第 3 名 1 星，其余 0
  const starsOfRank = (r) => (r <= PASS_RANK ? PASS_RANK + 1 - r : 0);

  /* ---------------- 主更新 ---------------- */
  function update(dt) {
    S.t += dt;
    if (S.tea > 0) S.tea -= dt;
    updateSchedule();
    for (const a of S.agents) updateAgent(a, dt);
    for (const l of S.leaders) updateLeader(l, dt);
    updateFlying(dt);
    updateThrows(dt);
    updateHot(dt);

    // 甩锅动画推进
    for (const a of S.arcs) a.t += dt;
    S.arcs = S.arcs.filter((a) => a.t < a.dur);
    // 一次性特效推进
    for (const e of S.fx) e.t += dt;
    S.fx = S.fx.filter((e) => e.t < e.dur);

    // 压垮：机器人出局（排最后），玩家当场失败
    for (const a of S.agents) {
      if (a.crushed || potsOf(a) < MAX_POTS) continue;
      if (a.isPlayer) { S.over = 'crushed'; return; }
      a.crushed = true; a.crushedAt = S.t; a.target = null;
      E.toast(`${a.name}被锅压垮了！`, 1800);
    }
    if (S.t >= L.duration) S.over = 'time';
  }

  /* ---------------- 提示条 / 群消息 ---------------- */
  // 显示一条教学提示
  function showHint(text) {
    const el = document.getElementById('hint');
    el.textContent = text;
    el.classList.add('on');
    hintTimer = 3.8;
  }
  // 显示一条工作群消息（事件预告）：「【群名】发言人：内容」
  function showMsg(text) {
    const m = text.match(/^(【[^】]+】)([^：]+)：(.*)$/);
    const el = document.getElementById('msg');
    el.innerHTML = m ? `<small>${m[1]} ${m[2]}</small>${m[3]}` : text;
    el.classList.add('on');
    msgTimer = 3.4;
    E.sfx('tick');
  }
  // 提示条和群消息的计时
  function updateBanners(dt) {
    if (hintTimer > 0) { hintTimer -= dt; if (hintTimer <= 0) document.getElementById('hint').classList.remove('on'); }
    if (msgTimer > 0) { msgTimer -= dt; if (msgTimer <= 0) document.getElementById('msg').classList.remove('on'); }
  }

  /* ---------------- 绘制 ---------------- */
  // 画一口锅：像素锅（带手柄，所以整体放大 WOK_K 倍）+ 便利贴上的字
  const WOK_K = 1.25;
  const POT_SCALE = 0.8; // 所有锅（背着的、飞着的、P0）统一缩放；只影响画面，不影响判定
  function drawWok(x, y, label, size, rot, alpha) {
    size *= POT_SCALE;
    const w = size * WOK_K, h = w * (E.spr.wok ? E.spr.wok.h / E.spr.wok.w : 1);
    E.drawSprite(ctx, 'wok', x, y, w, { rot, alpha });
    if (!label) return;
    ctx.save();
    if (alpha != null) ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    ctx.translate(w * 0.044, h * 0.097); // 便利贴在锅图里的位置
    ctx.rotate(-0.1);
    const fs = Math.round(size * (label.length > 2 ? 0.13 : 0.18));
    ctx.font = `${fs}px ${E.DISPLAY_FONT}`;
    ctx.fillStyle = '#1F2A44';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label.length > 4 ? label.slice(0, 4) : label, 0, 1);
    ctx.restore();
  }
  // 画一口正在飞的锅（带速度线的贴图）：a 为飞行方向；往左飞时镜像，免得锅柄朝下
  const FLY_DIR = -0.45; // 贴图里锅本身朝向（右上方）的角度
  function drawFlyingWok(x, y, label, size, a) {
    size *= POT_SCALE;
    const left = Math.cos(a) < 0;
    const rot = left ? a - (Math.PI - FLY_DIR) : a - FLY_DIR;
    const w = size * 1.35;
    E.drawSprite(ctx, 'wok_flying', x, y, w, { rot, flip: left });
    if (!label) return;
    // 便利贴大约在贴图中心偏右上，镜像时偏左上
    const fs = Math.round(size * (label.length > 2 ? 0.13 : 0.18));
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot);
    ctx.translate((left ? -1 : 1) * w * 0.06, -w * 0.05);
    ctx.rotate(left ? 0.1 : -0.1);
    ctx.font = `${fs}px ${E.DISPLAY_FONT}`;
    ctx.fillStyle = '#1F2A44'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label.length > 4 ? label.slice(0, 4) : label, 0, 1);
    ctx.restore();
  }
  // 画 P0 烫手山芋（红光 + 倒计时）
  function drawHotPot(x, y, time, left) {
    const r = 26 + Math.sin(time * 14) * 3;
    ctx.fillStyle = 'rgba(232,80,74,.35)';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    drawWok(x, y, 'P0', 42, Math.sin(time * 10) * 0.2);
    if (left != null) E.label(ctx, String(Math.ceil(left)), x + 22, y - 18, 18, '#E8504A');
  }
  // 画某人背着的锅（从尾到头）
  function drawTail(a, time) {
    const pos = a.sn.positions();
    const size = a.isPlayer ? 38 : 32;
    for (let i = pos.length - 1; i >= 0; i--) {
      drawWok(pos[i].x, pos[i].y, a.isPlayer ? a.sn.segs[i] : '', size, a.crushed ? 0.3 : Math.sin(time * 6 + i + a.id) * 0.12, a.crushed ? 0.6 : null);
    }
  }
  // 走路动画：每帧按位移更新朝向（d 朝下 / u 朝上 / s 侧面，往左走时镜像）和步伐
  // o 上挂 walk 记录；返回 { name 当前帧贴图, flip, dir, walking }，素材缺失时返回 null
  const STEP_PX = 13;  // 每走多少像素换一帧
  function walkFrame(o, base, x, y) {
    const w = o.walk || (o.walk = { x, y, vx: 0, vy: 0, dir: 'd', flip: false, dist: 0, still: 99 });
    const dx = x - w.x, dy = y - w.y, d = Math.hypot(dx, dy);
    w.x = x; w.y = y;
    if (d > 0.3 && d < 60) { // 位移太大是瞬移（复活、开局摆位），不算走路
      w.dist += d; w.still = 0;
      w.vx = w.vx * 0.7 + dx * 0.3; w.vy = w.vy * 0.7 + dy * 0.3; // 平滑一下，斜着走时朝向不来回抖
      const ax = Math.abs(w.vx), ay = Math.abs(w.vy);
      if (w.dir === 's' ? ay > ax * 1.4 : ax > ay * 1.4) w.dir = w.dir === 's' ? (w.vy > 0 ? 'd' : 'u') : 's';
      else if (w.dir !== 's') w.dir = w.vy > 0 ? 'd' : 'u';
      if (w.dir === 's') w.flip = w.vx < 0;
    } else w.still++;
    const walking = w.still <= 6;
    const name = `${base}_walk_${w.dir}${walking ? Math.floor(w.dist / STEP_PX) % 4 : 1}`; // 停下时用双脚并拢那帧
    return E.spr[name] ? { name, flip: w.flip, dir: w.dir, walking } : null;
  }
  // 按状态挑同事 / 玩家的贴图：被砸、喝茶、压垮等用专门的正面姿势，其余时候播走路动画
  // 每帧只能调用一次（里面会推进走路步伐）
  function personSprite(a, huntingMe) {
    const base = a.p.sprite, pots = potsOf(a);
    const walk = walkFrame(a, base, a.sn.x, a.sn.y);
    let st = null;
    if (a.isPlayer) { if (mode === 'over' && pots >= MAX_POTS) st = 'crushed'; else if (a.stun > 0) st = 'panic'; }
    else if (a.crushed) st = 'flat';
    else if (a.stun > 0 || a.angry > 1.4) st = 'hit'; // 刚接锅的前 0.6 秒显示被砸中
    else if (a.teaT > 0) st = 'tea';
    if (!st && walk) return walk;
    // 没有走路帧时退回旧的单张姿势
    if (!st) st = a.isPlayer ? (pots >= 10 ? 'panic' : 'normal') : a.cry > 0 ? 'cry' : (huntingMe || a.angry > 0) ? 'angry' : 'normal';
    const name = `${base}_${st}`;
    return { name: E.spr[name] ? name : `${base}_normal`, flip: false, dir: 'd', walking: false };
  }
  // 脚下的影子
  function drawShadow(x, y, rx, color) {
    ctx.fillStyle = color || 'rgba(31,42,68,.22)';
    ctx.beginPath(); ctx.ellipse(x, y, rx, rx * 0.34, 0, 0, Math.PI * 2); ctx.fill();
  }
  // 头顶 / 脸上的状态特效：晕（愣住）、怒（追人）、汗（锅太多）、泪（实习生哭）
  function drawStatusFx(a, spr, x, top, h, time, angry) {
    if (a.stun > 0) E.drawSprite(ctx, 'fx_dizzy', x, top - 12, 30, { rot: time * 5 });
    if (angry) E.drawSprite(ctx, 'fx_anger', x + 20, top + 6 + Math.sin(time * 12) * 2, 18);
    if (potsOf(a) >= (a.isPlayer ? 10 : 12)) E.drawSprite(ctx, 'fx_sweat', x - 22, top + 10 + (time * 24) % 6, 16);
    // 泪：正面画两股，侧面缩小挪到脸朝的那一侧；背面看不到脸不画
    if (a.cry > 0 && spr.dir === 'd') E.drawSprite(ctx, 'fx_tears', x, top + h * 0.4, h * 0.42);
    else if (a.cry > 0 && spr.dir === 's') E.drawSprite(ctx, 'fx_tears', x + (spr.flip ? -1 : 1) * h * 0.1, top + h * 0.38, h * 0.26);
  }
  // 头顶锅数徽标：像素小锅 + 数字
  function drawPotBadge(x, y, pots) {
    E.drawSprite(ctx, 'ui_wok', x - 8, y, 16);
    E.label(ctx, String(pots), x + 6, y, 12, pots >= 12 ? '#E8504A' : '#1F2A44');
  }
  // 画某人（全身像素小人，含状态特效）；(sn.x, sn.y) 是身体中心，脚底在 FOOT_DY 之下
  function drawHead(a, time) {
    const x = a.sn.x, y = a.sn.y, pots = potsOf(a), foot = y + FOOT_DY;
    const huntingMe = !a.isPlayer && !a.crushed && a.target === S.player && pots > 0;
    const spr = personSprite(a, huntingMe);
    if (a.crushed) {
      const s = E.spr[spr.name];
      drawShadow(x, foot, 30);
      if (s) E.drawSprite(ctx, spr.name, x, foot - (FLAT_W * s.h / s.w) / 2, FLAT_W, { alpha: 0.9 });
      E.label(ctx, '被压垮', x, y - 14, 12, '#5E6A84');
      E.label(ctx, a.name, x, foot + 12, 12, '#5E6A84');
      return;
    }
    const h = a.isPlayer ? PLAYER_H : NPC_H, top = foot - h;
    if (huntingMe) {
      ctx.fillStyle = 'rgba(232,80,74,.2)';
      ctx.beginPath(); ctx.arc(x, y, 32, 0, Math.PI * 2); ctx.fill();
    }
    if (a.isPlayer) drawShadow(x, foot, 24, 'rgba(255,216,77,.7)');
    else drawShadow(x, foot, 20);
    // 播走路帧时不再上下晃（步伐本身就是动画）；站着的姿势轻轻呼吸
    const bob = spr.walking ? 0 : Math.sin(time * 6 + a.id) * 1.2;
    E.drawStanding(ctx, spr.name, x, foot + bob, h, { flip: spr.flip });
    drawStatusFx(a, spr, x, top, h, time, huntingMe || (!a.isPlayer && a.angry > 0));
    if (a.isPlayer) { E.label(ctx, '你', x, foot + 12, 13, '#1F2A44', '#FFD84D'); return; }
    if (a.teaT > 0) E.label(ctx, '泡茶中…', x, top - 8, 12, '#2F9E6B');
    E.label(ctx, a.name, x, foot + 12, 12, '#1F2A44');
    if (pots > 0) drawPotBadge(x - 24, top + 2, pots);
  }
  // 领导贴图：瞄准、原地等待用专门姿势，巡逻和追人播走路动画（每帧只调用一次）
  function leaderSprite(l) {
    const base = l.cfg.sprite, walk = walkFrame(l, base, l.x, l.y);
    if (l.state === 'aim') return { name: `${base}_aim` };
    if (l.state !== 'chase' && l.wait > 0) return { name: `${base}_idle` };
    return walk || { name: `${base}_${l.state === 'chase' ? 'chase' : 'walk'}` };
  }
  // 画领导（含危险圈）；领导的锅直接画在贴图手里（瞄准姿势）
  function drawLeader(l, time) {
    const chase = l.state === 'chase', foot = l.y + 28, h = l.cfg.h;
    ctx.setLineDash([7, 6]); ctx.strokeStyle = chase ? '#E8504A' : 'rgba(232,80,74,.5)'; ctx.lineWidth = chase ? 4 : 2;
    ctx.beginPath(); ctx.arc(l.x, l.y, 46, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    drawShadow(l.x, foot, 26);
    const spr = leaderSprite(l);
    const shake = l.state === 'aim' ? Math.sin(time * 30) * 1.2 : 0;
    E.drawStanding(ctx, spr.name, l.x + shake, foot, h, { flip: spr.flip });
    E.label(ctx, l.name, l.x, foot + 13, 13, '#E8504A');
    if (chase) {
      E.drawSprite(ctx, 'fx_anger', l.x + 24, foot - h + 8 + Math.sin(time * 12) * 2, 22);
      E.label(ctx, '！', l.x - 26, foot - h - 4, 26, '#E8504A');
    }
  }
  // 瞄准线：领导丢锅前，从领导到目标的红色虚线 + 目标头上的准星
  function drawAims(time) {
    for (const l of S.leaders) {
      if (l.state !== 'aim') continue;
      for (const t of l.targets) {
        const k = 1 - l.aimT / AIM_TIME;
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(time * 20);
        ctx.strokeStyle = '#E8504A'; ctx.lineWidth = 3; ctx.setLineDash([10, 8]);
        ctx.beginPath(); ctx.moveTo(l.x, l.y - 20); ctx.lineTo(t.sn.x, t.sn.y); ctx.stroke(); ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(t.sn.x, t.sn.y, 34 - k * 12, 0, Math.PI * 2); ctx.stroke();
      }
    }
  }

  // 地砖配色：base 底色、alt 棋盘格色、line 砖缝色；wood 为木地板（按条纹画）
  const FLOORS = {
    carpet: { base: '#BCCBDD', alt: '#B2C2D6', line: '#A5B6CC', size: 48 },
    wood:   { base: '#D9B98C', alt: '#CFAE80', line: '#B08A5E', size: 24, wood: true },
    lilac:  { base: '#D7CCE8', alt: '#CDC1E0', line: '#B9ABD0', size: 48 },
    mint:   { base: '#CFE6D6', alt: '#C3DDCB', line: '#A9C9B3', size: 32 },
  };
  // 画一块像素地面（房间或整层），r.tile 指定地砖类型
  function drawFloor(r) {
    const f = FLOORS[r.tile] || FLOORS.carpet, n = f.size;
    ctx.fillStyle = f.base; ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.save();
    ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
    if (f.wood) {
      // 木地板：横条，每条错开接缝
      for (let y = r.y, row = 0; y < r.y + r.h; y += n, row++) {
        ctx.fillStyle = row % 2 ? f.alt : f.base; ctx.fillRect(r.x, y, r.w, n);
        ctx.fillStyle = f.line; ctx.fillRect(r.x, y + n - 2, r.w, 2);
        for (let x = r.x + (row % 3) * 40; x < r.x + r.w; x += 120) ctx.fillRect(x, y, 2, n - 2);
      }
    } else {
      // 地毯 / 瓷砖：棋盘格 + 砖缝
      for (let x = r.x; x < r.x + r.w; x += n) for (let y = r.y; y < r.y + r.h; y += n) {
        if (((x - r.x) / n + (y - r.y) / n) % 2 === 0) { ctx.fillStyle = f.alt; ctx.fillRect(x, y, n, n); }
        ctx.fillStyle = f.line; ctx.fillRect(x, y, n, 2); ctx.fillRect(x, y, 2, n);
      }
    }
    ctx.restore();
  }
  // 画一段墙：浅色顶面 + 深色正面 + 深色描边
  function drawWall(w) {
    const face = w.w > w.h ? Math.min(8, w.h / 2) : 0; // 横墙才露出正面
    ctx.fillStyle = '#1F2A44'; ctx.fillRect(w.x - 2, w.y - 2, w.w + 4, w.h + 4 + face);
    ctx.fillStyle = '#7F8FB0'; ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.fillStyle = '#9DACCB'; ctx.fillRect(w.x, w.y, w.w, 3);
    if (face) { ctx.fillStyle = '#4C5A7A'; ctx.fillRect(w.x, w.y + w.h, w.w, face); }
  }

  function draw(time) {
    const me = S.player.sn, W = OFFICE.world;
    const camX = W.w < st.w ? (W.w - st.w) / 2 : E.clamp(me.x - st.w / 2, 0, W.w - st.w);
    const camY = W.h < st.h ? (W.h - st.h) / 2 : E.clamp(me.y - st.h / 2, 0, W.h - st.h);
    ctx.fillStyle = '#1F2A44';
    ctx.fillRect(0, 0, st.w, st.h);
    ctx.save();
    if (shake > 0) { ctx.translate(E.rand(-shake, shake), E.rand(-shake, shake)); shake *= 0.86; if (shake < 0.5) shake = 0; }
    ctx.translate(-camX, -camY);

    // 办公区地毯 + 各房间地面（像素地砖）
    drawFloor({ x: 0, y: 0, w: W.w, h: W.h, tile: 'carpet' });
    for (const r of OFFICE.rooms) drawFloor(r);
    for (const r of OFFICE.rooms) {
      ctx.globalAlpha = 0.35;
      E.label(ctx, r.name, r.x + r.w / 2, r.y + r.h - 34, 22, '#1F2A44', 'rgba(0,0,0,0)');
      ctx.globalAlpha = 1;
    }
    // 下午茶：茶水间高亮
    if (S.tea > 0) {
      ctx.fillStyle = `rgba(47,158,107,${0.18 + 0.1 * Math.sin(time * 6)})`;
      ctx.fillRect(0, 1216, 300, 224);
      E.label(ctx, '🧋 下午茶', OFFICE.tea.x, OFFICE.tea.y - 60, 18, '#2F9E6B');
    }
    // 墙：顶面 + 一条正面（3/4 俯视的厚度）
    for (const w of OFFICE.walls) drawWall(w);

    // 摆设
    for (const p of OFFICE.props) {
      const s = E.spr[p.sprite];
      if (!s) continue;
      E.drawSprite(ctx, p.sprite, p.x + p.w / 2, p.y + (p.w * s.h / s.w) / 2, p.w);
    }

    // 预警中的锅（散会 / 打印机门口的红圈）
    for (const f of S.flying) {
      if (f.phase !== 'warn') continue;
      const k = 1 - f.t / Math.max(0.01, f.warn0);
      ctx.strokeStyle = '#E8504A'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(f.x, f.y, 14 + k * 20, 0, Math.PI * 2); ctx.stroke();
      E.label(ctx, '!', f.x, f.y, 24, '#E8504A');
    }

    // 瞄准扇形：身上有锅（或拿着 P0）时，在前方画出自动瞄准的扇形；扇形里有人就变绿并套住他
    const P = S.player;
    if (!P.crushed && (potsOf(P) || holdsHot(P))) {
      const b = pickAim(P), ready = canFire(P);
      // 有目标且能甩：绿色；扇形里没人：白色；冷却中：灰色（像素地板很花，透明度要够）
      const col = !ready ? '94,106,132' : b ? '47,158,107' : '255,253,245';
      ctx.fillStyle = `rgba(${col},${b && ready ? 0.3 : 0.24})`;
      ctx.strokeStyle = `rgba(${col},.9)`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(me.x, me.y);
      ctx.arc(me.x, me.y, AIM_RANGE, me.angle - AIM_CONE, me.angle + AIM_CONE);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      if (b) {
        ctx.strokeStyle = ready ? 'rgba(47,158,107,.95)' : 'rgba(94,106,132,.7)'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(b.sn.x, b.sn.y, 30 + Math.sin(time * 10) * 3, 0, Math.PI * 2); ctx.stroke();
        if (ready) E.label(ctx, '甩他!', b.sn.x, b.sn.y - 58, 13, '#FFFDF5', '#2F9E6B');
      }
    }
    // 来锅预警：有人甩的锅正朝你飞来，红圈收紧；进入反甩窗口时变实心提示「按甩！」
    let incoming = Infinity, inWin = false;
    for (const f of S.throws) {
      if (f.owner === P) continue;
      const t = incomingTTI(f, P);
      if (t < incoming) { incoming = t; inWin = t <= parryWin(f); }
    }
    if (incoming < 0.6) {
      ctx.strokeStyle = '#E8504A'; ctx.lineWidth = inWin ? 5 : 3;
      ctx.beginPath(); ctx.arc(me.x, me.y, 26 + incoming * 60, 0, Math.PI * 2); ctx.stroke();
      if (inWin) E.label(ctx, '按甩!', me.x, me.y - 62, 16, '#FFFDF5', '#E8504A');
    }

    // 所有人的锅尾巴先画（压在所有人头下面），再按 y 排序画头和领导
    for (const a of S.agents) drawTail(a, time);
    const people = S.agents.map((a) => ({ y: a.sn.y, f: () => drawHead(a, time) }));
    for (const l of S.leaders) people.push({ y: l.y, f: () => drawLeader(l, time) });
    people.sort((a, c) => a.y - c.y).forEach((p) => p.f());
    drawAims(time);

    // 飞行中的锅
    for (const f of S.flying) {
      if (f.phase === 'fly') {
        ctx.fillStyle = 'rgba(31,42,68,.2)';
        ctx.beginPath(); ctx.ellipse(f.x, f.y + 22, 16, 5, 0, 0, Math.PI * 2); ctx.fill();
        if (f.hot) drawHotPot(f.x, f.y, time, null);
        else drawFlyingWok(f.x, f.y, f.label, 44, f.a);
      } else if (f.phase === 'drop') {
        drawWok(f.x, f.y, f.label, 44, f.spin, Math.max(0, f.t / 0.5));
      } else if (f.hot) drawHotPot(f.x, f.y, time, null);
    }
    // 甩出去的锅：带一道拖影，越快越明显
    for (const f of S.throws) {
      ctx.strokeStyle = f.owner.isPlayer ? 'rgba(47,158,107,.55)' : 'rgba(232,80,74,.45)';
      ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(f.x - Math.cos(f.a) * 46, f.y - Math.sin(f.a) * 46); ctx.lineTo(f.x, f.y); ctx.stroke();
      ctx.lineCap = 'butt';
      if (f.hot) drawHotPot(f.x, f.y, time, null);
      else drawFlyingWok(f.x, f.y, f.label, 40, f.a);
    }
    // 拿在手里的 P0
    if (S.hot && !S.hot.inFlight) drawHotPot(S.hot.holder.sn.x, S.hot.holder.sn.y - 52, time, S.hot.t);

    // 甩锅飞行动画（抛物线）
    for (const a of S.arcs) {
      if (a.t < 0) continue;
      const k = Math.min(1, a.t / a.dur);
      const to = a.to();
      const x = a.x0 + (to.x - a.x0) * k;
      const y = a.y0 + (to.y - a.y0) * k - Math.sin(Math.PI * k) * 50;
      drawWok(x, y, a.label, 34, k * 8);
    }

    // 一次性特效：先弹大再回落，后半段淡出
    for (const e of S.fx) {
      const k = e.t / e.dur;
      const sc = k < 0.25 ? 0.5 + k * 2.6 : 1.15 - (k - 0.25) * 0.3;
      E.drawSprite(ctx, e.name, e.x, e.y, e.size * sc, { alpha: k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4, rot: k * 0.5 });
    }

    floats.draw(ctx, 0, 0);
    ctx.restore();

    // 屏幕外提示：领导、P0、冲你来的同事、可甩锅的同事
    // 角标用各人自己的像素头像；圈的颜色表示状态（红 = 领导 / 冲你来，绿 = 能甩给他，灰 = 刚接锅甩不了）
    for (const l of S.leaders) E.edgeHint(ctx, st, l.x - camX, l.y - camY, { sprite: `${l.cfg.sprite}_idle` }, '#E8504A');
    for (const b of S.bots) {
      if (b.crushed) continue;
      const hunting = b.target === P && potsOf(b) > 0;
      const color = hunting ? '#E8504A' : canThrowTo(P, b) ? '#2F9E6B' : '#9AA6C4';
      E.edgeHint(ctx, st, b.sn.x - camX, b.sn.y - camY, { sprite: `${b.p.sprite}_normal` }, color, hunting ? 'fx_anger' : null);
    }
    if (S.hot && !S.hot.holder.isPlayer) E.edgeHint(ctx, st, S.hot.holder.sn.x - camX, S.hot.holder.sn.y - camY, '🔥', '#E8504A');
    E.drawStick(ctx, inp);
  }

  /* ---------------- HUD + 实时排名 ---------------- */
  // 「甩」按钮状态：锅飞来进入窗口 → 红色「弹」；能甩 → 黄色；冷却中显示转圈；没锅 → 灰色
  const btnThrow = document.getElementById('btnThrow');
  function updateThrowBtn() {
    const P = S.player;
    btnThrow.hidden = mode !== 'play';
    if (btnThrow.hidden) return;
    let parryNow = false;
    if (P.parryLock <= 0) for (const f of S.throws) if (f.owner !== P && incomingTTI(f, P) <= parryWin(f)) parryNow = true;
    const has = potsOf(P) > 0 || holdsHot(P);
    btnThrow.classList.toggle('parry', parryNow);
    btnThrow.classList.toggle('empty', !parryNow && !has);
    btnThrow.style.setProperty('--cd', parryNow ? 0 : Math.max(0, P.cool, P.stun) / THROW_CD);
    btnThrow.firstChild.textContent = parryNow ? '弹!' : holdsHot(P) ? 'P0' : '甩!';
  }
  function updateHud() {
    const P = S.player, n = potsOf(P);
    const rank = ranking();
    const myRank = rank.indexOf(P) + 1;
    const rush = mode === 'play' && S.t >= L.duration - FINAL_RUSH;
    E.setText('hClock', clockAt(S.t));
    E.setText('hPotsN', `${n}/${MAX_POTS}`);
    E.setText('hRank', `第 ${myRank}/${rank.length} 名`);
    E.setText('hCombo', `连甩 ×${P.combo}`);
    document.getElementById('hCombo').hidden = P.combo < 2;
    document.getElementById('hPotsBar').style.width = Math.min(100, (n / MAX_POTS) * 100) + '%';
    document.getElementById('hPots').classList.toggle('hot', n >= MAX_POTS * 0.6);
    document.getElementById('hClock').parentElement.classList.toggle('hot', S.t >= L.duration - 13);
    updateThrowBtn();
    document.getElementById('hRank').parentElement.classList.toggle('hot', myRank > PASS_RANK);

    // 排名面板：内容变了才刷新 DOM；前三名下面画一条「加班线」
    const sig = rank.map((a) => `${a.id}:${potsOf(a)}:${a.crushed ? 1 : 0}`).join('|') + (rush ? 'R' : '');
    if (sig !== rankSig) {
      rankSig = sig;
      const el = document.getElementById('rank');
      el.innerHTML = rank.map((a, i) => `<li class="${a.isPlayer ? 'me' : ''}${i === PASS_RANK - 1 && rank.length > PASS_RANK ? ' cut' : ''}${a.crushed ? ' out' : ''}">
        <b>${i + 1}</b><span>${a.name}</span><em>${a.crushed ? '压垮' : `<img class="ico" src="assets/px/ui_wok.png" alt="锅">${potsOf(a)}`}</em></li>`).join('');
      el.classList.toggle('rush', rush);
    }
    // 最后 10 秒：每秒滴答一声
    if (rush && Math.floor(S.t) !== S.lastTick) { S.lastTick = Math.floor(S.t); E.sfx('tick'); }
  }

  /* ---------------- 结算 ---------------- */
  // 结束一局：reason = crushed（被压垮）| time（到点下班）
  function finish(reason) {
    mode = 'over';
    const P = S.player, left = potsOf(P), crushed = reason === 'crushed';
    const rank = ranking();
    const myRank = crushed ? rank.length : rank.indexOf(P) + 1;
    const stars = crushed ? 0 : starsOfRank(myRank);
    const final = Math.max(0, P.score + stars * 100 - left * 10);
    const vs = Object.entries(P.victims).sort((a, c) => c[1] - a[1]);
    const victim = vs.length ? `${vs[0][0]}（${vs[0][1]} 口）` : '没有人';
    const last = rank[rank.length - 1];

    // 进度：过关解锁下一关、记录本关最好成绩
    const prog = loadProgress();
    const old = prog.best[L.id];
    const isBest = stars > 0 && (!old || final > old.score);
    if (isBest) prog.best[L.id] = { score: final, stars };
    if (stars > 0) prog.unlocked = Math.max(prog.unlocked, L.id + 1);
    saveProgress(prog);
    E.sfx(stars > 0 ? 'win' : 'lose');

    let badge, title, share;
    if (crushed) {
      badge = '被锅压垮'; title = '锅太多，走不动了';
      share = `今天背了 ${MAX_POTS} 口锅，当场被压垮。甩出去 ${P.thrown} 口，最大受害者：${victim}。`;
    } else if (!stars) {
      badge = `18:00 · 第 ${myRank} 名`; title = '被留下加班';
      share = `下班时排第 ${myRank} 名，身上还有 ${left} 口锅，被留下加班了。`;
    } else {
      badge = `18:00 · 第 ${myRank} 名`; title = ['', '甩锅宗师', '职场老油条', '勉强下班'][myRank];
      share = `今天第 ${myRank} 名下班，甩锅 ${P.thrown} 口，最大受害者：${victim}。${last !== P ? `${last.name}${last.crushed ? '被锅压垮了' : '被留下加班了'}。` : ''}`;
    }

    // 最终排名表
    const table = rank.map((a, i) => `<li class="${a.isPlayer ? 'me' : ''}${i === PASS_RANK - 1 && rank.length > PASS_RANK ? ' cut' : ''}">
      <b>${i + 1}</b><span>${a.name}</span><em>${a.crushed ? '压垮' : potsOf(a) + ' 口'}</em><i>${a.score} 分</i></li>`).join('');
    const next = LEVELS[LEVELS.indexOf(L) + 1];
    // 星级用像素星星图标；顶部配一张主角：压垮 → 埋在锅堆里，过关 → 庆祝下班，没过关 → 慌张
    const starHtml = `<div class="stars">${[1, 2, 3].map((i) => `<img src="assets/px/ui_${i <= stars ? 'star' : 'star_empty'}.png" alt="${i <= stars ? '★' : '☆'}">`).join('')}</div>`;
    const hero = crushed ? 'player_crushed' : stars ? 'player_win' : 'player_panic';
    E.showPanel(`
      <img class="hero" src="assets/px/${hero}.png" alt="">
      <span class="badge">${badge}</span>
      <h1>${title}</h1>
      ${starHtml}
      <ol class="ranklist">${table}</ol>
      <div class="stat">
        <div><b>${P.thrown}</b><span>甩出的锅</span></div>
        <div><b>${P.maxCombo}</b><span>最高连甩</span></div>
        <div><b>${left}</b><span>身上剩余</span></div>
      </div>
      <p class="final">总分 <b id="finalNum">${final}</b>${isBest ? ' <em>新纪录</em>' : ''}</p>
      <div class="share">${share}<small>↑ 分享卡片文案</small></div>
      ${crushed && !S.revived ? '<button class="btn ad" data-act="revive">甩掉 8 口锅，接着熬</button>' : ''}
      ${!crushed && !stars && !S.rescued ? '<button class="btn ad" data-act="rescue">找人代班：甩掉 4 口重新排名</button>' : ''}
      ${stars ? '<button class="btn ad" data-act="double">总分翻倍</button>' : ''}
      ${stars && next ? `<button class="btn" data-act="next">下一关：${next.name}</button>` : ''}
      ${stars && !next ? '<button class="btn ghost" data-act="soon">更多关卡开发中</button>' : ''}
      <button class="btn ${stars && next ? 'ghost' : ''}" data-act="retry">再来一局</button>
      <button class="btn ghost" data-act="menu">选关</button>
      <button class="btn ghost" data-act="share">晒战绩</button>`, {
      retry: startGame,
      menu: showIntro,
      share: E.fakeShare,
      soon: () => E.toast('第 3 关还在做，先把前两关打到三星吧'),
      next: () => { L = next; showIntro(); },
      revive: () => E.fakeAd(() => {
        S.revived = true;
        P.sn.segs.splice(Math.max(0, P.sn.segs.length - 8));
        S.flying = S.flying.filter((f) => f.target !== P);
        S.throws = S.throws.filter((f) => f.target !== P);
        S.over = null;
        if (S.t > L.duration - 15) S.t = L.duration - 15;
        E.hidePanel(); mode = 'play';
        E.toast('甩掉 8 口锅，继续熬到下班');
      }),
      rescue: () => E.fakeAd(() => {
        S.rescued = true;
        P.sn.segs.splice(Math.max(0, P.sn.segs.length - 4));
        finish('time');
      }),
      double: (btn) => E.fakeAd(() => {
        document.getElementById('finalNum').textContent = final * 2;
        btn.remove();
        E.toast('总分已翻倍');
      }),
    });
  }

  /* ---------------- 流程 ---------------- */
  // 隐藏所有横幅
  function clearBanners() {
    document.getElementById('hint').classList.remove('on');
    document.getElementById('msg').classList.remove('on');
    hintTimer = msgTimer = 0;
  }
  // 开新局
  function startGame() {
    E.unlockAudio();
    S = makeState();
    floats.list = [];
    shake = 0;
    rankSig = '';
    E.hidePanel();
    clearBanners();
    inp.fire = 0;
    document.getElementById('hud').hidden = false;
    document.getElementById('rank').hidden = false;
    mode = 'play';
  }
  // 暂停
  function pauseGame() {
    if (mode !== 'play') return;
    mode = 'pause';
    E.showPanel(`
      <span class="badge">暂停</span>
      <h1>带薪休息中</h1>
      <p class="sub">${L.name} · 现在 ${clockAt(S.t)}</p>
      <button class="btn" data-act="resume">继续上班</button>
      <button class="btn ghost" data-act="retry">重新开始</button>
      <button class="btn ghost" data-act="menu">选关</button>`, {
      resume: () => { E.hidePanel(); mode = 'play'; },
      retry: startGame,
      menu: showIntro,
    });
  }
  // 关卡介绍 + 选关
  function showIntro() {
    mode = 'intro';
    S = makeState();
    clearBanners();
    const prog = loadProgress();
    const best = prog.best[L.id];
    const tabs = LEVELS.map((lv) => {
      const locked = lv.id > prog.unlocked;
      const b = prog.best[lv.id];
      return `<button class="lv${lv === L ? ' on' : ''}" data-act="pick" data-id="${lv.id}" ${locked ? 'disabled' : ''}>
        ${locked ? '🔒 ' : ''}第 ${lv.id} 关<small>${b ? '★'.repeat(b.stars) : locked ? '前一关进前三解锁' : '未通关'}</small></button>`;
    }).join('');
    const leaders = L.leaders.map((d) => LEADER_TYPES[d.type].name).join('、');
    E.showPanel(`
      <div class="lvtabs">${tabs}</div>
      <span class="badge">第 ${L.id} 关 · ${1 + L.bots.length} 人</span>
      <h1>${L.name}</h1>
      <p class="sub">${L.desc}</p>
      <ul class="rules">
        <li><span>🕹️</span>左下角摇杆控制方向，右下角「甩」把尾巴上的锅扔出去</li>
        <li><span>🤵</span>${leaders}会朝闲着的人丢锅，红色瞄准线出现就躲开；撞上领导一次 +3 口</li>
        <li><span>🎯</span>砸中谁就是谁的；甩空了锅立刻弹回你身上</li>
        <li><span>🛡️</span>锅朝你飞来时按「甩」，能弹回去；同事也会这样弹你</li>
        <li><span>📢</span>留意群消息：散会、卡纸、P0 事故，锅会从那里飞出来</li>
      </ul>
      <div class="goal">
        <b>目标</b> 18:00 按身上剩余锅数排名：第 1 名 ★★★ · 第 2 名 ★★ · 第 3 名 ★，进前三过关
        ${best ? `<br><b>最好成绩</b> ${best.score} 分 · ${'★'.repeat(best.stars)}` : ''}
      </div>
      <button class="btn" data-act="start">开始上班</button>`, {
      start: startGame,
      pick: (btn) => { L = LEVELS.find((lv) => lv.id === Number(btn.dataset.id)); showIntro(); },
    });
  }

  /* ---------------- 调试：纯 AI 对局模拟（平衡数值用） ---------------- */
  // 在控制台运行 SG_DEBUG.simulate(关卡序号, 局数)：玩家也交给 AI，快速跑完多局，统计排名和锅数
  window.SG_DEBUG = {
    simulate(levelIdx, runs) {
      const keepL = L, keepAuto = auto, keepS = S, keepMode = mode;
      L = LEVELS[levelIdx || 0]; auto = true;
      const out = { runs: runs || 20, crushedPlayer: 0, rankHist: {}, avgLeft: {}, crushedBots: 0, avgSpawned: 0, avgThrown: 0, avgLaunched: 0, avgMiss: 0, avgParry: 0, avgLeaderHits: 0, avgCrushT: 0 };
      for (let r = 0; r < out.runs; r++) {
        S = makeState(); mode = 'play';
        while (!S.over) update(1 / 30);
        if (S.over === 'crushed') out.crushedPlayer++;
        const rank = ranking();
        const pr = S.over === 'crushed' ? rank.length : rank.indexOf(S.player) + 1;
        out.rankHist[pr] = (out.rankHist[pr] || 0) + 1;
        for (const a of S.agents) {
          out.avgLeft[a.name] = (out.avgLeft[a.name] || 0) + potsOf(a) / out.runs;
          if (a.crushed) { out.crushedBots++; out.avgCrushT += a.crushedAt; }
        }
        out.avgSpawned += S.spawned / out.runs;
        out.avgLeaderHits += S.leaderHits / out.runs;
        out.avgThrown += S.agents.reduce((s, a) => s + a.thrown, 0) / out.runs;
        out.avgLaunched += S.agents.reduce((s, a) => s + a.launched, 0) / out.runs;
        out.avgMiss += S.agents.reduce((s, a) => s + a.misses, 0) / out.runs;
        out.avgParry += S.agents.reduce((s, a) => s + a.parries, 0) / out.runs;
      }
      for (const k in out.avgLeft) out.avgLeft[k] = +out.avgLeft[k].toFixed(1);
      out.avgSpawned = +out.avgSpawned.toFixed(1); out.avgLeaderHits = +out.avgLeaderHits.toFixed(1);
      out.avgCrushT = out.crushedBots ? Math.round(out.avgCrushT / out.crushedBots) : 0; out.avgThrown = +out.avgThrown.toFixed(1);
      for (const k of ['avgLaunched', 'avgMiss', 'avgParry']) out[k] = +out[k].toFixed(1);
      L = keepL; auto = keepAuto; S = keepS; mode = keepMode;
      floats.list = []; clearBanners();
      return out;
    },
    state: () => S,
  };

  /* ---------------- 启动 ---------------- */
  document.getElementById('btnPause').addEventListener('click', pauseGame);
  const btnMute = document.getElementById('btnMute');
  btnMute.addEventListener('click', () => {
    E.muted = !E.muted;
    document.getElementById('icoSound').src = `assets/px/ui_sound_${E.muted ? 'off' : 'on'}.png`; // 切换喇叭图标
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' || e.key === 'p') pauseGame(); });

  // ?level=2：直接进入指定关卡（调试用，会顺便解锁）
  const qLevel = Number(query.get('level'));
  if (qLevel && LEVELS.some((lv) => lv.id === qLevel)) {
    L = LEVELS.find((lv) => lv.id === qLevel);
    const prog = loadProgress();
    if (prog.unlocked < qLevel) { prog.unlocked = qLevel; saveProgress(prog); }
  }

  E.showPanel('<h1>加载中…</h1><p class="sub">正在把锅摆好</p>', {});
  E.loadSprites(SPRITES, 'assets/px/', 'png').then(showIntro);

  E.loop((dt, time) => {
    if (mode !== 'play') inp.fire = 0;
    if (mode === 'play') {
      update(dt);
      if (S.over) finish(S.over);
    }
    if (mode === 'play' || mode === 'over') floats.update(dt);
    updateBanners(mode === 'play' ? dt : 0);
    if (S) { draw(time); updateHud(); }
  });
})();
