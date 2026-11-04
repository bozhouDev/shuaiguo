// 忠实翻译 js/game.js drawWok～draw、drawPieSpeech；所有几何顺序和数值保持原型。
import {Match} from '../core/match';
import {OFFICE} from '../core/levels';
import {Agent, Leader, Rect, Fx, Pie} from '../core/types';
import {AIM_RANGE, AIM_TIME, CLOSING_BELL_TIME, DUE_WARN, DUE_DANGER, MAX_POTS, POT_ALARM} from '../core/config';
import {DrawSurface} from './DrawSurface';
import {SpriteTools} from './SpriteTools';
import {WorldAssets} from './WorldAssets';
interface Pose {name: string; flip?: boolean; dir?: string; walking?: boolean}
interface Walk {x: number; y: number; vx: number; vy: number; dir: string; flip: boolean; dist: number; still: number}
interface Floor {base: string; alt: string; line: string; size: number; wood?: boolean}
// 对局世界独立闭包：不在人物/领导状态上挂 walk，不使用 core 随机流。
export function createWorldPainter(m: Match, main: DrawSurface, floorLayer: DrawSurface, propsLayer: DrawSurface, teaLayer: DrawSurface, assets: WorldAssets, mapReady=false) {
 let ctx = main;
 const st = main, inp = m.inp, E = new SpriteTools(assets);
 const FOOT_DY = 20, PLAYER_H = 70, NPC_H = 64, FLAT_W = 74;
 let shake = 0;
 const walks = new WeakMap<object, Walk>();
 // 走路缓存由画面持有，参数数值保持原型。
 function saveWalk(o: object, w: Walk): Walk {walks.set(o, w); return w;}
 const floats: {text: string; x: number; y: number; color: string; life: number}[] = [];
 // 跟随式爆炸只读人物当前位置。
 function fxPos(e: Fx) {return e.follow ? {x: e.follow.sn.x + e.dx!, y: e.follow.sn.y + e.dy!} : e;}
 // 飘字复刻原型颜色、速度和寿命，但不推进 core.floats。
 function drawFloats() {for (const f of floats) {ctx.globalAlpha = Math.min(1, f.life * 2); E.label(ctx, f.text, f.x, f.y, 17, f.color);} ctx.globalAlpha = 1;}
 const POT_EXPLOSION = 'pot-cartoon-pow-bd83d9f0';
  // 画一口锅：像素锅（带手柄，所以整体放大 WOK_K 倍）+ 便利贴上的字
  const WOK_K = 1.25;
  const POT_SCALE = 0.8; // 所有锅（背着的、飞着的、P0）统一缩放；只影响画面，不影响判定
  function drawWok(x: number, y: number, label: string, size: number, rot?: number, alpha?: number | null) {
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
  function drawFlyingWok(x: number, y: number, label: string, size: number, a: number) {
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
  function drawHotPot(x: number, y: number, time: number, left: number | null) {
    const r = 26 + Math.sin(time * 14) * 3;
    ctx.fillStyle = 'rgba(232,80,74,.35)';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    drawWok(x, y, '急件', 42, Math.sin(time * 10) * 0.2);
    if (left != null) E.label(ctx, String(Math.ceil(left)), x + 22, y - 18, 18, '#E8504A');
  }
  // 主角头顶右侧：最急那口锅快到点时，标一个闹钟倒计时（黄 → 红）
  function drawDueTag(a: Agent) {
    if (a.crushed || !m.potsOf(a)) return;
    const left = m.urgentLeft(a);
    if (left >= DUE_WARN) return;
    E.drawSprite(ctx, 'ui_clock', a.sn.x + 20, a.sn.y - 46, 14);
    E.label(ctx, String(Math.max(0, Math.ceil(left))), a.sn.x + 36, a.sn.y - 46, 13, '#FFFDF5', left < DUE_DANGER ? '#E8504A' : '#C98A00');
  }
  // 画某人背着的锅（从尾到头）：快到点的锅底下发黄光 / 红光，红了还冒烟；玩家自己的锅标剩余秒数
  function drawTail(a: Agent, time: number) {
    const pos = a.sn.positions();
    const size = a.isPlayer ? 38 : 32;
    for (let i = pos.length - 1; i >= 0; i--) {
      const pot = a.sn.segs[i], q = pos[i];
      if (!pot || !q) continue;
      const left = pot.due - m.S.t, danger = pot.hot || left < DUE_DANGER;
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
  function walkFrame(o: object, base: string, x: number, y: number) {
    const w = walks.get(o) || saveWalk(o, { x, y, vx: 0, vy: 0, dir: 'd', flip: false, dist: 0, still: 99 });
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
  function personSprite(a: Agent, huntingMe: boolean) {
    const base = a.p.sprite, pots = m.potsOf(a);
    const walk = walkFrame(a, base, a.sn.x, a.sn.y);
    let st = null;
    if (a.isPlayer) {
      if (m.mode === 'closing' && m.S.closing!.t >= CLOSING_BELL_TIME) st = m.S.closing!.passed ? 'win' : 'panic';
      else if (m.mode === 'over' && pots >= MAX_POTS) st = 'crushed';
      else if (a.stun > 0) st = 'panic';
    }
    else if (a.crushed) st = a.key === 'nephew' ? 'crushed' : 'flat';
    else if (a.stun > 0 || a.angry > 1.4) st = 'hit'; // 刚接锅的前 0.6 秒显示被砸中
    else if (a.teaT > 0) st = 'tea';
    if (!st && a.key === 'nephew' && walk && !walk.walking) st = 'phone';
    if (!st && walk) return walk;
    // 没有走路帧时退回旧的单张姿势
    if (!st) st = a.isPlayer ? (pots >= POT_ALARM ? 'panic' : 'normal') : a.cry > 0 ? 'cry' : (huntingMe || a.angry > 0) ? 'angry' : 'normal';
    const name = `${base}_${st}`;
    return { name: E.spr[name] ? name : `${base}_normal`, flip: false, dir: 'd', walking: false };
  }
  // 脚下的影子
  function drawShadow(x: number, y: number, rx: number, color?: string) {
    ctx.fillStyle = color || 'rgba(31,42,68,.22)';
    ctx.beginPath(); ctx.ellipse(x, y, rx, rx * 0.34, 0, 0, Math.PI * 2); ctx.fill();
  }
  // 头顶 / 脸上的状态特效：晕（愣住）、怒（追人）、汗（锅太多）、泪（实习生哭）
  function drawStatusFx(a: Agent, spr: Pose, x: number, top: number, h: number, time: number, angry: boolean) {
    if (a.stun > 0) E.drawSprite(ctx, 'fx_dizzy', x, top - 12, 30, { rot: time * 5 });
    if (angry) E.drawSprite(ctx, 'fx_anger', x + 20, top + 6 + Math.sin(time * 12) * 2, 18);
    // 汗：锅快堆满，或者急着下班的同事（看着就慌）
    if (m.potsOf(a) >= POT_ALARM - 1 || (m.S.rushHour && !a.isPlayer && !a.crushed)) E.drawSprite(ctx, 'fx_sweat', x - 22, top + 10 + (time * 24) % 6, 16);
    // 泪：正面画两股，侧面缩小挪到脸朝的那一侧；背面看不到脸不画
    if (a.cry > 0 && spr.dir === 'd') E.drawSprite(ctx, 'fx_tears', x, top + h * 0.4, h * 0.42);
    else if (a.cry > 0 && spr.dir === 's') E.drawSprite(ctx, 'fx_tears', x + (spr.flip ? -1 : 1) * h * 0.1, top + h * 0.38, h * 0.26);
  }
  // 头顶锅数徽标：像素小锅 + 数字
  function drawPotBadge(x: number, y: number, pots: number) {
    E.drawSprite(ctx, 'ui_wok', x - 8, y, 16);
    E.label(ctx, String(pots), x + 6, y, 12, pots >= POT_ALARM ? '#E8504A' : '#1F2A44');
  }
  // 画某人（全身像素小人，含状态特效）；(sn.x, sn.y) 是身体中心，脚底在 FOOT_DY 之下
  function drawHead(a: Agent, time: number) {
    const x = a.sn.x, y = a.sn.y, pots = m.potsOf(a), foot = y + FOOT_DY;
    const huntingMe = !a.isPlayer && !a.crushed && a.target === m.S.player && pots > 0;
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
    // 绿圈表示能力增益；吃饼多出的锅另用红色提示，不把危险也涂绿。
    if (m.hyped(a)) E.drawSprite(ctx, 'fx_hype', x, foot - h / 2, 72 + Math.sin(time * 9) * 3);
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
  function leaderSprite(l: Leader) {
    const base = l.cfg.sprite, walk = walkFrame(l, base, l.x, l.y);
    if (l.meeting) return { name: `${base}_idle` };
    if (l.state === 'aim') return { name: `${base}_aim` };
    if (l.state !== 'chase' && l.wait > 0) return { name: `${base}_idle` };
    // 发火时用追人的怒气姿势（有这张图才换）
    if (m.raging(l) && E.spr[`${base}_chase`]) return { name: `${base}_chase`, flip: walk ? walk.flip : false };
    return walk || { name: `${base}_${l.state === 'chase' ? 'chase' : 'walk'}` };
  }
  // 画领导（含危险圈）；领导的锅直接画在贴图手里（瞄准姿势）
  function drawLeader(l: Leader, time: number) {
    const chase = l.state === 'chase' || m.raging(l), foot = l.y + 28, h = l.cfg.h; // 发火和追人一样画红圈、冒火
    ctx.setLineDash([7, 6]); ctx.strokeStyle = chase ? '#E8504A' : 'rgba(232,80,74,.5)'; ctx.lineWidth = chase ? 4 : 2;
    ctx.beginPath(); ctx.arc(l.x, l.y, 46, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    drawShadow(l.x, foot, 26);
    const spr = leaderSprite(l);
    const shake = l.state === 'aim' ? Math.sin(time * 30) * 1.2 : 0;
    E.drawStanding(ctx, spr.name, l.x + shake, foot, h, { flip: spr.flip });
    // 老板脚下的白底红字名牌，宽度随称呼变化；自定义汉字可使用系统字体回退。
    ctx.save();
    ctx.font = 'bold 16px "ZCOOL KuaiLe", "PingFang SC", sans-serif';
    const nameWidth = Math.ceil(ctx.measureText(l.name).width) + 16;
    ctx.fillStyle = '#FFFDF5'; ctx.strokeStyle = '#1F2A44'; ctx.lineWidth = 2;
    ctx.fillRect(l.x - nameWidth / 2, foot + 5, nameWidth, 28);
    ctx.strokeRect(l.x - nameWidth / 2, foot + 5, nameWidth, 28);
    ctx.fillStyle = '#E8504A'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(l.name, l.x, foot + 19); ctx.restore();
    if (chase) {
      E.drawSprite(ctx, 'fx_anger', l.x + 24, foot - h + 8 + Math.sin(time * 12) * 2, 22);
      E.label(ctx, '！', l.x - 26, foot - h - 4, 26, '#E8504A');
    }
    // 查岗：头顶挂个「查岗」牌子，提醒他是冲你来的
    if ((l.inspectUntil || 0) > m.S.t) E.label(ctx, '查岗', l.x, foot - h - 14, 18, '#E8504A');
  }
  // 瞄准线：领导丢锅前，从领导到目标的红色虚线 + 目标头上的准星
  function drawAims(time: number) {
    for (const l of m.S.leaders) {
      if (l.state !== 'aim') continue;
      for (const t of l.targets) {
        const k = 1 - l.aimT / (l.cfg.aimTime ?? AIM_TIME);
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
  const FLOORS: Record<string, Floor> = {
    carpet: { base: '#BCCBDD', alt: '#B2C2D6', line: '#A5B6CC', size: 48 },
    wood:   { base: '#D9B98C', alt: '#CFAE80', line: '#B08A5E', size: 24, wood: true },
    lilac:  { base: '#D7CCE8', alt: '#CDC1E0', line: '#B9ABD0', size: 48 },
    mint:   { base: '#CFE6D6', alt: '#C3DDCB', line: '#A9C9B3', size: 32 },
  };
  // 每关主题配色（关卡里的 theme 字段）：地图不变，换工位区地毯、三间房的地面和墙的颜色
  // 地面保持低饱和、浅色，高饱和颜色留给人物、锅和特效（见 DESIGN.md §3.2）
  // 三间房各自的地面要和工位区地毯分得开，玩家靠颜色认出会议室（wood）、老板办公室（lilac）、茶水间（mint）
  // wall：墙顶面 top、顶边高光 hi、正面 face；描边固定用墨蓝，不随主题变
  const WALL = { top: '#7F8FB0', hi: '#9DACCB', face: '#4C5A7A' };
  const THEMES: Record<string, Partial<Record<string, any>>> = {
    office: {},                                                                                // 默认办公：原色
    spring: {                                                                                  // 春日绿意：浅草绿地毯、樱花粉老板办公室、鼠尾草绿墙
      carpet: { base: '#CFE0BF', alt: '#C5D8B3', line: '#B2C79D', size: 48 },
      wood:   { base: '#E3CA9C', alt: '#D9BF90', line: '#BC9F6E', size: 24, wood: true },
      lilac:  { base: '#EDD5DD', alt: '#E5CAD4', line: '#D3B2BE', size: 48 },
      mint:   { base: '#EFE6C4', alt: '#E7DDB7', line: '#D2C69A', size: 32 },
      wall:   { top: '#8FAE8A', hi: '#AEC8A7', face: '#5C7A58' },
    },
    beach: {                                                                                   // 海滨度假：浅沙色地毯、海蓝墙、浅水色房间
      carpet: { base: '#EBDDBE', alt: '#E3D3B0', line: '#D0BD94', size: 48 },
      wood:   { base: '#C9A273', alt: '#BE9667', line: '#9C764A', size: 24, wood: true },
      lilac:  { base: '#CFE3EC', alt: '#C4DBE6', line: '#A9C6D4', size: 48 },
      mint:   { base: '#C8E8E0', alt: '#BCE0D7', line: '#A0CBC0', size: 32 },
      wall:   { top: '#6FA5B5', hi: '#94C2CE', face: '#437786' },
    },
    autumn: {                                                                                  // 秋日枫叶：浅橘色地毯、枫红砖墙、深胡桃木会议室
      carpet: { base: '#EBCFAE', alt: '#E3C49F', line: '#CFAA80', size: 48 },
      wood:   { base: '#BC8E62', alt: '#B18357', line: '#8E663F', size: 24, wood: true },
      lilac:  { base: '#EADBA8', alt: '#E2D19A', line: '#CCB977', size: 48 },
      mint:   { base: '#DCDDB8', alt: '#D2D4AB', line: '#B9BB8C', size: 32 },
      wall:   { top: '#B07A5E', hi: '#C99B81', face: '#7A4A36' },
    },
    winter: {                                                                                  // 冬日雪景：冰蓝白地毯、雪白墙、暖松木会议室
      carpet: { base: '#DCE8F2', alt: '#D2E0EC', line: '#BBCCDC', size: 48 },
      wood:   { base: '#DDBF94', alt: '#D3B488', line: '#B5955F', size: 24, wood: true },
      lilac:  { base: '#DCD6EC', alt: '#D2CBE5', line: '#BAB1D2', size: 48 },
      mint:   { base: '#D3ECE3', alt: '#C7E4D9', line: '#A9CDBF', size: 32 },
      wall:   { top: '#E4EBF3', hi: '#FFFFFF', face: '#93A3BA' },
    },
  };
  // 取某种地砖的配色：当前关的主题里有就用主题的，没有就用默认
  function floorOf(tile: string) {
    const t = THEMES[m.L.theme] || THEMES.office;
    return t[tile] || FLOORS[tile] || FLOORS.carpet;
  }
  // 取当前关的墙配色，主题没写就用默认蓝灰
  const wallOf = () => (THEMES[m.L.theme] || THEMES.office).wall || WALL;
  // 画一块像素地面（房间或整层），r.tile 指定地砖类型
  function drawFloor(r: Rect & {tile: string}) {
    const f = floorOf(r.tile), n = f.size;
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
  function drawWall(w: Rect) {
    const face = w.w > w.h ? Math.min(8, w.h / 2) : 0; // 横墙才露出正面
    ctx.fillStyle = '#1F2A44'; ctx.fillRect(w.x - 2, w.y - 2, w.w + 4, w.h + 4 + face);
    const c = wallOf();
    ctx.fillStyle = c.top; ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.fillStyle = c.hi; ctx.fillRect(w.x, w.y, w.w, 3);
    if (face) { ctx.fillStyle = c.face; ctx.fillRect(w.x, w.y + w.h, w.w, face); }
  }

  function draw(time: number) {
    const me = m.S.player.sn, W = OFFICE.world;
    const camX = W.w < st.width ? (W.w - st.width) / 2 : E.clamp(me.x - st.width / 2, 0, W.w - st.width);
    const camY = W.h < st.height ? (W.h - st.height) / 2 : E.clamp(me.y - st.height / 2, 0, W.h - st.height);

    ctx.save();
    let offsetX = 0, offsetY = 0;
    if (shake > 0) { offsetX = E.fxRand(-shake, shake); offsetY = E.fxRand(-shake, shake); shake *= 0.86; if (shake < 0.5) shake = 0; }
    ctx.translate(offsetX, offsetY);
    ctx.translate(-camX, -camY);

    floorLayer.root.setPosition(-camX + offsetX, camY - offsetY);
    const dynamic = ctx;
    ctx = teaLayer; ctx.begin(); ctx.save(); ctx.translate(-camX + offsetX, -camY + offsetY);
    // 下午茶：茶水间高亮
    if (m.S.tea > 0) {
      ctx.fillStyle = `rgba(47,158,107,${0.18 + 0.1 * Math.sin(time * 6)})`;
      ctx.fillRect(0, 1216, 300, 224);
      // 尚无独立奶茶像素图，保留绿字提示与茶水间高亮，不用系统图标。
      E.label(ctx, '下午茶', OFFICE.tea.x, OFFICE.tea.y - 60, 18, '#2F9E6B');
    }
    ctx.restore(); ctx.end(); ctx = dynamic;
    propsLayer.root.setPosition(-camX + offsetX, camY - offsetY);
    // 饼是地面拾取物，宽 40px；最后两秒闪烁提示即将消失。
    for (const pie of m.S.pies) E.drawSprite(ctx, 'pie', pie.x, pie.y, 40, { alpha: pie.expires - m.S.t < 2 ? 0.6 + 0.4 * Math.sin(time * 10) : 1 });
    // 带教黄圈：画在脚下，一胀一缩
    if (m.S.tut && m.S.tut.ring) {
      const r = m.S.tut.ring, k = Math.sin(time * 5) * 4, fy = r.y + FOOT_DY;
      ctx.lineWidth = 7; ctx.strokeStyle = '#1F2A44';
      ctx.beginPath(); ctx.ellipse(r.x, fy, 34 + k, 14 + k * 0.4, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 4; ctx.strokeStyle = '#FFD84D'; ctx.stroke();
      E.label(ctx, '走到这', r.x, fy - 34 - k, 13, '#1F2A44', '#FFD84D');
    }
    // 预警中的锅（散会 / 打印机门口的红圈）
    for (const f of m.S.flying) {
      if (f.phase !== 'warn') continue;
      const k = 1 - f.t / Math.max(0.01, f.warn0);
      ctx.strokeStyle = '#E8504A'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(f.x, f.y, 14 + k * 20, 0, Math.PI * 2); ctx.stroke();
      E.label(ctx, '!', f.x, f.y, 24, '#E8504A');
    }

    // 领导视野：面前一块淡红扇形；主角在里面时加深
    const P = m.S.player, eye = P.crushed ? null : m.seenBy(P);
    for (const l of m.S.leaders) {
      const on = eye === l, mad = m.raging(l); // 发火时扇形更大、颜色更深
      ctx.fillStyle = `rgba(232,80,74,${on ? 0.24 : mad ? 0.2 : 0.12})`;
      ctx.strokeStyle = `rgba(232,80,74,${on || mad ? 0.8 : 0.35})`; ctx.lineWidth = mad ? 3 : 2;
      ctx.beginPath(); ctx.moveTo(l.x, l.y);
      ctx.arc(l.x, l.y, m.visionRange(l), l.face - m.visionCone(l), l.face + m.visionCone(l));
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    // 瞄准扇形：身上有锅时，在前方画出自动瞄准的扇形；扇形里有人就变绿并套住他；在领导视野里变红
    if (!P.crushed && m.potsOf(P)) {
      const b = P.aimTgt, ready = m.canFire(P);
      // 领导在看：红色；有目标且能甩：绿色；扇形里没人：白色；冷却中：灰色（像素地板很花，透明度要够）
      const col = eye ? '232,80,74' : !ready ? '94,106,132' : b ? '47,158,107' : '255,253,245';
      ctx.fillStyle = `rgba(${col},${b && ready ? 0.3 : 0.24})`;
      ctx.strokeStyle = `rgba(${col},.9)`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(me.x, me.y);
      ctx.arc(me.x, me.y, m.aimRange(P), me.angle - m.aimCone(P), me.angle + m.aimCone(P));
      ctx.closePath(); ctx.fill(); ctx.stroke();
      if (b) {
        ctx.strokeStyle = ready ? 'rgba(47,158,107,.95)' : 'rgba(94,106,132,.7)'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(b.sn.x, b.sn.y, 30 + Math.sin(time * 10) * 3, 0, Math.PI * 2); ctx.stroke();
        if (ready && !eye) E.label(ctx, '甩他!', b.sn.x, b.sn.y - 58, 13, '#FFFDF5', '#2F9E6B');
      }
    }
    // 来锅预警：有人甩的锅正朝你飞来，红圈收紧；进入反甩窗口时变实心提示「按甩！」
    let incoming = Infinity, inWin = false;
    for (const f of m.S.throws) {
      if (f.owner === P) continue;
      const t = m.incomingTTI(f, P);
      if (t < incoming) { incoming = t; inWin = t <= m.parryWin(f); }
    }
    if (incoming < 0.6) {
      ctx.strokeStyle = '#E8504A'; ctx.lineWidth = inWin ? 5 : 3;
      ctx.beginPath(); ctx.arc(me.x, me.y, 26 + incoming * 60, 0, Math.PI * 2); ctx.stroke();
      if (inWin) E.label(ctx, '按甩!', me.x, me.y - 62, 16, '#FFFDF5', '#E8504A');
    }

    // 所有人的锅尾巴先画（压在所有人头下面），再按 y 排序画头和领导
    for (const a of m.S.agents) drawTail(a, time);
    const people = m.S.agents.map((a) => ({ y: a.sn.y, f: () => drawHead(a, time) }));
    for (const l of m.S.leaders) people.push({ y: l.y, f: () => drawLeader(l, time) });
    people.sort((a, c) => a.y - c.y).forEach((p) => p.f());
    drawDueTag(P);
    // 「X在看！」画在人物之后、扇形中段，免得被领导挡住
    if (eye && m.potsOf(P)) E.label(ctx, `${eye.name}在看！`, me.x + Math.cos(me.angle) * AIM_RANGE * 0.6, me.y + Math.sin(me.angle) * AIM_RANGE * 0.6, 14, '#FFFDF5', '#E8504A');
    drawAims(time);

    // 飞行中的锅
    for (const f of m.S.flying) {
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
    for (const f of m.S.throws) {
      ctx.strokeStyle = f.owner.isPlayer ? 'rgba(47,158,107,.55)' : 'rgba(232,80,74,.45)';
      ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(f.x - Math.cos(f.a) * 46, f.y - Math.sin(f.a) * 46); ctx.lineTo(f.x, f.y); ctx.stroke();
      ctx.lineCap = 'butt';
      if (f.hot) drawHotPot(f.x, f.y, time, null);
      else drawFlyingWok(f.x, f.y, f.label, 40, f.a);
    }

    // 甩锅飞行动画（抛物线）
    for (const a of m.S.arcs) {
      if (a.t < 0) continue;
      const k = Math.min(1, a.t / a.dur);
      const to = a.to();
      const x = a.x0 + (to.x - a.x0) * k;
      const y = a.y0 + (to.y - a.y0) * k - Math.sin(Math.PI * k) * 50;
      drawWok(x, y, a.label, 34, k * 8);
    }

    // 一次性特效：先弹大再回落，后半段淡出
    for (const e of m.S.fx) {
      const k = e.t / e.dur;
      const at = fxPos(e);
      if (e.name === 'pot_explosion') {
        const sheet = E.spr[POT_EXPLOSION];
        if (sheet) {
          // 按实际经过时间取帧，不循环、不旋转；禁用插值保留硬像素边缘。
          const frame = Math.min(32, Math.floor(e.t * 30));
          ctx.save();
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(sheet.canvas, frame % 6 * 184, Math.floor(frame / 6) * 144, 184, 144,
            at.x - e.size / 2, at.y - e.size * 72 / 184, e.size, e.size * 144 / 184);
          ctx.restore();
        } else E.drawSprite(ctx, 'fx_impact', at.x, at.y, e.size * 0.5, { alpha: 1 - k });
        continue;
      }
      const sc = k < 0.25 ? 0.5 + k * 2.6 : 1.15 - (k - 0.25) * 0.3;
      E.drawSprite(ctx, e.name, at.x, at.y, e.size * sc, { alpha: k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4, rot: k * 0.5 });
    }

    for (const l of m.S.leaders) if (l.meeting || (l.pieSayUntil || 0) > m.S.t) drawPieSpeech(l, camX, camY);
    for (const a of m.S.agents) if (!a.crushed && (a.pieSayUntil || 0) > m.S.t) drawPieSpeech(a, camX, camY);
    drawFloats();
    ctx.restore();

    // 屏幕外提示：领导、P0、冲你来的同事、可甩锅的同事
    // 角标用各人自己的像素头像；圈的颜色表示状态（红 = 领导 / 冲你来，绿 = 能甩给他，灰 = 刚接锅甩不了）
    for (const l of m.S.leaders) E.edgeHint(ctx, st, l.x - camX, l.y - camY, { sprite: `${l.cfg.sprite}_idle` }, '#E8504A');
    for (const b of m.S.bots) {
      if (b.crushed) continue;
      const hunting = b.target === P && m.potsOf(b) > 0;
      const color = hunting ? '#E8504A' : m.canThrowTo(P, b) ? '#2F9E6B' : '#9AA6C4';
      E.edgeHint(ctx, st, b.sn.x - camX, b.sn.y - camY, { sprite: `${b.p.sprite}_normal` }, color, hunting ? 'fx_anger' : null);
    }
    for (const b of m.S.bots) if (!b.crushed && m.holdsHot(b)) E.edgeHint(ctx, st, b.sn.x - camX, b.sn.y - camY, {sprite: 'wok', whole: true}, '#E8504A');
    // 地上有饼时只指最近的一张，黄圈表示「可选的主动操作」，吃不吃由玩家自己定
    const pie = m.S.pies.reduce<Pie | null>((best, p) => !best || E.dist(P.sn.x, P.sn.y, p.x, p.y) < E.dist(P.sn.x, P.sn.y, best.x, best.y) ? p : best, null);
    if (pie) E.edgeHint(ctx, st, pie.x - camX, pie.y - camY, { sprite: 'pie', whole: true }, '#FFD84D');
    E.drawStick(ctx, inp);
  }


  // 头顶承诺气泡，两行最多各 13 个字；硬边奶油白底，不用柔光。
  function drawPieSpeech(o: Agent | Leader, camX: number, camY: number) {
    const ox = 'sn' in o ? o.sn.x : o.x, oy = 'sn' in o ? o.sn.y : o.y;
    if (ox < camX - 30 || ox > camX + st.width + 30 || oy < camY || oy > camY + st.height) return;
    const text = o.pieSay || '', lines = text.length > 13 ? [text.slice(0, 13), text.slice(13)] : [text];
    const width = Math.min(13, text.length) * 12 + 16, height = lines.length * 17 + 12;
    // 靠近屏幕边缘时把气泡收进视口，避免承诺被裁掉；不替屏外人物弹气泡。
    const x = E.clamp(ox, camX + width / 2 + 6, camX + st.width - width / 2 - 6);
    const y = Math.max(camY + 78 + height, oy - ('sn' in o ? 68 : 116));
    ctx.fillStyle = '#1F2A44'; ctx.fillRect(x - width / 2 - 2, y - height - 2, width + 4, height + 4);
    ctx.fillStyle = '#FFFDF5'; ctx.fillRect(x - width / 2, y - height, width, height);
    ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.lineTo(x, y + 7); ctx.lineTo(x + 5, y); ctx.fill();
    lines.forEach((line, i) => E.label(ctx, line, x, y - height + 14 + i * 17, 12, '#1F2A44', 'rgba(0,0,0,0)'));
  }


 // 静态节点只初始化一次，每帧仅改变根节点相机偏移。
 function buildMap() {
   ctx = floorLayer; ctx.begin();
    // 办公区地毯 + 各房间地面（像素地砖）
    drawFloor({ x: 0, y: 0, w: OFFICE.world.w, h: OFFICE.world.h, tile: 'carpet' });
    for (const r of OFFICE.rooms) drawFloor(r);
    for (const r of OFFICE.rooms) {
      ctx.globalAlpha = 0.35;
      E.label(ctx, r.name, r.x + r.w / 2, r.y + r.h - 34, 22, '#1F2A44', 'rgba(0,0,0,0)');
      ctx.globalAlpha = 1;
    }
   ctx.end();
   ctx = propsLayer; ctx.begin();
    // 墙：顶面 + 一条正面（3/4 俯视的厚度）
    for (const w of OFFICE.walls) drawWall(w);

    // 摆设
    for (const p of OFFICE.props) {
      const s = E.spr[p.sprite];
      if (!s) continue;
      E.drawSprite(ctx, p.sprite, p.x + p.w / 2, p.y + (p.w * s.h / s.w) / 2, p.w);
    }

   ctx.end(); ctx = main;
 }
 if(!mapReady)buildMap();
 return {
   draw(time: number) { main.begin(); draw(time); main.end(); },
   advance(dt: number) {for (const f of floats) {f.life -= dt; f.y -= 38 * dt;} for (let i = floats.length - 1; i >= 0; i--) if (floats[i].life <= 0) floats.splice(i, 1);},
   event(kind: string, args: unknown[]) {if (kind === 'shake') shake = args[0] as number; if (kind === 'floats') {const [text, x, y, color] = args as [string, number, number, string?]; floats.push({text, x, y, color: color || '#1F2A44', life: 1.1});}},
 };
}
