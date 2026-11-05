// 对应原型 js/game.js 的手感参数、人设、领导、事件和增益常量；值与顺序原样保留。
import type { Persona, LeaderConfig, Buff } from './types';

/* ---------------- 手感参数（调数值主要改这里） ---------------- */
export const BASE_SPEED = 145;      // 移动速度（手机屏幕小，不能太快；背多少锅都不减速）
export const TURN_ONLY_MAG = 0.35;  // 摇杆只轻推（小于底座半径的这个比例）时原地转向不走，方便站着瞄准
export const HEAD_R = 18;           // 蛇头碰撞半径
export const THROW_SPEED = 620;     // 甩出去的锅飞多快（要快，慢了没意义）
export const THROW_TURN = 6;        // 甩出去的锅追踪目标的转向速度（擦边也能拐进去）
export const THROW_RANGE = 200;     // 甩出去的锅最远飞多远，飞满还没砸中人就算甩空（比扇形略远，留点余量给走动的目标）
export const THROW_HIT_R = HEAD_R + 22; // 甩出去的锅砸中判定半径（比领导的锅宽松）
export const AIM_RANGE = 150;       // 自动瞄准：扇形半径（v2.5 从 300 减半，要贴近了才甩得中）
export const AIM_CONE = 0.26;       // 自动瞄准：扇形半角，前进方向左右各约 15°（总开角约 30°）
export const THROW_CD = 0.6;        // 甩一次后多久才能再甩
export const PARRY_WIN = 0.22;      // 反甩判定窗口：锅离砸中你还剩几秒内按「甩」才算
export const PARRY_DECAY = 0.75;    // 每反甩一次，下一次判定窗口缩小到几倍（来回几次必有人接住）
export const PARRY_SPEEDUP = 1.12;  // 每反甩一次锅加速
export const PARRY_MAX = 0.6;       // 同事反甩成功率上限（人设 × 关卡倍率后封顶）：2026-11-05 由 0.9 降到 0.6，下午甩给老油条不能九成被弹回来，「甩出去」得是本事不是掷骰子
export const WHIFF_LOCK = 0.4;      // 按空（没锅可甩也没东西可弹）后多久不能反甩，防止狂按
export const COMBO_WINDOW = 2.5;    // 连甩判定窗口（秒）
export const RECV_SHIELD = 0.8;     // 刚接锅的人多久内甩不中（锅会弹开，算甩空）
export const RECV_STUN = 0.4;       // 接锅后愣多久才能甩出去
export const NO_RETURN = 1.5;       // 同事接锅后多久内不会主动瞄准刚甩给他的人（玩家不受限）
export const MAX_POTS = 12;         // 身上堆满即被压垮（玩家直接失败，同事出局）
export const POT_ALARM = 9;         // 堆到这么多开始报警（锅数条变红、冒汗）
export const CARRY_W = 0.5;         // 仅局内实时总账折算；18:00 所有余锅到期后，结算总账等于背锅次数。
export const DUE_DEFAULT = 30;      // 锅的截止时间（关卡没配 potLife 时用）：落到人身上开始倒计时，甩来甩去不重置
export const DUE_WARN = 10;         // 剩几秒变黄
export const DUE_DANGER = 5;        // 剩几秒变红冒烟
export const VISION_RANGE = 220;    // 领导视野：扇形长度（比玩家甩锅扇形 150 稍长）
export const VISION_CONE = 0.52;    // 领导视野：扇形半角，左右各约 30°（总开角约 60°）
export const SKY_TIME = 1;          // 天降锅：阴影出现到砸下来的时间（躲不掉，只是给个准备）
export const SKY_FIRST = 3;         // 开局第几秒落下第一口天降锅
export const SKY_GAP = 20;          // 天降锅保底：两口天降锅至少隔这么多秒（2026-11-05 加，坏运气有上限，输了才能归因到操作）
export const POT_SPEED = 105;       // 领导 / 散会飞出来的锅速度（按移动速度同比例放慢，保证横移躲得开）
export const POT_TURN = 1.5;        // 飞行锅转向速度（越小越好躲）
export const POT_LIFE = 7;          // 飞行锅存活时间
export const AIM_TIME = 0.8;        // 领导瞄准预警时长
export const LEADER_HIT_POTS = 3;   // 撞上领导一次派几口
export const ALERT_SEE = 480;       // 老板离实习生多近才「看得见」有人欺负他
export const ALERT_CD = 15;         // 老板追完一次后多久内不再追
export const ALERT_CHASE = 4;       // 老板追人时长
export const ALERT_SPEED = 120;     // 老板追人速度（略慢于人，绕障碍追）
export const P0_LIFE = 10;          // P0 的截止时间（比普通锅短得多）
export const P0_BLAME = 3;          // P0 到点算背几次锅
export const FINAL_RUSH = 10;       // 下班预告秒数，只影响横幅，不改变 AI 和计分
export const CLEARING = 15;         // 迭代需求§5：正式上班最后15实际秒清账，周一带教不计入。
export const CLOSING_BELL_TIME = 0.45; // 到点铃声提示的实际秒数
export const CLOSING_FEEDBACK_TIME = 1; // 胜负反馈的实际秒数
export const NEPHEW_CHASE = 5;      // 小舅子被压垮后，老板追最后甩中他的人几秒

