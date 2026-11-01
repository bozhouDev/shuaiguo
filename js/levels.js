/* =========================================================
 * 关卡数据
 * OFFICE：办公室地图（两关共用）——房间、墙、摆设、派锅地点、出生点、领导路线
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
    potLabels: ['周报', '线上Bug', '背锅', 'PPT', '加急', '复盘', '对接', '改需求', '报销', '团建', '写文档', '客户投诉'],
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
   * --------------------------------------------------------- */
  window.LEVELS = [
    {
      id: 1,
      name: '周一 · 早会之后',
      desc: '早会刚开完，老板已经在找人干活了。锅到点在谁身上谁背锅，18:00 背锅最少的前三名下班。',
      duration: 120,        // 实际秒数，对应 09:00 ~ 18:00
      startPots: 1,         // 同事开局自带的锅（主角开局空手，第一口是天降锅）
      potLife: 30,
      skyChance: 0.25,
      bots: ['pm', 'intern', 'veteran'],
      leaders: [{ type: 'boss', route: 'boss' }],
      ai: { aggr: 0.7, parry: 0.45 },   // 第 1 关是适应关：同事不太主动，也不太会反甩
      pace: [
        { t: 6, every: 8 },
        { t: 40, every: 6.5 },
        { t: 80, every: 5.2 },
        { t: 107, every: 3, toast: '17:00 下班前突击派活！' },
      ],
      bursts: [
        { t: 30, src: 'meeting', n: 3, msg: '【全员群】行政：{time} 周会结束，散会！' },
        { t: 78, src: 'meeting', n: 4, msg: '【全员群】行政：{time} 需求会结束，大家辛苦' },
      ],
      events: { n: 1, window: [45, 100], pool: ['printer', 'tea', 'p0'] },
      hints: [
        { t: 0.5, text: '左下角摇杆控制方向，右下角「甩」把锅扔出去' },
        { t: 3.5, text: '天降锅！老板点名给你的，躲不掉，接住再甩出去' },
        { t: 8, text: '锅变黄、变红就快到点了：到点在谁身上，谁背锅' },
        { t: 14, text: '朝同事走，扇形变绿套住他时按「甩」' },
        { t: 22, text: '老板面前的红色扇形是视野，在里面甩锅会被抓现行' },
        { t: 30, text: '甩空了锅会弹回来；锅朝你飞来时按「甩」能反弹' },
        { t: 44, text: '右上角是你的名次：按背锅次数排，进前三才能下班' },
        { t: 60, text: '身上堆满 12 口锅会当场压垮，别一直攒着' },
        { t: 72, text: '头上冒火的同事正冲你来，离他远点' },
      ],
    },
    {
      id: 2,
      name: '周三 · 需求评审',
      desc: '总监也来了，一次丢两口，还多一道视野。锅的期限更短，同事变成 5 个。',
      duration: 120,
      startPots: 2,
      potLife: 24,
      skyChance: 0.3,
      bots: ['pm', 'tester', 'intern', 'veteran', 'designer'],
      leaders: [{ type: 'boss', route: 'boss' }, { type: 'director', route: 'director' }],
      ai: { aggr: 1.15, parry: 1.1 },  // 第 2 关同事更狠：追着甩、更会反甩
      pace: [
        { t: 3, every: 5.5 },
        { t: 30, every: 4.5 },
        { t: 70, every: 3.6 },
        { t: 105, every: 2, toast: '17:00 下班前突击派活！' },
      ],
      bursts: [
        { t: 25, src: 'meeting', n: 5, msg: '【全员群】行政：{time} 需求评审结束，散会！' },
        { t: 60, src: 'meeting', n: 6, msg: '【全员群】行政：{time} 评审第二场结束' },
        { t: 95, src: 'meeting', n: 6, msg: '【全员群】行政：{time} 复盘会结束，记得写纪要' },
      ],
      events: { n: 3, window: [30, 108], pool: ['printer', 'tea', 'p0'] },
      hints: [
        { t: 1, text: '新领导：总监一次丢两口，也有自己的视野扇形' },
        { t: 12, text: '这关锅只有 24 秒期限，别攒着' },
        { t: 30, text: '场上 6 个人，背锅最少的前三名才能下班' },
      ],
    },
  ];
})();
