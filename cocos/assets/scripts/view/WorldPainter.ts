// 对局常驻节点组织器：原型走路状态/遮挡/表现时钟不变；DrawSurface仅用于一次性静态地图。
import {Match} from '../core/match';
import {OFFICE} from '../core/levels';
import {Agent, Leader, Rect} from '../core/types';
import {CLOSING_BELL_TIME, MAX_POTS, POT_ALARM} from '../core/config';
import {DrawSurface} from './DrawSurface';
import {SpriteTools} from './SpriteTools';
import {WorldAssets} from './WorldAssets';
import {RetainedWorld} from './RetainedWorld';
import {MatchNode} from './MatchNodes';
interface Pose {name: string; flip?: boolean; dir?: string; walking?: boolean}
interface Walk {x: number; y: number; vx: number; vy: number; dir: string; flip: boolean; dist: number; still: number}
interface Floor {base: string; alt: string; line: string; size: number; wood?: boolean}
// 对局世界独立闭包：不在人物/领导状态上挂 walk，不使用 core 随机流。
export function createWorldPainter(m: Match, main: DrawSurface, floorLayer: DrawSurface, propsLayer: DrawSurface, teaLayer: DrawSurface, assets: WorldAssets, mapReady=false) {
 let ctx = main;
 const retained=assets.matchTexture?new RetainedWorld(m,assets,main.root):undefined;
 const st = main, E = new SpriteTools(assets);
 let shake = 0;
 const walks = new WeakMap<object, Walk>();
 // 走路缓存由画面持有，参数数值保持原型。
 function saveWalk(o: object, w: Walk): Walk {walks.set(o, w); return w;}
 const floats: {text: string; x: number; y: number; color: string; life: number}[] = [];
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

  // 世界根只跟随镜头平移；语义层的顺序在构造时固定，每帧不begin/end或遍历隐藏池槽。
  const teaNode=retained?new MatchNode(teaLayer.root,'AfternoonTea',retained.atlas):undefined;
  const people:(Agent|Leader)[]=[...m.S.agents,...m.S.leaders],initialOrder=new Map(people.map((p,i)=>[p,i]));
  const yOf=(p:Agent|Leader)=>'sn'in p?p.sn.y:p.y;
  function draw(time:number):void {
    if(!retained)return;
    const me=m.S.player.sn,W=OFFICE.world,camX=W.w<st.width?(W.w-st.width)/2:E.clamp(me.x-st.width/2,0,W.w-st.width),camY=W.h<st.height?(W.h-st.height)/2:E.clamp(me.y-st.height/2,0,W.h-st.height);
    let offsetX=0,offsetY=0;if(shake>0){offsetX=E.fxRand(-shake,shake);offsetY=E.fxRand(-shake,shake);shake*=.86;if(shake<.5)shake=0;}
    const x=-camX+offsetX,y=-camY+offsetY;floorLayer.root.setPosition(x,-y);propsLayer.root.setPosition(x,-y);
    teaNode!.show(m.S.tea>0);if(m.S.tea>0){teaNode!.at(x,y);teaNode!.child('highlight').rect(0,1216,300,224,'rgba(47,158,107,'+(.18+.1*Math.sin(time*6))+')');teaNode!.child('text').text('下午茶',OFFICE.tea.x,OFFICE.tea.y-60,18,'#2F9E6B');}
    retained.camera(x,y,st.width,st.height);retained.ground.at(x,y);retained.vision(time);retained.tails.at(x,y);for(const a of m.S.agents)retained.tail(a,time);
    retained.actors.at(x,y);retained.measure=main.metrics;retained.beginActors();people.sort((a,b)=>yOf(a)-yOf(b)||initialOrder.get(a)!-initialOrder.get(b)!);
    for(const person of people)if('sn'in person){const hunting=!person.isPlayer&&!person.crushed&&person.target===m.S.player&&m.potsOf(person)>0;retained.person(person,personSprite(person,hunting),time);}else retained.leader(person,leaderSprite(person),time);
    retained.above.at(x,y);retained.aimLines(time);retained.effects.at(x,y);retained.flight(time);retained.speech.at(x,y);retained.speeches(floats,camX,camY,st.width,st.height);retained.hints(camX,camY,st.width,st.height);
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
   nodes:retained,
   destroy() {if(teaNode){teaNode.node.removeFromParent();teaNode.destroy();}retained?.destroy();},
   draw(time: number) { draw(time); },
   advance(dt: number) {for (const f of floats) {f.life -= dt; f.y -= 38 * dt;} for (let i = floats.length - 1; i >= 0; i--) if (floats[i].life <= 0) floats.splice(i, 1);},
   event(kind: string, args: unknown[]) {if (kind === 'shake') shake = args[0] as number; if (kind === 'floats') {const [text, x, y, color] = args as [string, number, number, string?]; floats.push({text, x, y, color: color || '#1F2A44', life: 1.1});}},
 };
}
