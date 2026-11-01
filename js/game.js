/* =========================================================
 * 甩锅侠 · 主逻辑（v3：出事追责）
 * 核心循环：领导远程丢锅 / 天降锅（只砸主角）/ 会议室散会喷锅 / 随机事件 → 被砸中就粘在身后
 *          → 每口锅都有截止时间，甩来甩去不重置；到点时锅在谁身上，谁「背锅 +1」（P0 +3）
 *          → 按「甩」把最急的那口扔出去：砸中谁就是谁的，甩空立刻弹回；在领导视野里甩会被抓现行
 *          → 18:00 按背锅次数排名，进前三过关；身上堆满 12 口当场压垮
 * 玩家和机器人同事是同一种「打工人」，唯一区别是方向由手指给还是由 AI 给
 * ========================================================= */
(function () {
  'use strict';

  const OFFICE = window.OFFICE, LEVELS = window.LEVELS;
  const st = E.createStage(), ctx = st.ctx, inp = E.createInput(st.c, document.getElementById('btnThrow'));

  // 像素素材（assets/px/*.png，网页上从 assets/atlas/ 图集加载）。角色图按「基础名_状态」命名，见 personSprite / leaderSprite
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
  const WHIFF_LOCK = 0.4;      // 按空（没锅可甩也没东西可弹）后多久不能反甩，防止狂按
  const COMBO_WINDOW = 2.5;    // 连甩判定窗口（秒）
  const RECV_SHIELD = 0.8;     // 刚接锅的人多久内甩不中（锅会弹开，算甩空）
  const RECV_STUN = 0.4;       // 接锅后愣多久才能甩出去
  const NO_RETURN = 1.5;       // 同事接锅后多久内不会主动瞄准刚甩给他的人（玩家不受限）
  const MAX_POTS = 12;         // 身上堆满即被压垮（玩家直接失败，同事出局）
  const POT_ALARM = 9;         // 堆到这么多开始报警（锅数条变红、冒汗）
  const DUE_DEFAULT = 30;      // 锅的截止时间（关卡没配 potLife 时用）：落到人身上开始倒计时，甩来甩去不重置
  const DUE_WARN = 10;         // 剩几秒变黄
  const DUE_DANGER = 5;        // 剩几秒变红冒烟
  const VISION_RANGE = 220;    // 领导视野：扇形长度（比玩家甩锅扇形 150 稍长）
  const VISION_CONE = 0.52;    // 领导视野：扇形半角，左右各约 30°（总开角约 60°）
  const SKY_TIME = 1;          // 天降锅：阴影出现到砸下来的时间（躲不掉，只是给个准备）
  const SKY_FIRST = 3;         // 开局第几秒落下第一口天降锅
  const POT_SPEED = 105;       // 领导 / 散会飞出来的锅速度（按移动速度同比例放慢，保证横移躲得开）
  const POT_TURN = 1.5;        // 飞行锅转向速度（越小越好躲）
  const POT_LIFE = 7;          // 飞行锅存活时间
  const AIM_TIME = 0.8;        // 领导瞄准预警时长
  const LEADER_HIT_POTS = 3;   // 撞上领导一次派几口
  const ALERT_SEE = 480;       // 老板离实习生多近才「看得见」有人欺负他
  const ALERT_CD = 15;         // 老板追完一次后多久内不再追
  const ALERT_CHASE = 4;       // 老板追人时长
  const ALERT_SPEED = 120;     // 老板追人速度（略慢于人，绕障碍追）
  const P0_LIFE = 10;          // P0 的截止时间（比普通锅短得多）
  const P0_BLAME = 3;          // P0 到点算背几次锅
  const FINAL_RUSH = 10;       // 最后几秒进入排名冲刺
  const PASS_RANK = 3;         // 进前几名过关

  // 同事人格：speed 速度倍率；turn 转向；react 思考间隔；aggr 甩锅积极度；seekR 找人半径；
  // seekMin 身上几口锅才开始找人甩（有锅快到点时不管这个）；dodge 躲锅能力；caution 躲人/躲领导；
  // parry 锅飞来时反甩成功的概率；throwR 目标进入多近才出手；sneak 在领导视野里时忍住不甩的概率
  const PERSONAS = {
    me:       { name: '你', sprite: 'player', speed: 1, turn: 5.2, react: 0.2, aggr: 1, seekR: 520, seekMin: 1, dodge: 0.9, caution: 0.7, parry: 0.5, throwR: 130, sneak: 0.9 },
    pm:       { name: '产品经理', sprite: 'pm', speed: 0.93, turn: 4.6, react: 0.22, aggr: 1, seekR: 520, seekMin: 1, dodge: 0.8, caution: 0.6, parry: 0.35, throwR: 120, sneak: 0.85 },
    tester:   { name: '测试小王', sprite: 'tester', speed: 0.88, turn: 4.4, react: 0.24, aggr: 0.85, seekR: 440, seekMin: 1, dodge: 1, caution: 0.8, parry: 0.4, throwR: 110, sneak: 0.7 },
    intern:   { name: '实习生', sprite: 'intern', speed: 0.85, turn: 4, react: 0.36, aggr: 0.4, seekR: 260, seekMin: 3, dodge: 0.45, caution: 1, parry: 0.1, throwR: 90, sneak: 0.2 },
    veteran:  { name: '老油条', sprite: 'veteran', speed: 0.95, turn: 4.8, react: 0.2, aggr: 0.65, seekR: 320, seekMin: 2, dodge: 1.3, caution: 1.3, parry: 0.65, throwR: 110, sneak: 1, tea: true },
    designer: { name: '设计师', sprite: 'designer', speed: 0.9, turn: 4.5, react: 0.26, aggr: 0.75, seekR: 400, seekMin: 1, dodge: 0.9, caution: 0.9, parry: 0.3, throwR: 115, sneak: 0.6 },
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
  let forceTut = query.has('tut'); // ?tut=1：已经看过带教也再走一遍
  let L = LEVELS[0];             // 当前关卡
  let S = null;                  // 当前对局状态
  let mode = 'loading';          // loading | lobby | intro | play | pause | over
  let shake = 0;                 // 屏幕震动
  let hintTimer = 0;             // 当前提示剩余显示时间
  let msgTimer = 0;              // 群消息剩余显示时间

  /* ---------------- 工具 ---------------- */
  // 当前身上锅数
  const potsOf = (a) => a.sn.segs.length;
  // 本关锅的截止时长
  const potLife = () => L.potLife || DUE_DEFAULT;
  // 新的一口锅：label 锅上的字，due 到点时刻（对局秒数），hot 是否 P0
  // 带教期间的锅不走时间（due = Infinity），开始上班时再统一起算
  function newPot(t, hot, label) {
    return { label: hot ? 'P0' : label || E.pick(OFFICE.potLabels), due: S && S.tut ? Infinity : t + (hot ? P0_LIFE : potLife()), hot: !!hot };
  }
  // 某人身上最急的一口锅的下标（没有锅返回 -1）
  function urgentIdx(a) {
    let bi = -1;
    a.sn.segs.forEach((p, i) => { if (bi < 0 || p.due < a.sn.segs[bi].due) bi = i; });
    return bi;
  }
  // 某人身上最急的一口锅还剩几秒（没有锅返回 Infinity）
  const urgentLeft = (a) => { const i = urgentIdx(a); return i < 0 ? Infinity : a.sn.segs[i].due - S.t; };
  // 某人身上有没有 P0
  const holdsHot = (a) => a.sn.segs.some((p) => p.hot);
  // 两个打工人蛇头之间的距离
  const headDist = (a, b) => E.dist(a.sn.x, a.sn.y, b.sn.x, b.sn.y);
  // 上班时钟：开始上班后过了几秒（带教期间 t0 = Infinity，结果是 -Infinity，时钟停在 09:00）
  // S.t 是对局物理时间（锅的截止、动画都用它），派锅节奏、散会、下班判定都用上班时钟
  const workT = () => S.t - S.t0;
  // 上班秒数 → 屏幕时钟文字（09:00 ~ 18:00）
  function clockAt(t) {
    const mins = (E.clamp(t, 0, L.duration) / L.duration) * 9 * 60;
    const hh = 9 + Math.floor(mins / 60), mm = Math.floor(mins % 60);
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }
  // 读取 / 保存闯关进度（存储不可用时静默失败）；tutDone 记录第 1 关的带教看过没有
  // v3：关卡从两关改成三关，旧存档的关卡编号对不上，换新键名重新开始
  const SAVE_KEY = 'shuaiguo_v3';
  function loadProgress() {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || { unlocked: 1, best: {} }; } catch (_) { return { unlocked: 1, best: {} }; }
  }
  function saveProgress(p) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(p)); } catch (_) { /* 忽略 */ } }

  /* ---------------- 对局状态 ---------------- */
  // 创建一个打工人（玩家或机器人同事共用这一个结构）
  // noPots：带教时同事开局不带锅（开始上班时再发，见 startWork）
  function makeAgent(id, key, x, y, isPlayer, noPots) {
    const p = PERSONAS[key];
    const sn = new E.Snake(x, y, { speed: BASE_SPEED * p.speed, turn: p.turn, spacing: 22 }); // 锅缩小后尾巴间距同步收紧
    sn.angle = isPlayer ? 0 : E.rand(0, Math.PI * 2);
    if (!isPlayer && !noPots) giveStartPots(sn, 0);
    return {
      id, key, p, name: p.name, isPlayer, sn,
      want: sn.angle, thinkT: E.rand(0, 0.3), target: null,   // AI：想去的方向、思考倒计时、想甩锅的对象
      blames: 0, caught: 0, alarmed: false,                    // 背锅次数、被领导抓现行次数、是否已提示快压垮
      thrown: 0, combo: 0, comboT: 0, maxCombo: 0, victims: {},
      cool: 0, stun: 0, shield: 0, lock: {},                  // lock[对方 id] = 到这个时间前同事不会主动瞄准他
      parryLock: 0, launched: 0, misses: 0, parries: 0,        // 按空惩罚、出手次数、甩空次数、反甩次数
      aimTgt: null,                                            // 当前锁定的瞄准目标
      cry: 0, teaCd: E.rand(8, 12), teaT: 0, angry: 0,
      crushed: false, crushedAt: 0,
      stuckT: 0, lastX: x, lastY: y, panicT: 0,                // 卡墙检测
    };
  }
  // 同事开局自带的锅：截止时间打散，免得同一时刻一起到点
  function giveStartPots(sn, t) {
    for (let i = 0; i < L.startPots; i++) { const pot = newPot(t); pot.due = t + E.rand(0.5, 1) * potLife(); sn.segs.push(pot); }
  }
  // 创建一位领导
  function makeLeader(def) {
    const cfg = LEADER_TYPES[def.type], route = OFFICE.routes[def.route];
    return {
      type: def.type, cfg, name: cfg.name, route, x: route[0].x, y: route[0].y, i: 1, wait: 1.5,
      tgo: null, faceLock: null,                              // 带教剧本：要走去的点、锁死的视野朝向
      path: [], goal: null, repathT: 0,                       // 寻路：当前路径、目标点、下次重算倒计时
      state: 'patrol', st: 0, aimT: 0, targets: [], chase: null, hitCd: {}, alertCd: 0,
      throwCd: E.rand(0, 1.5),
      face: Math.PI / 2, baseFace: Math.PI / 2,               // 视野朝向：走路时朝前进方向，停下时左右张望
    };
  }
  // 生成一局的初始状态；tut 为真时先走带教（同事站到带教位置、开局不带锅，上班时钟先不走）
  function makeState(tut) {
    const spots = tut ? L.tutorial.spots : {};
    const player = makeAgent(0, 'me', OFFICE.player.x, OFFICE.player.y, true);
    const bots = L.bots.map((k, i) => { const sp = spots[k] || OFFICE.spawns[i]; return makeAgent(i + 1, k, sp.x, sp.y, false, tut); });
    return {
      t: 0, t0: tut ? Infinity : 0, player, bots, agents: [player, ...bots],
      leaders: L.leaders.map(makeLeader),
      flying: [], throws: [], arcs: [], fx: [], tea: 0,
      pace: null, paceIdx: -1, schedule: buildSchedule(), hintIdx: 0, tipsShown: {},
      // 带教进度：i 当前步，timers 本步的定时器，ring 要走到的黄圈，victim 第一次甩中的同事
      tut: tut ? { i: -1, timers: [], ring: null, step: null, def: null, done: false, victim: null, showRank: false } : null,
      finale: false, finMsg: false, finDone: false,                  // 收尾（下午茶）：是否进行中 / 群消息发了没 / 触发过没
      skyFirst: !tut, revived: false, rescued: false, over: null, lastTick: 0, spawned: 0, leaderHits: 0, booms: 0, skies: 0,
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
      const pot = newPot(S.t);
      a.sn.segs.push(pot);
      S.arcs.push({ x0: fx, y0: fy, to: () => tailPos(a), t: -i * 0.08, dur: 0.4, label: pot.label });
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
  // 天降锅：只砸主角，脚下先出现阴影，SKY_TIME 秒后砸下来，躲不掉
  function launchSky(target, from) {
    if (target.crushed) return;
    S.flying.push({ phase: 'sky', t: SKY_TIME, warn0: SKY_TIME, x: target.sn.x, y: target.sn.y, target, hot: false, a: 0, spin: 0, life: POT_LIFE, label: E.pick(OFFICE.potLabels) });
    S.spawned++; S.skies++;
    if (target.isPlayer) {
      floats.add(`${from ? from.name : '老板'}：这个你来`, target.sn.x, target.sn.y - 60, '#E8504A');
      E.sfx('warn');
    }
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
      // 天降锅：阴影跟着目标走，到点直接砸中
      if (f.phase === 'sky') {
        f.t -= dt; f.x = f.target.sn.x; f.y = f.target.sn.y;
        if (f.target.crushed) f.dead = true;
        else if (f.t <= 0) { f.dead = true; potHit(f.target, f); }
        continue;
      }
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
    a.sn.segs.push(newPot(S.t, f.hot, f.label));   // 截止时间从落到身上开始算
    a.combo = 0;
    if (a.isPlayer) tutEvent('potOnMe');
    if (f.hot) {
      if (a.isPlayer) { E.toast(`P0 砸到你身上！${P0_LIFE} 秒内甩出去，炸了背锅 +${P0_BLAME}`, 2200); E.sfx('boss'); E.buzz(60); shake = 8; }
      return;
    }
    if (a.isPlayer) {
      floats.add('+1 ' + f.label, a.sn.x, a.sn.y - 34, '#E8504A');
      shake = 6;
      E.sfx('hit'); E.buzz(35); // 被锅砸中：短震
    } else {
      floats.add('+1', a.sn.x, a.sn.y - 40, '#9AA6C4');
    }
  }

  /* ---------------- 甩锅：按键把锅扔出去（所有人同一套规则） ---------------- */
  // 同事会不会主动把锅甩给 b（护盾中、刚甩给自己的人不考虑）
  function canThrowTo(a, b) {
    return a !== b && !b.crushed && b.shield <= 0 && !((a.lock[b.id] || 0) > S.t);
  }
  // a 现在能不能甩：身上有锅、没在冷却、没愣住
  function canFire(a) { return !a.crushed && a.cool <= 0 && a.stun <= 0 && potsOf(a) > 0; }
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
  // 两点之间有没有墙挡着视线（桌子不挡，每 12px 采样一次）
  function sightClear(ax, ay, bx, by) {
    const n = Math.ceil(E.dist(ax, ay, bx, by) / 12);
    for (let k = 1; k < n; k++) if (inWall(ax + (bx - ax) * k / n, ay + (by - ay) * k / n)) return false;
    return true;
  }
  // a 在不在某位领导的视野扇形里（隔墙看不见）；在就返回那位领导
  function seenBy(a) {
    for (const l of S.leaders) {
      if (E.dist(l.x, l.y, a.sn.x, a.sn.y) > VISION_RANGE) continue;
      if (Math.abs(E.angDiff(l.face, Math.atan2(a.sn.y - l.y, a.sn.x - l.x))) > VISION_CONE) continue;
      if (sightClear(l.x, l.y, a.sn.x, a.sn.y)) return l;
    }
    return null;
  }
  // 当着领导的面甩锅：锅不走，还要背锅 +1
  function caught(a, l) {
    a.cool = THROW_CD;
    a.caught++;
    floats.add(`${l.name}：当着我的面甩锅？`, a.sn.x, a.sn.y - 60, '#E8504A');
    addBlame(a, 1, '被抓现行');
    if (a.isPlayer) E.sfx('boss');
  }
  // 甩出去：扔身上最急的那口（P0 截止时间短，自然最先扔）；在领导视野里甩会被抓现行
  function fireThrow(a) {
    if (!potsOf(a)) return false;
    const eye = seenBy(a);
    if (eye) { caught(a, eye); return true; }
    const b = pickAim(a);
    const ang = b ? leadAngle(a, b) : a.sn.angle;
    const pot = a.sn.segs.splice(urgentIdx(a), 1)[0];
    S.throws.push({
      owner: a, target: b, x: a.sn.x + Math.cos(ang) * 12, y: a.sn.y + Math.sin(ang) * 12, a: ang,
      speed: THROW_SPEED, pot, label: pot.label, hot: pot.hot, dist: 0, range: THROW_RANGE, bounces: 0, spin: 0, rolled: new Set(),
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
  // 注意倍率可以是 0（第 1 关同事完全不反弹），不能用 || 兜底
  const aiMul = (a, k) => (a.isPlayer || !L.ai || L.ai[k] == null ? 1 : L.ai[k]);
  const parryChance = (b) => Math.min(0.9, b.p.parry * aiMul(b, 'parry'));
  // 当前反甩窗口：每来回一次就缩小
  function parryWin(f) { return PARRY_WIN * Math.pow(PARRY_DECAY, f.bounces); }
  // 玩家按下「甩」：锅正飞向自己且在窗口内 → 反甩；否则能甩就甩；都不行算按空
  function pressFire(a) {
    if (a.crushed) return;
    if (S.tut && a.isPlayer && !tutCanFire(a)) return;
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
    b.parries++;
    spawnFx('fx_impact', f.x, f.y, 40, 0.25); // 反甩：在锅的位置闪一下
    if (b.isPlayer) {
      floats.add(f.bounces >= 2 ? '再弹回去！' : '反甩！', b.sn.x, b.sn.y - 46, '#2F9E6B');
      E.sfx('parry');
      shake = 4;
    } else if (back.isPlayer) {
      floats.add(`${b.name}：这锅不是我的`, b.sn.x, b.sn.y - 40, '#E8504A');
      E.sfx('parry');
    } else floats.add('弹!', b.sn.x, b.sn.y - 40, '#5E6A84');
  }
  // 甩空：锅立刻弹回扔锅的人身上（截止时间照旧）
  function missThrow(f, why) {
    f.dead = true;
    const a = f.owner;
    a.combo = 0;
    if (a.crushed) return;
    a.sn.segs.push(f.pot);
    S.arcs.push({ x0: f.x, y0: f.y, to: () => tailPos(a), t: 0, dur: 0.25, label: f.label });
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
  // 锅 f 砸中 b：归 b（截止时间照旧，越传越烫）；记连甩
  function landThrow(f, b) {
    const a = f.owner;
    spawnFx('fx_impact', b.sn.x, b.sn.y - 26, f.hot ? 70 : 56); // 砸中瞬间的撞击星
    b.sn.segs.push(f.pot);

    // 连甩：窗口内连续甩中（只做统计和飘字）
    a.combo = a.comboT > 0 ? a.combo + 1 : 1;
    a.comboT = COMBO_WINDOW;
    a.maxCombo = Math.max(a.maxCombo, a.combo);
    a.thrown++;
    a.victims[b.name] = (a.victims[b.name] || 0) + 1;

    // 接锅的人：短暂护盾 + 愣住 + 连甩清零 + 记仇
    b.shield = RECV_SHIELD;
    b.stun = RECV_STUN;
    b.lock[a.id] = S.t + NO_RETURN;
    b.combo = 0;
    b.angry = 2;
    if (b.key === 'intern') { b.cry = 2; if (potsOf(b) >= 3) leaderAlert(a, b); }

    if (a.isPlayer) tutEvent('land', b);
    if (a.isPlayer) {
      const wasTea = b.teaT > 0;
      if (f.hot) floats.add(`P0 甩给${b.name}`, b.sn.x, b.sn.y - 44, '#2F9E6B');
      else if (b.key === 'veteran') floats.add(wasTea ? '老油条也有今天！' : '甩中老油条！', b.sn.x, b.sn.y - 44, '#2F9E6B');
      else floats.add(`甩给${b.name}`, b.sn.x, b.sn.y - 44, '#2F9E6B');
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

  /* ---------------- 截止时间：到点在谁身上谁背锅 ---------------- */
  // 给 a 记 n 次背锅，why 为飘字说明
  function addBlame(a, n, why) {
    a.blames += n;
    tutEvent('blame', a);
    if (a.isPlayer) {
      floats.add(`背锅 +${n}：${why}`, a.sn.x, a.sn.y - 40, '#E8504A');
      shake = Math.max(shake, n > 1 ? 14 : 9);
      E.sfx('back');
    } else floats.add(`${a.name} 背锅 +${n}`, a.sn.x, a.sn.y - 40, '#5E6A84');
  }
  // 一口锅到点出事：算在 a 头上，锅消失
  function explode(a, pot) {
    S.booms++;
    spawnFx('fx_impact', a.sn.x, a.sn.y - 26, pot.hot ? 84 : 62, 0.45);
    addBlame(a, pot.hot ? P0_BLAME : 1, pot.hot ? 'P0 炸了' : `${pot.label}出事了`);
    if (pot.hot) E.toast(a.isPlayer ? `P0 炸在你手里，背锅 +${P0_BLAME}` : `P0 炸在${a.name}手里，背锅 +${P0_BLAME}`, 2000);
  }
  // 每帧：身上到点的锅出事；还在飞的锅到点，算甩它的人
  function updateDue() {
    for (const a of S.agents) {
      if (a.crushed) continue;
      for (let i = a.sn.segs.length - 1; i >= 0; i--) {
        if (a.sn.segs[i].due > S.t) continue;
        const pot = a.sn.segs.splice(i, 1)[0];
        explode(a, pot);
      }
    }
    for (const f of S.throws) if (!f.dead && f.pot.due <= S.t) { f.dead = true; if (!f.owner.crushed) explode(f.owner, f.pot); }
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
  // 第 1 关（basic）还没讲到这个机制，不追
  function leaderAlert(bully, intern) {
    const l = S.leaders[0];
    if (!l || L.basic || S.tut || l.state === 'chase' || S.t < l.alertCd) return;
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
    const cand = S.agents.filter((a) => !a.crushed && E.dist(a.sn.x, a.sn.y, l.x, l.y) < l.cfg.range)
      .map((a) => ({ a, k: potsOf(a) + Math.random() * 0.9 }))
      .sort((x, y) => x.k - y.k);
    return cand.slice(0, l.cfg.count).map((c) => c.a);
  }
  // 带教时的领导：原地站着（视野照常），只按剧本走位、给人派锅；不追人，撞上也不派锅
  function updateLeaderTut(l, dt) {
    if (l.state === 'aim') {
      l.aimT -= dt;
      if (l.aimT <= 0) { for (const t of l.targets) addPots(t, 1, l.x, l.y - 20); l.state = 'patrol'; l.targets = []; l.wait = 99; }
      return;
    }
    // 走到了（或寻路失败没有路径）就算到位，免得带教卡住
    if (l.tgo && (walkTo(l, l.tgo.x, l.tgo.y, l.cfg.speed * TUT_BOSS_SPEED, dt, 0) < 4 || !l.path.length)) {
      l.tgo = null; l.wait = 99;
      tutEvent('arrive', l);
    }
  }
  // 领导视野朝向：走路时转向前进方向；停下来左右张望；瞄准时盯着目标；带教剧本可以锁死朝向（faceLock）
  function updateFace(l, ox, oy, dt) {
    if (l.faceLock != null) { l.face = l.baseFace = l.faceLock; return; }
    const dx = l.x - ox, dy = l.y - oy;
    if (l.state === 'aim' && l.targets.length) {
      const t = l.targets[0].sn;
      l.baseFace = Math.atan2(t.y - l.y, t.x - l.x);
      l.face = l.baseFace;
    } else if (dx * dx + dy * dy > 0.04) {
      const want = Math.atan2(dy, dx);
      l.baseFace = want;
      l.face += E.clamp(E.angDiff(l.face, want), -5 * dt, 5 * dt);
    } else {
      l.face = l.baseFace + Math.sin(S.t * 1.4 + l.cfg.count) * 0.8;
    }
  }
  // 领导每帧：巡逻 → 瞄准（预警）→ 丢锅；或追欺负实习生的人；撞上谁就给谁派 3 口
  // 老板丢锅时有 L.skyChance 的概率改成天降锅，只砸主角
  // 领导走路都走寻路路径，不会穿墙 / 穿桌子
  function updateLeader(l, dt) {
    const ox = l.x, oy = l.y;
    if (S.tut) { updateLeaderTut(l, dt); updateFace(l, ox, oy, dt); return; }
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
          l.targets = [];
          if (l.type === 'boss' && Math.random() < (L.skyChance || 0)) launchSky(S.player, l);
          else l.targets = pickTargets(l);
          if (l.targets.length) {
            l.state = 'aim'; l.aimT = AIM_TIME;
            if (l.targets.includes(S.player)) E.sfx('warn');
          }
        }
      }
    }
    updateFace(l, ox, oy, dt);
    // 撞上领导：+3 口
    for (const a of S.agents) {
      if (a.crushed || (l.hitCd[a.id] || 0) > S.t) continue;
      if (E.dist(l.x, l.y, a.sn.x, a.sn.y) < HEAD_R + 28) {
        addPots(a, LEADER_HIT_POTS, l.x, l.y);
        spawnFx('fx_impact', a.sn.x, a.sn.y - 26, 72, 0.45);
        S.leaderHits++;
        l.hitCd[a.id] = S.t + 3;
        if (l.chase === a) { l.state = 'patrol'; l.chase = null; l.i = nearestRoute(l); }
        if (a.isPlayer) { floats.add(`${l.name}：这几个你跟一下`, a.sn.x, a.sn.y - 44, '#E8504A'); shake = 13; E.sfx('boss'); E.buzz(80); }
        else floats.add(`+${LEADER_HIT_POTS}`, a.sn.x, a.sn.y - 40, '#E8504A');
      }
    }
  }

  /* ---------------- 时间表：节奏、散会、随机事件、教学提示 ---------------- */
  function updateSchedule() {
    const w = workT();
    // 领导丢锅节奏
    let idx = -1;
    L.pace.forEach((p, i) => { if (w >= p.t) idx = i; });
    if (idx !== S.paceIdx) {
      S.paceIdx = idx;
      S.pace = L.pace[idx] || null;
      if (S.pace && S.pace.toast) { E.toast(S.pace.toast, 2200); E.sfx('boss'); shake = 8; }
    }
    // 散会、随机事件
    while (S.schedule.length && w >= S.schedule[0].t) {
      const it = S.schedule.shift();
      if (it.act === 'msg') showMsg(it.text);
      else if (it.act === 'burst') burst(it.src, it.n);
      else if (it.act === 'event') startEvent(it.kind);
    }
    // 开局第一口锅：天降锅砸给主角
    if (S.skyFirst && w >= SKY_FIRST) { S.skyFirst = false; launchSky(S.player, S.leaders[0]); }
    // 教学提示：按时间弹的
    const h = L.hints[S.hintIdx];
    if (h && w >= h.t) { showHint(h); S.hintIdx++; }
    // 看情况弹的提示：当前没有横幅时才弹，每条每局一次
    if (L.tips && hintTimer <= 0) {
      for (const tip of L.tips) {
        if (S.tipsShown[tip.on] || !TIP_CHECKS[tip.on]()) continue;
        S.tipsShown[tip.on] = true;
        showHint(tip);
        break;
      }
    }
    // 收尾：先发群消息，2 秒后开下午茶、给主角塞锅
    const fin = L.finale;
    if (fin && !S.finDone) {
      if (!S.finMsg && w >= fin.t - 2) { S.finMsg = true; showMsg(fin.msg); }
      if (w >= fin.t) { S.finDone = true; startFinale(fin); }
    }
  }
  // 看情况弹的提示：触发条件（都只看主角）
  const TIP_CHECKS = {
    potWarn: () => urgentLeft(S.player) < DUE_WARN,                                   // 身上有锅快到点
    seen: () => potsOf(S.player) > 0 && !!seenBy(S.player),                          // 带着锅站进领导视野
    rankOut: () => workT() > 15 && ranking().indexOf(S.player) + 1 > PASS_RANK,     // 掉出前三（开局 15 秒内大家都没背锅，不算）
  };
  // 收尾（第 1 关）：同事都去茶水间挤着，老板给主角塞几口锅，期限卡在 18:00，正好冲过去一口气连甩
  function startFinale(fin) {
    const P = S.player, l = S.leaders[0];
    S.finale = true;
    S.finBlame0 = P.blames; // 调试统计用：收尾期间主角背了几次锅
    S.tea = L.duration - fin.t + 1;
    addPots(P, fin.pots, l ? l.x : P.sn.x, l ? l.y : P.sn.y - 200);
    const end = S.t0 + L.duration - 0.6; // 赶在下班判定之前到点
    for (const pot of P.sn.segs.slice(-fin.pots)) pot.due = end;
    floats.add(fin.say, P.sn.x, P.sn.y - 60, '#E8504A');
    E.toast('同事都挤在茶水间，过去一口气甩掉！', 2400);
    E.sfx('boss');
    shake = 8;
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

  /* ---------------- 带教（第 1 关开头）：时钟停在 09:00，每一步做到了才往下走 ----------------
   * 步骤和文案在 levels.js 的 tutorial 里，这里只写每种步骤「怎么布置、怎么算完成」
   * 带教里的保护：锅不走时间；扇形里没人、站在领导视野里时按「甩」都只提醒不扔；同事站着不动，老板只按剧本丢锅
   * --------------------------------------------------------------------------------------- */
  const TUT_BOSS_SPEED = 2;  // 带教时老板走路的倍速，别让人干等
  const TUT_RING_R = 34;     // 走进黄圈多近算到
  // 按人设名找场上的同事
  const agentByKey = (k) => S.agents.find((a) => a.key === k);
  // 带教里的延时（跟着对局时间走，暂停时也停）
  function tutLater(sec, fn) { S.tut.timers.push({ t: sec, fn }); }
  // 老周说话：沿用教学横幅的样式，一直显示到下一句；btn 为按钮文字（点了开始上班）
  function showCoach(text, btn) {
    const who = (S.tut && S.tut.victim && S.tut.victim.name) || '实习生';
    showHint({ title: '带教', icon: ['veteran_tea'], sub: '老周', text: text.replace('{who}', who) });
    hintTimer = 0; // 0 = 不自动收起
    if (btn) {
      const el = document.getElementById('hint');
      el.querySelector('.h-txt').insertAdjacentHTML('beforeend', `<button class="h-go" type="button">${btn}</button>`);
      el.querySelector('.h-go').addEventListener('click', () => { E.sfx('throw'); startWork(); });
    }
  }
  // 每种带教步骤：enter 布置场面；check 每帧检查是否完成；其余是事件回调（见 tutEvent）
  // fire：这一步允许按「甩」；btn：这一步靠点按钮完成
  const TUT_STEPS = {
    // 按住摇杆走进黄圈
    walk: {
      enter() { S.tut.ring = L.tutorial.spots.ring; },
      check: () => E.dist(S.player.sn.x, S.player.sn.y, S.tut.ring.x, S.tut.ring.y) < TUT_RING_R,
    },
    // 老板丢一口天降锅；砸到身上后说下一句
    sky: {
      enter() { tutLater(0.4, () => launchSky(S.player, S.leaders[0])); },
      potOnMe() { showCoach(S.tut.step.say2); tutLater(3.6, tutNext); },
    },
    // 甩给同事（谁都行，记下是谁，下一步让他的锅到点）
    throw: {
      fire: true,
      land(b) { S.tut.victim = b; showCoach(S.tut.step.say2); tutLater(1.4, tutNext); },
    },
    // 刚被甩中的同事身上的锅快进到点，看他背锅
    expire: {
      enter() {
        const v = S.tut.victim || agentByKey('intern');
        if (!potsOf(v)) v.sn.segs.push(newPot(S.t));
        for (const pot of v.sn.segs) pot.due = S.t + 3.5;
      },
      blame() { showCoach(S.tut.step.say2); tutLater(2.8, tutNext); },
    },
    // 老板出来巡视：给实习生一口锅，实习生想当面甩给主角，被抓现行
    sight: {
      enter() { const l = S.leaders[0]; l.tgo = L.tutorial.spots.boss; l.wait = 0; },
      arrive(l) {
        const it = agentByKey('intern'), P = S.player;
        // 视野朝实习生和主角的中间看，尽量同时罩住两个人
        l.faceLock = Math.atan2((it.sn.y + P.sn.y) / 2 - l.y, (it.sn.x + P.sn.x) / 2 - l.x);
        l.state = 'aim'; l.targets = [it]; l.aimT = AIM_TIME;
        tutLater(AIM_TIME + 1, () => floats.add('嘿嘿……这个给新人', it.sn.x, it.sn.y - 50, '#1F2A44'));
        tutLater(AIM_TIME + 2.2, () => {
          caught(it, l);
          shake = 6;
          E.sfx('boss');
          showCoach(S.tut.step.say2);
          tutLater(3.4, tutNext);
        });
      },
    },
    // 老板再丢主角一口：走出视野，甩给同事
    dodge: {
      fire: true,
      enter(step) {
        if (!seenBy(S.player)) showCoach(step.alt || step.say); // 主角本来就不在视野里，换个说法
        tutLater(0.6, () => launchSky(S.player, S.leaders[0]));
      },
      land() { tutLater(1.2, tutNext); },
    },
    // 亮出右上角名次，点「开始上班」
    rank: {
      btn: '开始上班',
      enter() {
        S.tut.showRank = true;
        const chip = document.getElementById('hRank').parentElement;
        chip.classList.remove('pulse'); void chip.offsetWidth; chip.classList.add('pulse');
      },
    },
  };
  // 进下一步；没有下一步就开始上班
  function tutNext() {
    const T = S.tut;
    if (!T) return;
    T.i++; T.timers = []; T.ring = null; T.done = false;
    const step = L.tutorial.steps[T.i];
    if (!step) { startWork(); return; }
    T.step = step; T.def = TUT_STEPS[step.do];
    showCoach(step.say, T.def.btn);
    if (T.def.enter) T.def.enter(step);
  }
  // 带教里发生的事（砸中主角、甩中同事、有人背锅、老板走到位）转给当前步骤处理
  function tutEvent(name, arg) {
    const T = S && S.tut;
    if (T && T.def && T.def[name] && !T.done) T.def[name](arg);
  }
  // 带教每帧：推进定时器，检查当前步骤是否完成
  function updateTutorial(dt) {
    const T = S.tut, i = T.i;
    for (const x of T.timers) x.t -= dt;
    const due = T.timers.filter((x) => x.t <= 0);
    T.timers = T.timers.filter((x) => x.t > 0);
    for (const x of due) { if (S.tut !== T || T.i !== i) break; x.fn(); }
    if (S.tut === T && T.i === i && T.def && T.def.check && T.def.check()) { T.done = true; tutNext(); }
  }
  // 带教里按「甩」：还没讲到甩锅、站在领导视野里、扇形里没人，都只提醒不扔
  function tutCanFire(a) {
    const def = S.tut.def;
    if (!def || !def.fire) return false;
    if (!canFire(a)) return true; // 冷却、没锅等交给正常流程处理
    const eye = seenBy(a);
    if (eye) { E.toast(`${eye.name}在看！先走出红扇形`, 1400); E.sfx('miss'); return false; }
    if (!pickAim(a)) { E.toast('扇形里没人，走近点、对准了再甩', 1400); return false; }
    return true;
  }
  // 带教结束（做完或跳过）：上班时钟从现在起算，带教里的锅开始走时间，大家回到正常状态
  function startWork() {
    if (!S || !S.tut) return;
    S.tut = null;
    S.t0 = S.t;
    for (const a of S.agents) for (const pot of a.sn.segs) if (pot.due === Infinity) pot.due = S.t + potLife();
    for (const f of S.throws) if (f.pot.due === Infinity) f.pot.due = S.t + potLife();
    for (const a of S.agents) {
      a.blames = 0; a.caught = 0; // 带教里的背锅不算数，免得重玩跳过带教时难度不一样
      if (!a.isPlayer) giveStartPots(a.sn, S.t);
    }
    for (const l of S.leaders) {
      l.tgo = null; l.faceLock = null; l.state = 'patrol'; l.targets = [];
      l.i = nearestRoute(l); l.path = []; l.goal = null; l.wait = 0.5; l.throwCd = E.rand(0.5, 1.5);
    }
    const prog = loadProgress();
    if (!prog.tutDone) { prog.tutDone = true; saveProgress(prog); }
    forceTut = false;
    clearBanners();
    E.toast('09:00 正式上班！', 1600);
    E.sfx('boss');
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
    // 3. P0：拿着就找最近的人传，没拿就躲着拿 P0 的人
    const hotMine = holdsHot(a), urgent = urgentLeft(a), rush = hotMine || urgent < DUE_WARN; // rush：有锅快到点了
    if (hotMine) {
      const b = nearestAgent(me.x, me.y, a);
      if (b) seek(b.sn.x, b.sn.y, 3.5);
    } else {
      for (const b of S.agents) {
        if (b === a || b.crushed || !holdsHot(b)) continue;
        const d = headDist(a, b);
        if (d < 260) flee(b.sn.x, b.sn.y, 2 * p.caution * (1 - d / 260));
      }
    }
    // 4. 找人甩锅：锅越多、越快到点越积极；预判对方走位
    a.target = null;
    if ((pots >= p.seekMin || rush) && !hotMine) {
      const b = pickDumpTarget(a);
      if (b) {
        a.target = b;
        const lead = 0.3;
        seek(b.sn.x + Math.cos(b.sn.angle) * b.sn.speed * lead, b.sn.y + Math.sin(b.sn.angle) * b.sn.speed * lead,
          p.aggr * aiMul(a, 'aggr') * (0.7 + Math.min(pots, 8) * 0.1) + (rush ? 1 : 0));
      }
    }
    // 5. 躲开想把锅甩给自己的人（自己没锅、或正被锁住不能还手时更想躲）
    for (const b of S.agents) {
      if (b === a || b.crushed || !potsOf(b) || !canThrowTo(b, a)) continue;
      const d = headDist(a, b);
      if (d > 150) continue;
      const scared = pots === 0 || (a.lock[b.id] || 0) > S.t ? 1.4 : 0.5;
      flee(b.sn.x, b.sn.y, p.caution * scared * (1 - d / 150) * (S.finale && S.tea > 0 ? 0.25 : 1)); // 收尾下午茶：忙着抢吃的，懒得躲
    }
    // 6. 下午茶 / 老油条泡茶：往茶水间走
    if (S.tea > 0 || a.teaT > 0) seek(OFFICE.tea.x, OFFICE.tea.y, S.finale && S.tea > 0 ? 2.2 : a.teaT > 0 ? 1.5 : 1.1);
    // 7. 没事干：保持方向慢慢晃，靠近边缘时往中间拐
    if (Math.hypot(vx, vy) < 0.15) {
      vx += Math.cos(me.angle) * 0.4 + E.rand(-0.2, 0.2);
      vy += Math.sin(me.angle) * 0.4 + E.rand(-0.2, 0.2);
      seek(OFFICE.world.w / 2, OFFICE.world.h / 2, 0.15);
    }
    a.want = steerFree(a, Math.atan2(vy, vx) + E.rand(-0.08, 0.08));

    // 8. 出手：前方瞄得到人、够近就甩（有锅快到点时不挑人；平时不主动瞄刚甩给自己的人）
    //    领导在看时，按性格忍住不甩（老油条从不当面甩，实习生经常被抓）
    if (canFire(a)) {
      const b = pickAim(a);
      if (b && headDist(a, b) < p.throwR && (rush || (pots >= p.seekMin && (a.lock[b.id] || 0) <= S.t)) &&
        Math.random() < 0.45 + 0.55 * p.aggr * aiMul(a, 'aggr') && !(seenBy(a) && Math.random() < p.sneak)) fireThrow(a);
    }
  }

  /* ---------------- 打工人每帧 ---------------- */
  function updateAgent(a, dt) {
    if (a.crushed) return;
    a.cool -= dt; a.stun -= dt; a.shield -= dt; a.cry -= dt; a.angry -= dt; a.panicT -= dt; a.parryLock -= dt;
    a.comboT -= dt;
    if (a.comboT <= 0) a.combo = 0;

    // 老油条定期去泡茶：泡茶时走得很慢，是甩锅的好时机（带教时不去）
    if (a.p.tea && !S.tut) {
      if (a.teaT > 0) a.teaT -= dt;
      else { a.teaCd -= dt; if (a.teaCd <= 0) { a.teaT = 3.5; a.teaCd = E.rand(9, 13); } }
    }

    // 速度：只看人设和是否在泡茶，背锅不减速
    a.sn.speed = BASE_SPEED * a.p.speed * (a.teaT > 0 && E.dist(a.sn.x, a.sn.y, OFFICE.tea.x, OFFICE.tea.y) < 120 ? 0.4 : 1);

    // 方向：玩家用手指，机器人用 AI；带教时同事都站在原地当靶子
    const ai = !a.isPlayer || auto;
    let steer = null;     // 本帧想转向的角度（null = 不转）
    if (S.tut && !a.isPlayer) {
      a.sn.speed = 0;
    } else if (ai) {
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
    if (ai && !S.tut) {
      a.stuckT += dt;
      if (a.stuckT >= 1.2) {
        if (E.dist(a.sn.x, a.sn.y, a.lastX, a.lastY) < 30) { a.panicT = 0.7; a.want = E.rand(0, Math.PI * 2); }
        a.stuckT = 0; a.lastX = a.sn.x; a.lastY = a.sn.y;
      }
    }
  }

  /* ---------------- 排名 ---------------- */
  // 排名：没被压垮的在前；背锅次数少的在前；再比身上锅少、甩出去的多；被压垮的人越晚压垮排越前
  function ranking() {
    return S.agents.slice().sort((a, b) =>
      (a.crushed - b.crushed) ||
      (a.crushed ? b.crushedAt - a.crushedAt : (a.blames - b.blames) || (potsOf(a) - potsOf(b))) ||
      (b.thrown - a.thrown));
  }
  // 名次 → 星级：第 1 名 3 星，第 2 名 2 星，第 3 名 1 星，其余 0
  const starsOfRank = (r) => (r <= PASS_RANK ? PASS_RANK + 1 - r : 0);

  /* ---------------- 主更新 ---------------- */
  function update(dt) {
    S.t += dt;
    if (S.tea > 0) S.tea -= dt;
    if (S.tut) updateTutorial(dt);
    else updateSchedule();
    for (const a of S.agents) updateAgent(a, dt);
    for (const l of S.leaders) updateLeader(l, dt);
    updateFlying(dt);
    updateThrows(dt);
    updateDue();

    // 甩锅动画推进
    for (const a of S.arcs) a.t += dt;
    S.arcs = S.arcs.filter((a) => a.t < a.dur);
    // 一次性特效推进
    for (const e of S.fx) e.t += dt;
    S.fx = S.fx.filter((e) => e.t < e.dur);

    // 快压垮提醒：玩家堆到 POT_ALARM 口提示一次，降下去后可以再提示
    const P = S.player, n = potsOf(P);
    if (n >= POT_ALARM && !P.alarmed) { P.alarmed = true; E.toast(`身上 ${n} 口锅了，堆满 ${MAX_POTS} 口会被压垮！`, 1800); E.sfx('warn'); }
    else if (n < POT_ALARM - 2) P.alarmed = false;
    // 压垮：机器人出局（排最后），玩家当场失败
    for (const a of S.agents) {
      if (a.crushed || potsOf(a) < MAX_POTS) continue;
      if (a.isPlayer) { S.over = 'crushed'; return; }
      a.crushed = true; a.crushedAt = S.t; a.target = null;
      E.toast(`${a.name}被锅压垮了！`, 1800);
    }
    if (workT() >= L.duration) S.over = 'time';
  }

  /* ---------------- 提示条 / 群消息 ---------------- */
  // 显示一条教学提示
  // 关键词高亮：*黄* !红! ~绿~，其余文字转义后原样输出
  function hintMarkup(t) {
    const esc = (x) => x.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
    return esc(t || '').replace(/\*([^*]+)\*/g, '<b class="hl-y">$1</b>').replace(/!([^!]+)!/g, '<b class="hl-r">$1</b>').replace(/~([^~]+)~/g, '<b class="hl-g">$1</b>');
  }
  // 显示教学横幅：h = { title 标签, icon [主图, 角标图], sub 小字, text 大字 }（只有 text 时就是一行字）
  function showHint(h) {
    const el = document.getElementById('hint');
    const icon = (h.icon || []).map((n) => `<img src="${E.pxUrl(n)}" alt="">`).join('');
    el.innerHTML = `${h.title ? `<span class="h-tab">${h.title}</span>` : ''}${icon ? `<span class="h-ico">${icon}</span>` : ''}
      <span class="h-txt">${h.sub ? `<span class="h-sub">${hintMarkup(h.sub)}</span>` : ''}<span class="h-main">${hintMarkup(h.text)}</span></span>`;
    el.classList.add('on');
    hintTimer = h.sub ? 4.6 : 3.8;
    placeBanners();
  }
  // 横幅摆位：教学横幅贴在顶栏下方（窄屏顶栏会折成两行，所以按顶栏实际高度算）；
  // 群消息在教学横幅显示时排到它下面，不显示时贴在顶栏下方，两者不叠在一起
  function placeBanners() {
    const hudBottom = document.getElementById('hud').getBoundingClientRect().bottom;
    const hint = document.getElementById('hint'), msg = document.getElementById('msg');
    const tab = hint.querySelector('.h-tab');
    hint.style.top = `${hudBottom + (tab ? 30 : 8)}px`; // 黄色标签凸出在横幅上方，要多留出它的高度
    msg.style.top = `${hint.classList.contains('on') ? hint.getBoundingClientRect().bottom + 10 : hudBottom + 8}px`;
  }
  // 显示一条工作群消息（事件预告）：「【群名】发言人：内容」
  function showMsg(text) {
    const m = text.match(/^(【[^】]+】)([^：]+)：(.*)$/);
    const el = document.getElementById('msg');
    el.innerHTML = m ? `<small>${m[1]} ${m[2]}</small>${m[3]}` : text;
    el.classList.add('on');
    msgTimer = 3.4;
    placeBanners();
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
  // 画飞行中的 P0 烫手山芋（红光）；left 不为空时标倒计时
  function drawHotPot(x, y, time, left) {
    const r = 26 + Math.sin(time * 14) * 3;
    ctx.fillStyle = 'rgba(232,80,74,.35)';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    drawWok(x, y, 'P0', 42, Math.sin(time * 10) * 0.2);
    if (left != null) E.label(ctx, String(Math.ceil(left)), x + 22, y - 18, 18, '#E8504A');
  }
  // 主角头顶右侧：最急那口锅快到点时，标一个闹钟倒计时（黄 → 红）
  function drawDueTag(a) {
    if (a.crushed || !potsOf(a)) return;
    const left = urgentLeft(a);
    if (left >= DUE_WARN) return;
    E.label(ctx, `⏰${Math.max(0, Math.ceil(left))}`, a.sn.x + 30, a.sn.y - 46, 13, '#FFFDF5', left < DUE_DANGER ? '#E8504A' : '#C98A00');
  }
  // 画某人背着的锅（从尾到头）：快到点的锅底下发黄光 / 红光，红了还冒烟；玩家自己的锅标剩余秒数
  function drawTail(a, time) {
    const pos = a.sn.positions();
    const size = a.isPlayer ? 38 : 32;
    for (let i = pos.length - 1; i >= 0; i--) {
      const pot = a.sn.segs[i], q = pos[i];
      if (!pot || !q) continue;
      const left = pot.due - S.t, danger = pot.hot || left < DUE_DANGER;
      if (!a.crushed && (danger || left < DUE_WARN)) {
        const r = (pot.hot ? 26 : 20) + Math.sin(time * (danger ? 16 : 7) + i) * 3;
        ctx.fillStyle = danger ? 'rgba(232,80,74,.45)' : 'rgba(255,200,40,.45)';
        ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, Math.PI * 2); ctx.fill();
        if (danger) { // 冒烟：两团灰烟往上飘
          for (let k = 0; k < 2; k++) {
            const ph = (time * 1.6 + k * 0.5 + i * 0.3) % 1;
            ctx.fillStyle = `rgba(94,106,132,${0.5 * (1 - ph)})`;
            ctx.beginPath(); ctx.arc(q.x + (k ? 6 : -5), q.y - 14 - ph * 26, 4 + ph * 6, 0, Math.PI * 2); ctx.fill();
          }
        }
      }
      drawWok(q.x, q.y, a.isPlayer || pot.hot ? pot.label : '', pot.hot ? size * 1.15 : size, a.crushed ? 0.3 : Math.sin(time * 6 + i + a.id) * 0.12, a.crushed ? 0.6 : null);
      // 锅压在人身下时不标（会被头挡住），改由 drawDueTag 在头顶标最急的那口
      if (a.isPlayer && !a.crushed && left < DUE_WARN && E.dist(q.x, q.y, a.sn.x, a.sn.y) > 24) E.label(ctx, String(Math.max(0, Math.ceil(left))), q.x + 15, q.y - 15, 13, '#FFFDF5', danger ? '#E8504A' : '#C98A00');
    }
  }
  // 走路动画：每帧按位移更新朝向（d 朝下 / u 朝上 / s 侧面，往左走时镜像）和步伐
  // o 上挂 walk 记录；返回 { name 当前帧贴图, flip, dir, walking }，素材缺失时返回 null
  const STEP_PX = 13;  // 每走多少像素换一帧
  const STAND_FRAME = 3; // 站着不动时显示的走路帧序号
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
    // 连续 2 帧没动就算停下（只留 1 帧容错，防止偶尔一帧位移太小时闪成站姿）
    const walking = w.still < 2;
    if (!walking) w.dist = 0; // 停下后步伐归零，再起步时直接从迈步那帧开始，反应更跟手
    // 停下时用站姿那帧：第 3 帧两脚都着地、并拢站着（第 1 帧侧面是后脚抬起的迈步姿势，看着像还在走）
    const name = `${base}_walk_${w.dir}${walking ? Math.floor(w.dist / STEP_PX) % 4 : STAND_FRAME}`;
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
    if (!st) st = a.isPlayer ? (pots >= POT_ALARM ? 'panic' : 'normal') : a.cry > 0 ? 'cry' : (huntingMe || a.angry > 0) ? 'angry' : 'normal';
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
    if (potsOf(a) >= POT_ALARM - 1) E.drawSprite(ctx, 'fx_sweat', x - 22, top + 10 + (time * 24) % 6, 16);
    // 泪：正面画两股，侧面缩小挪到脸朝的那一侧；背面看不到脸不画
    if (a.cry > 0 && spr.dir === 'd') E.drawSprite(ctx, 'fx_tears', x, top + h * 0.4, h * 0.42);
    else if (a.cry > 0 && spr.dir === 's') E.drawSprite(ctx, 'fx_tears', x + (spr.flip ? -1 : 1) * h * 0.1, top + h * 0.38, h * 0.26);
  }
  // 头顶锅数徽标：像素小锅 + 数字
  function drawPotBadge(x, y, pots) {
    E.drawSprite(ctx, 'ui_wok', x - 8, y, 16);
    E.label(ctx, String(pots), x + 6, y, 12, pots >= POT_ALARM ? '#E8504A' : '#1F2A44');
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

    // 带教黄圈：画在脚下，一胀一缩
    if (S.tut && S.tut.ring) {
      const r = S.tut.ring, k = Math.sin(time * 5) * 4, fy = r.y + FOOT_DY;
      ctx.lineWidth = 7; ctx.strokeStyle = '#1F2A44';
      ctx.beginPath(); ctx.ellipse(r.x, fy, 34 + k, 14 + k * 0.4, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 4; ctx.strokeStyle = '#FFD84D'; ctx.stroke();
      E.label(ctx, '走到这', r.x, fy - 34 - k, 13, '#1F2A44', '#FFD84D');
    }
    // 预警中的锅（散会 / 打印机门口的红圈）
    for (const f of S.flying) {
      if (f.phase !== 'warn') continue;
      const k = 1 - f.t / Math.max(0.01, f.warn0);
      ctx.strokeStyle = '#E8504A'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(f.x, f.y, 14 + k * 20, 0, Math.PI * 2); ctx.stroke();
      E.label(ctx, '!', f.x, f.y, 24, '#E8504A');
    }

    // 领导视野：面前一块淡红扇形；主角在里面时加深
    const P = S.player, eye = P.crushed ? null : seenBy(P);
    for (const l of S.leaders) {
      const on = eye === l;
      ctx.fillStyle = `rgba(232,80,74,${on ? 0.24 : 0.12})`;
      ctx.strokeStyle = `rgba(232,80,74,${on ? 0.8 : 0.35})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(l.x, l.y);
      ctx.arc(l.x, l.y, VISION_RANGE, l.face - VISION_CONE, l.face + VISION_CONE);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    // 瞄准扇形：身上有锅时，在前方画出自动瞄准的扇形；扇形里有人就变绿并套住他；在领导视野里变红
    if (!P.crushed && potsOf(P)) {
      const b = pickAim(P), ready = canFire(P);
      // 领导在看：红色；有目标且能甩：绿色；扇形里没人：白色；冷却中：灰色（像素地板很花，透明度要够）
      const col = eye ? '232,80,74' : !ready ? '94,106,132' : b ? '47,158,107' : '255,253,245';
      ctx.fillStyle = `rgba(${col},${b && ready ? 0.3 : 0.24})`;
      ctx.strokeStyle = `rgba(${col},.9)`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(me.x, me.y);
      ctx.arc(me.x, me.y, AIM_RANGE, me.angle - AIM_CONE, me.angle + AIM_CONE);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      if (b) {
        ctx.strokeStyle = ready ? 'rgba(47,158,107,.95)' : 'rgba(94,106,132,.7)'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(b.sn.x, b.sn.y, 30 + Math.sin(time * 10) * 3, 0, Math.PI * 2); ctx.stroke();
        if (ready && !eye) E.label(ctx, '甩他!', b.sn.x, b.sn.y - 58, 13, '#FFFDF5', '#2F9E6B');
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
    drawDueTag(P);
    // 「X在看！」画在人物之后、扇形中段，免得被领导挡住
    if (eye && potsOf(P)) E.label(ctx, `${eye.name}在看！`, me.x + Math.cos(me.angle) * AIM_RANGE * 0.6, me.y + Math.sin(me.angle) * AIM_RANGE * 0.6, 14, '#FFFDF5', '#E8504A');
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
      } else if (f.phase === 'sky') {
        const k = 1 - f.t / f.warn0;
        ctx.fillStyle = `rgba(31,42,68,${0.15 + 0.3 * k})`;
        ctx.beginPath(); ctx.ellipse(f.x, f.y + 18, 10 + 18 * k, 4 + 6 * k, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#E8504A'; ctx.lineWidth = 3; ctx.setLineDash([6, 5]);
        ctx.beginPath(); ctx.arc(f.x, f.y, 40 - 14 * k, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        drawWok(f.x, f.y - 280 * (1 - k) * (1 - k), f.label, 44, k * 6);
        if (k < 0.7) E.label(ctx, '天降锅！', f.x, f.y - 70, 15, '#FFFDF5', '#E8504A');
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
    for (const b of S.bots) if (!b.crushed && holdsHot(b)) E.edgeHint(ctx, st, b.sn.x - camX, b.sn.y - camY, '🔥', '#E8504A');
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
    const has = potsOf(P) > 0 && !(S.tut && !(S.tut.def && S.tut.def.fire)); // 带教还没讲到甩锅时变灰
    btnThrow.classList.toggle('parry', parryNow);
    btnThrow.classList.toggle('empty', !parryNow && !has);
    btnThrow.style.setProperty('--cd', parryNow ? 0 : Math.max(0, P.cool, P.stun) / THROW_CD);
    btnThrow.firstChild.textContent = parryNow ? '弹!' : holdsHot(P) ? 'P0' : '甩!';
  }
  function updateHud() {
    const P = S.player, n = potsOf(P);
    const rank = ranking();
    const myRank = rank.indexOf(P) + 1;
    const w = workT(), rush = mode === 'play' && w >= L.duration - FINAL_RUSH;
    E.setText('hClock', clockAt(w));
    E.setText('hPotsN', `${n}/${MAX_POTS}`);
    E.setText('hRank', `第 ${myRank}/${rank.length} 名`);
    E.setText('hBlame', `背锅 ${P.blames}`);
    E.setText('hCombo', `连甩 ×${P.combo}`);
    document.getElementById('hCombo').hidden = P.combo < 2;
    document.getElementById('hPotsBar').style.width = Math.min(100, (n / MAX_POTS) * 100) + '%';
    document.getElementById('hPots').classList.toggle('hot', n >= POT_ALARM);
    document.getElementById('hClock').parentElement.classList.toggle('hot', w >= L.duration - 13);
    // 带教时先藏起名次和背锅数，讲到名次那一步再亮出来；右上角显示「跳过带教」
    const hideRank = !!S.tut && !S.tut.showRank;
    document.getElementById('hRank').parentElement.hidden = hideRank;
    document.getElementById('hBlameChip').hidden = hideRank;
    document.getElementById('btnSkip').hidden = !S.tut || mode !== 'play';
    updateThrowBtn();
    document.getElementById('hRank').parentElement.classList.toggle('hot', myRank > PASS_RANK);
    // 最后 10 秒：每秒滴答一声
    if (rush && Math.floor(w) !== S.lastTick) { S.lastTick = Math.floor(w); E.sfx('tick'); }
  }

  /* ---------------- 像素图标（弹窗、设置用） ---------------- */
  // 16×16 点阵：# = 当前文字色，w = 白，y = 金，o = 暗金；转成 SVG，缩放时保持像素硬边
  const PX_ICONS = {
    pause: ['', '.######..######.', '.#wwww#..#wwww#.', '.#wwww#..#wwww#.', '.#wwww#..#wwww#.', '.#wwww#..#wwww#.', '.#wwww#..#wwww#.', '.#wwww#..#wwww#.',
      '.#wwww#..#wwww#.', '.#wwww#..#wwww#.', '.#wwww#..#wwww#.', '.#wwww#..#wwww#.', '.#wwww#..#wwww#.', '.#wwww#..#wwww#.', '.######..######.'],
    gear: ['.......##.......', '......####......', '...##.####.##...', '..############..', '..############..', '...##########...', '.#####....#####.', '######....######',
      '######....######', '.#####....#####.', '...##########...', '..############..', '..############..', '...##.####.##...', '......####......', '.......##.......'],
    music: ['', '......########..', '......########..', '......##....##..', '......##....##..', '......##....##..', '......##....##..', '......##....##..',
      '......##....##..', '......##..####..', '...#####.#####..', '..######.#####..', '..######..###...', '..#####.........', '...###..........'],
    sound: ['', '', '......#.........', '.....##....#....', '....###.....#...', '.######..#...#..', '.######...#..#..', '.######...#..#..',
      '.######...#..#..', '.######...#..#..', '.######..#...#..', '....###.....#...', '.....##....#....', '......#.........'],
    vibrate: ['', '.....######.....', '....#......#....', '....#.####.#....', '.#..#.#..#.#..#.', '#...#.#..#.#...#', '.#..#.#..#.#..#.', '#...#.#..#.#...#',
      '.#..#.#..#.#..#.', '#...#.#..#.#...#', '.#..#.####.#..#.', '....#......#....', '....#..##..#....', '.....######.....'],
    trophy: ['..############..', '###yyyyyyyyyo###', '#y#yyyyyyyyyo#y#', '#y#yyyyyyyyyo#y#', '#y#yyyyyyyyyo#y#', '.###yyyyyyyyo###', '..##yyyyyyyyo#..', '...##yyyyyyo##..',
      '....##yyyyo##...', '.....##yyo##....', '......#yo#......', '......#yo#......', '.....##yo##.....', '....#yyyyyo#....', '....#oooooo#....', '....########....'],
    close: ['', '', '..##........##..', '..###......###..', '...###....###...', '....###..###....', '.....######.....', '......####......',
      '......####......', '.....######.....', '....###..###....', '...###....###...', '..###......###..', '..##........##..'],
  };
  const PX_COLORS = { '#': 'currentColor', w: '#FFFFFF', y: '#FFD84D', o: '#C98A00' };
  // 把点阵按颜色合并成 SVG 路径（每行连续同色的格子合成一段），返回 <svg> 字符串
  function pxIcon(name) {
    const paths = {};
    PX_ICONS[name].forEach((row, y) => {
      for (let x = 0; x < row.length;) {
        const c = row[x];
        let n = 1;
        while (row[x + n] === c) n++;
        if (PX_COLORS[c]) paths[c] = (paths[c] || '') + `M${x} ${y}h${n}v1h-${n}z`;
        x += n;
      }
    });
    return `<svg class="px" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">${
      Object.entries(paths).map(([c, d]) => `<path fill="${PX_COLORS[c]}" d="${d}"/>`).join('')}</svg>`;
  }

  /* ---------------- 结算 ---------------- */
  // 结束一局：reason = crushed（被压垮）| time（到点下班）
  function finish(reason) {
    mode = 'over';
    const P = S.player, crushed = reason === 'crushed';
    const rank = ranking();
    const myRank = crushed ? rank.length : rank.indexOf(P) + 1;
    const stars = crushed ? 0 : starsOfRank(myRank);

    // 进度：过关解锁下一关、记录本关最好成绩
    const prog = loadProgress();
    const old = prog.best[L.id];
    // 最好成绩：星多的好；星一样比背锅少（旧存档没有 blames，当作最差）
    const isBest = stars > 0 && (!old || stars > old.stars || (stars === old.stars && P.blames < (old.blames == null ? Infinity : old.blames)));
    if (isBest) prog.best[L.id] = { blames: P.blames, stars };
    if (stars > 0) prog.unlocked = Math.max(prog.unlocked, L.id + 1);
    saveProgress(prog);
    E.sfx(stars > 0 ? 'win' : 'lose');
    if (crushed) E.buzz(200); // 被压垮：长震
    E.bgm(false);
    clearBanners(); // 收起群消息和教学横幅，别压在结算弹窗上

    // 名次后面跟的短称号
    const title = crushed ? '锅太多，走不动了' : !stars ? '被留下加班' : ['', '甩锅宗师', '职场老油条', '勉强下班'][myRank];
    // 最终排名表：名次 / 名字 / 锅图标 + 背锅次数，被压垮的写「压垮」
    const table = rank.map((a, i) => `<li class="${a.isPlayer ? 'me' : ''}${i === PASS_RANK - 1 && rank.length > PASS_RANK ? ' cut' : ''}">
      <b>${i + 1}</b><span>${a.isPlayer ? '你' : a.name}</span>${a.crushed || (a.isPlayer && crushed) ? '<span class="crush">被压垮</span>' : `<img src="${E.pxUrl('ui_wok')}" alt="背锅"><em>${a.blames}</em>`}</li>`).join('');
    const next = LEVELS[LEVELS.indexOf(L) + 1];
    // 大字：过关「第 N 名」带放射光；没过关「第 N 名」不带光；被压垮直接写「被压垮」
    const big = crushed ? '<div class="rays res-rank bad">被压垮</div>'
      : `<div class="rays res-rank${stars ? '' : ' bad'}">${stars ? '<i></i><i></i><i></i><i></i><i></i><i></i>' : ''}第<em>${myRank}</em>名</div>`;
    const starHtml = `<span class="stars">${[1, 2, 3].map((i) => `<img src="${E.pxUrl(`ui_${i <= stars ? 'star' : 'star_empty'}`)}" alt="${i <= stars ? '★' : '☆'}">`).join('')}</span>`;
    // 按钮：过关且有下一关 → 下一关为主按钮；否则「再来一局」为主按钮。广告按钮只在对应失败情况出现
    const hasNext = stars && next;
    E.showPanel(`
      <div class="pop-head">${pxIcon('trophy')}本局结束</div>
      ${big}
      <p class="res-of">/ ${rank.length}人 · ${title}${starHtml}${isBest ? '<em>新纪录</em>' : ''}</p>
      <ol class="ranklist">${table}</ol>
      ${crushed && !S.revived ? '<button class="btn ad" data-act="revive">甩掉 6 口锅，接着熬</button>' : ''}
      ${!crushed && !stars && !S.rescued ? '<button class="btn ad" data-act="rescue">找人顶锅：背锅 -3</button>' : ''}
      ${hasNext ? `<button class="btn" data-act="next">下一关：${next.name.split('·').pop().trim()}</button>` : ''}
      <button class="btn${hasNext ? ' ghost' : ''}" data-act="retry">再来一局</button>
      ${hasNext ? '<button class="pop-link" data-act="menu">返回首页</button>' : '<button class="btn ghost" data-act="menu">返回首页</button>'}`, {
      retry: startGame,
      menu: showLobby,
      next: () => { L = next; showIntro(); },
      revive: () => E.fakeAd(() => {
        S.revived = true;
        P.sn.segs.splice(Math.max(0, P.sn.segs.length - 6));
        S.flying = S.flying.filter((f) => f.target !== P);
        S.throws = S.throws.filter((f) => f.target !== P);
        S.over = null;
        if (workT() > L.duration - 15) S.t0 = S.t - (L.duration - 15); // 上班时钟拨回到下班前 15 秒
        E.hidePanel(); mode = 'play'; E.bgm(true);
        E.toast('甩掉 6 口锅，继续熬到下班');
      }),
      rescue: () => E.fakeAd(() => {
        S.rescued = true;
        P.blames = Math.max(0, P.blames - 3);
        finish('time');
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
  // 第 1 关第一次玩（或要求重看）时先走带教；?auto 自动玩时不走
  function startGame() {
    E.unlockAudio();
    const tut = !!L.tutorial && !auto && (forceTut || !loadProgress().tutDone);
    S = makeState(tut);
    floats.list = [];
    shake = 0;
    E.hidePanel();
    clearBanners();
    inp.fire = 0;
    document.getElementById('hud').hidden = false;
    mode = 'play';
    E.bgm(true);
    if (tut) tutNext();
  }
  // 暂停：休息一下（锅插图 + 继续 / 重新开始 / 返回首页）
  function pauseGame() {
    if (mode !== 'play') return;
    mode = 'pause';
    E.bgm(false);
    E.showPanel(`
      <div class="pop-head">${pxIcon('pause')}休息一下</div>
      <p class="pop-sub">本局已暂停</p>
      <div class="rays pause-wok"><i></i><i></i><i></i><img src="${E.pxUrl('wok')}" alt=""><b>甩锅</b></div>
      <button class="btn" data-act="resume">继续游戏</button>
      <button class="btn ghost" data-act="retry">重新开始</button>
      <button class="pop-link" data-act="menu">返回首页</button>`, {
      resume: resumeGame,
      retry: startGame,
      menu: showLobby,
    });
  }
  // 从暂停 / 设置回到对局
  function resumeGame() { E.hidePanel(); mode = 'play'; E.bgm(true); }

  // 设置弹窗：音乐 / 音效 / 震动三个开关，点了立即生效并保存；对局中打开会先暂停，关掉后继续
  function showSettings() {
    const inGame = mode === 'play';
    if (inGame) { mode = 'pause'; E.bgm(false); }
    const row = (key, icon, name) => {
      const on = E.settings[key];
      return `<div class="set-row">${pxIcon(icon)}<span>${name}</span>
        <button class="tg" type="button" role="switch" aria-checked="${on}" aria-label="${name}" data-act="tg" data-key="${key}">${on ? '开' : '关'}</button></div>`;
    };
    const close = () => { if (inGame) resumeGame(); else E.hidePanel(); };
    E.showPanel(`
      <div class="pop-head">${pxIcon('gear')}游戏设置<button class="pop-x" type="button" data-act="close" aria-label="关闭">${pxIcon('close')}</button></div>
      ${row('music', 'music', '音乐')}
      ${row('sfx', 'sound', '音效')}
      ${row('vibrate', 'vibrate', '震动')}
      <div class="set-line"></div>
      <button class="btn" data-act="close">完成</button>`, {
      close,
      tg: (btn) => {
        const key = btn.dataset.key, on = !E.settings[key];
        E.setSetting(key, on);
        btn.setAttribute('aria-checked', on);
        btn.textContent = on ? '开' : '关';
        if (key === 'sfx' && on) { E.unlockAudio(); E.sfx('tick'); }
        if (key === 'vibrate' && on) E.buzz(40);
      },
    });
  }

  // 玩法规则列表（关卡介绍和大厅「玩法」共用），领导名字按当前关卡填
  // basic 关卡（第 1 关）只列基本规则，反弹、P0、压垮到第 2 关再讲
  function rulesHtml() {
    const leaders = L.leaders.map((d) => LEADER_TYPES[d.type].name).join('、');
    const basic = `
        <li><span>⏰</span>每口锅都有截止时间（${potLife()} 秒），甩来甩去不重置；到点在谁身上，谁背锅</li>
        <li><span>🕹️</span>左下角摇杆控制方向，右下角「甩」把最急的那口锅扔出去</li>
        <li><span>👀</span>${leaders}面前的红色扇形是视野，在里面甩锅会被抓现行：锅不走，还要背锅</li>`;
    if (L.basic) return `<ul class="rules">${basic}</ul>`;
    return `
      <ul class="rules">${basic}
        <li><span>☄️</span>天降锅只砸你，躲不掉；${leaders}的普通锅看到红线就躲</li>
        <li><span>🛡️</span>锅朝你飞来时按「甩」能弹回去；P0 只有 ${P0_LIFE} 秒，炸了背锅 +${P0_BLAME}</li>
        <li><span>💥</span>身上堆满 ${MAX_POTS} 口锅当场压垮，直接失败</li>
      </ul>`;
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
        ${locked ? `<img class="ico" src="${E.pxUrl('ui_lock')}" alt="">` : ''}第 ${lv.id} 关<small>${b ? '★'.repeat(b.stars) : locked ? '前一关进前三解锁' : '未通关'}</small></button>`;
    }).join('');
    E.showPanel(`
      <div class="lvtabs">${tabs}</div>
      <span class="badge">第 ${L.id} 关 · ${1 + L.bots.length} 人</span>
      <h1>${L.name}</h1>
      <p class="sub">${L.desc}</p>
      ${rulesHtml()}
      <div class="goal">
        <b>目标</b> 18:00 按背锅次数排名（少的在前）：第 1 名 ★★★ · 第 2 名 ★★ · 第 3 名 ★，进前三过关
        ${best ? `<br><b>最好成绩</b> ${'★'.repeat(best.stars)}${best.blames != null ? ` · 背锅 ${best.blames} 次` : ''}` : ''}
      </div>
      <button class="btn" data-act="start">开始上班</button>
      <button class="btn ghost" data-act="lobby">回大厅</button>
      ${L.tutorial && prog.tutDone ? '<button class="pop-link" data-act="tut">重看带教</button>' : ''}`, {
      start: startGame,
      lobby: showLobby,
      tut: () => { forceTut = true; startGame(); },
      pick: (btn) => { L = LEVELS.find((lv) => lv.id === Number(btn.dataset.id)); showIntro(); },
    });
  }

  /* ---------------- 大厅 ---------------- */
  // 大厅是盖在画布上的一层 DOM（#lobby）：像素门厅背景 + 标题 + 主角（头顶三口锅）和两边的同事 + 关卡日历 + 去上班
  // 布局按用户给的图稿；小人和锅的待机动画全用 CSS，大厅期间画布不重绘（见主循环）
  const LOBBY_LINES = ['这锅不是我的', '这个你来跟一下', '我就路过一下', '收到，马上甩', '先对齐一下口径', '谁提的需求谁负责'];
  const lobby = { el: document.getElementById('lobby'), heroT: 0, line: -1 };

  // 显示大厅：按当前进度重画工牌星数、关卡日历和当前关
  function showLobby() {
    mode = 'lobby';
    E.bgm(true);
    S = null;
    E.hidePanel();
    clearBanners();
    document.getElementById('hud').hidden = true;
    const prog = loadProgress();
    const stars = LEVELS.reduce((sum, lv) => sum + ((prog.best[lv.id] && prog.best[lv.id].stars) || 0), 0);
    // 关卡日历：每关一页，锁住的显示锁；当前关是深蓝金边，顶上挂「当前」标签、外侧冒光；点一页就切到那一关
    const days = LEVELS.map((lv) => {
      const locked = lv.id > prog.unlocked;
      const b = prog.best[lv.id];
      const got = b ? b.stars : 0;
      const on = lv === L;
      const starImgs = [1, 2, 3].map((i) => `<img src="${E.pxUrl(`ui_${i <= got ? 'star' : 'star_empty'}`)}" alt="">`).join('');
      return `<button class="lb-day${on ? ' on' : ''}" data-act="pick" data-id="${lv.id}" ${locked ? 'disabled' : ''} aria-label="第 ${lv.id} 关 ${lv.name}">
        ${on ? '<em class="lb-tag">当前</em><i class="lb-spk"></i><i class="lb-spk"></i><i class="lb-spk"></i>' : ''}
        <b><img src="${E.pxUrl('ui_calendar')}" alt="">${lv.name.split('·')[0].trim()}</b>
        <span>${locked ? `<img class="lb-lock" src="${E.pxUrl('ui_lock')}" alt="未解锁">` : starImgs}</span></button>`;
    }).join('');
    const wok = E.pxUrl('wok');
    lobby.el.innerHTML = `
      <div class="lb-top">
        <span class="chip"><img class="ico" src="${E.pxUrl('ui_badge')}" alt="">工牌 <b>${stars}</b>/${LEVELS.length * 3}<img class="ico lb-star" src="${E.pxUrl('ui_star')}" alt="星"></span>
        <button class="chip" type="button" data-act="settings" aria-label="设置">${pxIcon('gear')}</button>
      </div>
      <div class="lb-title">
        <h1 class="rays"><i></i><i></i><i></i><i></i><i></i><i></i>甩锅侠</h1>
        <p>今天这锅，反正不是我的</p>
      </div>
      <div class="lb-floor">
        <div class="lb-crew">
          <div class="lb-woks">
            <img src="${wok}" alt=""><img src="${wok}" alt=""><img src="${wok}" alt="">
            <i></i><i></i><i></i><i></i>
          </div>
          <div class="lb-mate left"><img src="${E.pxUrl('intern_walk_s1')}" alt=""><b class="lb-whoosh"></b></div>
          <div class="lb-mate right"><img src="${E.pxUrl('veteran_walk_s1')}" alt=""><b class="lb-whoosh"></b></div>
          <button class="lb-hero" type="button" data-act="hero" aria-label="主角">
            <span class="lb-say" hidden></span>
            <img src="${E.pxUrl('player_normal')}" alt="">
          </button>
        </div>
      </div>
      <div class="lb-menu">
        <div class="lb-days">${days}</div>
        <p class="lb-cur"><span>第 ${L.id} 关 · ${L.name}</span></p>
        <button class="lb-go" type="button" data-act="go"><img src="${E.pxUrl('ui_badge')}" alt=""><span>去上班</span><i></i></button>
        <button class="lb-rules" type="button" data-act="rules"><img src="${E.pxUrl('ui_book')}" alt="">玩法</button>
      </div>`;
    lobby.heroT = 0;
    lobby.el.hidden = false;
  }

  // 离开大厅（进关卡介绍 / 开局时调用）
  function hideLobby() {
    lobby.el.hidden = true;
    document.getElementById('hud').hidden = false;
  }

  // 每帧更新大厅：主角说完台词后恢复站姿（其余待机动画都是 CSS）
  function updateLobby(dt) {
    if (lobby.heroT > 0) {
      lobby.heroT -= dt;
      if (lobby.heroT <= 0) {
        const hero = lobby.el.querySelector('.lb-hero');
        if (hero) { hero.querySelector('img').src = E.pxUrl('player_normal'); hero.querySelector('.lb-say').hidden = true; }
      }
    }
  }

  // 点主角：换成得意姿势，头顶冒一句甩锅台词（不和上一句重复）
  function pokeHero(btn) {
    let i;
    do { i = Math.floor(Math.random() * LOBBY_LINES.length); } while (i === lobby.line && LOBBY_LINES.length > 1);
    lobby.line = i;
    const say = btn.querySelector('.lb-say');
    say.textContent = LOBBY_LINES[i];
    say.hidden = false;
    btn.querySelector('img').src = E.pxUrl('player_win');
    lobby.heroT = 1.6;
    E.sfx('throw');
  }

  // 大厅「玩法」：只看规则，看完回大厅
  function showRules() {
    E.showPanel(`
      <span class="badge">玩法</span>
      <h1>怎么甩锅</h1>
      <p class="sub">背锅越少，排名越前；进前三准点下班</p>
      ${rulesHtml()}
      <button class="btn" data-act="close">知道了</button>`, { close: E.hidePanel });
  }

  // 大厅按钮：委托到 #lobby 一处监听
  lobby.el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || mode !== 'lobby') return;
    E.unlockAudio();
    const act = b.dataset.act;
    if (act === 'go') { hideLobby(); showIntro(); }
    else if (act === 'pick') { L = LEVELS.find((lv) => lv.id === Number(b.dataset.id)); showLobby(); }
    else if (act === 'rules') showRules();
    else if (act === 'hero') pokeHero(b);
    else if (act === 'settings') showSettings();
  });

  /* ---------------- 调试：纯 AI 对局模拟（平衡数值用） ---------------- */
  // 在控制台运行 SG_DEBUG.simulate(关卡序号, 局数)：玩家也交给 AI，快速跑完多局，统计排名和锅数
  window.SG_DEBUG = {
    simulate(levelIdx, runs) {
      const keepL = L, keepAuto = auto, keepS = S, keepMode = mode;
      L = LEVELS[levelIdx || 0]; auto = true;
      const out = { runs: runs || 20, crushedPlayer: 0, rankHist: {}, avgLeft: {}, avgBlame: {}, avgCaught: {}, avgBooms: 0, avgSkies: 0, crushedBots: 0, avgSpawned: 0, avgThrown: 0, avgLaunched: 0, avgMiss: 0, avgParry: 0, avgLeaderHits: 0, avgCrushT: 0 };
      for (let r = 0; r < out.runs; r++) {
        S = makeState(false); mode = 'play';
        while (!S.over) update(1 / 30);
        if (S.over === 'crushed') out.crushedPlayer++;
        const rank = ranking();
        const pr = S.over === 'crushed' ? rank.length : rank.indexOf(S.player) + 1;
        out.rankHist[pr] = (out.rankHist[pr] || 0) + 1;
        for (const a of S.agents) {
          out.avgLeft[a.name] = (out.avgLeft[a.name] || 0) + potsOf(a) / out.runs;
          out.avgBlame[a.name] = (out.avgBlame[a.name] || 0) + a.blames / out.runs;
          out.avgCaught[a.name] = (out.avgCaught[a.name] || 0) + a.caught / out.runs;
          if (a.crushed) { out.crushedBots++; out.avgCrushT += a.crushedAt; }
        }
        out.avgSpawned += S.spawned / out.runs;
        if (S.finBlame0 != null) out.avgFinBlame = (out.avgFinBlame || 0) + (S.player.blames - S.finBlame0) / out.runs;
        out.avgBooms += S.booms / out.runs; out.avgSkies += S.skies / out.runs;
        out.avgLeaderHits += S.leaderHits / out.runs;
        out.avgThrown += S.agents.reduce((s, a) => s + a.thrown, 0) / out.runs;
        out.avgLaunched += S.agents.reduce((s, a) => s + a.launched, 0) / out.runs;
        out.avgMiss += S.agents.reduce((s, a) => s + a.misses, 0) / out.runs;
        out.avgParry += S.agents.reduce((s, a) => s + a.parries, 0) / out.runs;
      }
      for (const m of [out.avgLeft, out.avgBlame, out.avgCaught]) for (const k in m) m[k] = +m[k].toFixed(1);
      out.avgBooms = +out.avgBooms.toFixed(1); out.avgSkies = +out.avgSkies.toFixed(1);
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
  // HUD「跳过带教」：直接开始上班
  document.getElementById('btnSkip').addEventListener('click', () => { if (mode === 'play') startWork(); });
  // HUD 右上角齿轮：打开设置（对局中会先暂停）
  const btnSet = document.getElementById('btnSet');
  btnSet.innerHTML = pxIcon('gear');
  btnSet.addEventListener('click', () => { if (mode === 'play') showSettings(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' || e.key === 'p') pauseGame(); });

  // ?level=2：直接进入指定关卡（调试用，会顺便解锁）
  const qLevel = Number(query.get('level'));
  if (qLevel && LEVELS.some((lv) => lv.id === qLevel)) {
    L = LEVELS.find((lv) => lv.id === qLevel);
    const prog = loadProgress();
    if (prog.unlocked < qLevel) { prog.unlocked = qLevel; saveProgress(prog); }
  } else {
    // 默认选中最新解锁的那一关
    const un = loadProgress().unlocked;
    L = LEVELS.filter((lv) => lv.id <= un).pop() || LEVELS[0];
  }

  E.showPanel('<h1>加载中…</h1><p class="sub">正在把锅摆好</p>', {});
  // 素材加载完先进大厅；带 ?level= 调试参数时直接进关卡介绍
  // 先加载图集（十来个请求），图集里没有的再按单张补；然后把 HUD 里写死的图标换成图集里的图
  E.loadAtlas(window.ATLAS, 'assets/atlas/')
    .then(() => E.loadSprites(SPRITES.filter((n) => !E.spr[n]), 'assets/px/', 'png'))
    .then(() => { E.fillPxImages(); qLevel ? showIntro() : showLobby(); });

  E.loop((dt, time) => {
    if (mode !== 'play') inp.fire = 0;
    if (mode === 'play') {
      update(dt);
      if (S.over) finish(S.over);
    }
    if (mode === 'play' || mode === 'over') floats.update(dt);
    updateBanners(mode === 'play' ? dt : 0);
    if (mode === 'lobby') updateLobby(dt);
    if (S) { draw(time); updateHud(); }
  });
})();