// 难度爬升（每关后半段越来越难，详见 levels.js 的 aiEnd / rushAt / incidents）
export const RAMP_CURVE = 1.6;      // 同事难度从 ai 过渡到 aiEnd 的曲线指数（>1 前缓后陡）
export const RUSH_AT = 0.75;        // 关卡没写 rushAt 时，上班进度到这里进入「急着下班」
export const RUSH_SPEED = 1.08;     // 急着下班：同事走路加速
export const RUSH_REACT = 0.8;      // 急着下班：同事思考间隔缩短（反应更快）
export const RUSH_AGGR = 1.15;      // 急着下班：同事甩锅积极度再乘一档
export const RAGE_TIME = 10;        // 老板发火持续秒数
export const RAGE_SPEED = 1.5;      // 发火时老板走路倍速
export const RAGE_EVERY = 0.45;     // 发火时老板丢锅间隔倍率（越小越密）
export const RAGE_AIM = 0.7;        // 发火时瞄准预警时长倍率
export const RAGE_VISION = 1.25;    // 发火时视野长度、开角倍率（盯得更紧）
export const RAGE_PANIC = 1.25;     // 发火时同事跟着慌，甩锅积极度再乘一档
export const INSPECT_TIME = 9;      // 领导查岗：直奔你所在位置的秒数
export const INSPECT_SPEED = 1.7;   // 查岗时领导走路倍速（老板约 116，仍比人慢，跑得掉）
export const INSPECT_STOP = 110;    // 查岗走到离你多近停下盯着看（比视野 220 近，比撞上 46 远）

// 临时事件的群消息（{boss} 换成老板称呼）：发火、查岗各一组，随机挑一句
export const INCIDENT_MSGS: Record<string, string[]> = {
    rage: ['【工作群】{boss}：这个方案谁做的？！全部重做！', '【工作群】{boss}：客户投诉都打到我这了，谁负责的？！', '【工作群】{boss}：报表数字又对不上，今天谁都别想早走！'],
    inspect: ['【全员群】{who}：我下来转转，看看谁在摸鱼', '【全员群】{who}：都别动，我挨个看看进度'],
  };

// 广告重来可带的单局增益：名字、说明和图标统一供结算与 HUD 使用。
export const BUFFS: Record<string, Buff> = {
    trip: { name: '领导出差', desc: '前 30 秒没有天降锅', img: 'boss_idle' },
    gold: { name: '免死金牌', desc: '第一次当着领导甩锅不被抓', img: 'ui_badge' },
    news: { name: '消息灵通', desc: '群消息预告提前 2 秒', img: 'ui_book' },
    legs: { name: '腿长', desc: '移动速度 +10%', img: 'player_walk_s1' },
  };

// 同事人格：speed 速度倍率；turn 转向；react 思考间隔；aggr 甩锅积极度；seekR 找人半径；
  // seekMin 身上几口锅才开始找人甩（有锅快到点时不管这个）；dodge 躲锅能力；caution 躲人/躲领导；
  // parry 锅飞来时反甩成功的概率；throwR 目标进入多近才出手；sneak 在领导视野里时忍住不甩的概率
