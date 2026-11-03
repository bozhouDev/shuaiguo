// 自动生成：npm run cloud:prepare；勿手改。
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LEVELS = exports.OFFICE = void 0;
// 工位网格：3 列 × 4 行；每格 240 宽，工位按格子中心缩到 DESK_SCALE，过道随之变宽（缩 85% 后约 116px）
const DESK_COLS = [40, 360, 680];
const DESK_ROWS = [340, 560, 780, 1000];
const DESK_SCALE = 0.85;
const DESK_CELL_W = 240, DESK_CELL_H = 158; // 原尺寸：绘制宽 240，按素材比例高约 158
const desks = [];
for (const y0 of DESK_ROWS)
    for (const x0 of DESK_COLS) {
        const w = Math.round(DESK_CELL_W * DESK_SCALE);
        const x = x0 + (DESK_CELL_W - w) / 2, y = y0 + Math.round(DESK_CELL_H * (1 - DESK_SCALE) / 2);
        // 碰撞框只挡桌面那一截（椅子那半截能走过去），同样按比例缩
        const k = DESK_SCALE;
        desks.push({ sprite: 'desk', x, y, w, hit: { x: x + Math.round(6 * k), y: y + Math.round(6 * k), w: Math.round(228 * k), h: Math.round(80 * k) } });
    }
