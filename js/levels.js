/* =========================================================
 * 关卡数据
 * OFFICE：办公室地图（两关共用）——房间、墙、摆设、派锅地点、出生点、领导路线
 * LEVELS：每关只描述「数据」：同事阵容、领导、派锅节奏、散会、随机事件、教学提示
 * 玩法逻辑都在 game.js 里，加关卡只需往 LEVELS 里加一项
 * ========================================================= */
(function () {
  'use strict';

  // 工位网格：3 列 × 4 行，过道宽约 80px
  const DESK_COLS = [40, 360, 680];
  const DESK_ROWS = [340, 560, 780, 1000];
  const desks = [];
  for (const y of DESK_ROWS) for (const x of DESK_COLS) desks.push({ sprite: 'desk', x, y, w: 240, hit: { x: x + 6, y: y + 6, w: 228, h: 80 } });

  window.OFFICE = {
    world: { w: 960, h: 1440 },

    // 房间地面（纯视觉）
    rooms: [
      { name: '会议室', x: 0, y: 0, w: 424, h: 264, floor: '#D9CBB0' },
      { name: '老板办公室', x: 600, y: 0, w: 360, h: 264, floor: '#D6CBE3' },
      { name: '茶水间', x: 0, y: 1216, w: 300, h: 224, floor: '#CFE5D6' },
    ],

    // 墙体（碰撞），每个房间都留了门
    walls: [
      { x: 0, y: 250, w: 170, h: 14 }, { x: 270, y: 250, w: 154, h: 14 }, { x: 410, y: 0, w: 14, h: 264 },   // 会议室
      { x: 600, y: 0, w: 14, h: 264 }, { x: 600, y: 250, w: 150, h: 14 }, { x: 850, y: 250, w: 110, h: 14 }, // 老板办公室
      { x: 0, y: 1216, w: 190, h: 14 }, { x: 286, y: 1216, w: 14, h: 224 },                                  // 茶水间
    ],

    // 摆设：sprite 为素材名，x/y 为左上角，w 为绘制宽度；hit 为碰撞框（没有则可穿过）
    props: [
      { sprite: 'meeting_table', x: 60, y: 60, w: 300, hit: { x: 92, y: 90, w: 260, h: 90 } },
      { sprite: 'boss_desk', x: 700, y: 70, w: 220, hit: { x: 706, y: 100, w: 204, h: 84 } },
      ...desks,
      { sprite: 'printer', x: 840, y: 1250, w: 96, hit: { x: 844, y: 1264, w: 88, h: 60 } },
      { sprite: 'cooler', x: 30, y: 1290, w: 64, hit: { x: 40, y: 1322, w: 44, h: 48 } },
      { sprite: 'plant', x: 480, y: 30, w: 64 },
      { sprite: 'plant', x: 900, y: 1380, w: 56 },
      { sprite: 'plant', x: 220, y: 1380, w: 56 },
      { sprite: 'plant', x: 446, y: 1180, w: 50 },
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

    // 领导巡逻路线（循环），wait 为到点后停留秒数；领导不做障碍物碰撞
    routes: {
      boss: [
        { x: 780, y: 190, wait: 3 }, { x: 800, y: 300 }, { x: 640, y: 300 }, { x: 640, y: 1150 },
        { x: 320, y: 1150 }, { x: 320, y: 300 }, { x: 800, y: 300 },
      ],
      director: [
        { x: 220, y: 190, wait: 2 }, { x: 220, y: 300 }, { x: 320, y: 300 }, { x: 320, y: 720 },
        { x: 640, y: 720 }, { x: 640, y: 1150 }, { x: 900, y: 1150 }, { x: 900, y: 500 }, { x: 320, y: 500 }, { x: 220, y: 300 },
      ],
    },

    // 锅上的字
    potLabels: ['周报', '线上Bug', '背锅', 'PPT', '加急', '复盘', '对接', '改需求', '报销', '团建', '写文档', '客户投诉'],
  };

  /* ---------------------------------------------------------
   * 关卡字段说明
   * bots：同事阵容（人格见 game.js 的 PERSONAS）；场上人数 = 1 + bots.length
   * leaders：领导（见 game.js 的 LEADER_TYPES），route 为巡逻路线名
   * pace：领导丢锅节奏——从第 t 秒起，每位领导约每 every 秒丢一次
   * bursts：会议室定期「散会」喷锅，at 前 2.5 秒先发群消息；{time} 会替换成屏幕时钟
   * events：随机事件——从 pool 里抽 n 个不重复的，在 window 时间段内均匀错开触发
   * --------------------------------------------------------- */
  window.LEVELS = [
    {
      id: 1,
      name: '周一 · 早会之后',
      desc: '早会刚开完，老板已经在找人干活了。18:00 下班时，比同事身上的锅少就行。',
      duration: 120,        // 实际秒数，对应 09:00 ~ 18:00
      startPots: 2,         // 每人开局自带的锅
      bots: ['pm', 'intern', 'veteran'],
      leaders: [{ type: 'boss', route: 'boss' }],
      pace: [
        { t: 4, every: 6.5 },
        { t: 40, every: 5.2 },
        { t: 80, every: 4.2 },
        { t: 107, every: 2.2, toast: '17:00 下班前突击派活！' },
      ],
      bursts: [
        { t: 30, src: 'meeting', n: 4, msg: '【全员群】行政：{time} 周会结束，散会！' },
        { t: 78, src: 'meeting', n: 5, msg: '【全员群】行政：{time} 需求会结束，大家辛苦' },
      ],
      events: { n: 1, window: [45, 100], pool: ['printer', 'tea', 'p0'] },
      hints: [
        { t: 0.5, text: '按住屏幕任意位置拖动，控制方向' },
        { t: 4, text: '老板会朝闲着的人丢锅，看到红色瞄准线就躲开' },
        { t: 10, text: '身后有锅？贴近同事，自动甩给他' },
        { t: 18, text: '同事也会把锅甩给你；刚甩给你的人 3 秒内甩不回去' },
        { t: 40, text: '左上角是实时排名，18:00 进前三才能过关' },
        { t: 58, text: '头上冒火的同事正冲你来，离他远点' },
        { t: 70, text: '老油条难甩，甩中 ×3 分；欺负实习生，老板会来找你' },
      ],
    },
    {
      id: 2,
      name: '周三 · 需求评审',
      desc: '总监也来了，一次丢两口。同事变成 5 个，进前三更难了。',
      duration: 120,
      startPots: 2,
      bots: ['pm', 'tester', 'intern', 'veteran', 'designer'],
      leaders: [{ type: 'boss', route: 'boss' }, { type: 'director', route: 'director' }],
      pace: [
        { t: 3, every: 6.5 },
        { t: 35, every: 5.2 },
        { t: 75, every: 4.2 },
        { t: 105, every: 2.4, toast: '17:00 下班前突击派活！' },
      ],
      bursts: [
        { t: 25, src: 'meeting', n: 5, msg: '【全员群】行政：{time} 需求评审结束，散会！' },
        { t: 60, src: 'meeting', n: 5, msg: '【全员群】行政：{time} 评审第二场结束' },
        { t: 95, src: 'meeting', n: 6, msg: '【全员群】行政：{time} 复盘会结束，记得写纪要' },
      ],
      events: { n: 2, window: [35, 105], pool: ['printer', 'tea', 'p0'] },
      hints: [
        { t: 1, text: '新领导：总监一次丢两口，瞄准锅最少的两个人' },
        { t: 30, text: '场上 6 个人，进前三才能过关' },
      ],
    },
  ];
})();