export const PERSONAS: Record<string, Persona> = {
    me:       { name: '你', sprite: 'player', speed: 1, turn: 5.2, react: 0.2, aggr: 1, seekR: 520, seekMin: 1, dodge: 0.9, caution: 0.7, parry: 0.5, throwR: 130, sneak: 0.9 },
    pm:       { name: '会计', sprite: 'pm', speed: 0.93, turn: 4.6, react: 0.22, aggr: 1, seekR: 520, seekMin: 1, dodge: 0.8, caution: 0.6, parry: 0.35, throwR: 120, sneak: 0.85 },
    tester:   { name: '业务员', sprite: 'tester', speed: 0.88, turn: 4.4, react: 0.24, aggr: 0.85, seekR: 440, seekMin: 1, dodge: 1, caution: 0.8, parry: 0.4, throwR: 110, sneak: 0.7 },
    intern:   { name: '新来的', sprite: 'intern', speed: 0.85, turn: 4, react: 0.36, aggr: 0.4, seekR: 260, seekMin: 3, dodge: 0.45, caution: 1, parry: 0.1, throwR: 90, sneak: 0.2 },
    veteran:  { name: '老油条', sprite: 'veteran', speed: 0.95, turn: 4.8, react: 0.2, aggr: 0.65, seekR: 320, seekMin: 2, dodge: 1.3, caution: 1.3, parry: 0.65, throwR: 110, sneak: 1, tea: true },
    // 小舅子的正式形象：墨绿上衣、大金链子、低头玩手机。
    nephew:   { name: '小舅子', sprite: 'nephew', speed: 0.9, turn: 4.5, react: 0.2, aggr: 1, seekR: 520, seekMin: 1, dodge: 0.5, caution: 0.3, parry: 0, throwR: 150, sneak: 0 },
    // 出纳跟风：优先追着三秒内刚被同事甩中过的人。
    cashier:  { name: '出纳', sprite: 'cashier', speed: 0.94, turn: 4.7, react: 0.23, aggr: 0.95, seekR: 480, seekMin: 1, dodge: 0.8, caution: 0.7, parry: 0.35, throwR: 120, sneak: 0.75 },
    designer: { name: '美工', sprite: 'designer', speed: 0.9, turn: 4.5, react: 0.26, aggr: 0.75, seekR: 400, seekMin: 1, dodge: 0.9, caution: 0.9, parry: 0.3, throwR: 115, sneak: 0.6 },
  };

// 领导类型：count 一次丢几口（分别瞄准锅最少的几个人）；range 视野；everyMul 丢锅间隔倍率
export const LEADER_TYPES: Record<string, LeaderConfig> = {
    boss:     { name: '老板', sprite: 'boss', h: 94, emoji: '🤵', speed: 68, count: 1, range: 700, everyMul: 1 },
    wife:     { name: '老板娘', sprite: 'wife', h: 88, speed: 76, count: 1, range: 700, everyMul: 1.1, visionCone: Math.PI / 8, aimTime: 0.6 },
    director: { name: '经理', sprite: 'director', h: 86, emoji: '👔', speed: 80, count: 2, range: 600, everyMul: 1.3 },
  };

// 随机事件：先发群消息，2 秒后生效
export const EVENTS: Record<string, { msg: string }> = {
    printer: { msg: '【全员群】行政：打印机又卡纸了！谁离得近去看一下' },
    tea: { msg: '【全员群】人事：下午茶到了，茶水间自取 🧋' },
    p0: { msg: '【工作群】老板：@所有人 大客户急件，今天必须交，谁来跟一下？' },
  };

/* ---------------- 领导寻路：网格 A*，领导不再穿墙 / 穿桌子 ---------------- */
export const NAV_CELL = 20;   // 网格大小
export const LEADER_R = 20;   // 领导身体半径（障碍物按这个外扩）

/* ---------------- 画饼大会：时间都用对局时钟，暂停时一起停 ---------------- */
export const PIE_PROMISES = [
    '明年公司上市，在座的都是元老。', '好好干，明年开分店，你去当店长。',
    '年底分红，人人有份。', '等融资到位，给大家配股份。',
    '这个单子拿下来，年底给你配车。', '年轻人别光盯着工资，要看长远。', '公司就是你们的家。',
    '今年辛苦一点，明年给大家涨薪。', '格局要打开。',
  ];
export const TUT_BOSS_SPEED = 3;  // 带教时老板走路的倍速，别让人干等
export const TUT_RING_R = 34;     // 走进黄圈多近算到
export const STEER_OFFSETS = [0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05, 1.5, -1.5, 2, -2, 2.6, -2.6, Math.PI];

// 随机掉落道具：规则见《这锅你来背-核心玩法》“随机掉落道具”，独立于原派锅数值。
// 刷新时刻按上班进度算（2026-11-05 改：各关时长不再相同），120 秒的关正好是第 25 / 60 / 95 秒
export const ITEM_DROP_FRACS = [25 / 120, 60 / 120, 95 / 120];
export const ITEM_DROP_JITTER = 0; // 固定时刻也符合“左右”；便于玩家学习节奏，以后可调至3秒。
export const ITEM_PREVIEW = 1;
export const ITEM_LIFE = 12;
export const ITEM_BLINK = 3;
export const ITEM_CLEAR_CHANCE = 0.2;
export const ITEM_INVINCIBLE_CHANCE = 0.4;
export const ITEM_INVINCIBLE_TIME = 5;
export const ITEM_DELAY_TIME = 15;
export const ITEM_PICK_RADIUS = HEAD_R + 14;
export const ITEM_AI_RANGE = 280;
export const ITEM_PATH_STEP = 8;
export const ITEM_CLEAR_STAGGER = 0.06;
export const ITEM_CLEAR_FX_TIME = 0.6;
export const ITEM_DELAY_FX_TIME = 0.8;