exports.OFFICE = {
    world: { w: 960, h: 1440 },
    // 房间地面（纯视觉）
    rooms: [
        { name: '会议室', x: 0, y: 0, w: 424, h: 264, tile: 'wood' },
        { name: '老板办公室', x: 600, y: 0, w: 360, h: 264, tile: 'lilac' },
        { name: '茶水间', x: 0, y: 1216, w: 300, h: 224, tile: 'mint' },
    ],
    // 墙体（碰撞），每个房间都留了门
    walls: [
        { x: 0, y: 250, w: 170, h: 14 }, { x: 270, y: 250, w: 154, h: 14 }, { x: 410, y: 0, w: 14, h: 264 },
        { x: 600, y: 0, w: 14, h: 264 }, { x: 600, y: 250, w: 150, h: 14 }, { x: 850, y: 250, w: 110, h: 14 },
        { x: 0, y: 1216, w: 190, h: 14 }, { x: 286, y: 1216, w: 14, h: 224 }, // 茶水间
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
    tea: { x: 170, y: 1330 },
    player: { x: 480, y: 725 },
    // 同事出生点（都在过道上），按阵容顺序取
    spawns: [
        { x: 320, y: 500 }, { x: 640, y: 940 }, { x: 160, y: 1150 },
        { x: 640, y: 500 }, { x: 320, y: 940 }, { x: 800, y: 1150 },
        { x: 320, y: 720 }, { x: 640, y: 720 },
    ],
    // 领导巡逻路线（循环），wait 为到点后停留秒数；点与点之间由 game.js 寻路绕开墙和桌子
    routes: {
        // 老板娘从南侧查起，走外侧过道，避免开局三位领导挤在北边。
        wife: [
            { x: 480, y: 1320, wait: 2 }, { x: 640, y: 1150 }, { x: 900, y: 940 },
            { x: 900, y: 300 }, { x: 480, y: 300 }, { x: 320, y: 500 },
            { x: 40, y: 720 }, { x: 40, y: 1150 }, { x: 480, y: 1150 },
        ],
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
 * ai：同事开局的难度倍率——aggr 甩锅积极度、parry 反甩成功率、dodge 躲锅、sneak 领导面前忍住不甩（乘在人设上）；
 *     focus 盯人程度（0 = 只找最近的人甩，越大越专挑同事里总账最少的人，玩家领先时就是盯你）
 * aiEnd：同事下班时的难度倍率（字段同 ai）；从 ai 按上班进度前缓后陡地爬到 aiEnd，没写的项不变
 * rushAt：第几秒进入「急着下班」——同事走得更快、反应更快、更爱甩锅，头上冒汗（不写默认 75% 处）
 * incidents：临时事件，固定时刻发生，提前 2 秒群消息预告。kind: rage 老板发火（10 秒内派锅又快又多、视野更大，同事跟着慌）、
 *     inspect 领导查岗（9 秒内走到你跟前盯着看，视野罩住你就别甩）；who 写领导类型，默认 boss
 * news：关卡介绍页三行图解，只讲这关新出现的东西（icon 为 assets/px 素材名）；不写就讲基本规则（第 1 关）
 * leaderFocus：老板、经理每次派活先点你名的概率（你在丢锅范围内才算）
 * potLife：每口锅的截止秒数（落到人身上开始计时，甩来甩去不重置，到点在谁身上谁背锅）
 * skyChance：老板每次丢锅变成「天降锅」（只砸主角、躲不掉）的概率
 * pieMeetings：老板画饼会议列表，t 开始秒数、duration 讲话时长、count 饼数、life 留地秒数
 * theme：主题配色（地图不变，只换地毯颜色；配色见 game.js 的 THEMES），不填就是默认办公
 * 下面几项可选，不填就没有：
 * basic：关卡介绍只列基本规则（第 1 关还没教反弹、P0、压垮）
 * tips：看情况弹的提示（on 为触发条件名，见 game.js 的 TIP_CHECKS），每条每局只弹一次；每关只留一条，新东西第一次出现时弹
 * finale：收尾——t 秒时发群消息、开下午茶，老板给主角塞 pots 口锅，期限卡在 18:00
 * tutorial：带教段（时钟停在 09:00，做到了才往下走）。spots 是带教时各人站的位置；
 *           steps 每步 do 为动作名（做法见 game.js 的 TUT_STEPS），say 是老周说的话，say2 是动作完成后的下一句，
 *           alt 是主角不在老板视野里时 dodge 那步换的说法；{who} 换成刚被你甩中的同事
 * --------------------------------------------------------- */
exports.LEVELS = [
    {
        id: 1,
        name: '周一 · 入职第一天',
        theme: 'office',
        desc: '入职第一天，老周先带你走一遍。锅到点在谁身上谁背锅，18:00 背锅最少的前三名下班。',
        duration: 70,
        startPots: 1,
        potLife: 40,
        skyChance: 0,
        basic: true,
        bots: ['pm', 'intern', 'veteran'],
        leaders: [{ type: 'boss', route: 'boss' }],
        ai: { aggr: 0.5, parry: 0 },
        aiEnd: { aggr: 0.95, parry: 0.4, dodge: 1.1, focus: 0.4 },
        pace: [
            { t: 5, every: 9 },
            { t: 28, every: 7 },
            { t: 48, every: 5.5 },
        ],
        rushAt: 46,
        incidents: [{ t: 32, kind: 'rage' }],
        bursts: [],
        tips: [
            { on: 'seen', title: '领导视野', icon: ['boss_idle'], sub: '你站在老板的!红扇形!里', text: '先*走出去*再甩' },
        ],
        finale: { t: 58, pots: 4, msg: '【全员群】人事：下午茶到了，茶水间自取', say: '老板：下班前这几个你分一下' },
        tutorial: {
            spots: {
                ring: { x: 595, y: 745 },
                intern: { x: 640, y: 600 },
                veteran: { x: 380, y: 740 },
                pm: { x: 640, y: 880 },
                boss: { x: 765, y: 540 }, // 老板出来巡视停在这（离主角近一点，视野更容易同时罩住实习生和主角）
            },
            // 2026-11-03 带教提速：每句话砍短，步骤间等待减半
            steps: [
                { do: 'walk', say: '我是老周，今天带你。按住*左下摇杆*，走到*黄圈*。' },
                { do: 'sky', say: '站好，!老板点名了!。', say2: '这叫*天降锅*，!躲不掉!。锅有*截止时间*，快到点变黄、变红。' },
                { do: 'throw', say: '到点前甩出去，就不是你的锅。走到*新来的*跟前，扇形变~绿~就按「*甩*」。', say2: '~甩出去了~。' },
                { do: 'expire', say: '看好：锅*到点*在谁身上，谁*背锅*。', say2: '*{who}*背锅 +1，~你没事~。' },
                { do: 'sight', say: '老板面前的!红扇形!是*视野*。', say2: '在视野里甩锅会被*抓现行*：!锅不走，还要背锅!。' },
                { do: 'dodge', say: '又来一口。先*走出红扇形*，再甩给*会计*。', alt: '又来一口。别在!红扇形!里甩，甩给*会计*。' },
                { do: 'rank', say: '右上角是*名次*：炸了的锅算 1，身上没甩掉的算*半口*。*18:00 前三名*下班，越到下班大家越急。' },
            ],
        },
    },
    {
        id: 2,
        name: '周二 · 早会之后',
        theme: 'spring',
        desc: `老板派活更勤，同事也会反甩了。下午老板还要发一次火，身上攒满 12 口就压垮。`,
        duration: 120,
        startPots: 1,
        potLife: 26,
        skyChance: 0.3,
        bots: ['pm', 'intern', 'veteran'],
        leaders: [{ type: 'boss', route: 'boss' }],
        ai: { aggr: 0.9, parry: 0.7, dodge: 1.1, focus: 0.5 },
        aiEnd: { aggr: 1.5, parry: 1.35, dodge: 1.4, focus: 1.5 },
        leaderFocus: 0.3,
        pace: [
            { t: 6, every: 7 },
            { t: 40, every: 5.5 },
            { t: 80, every: 4.5 },
            { t: 107, every: 2.6 },
        ],
        rushAt: 90,
        incidents: [{ t: 64, kind: 'rage' }, { t: 98, kind: 'inspect' }],
        bursts: [
            { t: 30, src: 'meeting', n: 3, msg: '【全员群】行政：{time} 周会结束，散会！' },
            { t: 78, src: 'meeting', n: 4, msg: '【全员群】行政：{time} 销售会结束，大家辛苦' },
        ],
        events: { n: 1, window: [45, 100], pool: ['printer', 'tea', 'p0'] },
        news: [
            { icon: 'fx_impact', text: '同事学会反甩了；锅快砸中你时按「甩」，也能弹回去' },
            { icon: 'wok', text: '散会、打印机卡纸会喷锅，群里一预告就离远点' },
            { icon: 'boss_chase', text: '下午老板会发火：派锅又快又多，视野也更大' },
        ],
        // 教学横幅：title 黄色标签，icon [主图, 角标]（assets/px 里的名字），sub 小字，text 大字；*黄* !红! ~绿~ 是高亮
        tips: [
            { on: 'incoming', title: '反弹', icon: ['fx_impact'], sub: '同事的锅朝你飞来了', text: '快砸中时按「*甩*」，*弹回去*' },
        ],
    },
    {
        id: 3,
        name: '周三 · 开大会',
        theme: 'beach',
        desc: '经理一次丢两口！小舅子接锅就塞给别人，别当着老板的面甩他；他不占前三名额。',
        duration: 120,
        startPots: 2,
        potLife: 20,
        skyChance: 0.35,
        bots: ['pm', 'tester', 'intern', 'veteran', 'designer', 'nephew'],
        nephewRanked: false,
        leaders: [{ type: 'boss', route: 'boss' }, { type: 'director', route: 'director' }],
        ai: { aggr: 1.25, parry: 1.2, dodge: 1.15, sneak: 1.15, focus: 0.85 },
        aiEnd: { aggr: 1.7, parry: 1.6, dodge: 1.35, sneak: 1.35, focus: 1.6 },
        leaderFocus: 0.35,
        pace: [
            { t: 3, every: 4.8 },
            { t: 30, every: 3.9 },
            { t: 70, every: 3.1 },
            { t: 105, every: 1.8 },
        ],
        rushAt: 90,
        incidents: [{ t: 50, kind: 'inspect', who: 'director' }, { t: 84, kind: 'rage' }],
        bursts: [
            { t: 25, src: 'meeting', n: 5, msg: '【全员群】行政：{time} 月度总结会结束，散会！' },
            { t: 60, src: 'meeting', n: 6, msg: '【全员群】行政：{time} 总结会第二场结束' },
            { t: 95, src: 'meeting', n: 6, msg: '【全员群】行政：{time} 安全培训结束，记得签到' },
        ],
        events: { n: 3, window: [30, 108], pool: ['printer', 'tea', 'p0'] },
        news: [
            { icon: 'director_idle', text: '经理一次丢两口锅，他面前也有红扇形视野' },
            { icon: 'nephew_normal', text: '小舅子接锅就塞给别人；当着老板甩他会被护短' },
            { icon: 'director_chase', text: '经理会下来查岗：走到你跟前盯着，这时别甩' },
        ],
        tips: [
            { on: 'nephewAim', title: '小舅子', icon: ['nephew_normal'], sub: '老板正看着他', text: '别!当着老板!甩他' },
        ],
    },
    {
        id: 4,
        name: '周四 · 老板画饼',
        theme: 'autumn',
        desc: '老板上午、下午各画一次饼。出纳跟风甩锅；小舅子不占名额，其余 7 人争前三。',
        duration: 120, startPots: 3, potLife: 20, skyChance: 0.3,
        bots: ['pm', 'tester', 'intern', 'veteran', 'designer', 'nephew', 'cashier'],
        nephewRanked: false,
        leaders: [{ type: 'boss', route: 'boss' }, { type: 'director', route: 'director' }],
        ai: { aggr: 1.2, parry: 1.1, dodge: 1.15, sneak: 1.1, focus: 0.9 },
        aiEnd: { aggr: 1.6, parry: 1.5, dodge: 1.35, sneak: 1.3, focus: 1.6 },
        leaderFocus: 0.4,
        pace: [
            { t: 3, every: 4.8 }, { t: 30, every: 3.9 }, { t: 70, every: 3.1 },
            { t: 105, every: 1.8 },
        ],
        rushAt: 90,
        incidents: [{ t: 50, kind: 'inspect', who: 'director' }, { t: 86, kind: 'rage' }],
        // 09:00–18:00 对应 120 秒：22 秒约 10:39，74 秒约 14:33。
        pieMeetings: [{ t: 22, duration: 3.6, count: 4, life: 9 }, { t: 74, duration: 3.6, count: 4, life: 9 }],
        bursts: [
            { t: 38, src: 'meeting', n: 6, msg: '【全员群】行政：{time} 散会，活儿都领回去' },
            { t: 62, src: 'meeting', n: 7, msg: '【全员群】行政：{time} 盘点会结束' },
            { t: 98, src: 'meeting', n: 7, msg: '【全员群】行政：{time} 散会，下班前都交齐' },
        ],
        events: { n: 3, window: [35, 108], pool: ['printer', 'tea', 'p0'] },
        news: [
            { icon: 'cashier_normal', text: '新同事出纳：专挑刚被甩中的人，跟着落井下石' },
            { icon: 'pie', text: '老板开会画饼：捡饼多两口锅，换十秒鸡血' },
            { icon: 'fx_hype', text: '鸡血跑得快、甩得远；锅多、落后时再去抢' },
        ],
        tips: [
            { on: 'pies', title: '画饼', icon: ['pie'], sub: '踩到饼自动吃', text: '!多两口锅!，换~十秒鸡血~' },
        ],
    },
    {
        id: 5,
        name: '周五 · 老板娘查账', theme: 'winter',
        desc: '今天只有 2 个下班名额，小舅子占 1 个；把他压垮就空出一个。老板娘专查同事里的第 1 名。',
        duration: 120, startPots: 3, potLife: 19, skyChance: 0.12,
        passRank: 2, passStars: 3, nephewRanked: true,
        bots: ['pm', 'tester', 'intern', 'veteran', 'designer', 'nephew', 'cashier'],
        leaders: [{ type: 'boss', route: 'boss' }, { type: 'director', route: 'director' }, { type: 'wife', route: 'wife' }],
        ai: { aggr: 1.25, parry: 1.15, dodge: 1.2, sneak: 1.15, focus: 1.1 },
        aiEnd: { aggr: 1.65, parry: 1.55, dodge: 1.4, sneak: 1.35, focus: 1.8 },
        leaderFocus: 0.45,
        pace: [
            { t: 3, every: 4.4 }, { t: 30, every: 3.5 }, { t: 70, every: 2.8 },
            { t: 105, every: 2 },
        ],
        rushAt: 90,
        incidents: [{ t: 48, kind: 'inspect', who: 'director' }, { t: 86, kind: 'rage' }],
        pieMeetings: [{ t: 22, duration: 3.6, count: 4, life: 9 }, { t: 74, duration: 3.6, count: 4, life: 9 }],
        bursts: [
            { t: 38, src: 'meeting', n: 6, msg: '【全员群】行政：{time} 散会，账都对一遍' },
            { t: 62, src: 'meeting', n: 7, msg: '【全员群】行政：{time} 查账会结束' },
            { t: 98, src: 'meeting', n: 7, msg: '【全员群】行政：{time} 散会，下班前都交齐' },
        ],
        events: { n: 3, window: [35, 108], pool: ['printer', 'tea', 'p0'] },
        news: [
            { icon: 'wife_idle', text: '老板娘专查同事里的第 1 名，瞄准红线一出就躲' },
            { icon: 'wife_chase', text: '当着她甩中小舅子，背锅 +3；压垮他，姐姐会追你' },
            { icon: 'pie', text: '画饼、散会、查岗、老板发火今天全都有' },
        ],
        tips: [
            { on: 'nephewAim', title: '小舅子', icon: ['wife_chase'], sub: '他姐姐或老板正看着他', text: '当面甩他会被!护短!' },
        ],
    },
];
