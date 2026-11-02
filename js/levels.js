/* =========================================================
 * 关卡数据
 * OFFICE：办公室地图（各关共用）——房间、墙、摆设、派锅地点、出生点、领导路线
 * LEVELS：每关只描述「数据」：同事阵容、领导、派锅节奏、散会、随机事件、教学提示
 * 玩法逻辑都在 game.js 里，加关卡只需往 LEVELS 里加一项
 * ========================================================= */
(function () {
  'use strict';

  // 工位网格：3 列 × 4 行；每格 240 宽，工位按格子中心缩到 DESK_SCALE，过道随之变宽（缩 85% 后约 116px）
  const DESK_COLS = [40, 360, 680];
  const DESK_ROWS = [340, 560, 780, 1000];
  const DESK_SCALE = 0.85;
  const DESK_CELL_W = 240, DESK_CELL_H = 158;          // 原尺寸：绘制宽 240，按素材比例高约 158
  const desks = [];
  for (const y0 of DESK_ROWS) for (const x0 of DESK_COLS) {
    const w = Math.round(DESK_CELL_W * DESK_SCALE);
    const x = x0 + (DESK_CELL_W - w) / 2, y = y0 + Math.round(DESK_CELL_H * (1 - DESK_SCALE) / 2);
    // 碰撞框只挡桌面那一截（椅子那半截能走过去），同样按比例缩
    const k = DESK_SCALE;
    desks.push({ sprite: 'desk', x, y, w, hit: { x: x + Math.round(6 * k), y: y + Math.round(6 * k), w: Math.round(228 * k), h: Math.round(80 * k) } });
  }

  window.OFFICE = {
    world: { w: 960, h: 1440 },

    // 房间地面（纯视觉）
    rooms: [
      { name: '会议室', x: 0, y: 0, w: 424, h: 264, tile: 'wood' },
      { name: '老板办公室', x: 600, y: 0, w: 360, h: 264, tile: 'lilac' },
      { name: '茶水间', x: 0, y: 1216, w: 300, h: 224, tile: 'mint' },
    ],

    // 墙体（碰撞），每个房间都留了门
    walls: [
      { x: 0, y: 250, w: 170, h: 14 }, { x: 270, y: 250, w: 154, h: 14 }, { x: 410, y: 0, w: 14, h: 264 },   // 会议室
      { x: 600, y: 0, w: 14, h: 264 }, { x: 600, y: 250, w: 150, h: 14 }, { x: 850, y: 250, w: 110, h: 14 }, // 老板办公室
      { x: 0, y: 1216, w: 190, h: 14 }, { x: 286, y: 1216, w: 14, h: 224 },                                  // 茶水间
    ],

    // 摆设：sprite 为素材名，x/y 为左上角，w 为绘制宽度；hit 为碰撞框（没有则可穿过）
    props: [
      { sprite: 'meeting_table', x: 70, y: 40, w: 280, hit: { x: 100, y: 70, w: 220, h: 110 } },
      { sprite: 'whiteboard', x: 330, y: 24, w: 70 },
      { sprite: 'boss_desk', x: 715, y: 40, w: 200, hit: { x: 720, y: 80, w: 190, h: 100 } },
      { sprite: 'cabinet', x: 626, y: 30, w: 64, hit: { x: 626, y: 30, w: 64, h: 60 } },
      ...desks,
      { sprite: 'printer', x: 840, y: 1250, w: 96, hit: { x: 844, y: 1264, w: 88, h: 60 } },
      { sprite: 'cooler', x: 30, y: 1260, w: 52, hit: { x: 34, y: 1290, w: 44, h: 60 } },
      { sprite: 'tea_counter', x: 100, y: 1236, w: 120, hit: { x: 104, y: 1240, w: 112, h: 50 } },
      { sprite: 'sofa', x: 110, y: 1374, w: 110 },
      { sprite: 'plant', x: 480, y: 30, w: 64 },
      { sprite: 'plant', x: 900, y: 1380, w: 56 },
      { sprite: 'plant_small', x: 236, y: 1384, w: 44 },
      { sprite: 'plant_small', x: 452, y: 1180, w: 44 },
    ],

    // 会喷锅的地点（锅不会凭空出现，一定从这些地方或领导手里飞出来）
    sources: {
      meeting: { name: '会议室', x: 220, y: 285 },
      bossroom: { name: '老板办公室', x: 800, y: 285 },
      printer: { name: '打印机', x: 888, y: 1236 },
    },
    tea: { x: 170, y: 1330 },          // 茶水间中心：下午茶、老油条泡茶都往这里走

    player: { x: 480, y: 725 },        // 玩家出生点（中间过道）
    // 同事出生点（都在过道上），按阵容顺序取
    spawns: [
      { x: 320, y: 500 }, { x: 640, y: 940 }, { x: 160, y: 1150 },
      { x: 640, y: 500 }, { x: 320, y: 940 }, { x: 800, y: 1150 },
    ],

    // 领导巡逻路线（循环），wait 为到点后停留秒数；点与点之间由 game.js 寻路绕开墙和桌子
    routes: {
      boss: [
        { x: 790, y: 214, wait: 3 }, { x: 800, y: 300 }, { x: 640, y: 300 }, { x: 640, y: 1150 },
        { x: 320, y: 1150 }, { x: 320, y: 300 }, { x: 800, y: 300 },
      ],
      director: [
        { x: 220, y: 214, wait: 2 }, { x: 220, y: 300 }, { x: 320, y: 300 }, { x: 320, y: 720 },
        { x: 640, y: 720 }, { x: 640, y: 1150 }, { x: 900, y: 1150 }, { x: 900, y: 500 }, { x: 320, y: 500 }, { x: 220, y: 300 },
      ],
    },

    // 锅上的字
    potLabels: ['周报', '返工', '背锅', 'PPT', '盘点', '对账', '对接', '改方案', '报销', '团建', '做表格', '客户投诉'],
  };

  /* ---------------------------------------------------------
   * 关卡字段说明
   * bots：同事阵容（人格见 game.js 的 PERSONAS）；场上人数 = 1 + bots.length
   * leaders：领导（见 game.js 的 LEADER_TYPES），route 为巡逻路线名
   * pace：领导丢锅节奏——从第 t 秒起，每位领导约每 every 秒丢一次
   * bursts：会议室定期「散会」喷锅，at 前 2.5 秒先发群消息；{time} 会替换成屏幕时钟
   * events：随机事件——从 pool 里抽 n 个不重复的，在 window 时间段内均匀错开触发
   * ai：同事难度倍率——aggr 甩锅积极度、parry 反甩成功率（乘在人设上）
   * potLife：每口锅的截止秒数（落到人身上开始计时，甩来甩去不重置，到点在谁身上谁背锅）
   * skyChance：老板每次丢锅变成「天降锅」（只砸主角、躲不掉）的概率
   * 下面几项可选，不填就没有：
   * basic：关卡介绍只列基本规则（第 1 关还没教反弹、P0、压垮）
   * tips：看情况弹的提示（on 为触发条件名，见 game.js 的 TIP_CHECKS），每条每局只弹一次
   * finale：收尾——t 秒时发群消息、开下午茶，老板给主角塞 pots 口锅，期限卡在 18:00
   * tutorial：带教段（时钟停在 09:00，做到了才往下走）。spots 是带教时各人站的位置；
   *           steps 每步 do 为动作名（做法见 game.js 的 TUT_STEPS），say 是老周说的话，say2 是动作完成后的下一句，
   *           alt 是主角不在老板视野里时 dodge 那步换的说法；{who} 换成刚被你甩中的同事
   * --------------------------------------------------------- */
  window.LEVELS = [
    {
      id: 1,
      name: '周一 · 入职第一天',
      desc: '入职第一天，老员工老周先带你走一遍。锅到点在谁身上谁背锅，18:00 背锅最少的前三名下班。',
      duration: 90,         // 正式上班的实际秒数，对应 09:00 ~ 18:00（带教时间不算）
      startPots: 1,         // 开始上班时每个同事发 1 口锅
      potLife: 40,
      skyChance: 0,         // 带教之后不再有天降锅
      basic: true,
      bots: ['pm', 'intern', 'veteran'],
      leaders: [{ type: 'boss', route: 'boss' }],
      ai: { aggr: 0.5, parry: 0 },      // 新手关：同事懒得追着甩，也完全不反弹
      pace: [
        { t: 8, every: 10 },
        { t: 45, every: 8 },
      ],
      bursts: [],
      hints: [],
      tips: [
        { on: 'potWarn', title: '快到点', icon: ['wok', 'ui_clock'], sub: '你的锅变*黄*、变!红!了', text: '赶紧*甩出去*' },
        { on: 'seen', title: '领导视野', icon: ['boss_idle'], sub: '你站在老板的!红扇形!里', text: '先*走出去*再甩' },
        { on: 'rankOut', title: '名次', icon: ['ui_crown'], sub: '你掉出前三了', text: '把锅*甩给别人*，追回来' },
      ],
      finale: { t: 68, pots: 4, msg: '【全员群】人事：下午茶到了，茶水间自取', say: '老板：下班前这几个你分一下' },
      tutorial: {
        spots: {
          ring: { x: 595, y: 745 },     // 第一步要走到的黄圈（别放太右，窄屏会被切边）
          intern: { x: 640, y: 600 },   // 新来的站着当靶子
          veteran: { x: 380, y: 740 },  // 老周站在主角旁边
          pm: { x: 640, y: 880 },       // 会计站在老板视野外
          boss: { x: 765, y: 540 },     // 老板出来巡视停在这（离主角近一点，视野更容易同时罩住实习生和主角）
        },
        steps: [
          { do: 'walk', say: '第一天上班？我是老周，大家都叫我*老油条*，今天我带你。按住*左下摇杆*，走到*黄圈*那儿。' },
          { do: 'sky', say: '站好别动，!老板点名了!。', say2: '这叫*天降锅*，!躲不掉!。每口锅都有*截止时间*，快到点会变黄、变红。' },
          { do: 'throw', say: '到点前甩出去，就不是你的锅了。那边那个*新来的*比你早来一周，走到她跟前，扇形变~绿~就按「*甩*」。', say2: '漂亮，~甩出去了~。' },
          { do: 'expire', say: '看好了：锅*到点*在谁身上，谁就*背锅*。', say2: '*{who}*背锅 +1。你空手，~一点事没有~。' },
          { do: 'sight', say: '老板出来巡视了。他面前的!红扇形!是*视野*。', say2: '在视野里甩锅会被*抓现行*：!锅甩不走，还要背锅!。' },
          { do: 'dodge', say: '老板又给你丢了一口。先*走出红扇形*，再甩给*会计*。', alt: '老板又给你丢了一口。别在!红扇形!里甩，把锅甩给*会计*。' },
          { do: 'rank', say: '右上角是*名次*，按背锅次数排。*18:00 背锅最少的前三名*能下班。你现在~第 1~，保持住。' },
        ],
      },
    },
    {
      id: 2,
      name: '周二 · 早会之后',
      desc: '老板派活更勤了，同事也学会了反甩。会议室散会、打印机卡纸都会喷锅，18:00 背锅最少的前三名下班。',
      duration: 120,        // 实际秒数，对应 09:00 ~ 18:00
      startPots: 1,         // 同事开局自带的锅（主角开局空手，第一口是天降锅）
      potLife: 30,
      skyChance: 0.25,
      bots: ['pm', 'intern', 'veteran'],
      leaders: [{ type: 'boss', route: 'boss' }],
      ai: { aggr: 0.7, parry: 0.45 },   // 第 2 关：同事不太主动，也不太会反甩
      pace: [
        { t: 6, every: 8 },
        { t: 40, every: 6.5 },
        { t: 80, every: 5.2 },
        { t: 107, every: 3, toast: '17:00 下班前突击派活！' },
      ],
      bursts: [
        { t: 30, src: 'meeting', n: 3, msg: '【全员群】行政：{time} 周会结束，散会！' },
        { t: 78, src: 'meeting', n: 4, msg: '【全员群】行政：{time} 销售会结束，大家辛苦' },
      ],
      events: { n: 1, window: [45, 100], pool: ['printer', 'tea', 'p0'] },
      // 教学横幅：title 黄色标签，icon [主图, 角标]（assets/px 里的名字），sub 小字，text 大字；*黄* !红! ~绿~ 是高亮
      // 基本规则第 1 关已经教过，这里只讲新东西
      hints: [
        { t: 1, title: '反弹', icon: ['fx_impact'], sub: '同事开始会反甩了', text: '锅朝你飞来时按「*甩*」，能*弹回去*' },
        { t: 26, title: '散会', icon: ['wok'], sub: '右上角群消息说散会', text: '会议室门口马上!喷锅!，*离远点*' },
        { t: 50, title: '压垮', icon: ['player_crushed'], sub: '别一直攒着锅', text: '身上堆满 !12 口!，当场压垮' },
        { t: 66, title: '小心', icon: ['fx_anger'], sub: '头上冒火的同事正冲你来', text: '离他*远点*' },
      ],
    },
    {
      id: 3,
      name: '周三 · 开大会',
      desc: '经理也来了，一次丢两口，还多一道视野。锅的期限更短，同事变成 5 个。',
      duration: 120,
      startPots: 2,
      potLife: 24,
      skyChance: 0.3,
      bots: ['pm', 'tester', 'intern', 'veteran', 'designer'],
      leaders: [{ type: 'boss', route: 'boss' }, { type: 'director', route: 'director' }],
      ai: { aggr: 1.15, parry: 1.1 },  // 第 3 关同事更狠：追着甩、更会反甩
      pace: [
        { t: 3, every: 5.5 },
        { t: 30, every: 4.5 },
        { t: 70, every: 3.6 },
        { t: 105, every: 2, toast: '17:00 下班前突击派活！' },
      ],
      bursts: [
        { t: 25, src: 'meeting', n: 5, msg: '【全员群】行政：{time} 月度总结会结束，散会！' },
        { t: 60, src: 'meeting', n: 6, msg: '【全员群】行政：{time} 总结会第二场结束' },
        { t: 95, src: 'meeting', n: 6, msg: '【全员群】行政：{time} 安全培训结束，记得签到' },
      ],
      events: { n: 3, window: [30, 108], pool: ['printer', 'tea', 'p0'] },
      hints: [
        { t: 1, title: '新领导', icon: ['director_idle'], sub: '经理一次丢*两口*锅', text: '他也有自己的!视野扇形!' },
        { t: 12, title: '背锅规则', icon: ['wok', 'ui_clock'], sub: '这关锅只有 !24 秒!期限', text: '别攒着，*快甩*' },
        { t: 30, title: '名次', icon: ['ui_crown'], sub: '场上 6 个人', text: '背锅最少的*前三名*才能下班' },
      ],
    },
  ];
})();
