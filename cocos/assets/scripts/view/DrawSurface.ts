import {Color, Graphics, Label, Layers, Mask, Node, Sprite, UITransform} from 'cc';
import {WorldAssets, Picture} from './WorldAssets';
import {UI_METRICS} from './ui-metrics';
import {displayText} from './ui-data';

// EditBox先更新自己的Label再发文字事件；只在自建输入Label上过滤，避免输入瞬间借用emoji字体。
export function guardLabelText(label: Label): void {
  const property = Object.getOwnPropertyDescriptor(Label.prototype, 'string')!;
  Object.defineProperty(label, 'string', {configurable: true, get() {return property.get!.call(this);}, set(value: string) {property.set!.call(this, displayText(value));}});
}

type Matrix = [number, number, number, number, number, number];
type Point = {x: number; y: number};
type Clip = {x: number; y: number; w: number; h: number} | {cx: number; cy: number; r: number};
interface Style {matrix: Matrix; alpha: number; fill: string; stroke: string; width: number; font: string; clip?: Clip; group?: Node; dash: number[]}
interface Geometry {fill: boolean; paths: Point[][]; closed: boolean[]; ink: string; alpha: number; width: number; cap: string; dash: number[]}
interface Entry {shape?: (string | number)[]; node: Node; graphic?: Graphics; sprite?: Sprite; label?: Label; mask?: Mask; child?: Node}

// 原型坐标（左上为原点、Y 向下）到 Cocos 节点的轻量绘制门面；不用 DOM 或 Canvas 纹理。
// 连续几何操作共用一个 Graphics；Sprite、Label 按类型复用节点池，顺序保持原型 draw 调用顺序。
export class DrawSurface {
  private state: Style = this.initial();
  private stack: Style[] = [];
  private paths: Point[][] = [];
  private closed = new Set<Point[]>();
  private path: Point[] = [];
  private pools: Record<string, Entry[]> = {g: [], s: [], l: [], m: [], r: []};
  private used: Record<string, number> = {g: 0, s: 0, l: 0, m: 0, r: 0};
  private order = 0;
  private geometry: Geometry[] = [];
  private graphicEntry: Entry | null = null;
  private origin: Point = {x: 0, y: 0};
  private shape: (string | number)[] = [];
  private strokeTextValue: {s: string; x: number; y: number; color: string; width: number} | null = null;
  textAlign = 'center'; textBaseline = 'middle'; lineJoin = 'round'; lineCap = 'butt';
  imageSmoothingEnabled = false; imageSmoothingQuality = 'high';

  // 每个层有独立池；静态层只画一次，此后只移动根节点。
  constructor(readonly root: Node, readonly assets: WorldAssets) {}
  // 重置画笔，防止上一帧的 alpha、transform 泄漏。
  private initial(): Style { return {matrix: [1, 0, 0, 1, 0, 0], alpha: 1, fill: '#000000', stroke: '#000000', width: 1, font: '16px title', dash: []}; }
  // 开始一帧，节点保留、几何缓存重用。
  begin(): void { this.flushGraphics(); this.state = this.initial(); this.stack = []; this.order = 0; for (const key in this.used) this.used[key] = 0; }
  // 仅隐藏多余节点，不每帧销毁。
  end(): void { this.flushGraphics(); for (const key in this.pools) for (let i = this.used[key]; i < this.pools[key].length; i++) this.pools[key][i].node.active = false; }
  // 将外部浮层插入当前绘制顺序，后续遮罩/提示继续在其上方绘制。
  insertLayer(node:Node):void {this.flushGraphics();node.setSiblingIndex(this.order++);}
  // 用于验收节点池是否在预热后稳定。
  stats(): Record<string, number> { return Object.fromEntries(Object.entries(this.pools).map(([key, values]) => [key, values.length])); }
  get fillStyle(): string { return this.state.fill; } set fillStyle(v: string) { this.state.fill = v; }
  get strokeStyle(): string { return this.state.stroke; } set strokeStyle(v: string) { this.state.stroke = v; }
  get globalAlpha(): number { return this.state.alpha; } set globalAlpha(v: number) { this.state.alpha = v; }
  get lineWidth(): number { return this.state.width; } set lineWidth(v: number) { this.state.width = v; }
  get font(): string { return this.state.font; } set font(v: string) { this.state.font = v; }
  // 保存和恢复画笔及仿射变换；不触碰 core。
  save(): void { this.stack.push({...this.state, matrix: [...this.state.matrix], dash: [...this.state.dash]}); }
  restore(): void { const group=this.state.group;this.state = this.stack.pop()!;if(group!==this.state.group)this.flushGraphics(); }
  translate(x: number, y: number): void { const m = this.state.matrix; m[4] += m[0] * x + m[2] * y; m[5] += m[1] * x + m[3] * y; }
  rotate(a: number): void { const m = this.state.matrix, [a0, b, c, d] = m, cs = Math.cos(a), sn = Math.sin(a); m[0] = a0 * cs + c * sn; m[1] = b * cs + d * sn; m[2] = c * cs - a0 * sn; m[3] = d * cs - b * sn; }
  scale(x: number, y: number): void { const m = this.state.matrix; m[0] *= x; m[1] *= x; m[2] *= y; m[3] *= y; }
  // 几何顶点直接变换，避免 Graphics 节点随图形改变 transform。
  private at(x: number, y: number): Point { const m = this.state.matrix; return {x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5]}; }
  // RGBA 的 alpha 同时乘画笔透明度；颜色缓存交给 Graphics 按值复制。
  private color(value: string, alpha = this.state.alpha): Color {
    const rgba = value.match(/^rgba?\(([^)]+)\)/);
    if (rgba) { const n = rgba[1].split(',').map(Number); return new Color(n[0], n[1], n[2], Math.round((n[3] ?? 1) * alpha * 255)); }
    const c = new Color(value); c.a = Math.round(c.a * alpha); return c;
  }
  // 创建或取用池条目；只有增加峰值数量时才创建节点。
  private take(kind: string): Entry {
    const i = this.used[kind]++;
    let e = this.pools[kind][i];
    if (!e) {
      const node = new Node(`Draw-${kind}-${i}`); node.layer = Layers.Enum.UI_2D;
      node.addComponent(UITransform); this.root.addChild(node); e = {node};
      if (kind === 'g') e.graphic = node.addComponent(Graphics);
      if (kind === 's') e.sprite = node.addComponent(Sprite);
      if (kind === 'l') {
        e.label = node.addComponent(Label); e.label.font = this.assets.title; e.label.useSystemFont = false;
        e.label.overflow = Label.Overflow.NONE; e.label.enableWrapText = false;
        e.label.horizontalAlign = Label.HorizontalAlign.CENTER; e.label.verticalAlign = Label.VerticalAlign.CENTER;
      }
      if(kind==='r'){e.mask=node.addComponent(Mask);e.mask.type=Mask.Type.GRAPHICS_RECT;e.child=new Node('RectContent');e.child.layer=Layers.Enum.UI_2D;node.addChild(e.child);}
      if (kind === 'm') {
        e.mask = node.addComponent(Mask); e.mask.type = Mask.Type.GRAPHICS_ELLIPSE;
        e.child = new Node('ClippedSprite'); e.child.layer = Layers.Enum.UI_2D; e.child.addComponent(UITransform); node.addChild(e.child);
        e.sprite = e.child.addComponent(Sprite);
      }
      if (e.sprite) { e.sprite.sizeMode = Sprite.SizeMode.CUSTOM; e.sprite.trim = false; }
      this.pools[kind][i] = e;
    }
    const parent=this.state.group||this.root;if(e.node.parent!==parent)parent.addChild(e.node);
    e.node.active = true; e.node.setSiblingIndex(this.order++);
    return e;
  }
  // 相邻几何仍共用原来的池槽和层次；只缓存上一帧该槽的网格，不按类型重排。
  private recordGeometry(fill: boolean): void {
    if (!this.graphicEntry) {
      this.graphicEntry = this.take('g');
      this.origin = this.paths.find(p => p.length)?.[0] || {x: 0, y: 0};
      this.geometry = []; this.shape = [];
    }
    const paths = this.paths.map(p => p.map(q => ({x: q.x - this.origin.x, y: q.y - this.origin.y})));
    const closed = fill ? [] : this.paths.map(p => this.closed.has(p));
    const op: Geometry = {fill, paths, closed, ink: fill ? this.fillStyle : this.strokeStyle, alpha: this.globalAlpha, width: this.lineWidth, cap: this.lineCap, dash: fill ? [] : [...this.state.dash]};
    this.geometry.push(op);
    // 平移独立放到节点上；仅容忍减法产生的浮点尾差，不量化坐标或进度。
    this.shape.push(fill ? 'fill' : 'stroke', op.ink, op.alpha, ...(fill ? [] : [op.width, op.cap, op.dash.length, ...op.dash]), paths.length);
    paths.forEach((p, i) => {this.shape.push(p.length);if (!fill) this.shape.push(closed[i] ? 1 : 0);for (const q of p) this.shape.push(q.x, q.y);});
  }
  // 每次精灵/文字/遮罩/外部层打断前提交；移动不clear，变形、颜色、虚线变化仍完整重画。
  private flushGraphics(): void {
    const entry = this.graphicEntry;
    if (!entry) return;
    const g = entry.graphic!;
    entry.node.setPosition(this.origin.x, -this.origin.y);
    const old = entry.shape, equal = old?.length === this.shape.length && this.shape.every((v, i) => typeof v === 'number' && typeof old[i] === 'number' ? Math.abs(v - (old[i] as number)) < 1e-8 : v === old[i]);
    if (!equal) {
      g.clear();
      for (const op of this.geometry) this.paintGeometry(g, op);
      entry.shape = this.shape;
    }
    this.graphicEntry = null; this.geometry = []; this.shape = [];
  }
  // 重建时沿用原先的填充和虚线离散算法，缓存只改变重建频率。
  private paintGeometry(g: Graphics, op: Geometry): void {
    const ink = this.color(op.ink, op.alpha);
    if (op.fill) {
      g.fillColor = ink;
      for (const p of op.paths) {if (!p.length) continue;g.moveTo(p[0].x, -p[0].y);for (let i = 1; i < p.length; i++) g.lineTo(p[i].x, -p[i].y);g.close();}
      g.fill();return;
    }
    g.strokeColor = ink; g.lineWidth = op.width;
    g.lineCap = op.cap === 'round' ? Graphics.LineCap.ROUND : Graphics.LineCap.BUTT;
    for (let i = 0; i < op.paths.length; i++) {
      const path = op.paths[i]; if (!path.length) continue;
      const points = op.closed[i] ? [...path, path[0]] : path;
      let dashIdx = 0, remaining = op.dash[0] || Infinity, draw = true;
      if (!op.dash.length) {g.moveTo(points[0].x, -points[0].y);for (const p of points.slice(1)) g.lineTo(p.x, -p.y);continue;}
      for (let j = 1; j < points.length; j++) {
        const a = points[j - 1], b = points[j], length = Math.hypot(b.x - a.x, b.y - a.y);let d = 0;
        while (d < length - 1e-8) {
          const step = Math.min(remaining, length - d), t0 = d / length, t1 = (d + step) / length;
          if (draw) {g.moveTo(a.x + (b.x - a.x) * t0, -a.y - (b.y - a.y) * t0);g.lineTo(a.x + (b.x - a.x) * t1, -a.y - (b.y - a.y) * t1);}
          d += step;remaining -= step;
          if (remaining < 1e-8) {dashIdx = (dashIdx + 1) % op.dash.length;remaining = op.dash[dashIdx];draw = dashIdx % 2 === 0;}
        }
      }
    }
    g.stroke();
  }
  beginPath(): void { this.paths = []; this.closed.clear(); this.path = []; }
  moveTo(x: number, y: number): void { this.path = [this.at(x, y)]; this.paths.push(this.path); }
  lineTo(x: number, y: number): void { if (!this.path.length) this.moveTo(x, y); else this.path.push(this.at(x, y)); }
  closePath(): void { this.closed.add(this.path); }
  rect(x: number, y: number, w: number, h: number): void { this.moveTo(x, y); this.lineTo(x + w, y); this.lineTo(x + w, y + h); this.lineTo(x, y + h); this.closePath(); }
  // 曲线以约 4px 段长离散，虚线也沿同一曲线累计距离，非逐段重启。
  ellipse(x: number, y: number, rx: number, ry: number, rot: number, start: number, end: number): void {
    const n = Math.max(8, Math.ceil(Math.abs(end - start) * Math.max(rx, ry) / 4));
    for (let i = 0; i <= n; i++) { const a = start + (end - start) * i / n, px = x + Math.cos(a) * rx * Math.cos(rot) - Math.sin(a) * ry * Math.sin(rot), py = y + Math.cos(a) * rx * Math.sin(rot) + Math.sin(a) * ry * Math.cos(rot); if (i === 0 && !this.path.length) this.moveTo(px, py); else this.lineTo(px, py); }
    if (Math.abs(end - start) >= Math.PI * 2) this.closePath();
  }
  arc(x: number, y: number, r: number, start: number, end: number): void { this.ellipse(x, y, r, r, 0, start, end); }
  // 世界只有矩形地板和圆形头像需要裁切。
  clip(): void {
    const p = this.paths[0]; if (!p?.length) return;
    const xs = p.map(q => q.x), ys = p.map(q => q.y), x = Math.min(...xs), y = Math.min(...ys), w = Math.max(...xs) - x, h = Math.max(...ys) - y;
    if(p.length===4){const e=this.take('r');e.node.setPosition(x+w/2,-y-h/2);e.node.getComponent(UITransform)!.setContentSize(w,h);e.child!.setPosition(-x-w/2,y+h/2);this.state.group=e.child;this.flushGraphics();}else this.state.clip={cx:x+w/2,cy:y+h/2,r:w/2};
  }
  setLineDash(dash: number[]): void { this.state.dash = dash; }
  // 填充路径；Graphics 颜色变化会记录到顶点数据，允许一个节点包含多色地板。
  fill(): void { this.recordGeometry(true); }
  // 曲线与虚线路径在本批提交时才重建；未变的几何直接沿用旧网格。
  stroke(): void { this.recordGeometry(false); }
  // 矩形地板在建图时按房间边界裁剪，防止最后一格越过门墙。
  fillRect(x: number, y: number, w: number, h: number): void {
    const c = this.state.clip;
    if (c && 'w' in c) { const m = this.state.matrix, x0 = Math.max(x, c.x - m[4]), y0 = Math.max(y, c.y - m[5]); w = Math.min(x + w, c.x + c.w - m[4]) - x0; h = Math.min(y + h, c.y + c.h - m[5]) - y0; x = x0; y = y0; }
    if (w <= 0 || h <= 0) return; this.beginPath(); this.rect(x, y, w, h); this.fill();
  }
  strokeRect(x: number, y: number, w: number, h: number): void { this.beginPath(); this.rect(x, y, w, h); this.stroke(); }
  // 把平移、旋转和镜像转成节点 transform；精灵尺寸仍用原型的逻辑像素。
  private place(node: Node, x: number, y: number): void { const p = this.at(x, y), m = this.state.matrix, sx = Math.hypot(m[0], m[1]), det = m[0] * m[3] - m[1] * m[2]; node.setPosition(p.x, -p.y); node.angle = -Math.atan2(m[1], m[0]) * 180 / Math.PI; node.setScale(sx, det / sx, 1); }
  // 透明图集矩形切片与爆炸帧都缓存；圆形头像使用 Cocos Mask。
  drawImage(pic: Picture, ...args: number[]): void {
    let x: number, y: number, w: number, h: number;
    if (args.length === 8) { pic = this.assets.crop(pic, args[0], args[1], args[2], args[3]); [x, y, w, h] = args.slice(4); }
    else [x, y, w, h] = args;
    const p = this.at(x + w / 2, y + h / 2);
    if (this.cull && (p.x + w < -100 || p.y + h < -100 || p.x - w > this.width + 100 || p.y - h > this.height + 100)) return;
    this.flushGraphics();
    const c = this.state.clip, masked = c && 'r' in c;
    const e = this.take(masked ? 'm' : 's');
    const node = e.child || e.node;
    if (masked) { e.node.setPosition(c.cx, -c.cy); e.node.getComponent(UITransform)!.setContentSize(c.r * 2, c.r * 2); this.place(node, x + w / 2, y + h / 2); node.setPosition(node.position.x - c.cx, node.position.y + c.cy); }
    else this.place(node, x + w / 2, y + h / 2);
    node.getComponent(UITransform)!.setContentSize(w, h); e.sprite!.spriteFrame = pic.frame; e.sprite!.color = new Color(255, 255, 255, Math.round(this.globalAlpha * 255));
  }
  width = 375; height = 812; cull = true;
  // 字体宽度取 TTF cmap/hmtx 的预生成数据，不依赖网页 Canvas 测量。
  metrics: Record<string, number> = {};
  measureText(text: string): {width: number} { const size = Number(this.font.match(/([\d.]+)px/)?.[1] || 16); return {width: Array.from(displayText(text)).reduce((n, ch) => n + (this.metrics[ch] ?? 1), 0) * size}; }
  strokeText(s: string, x: number, y: number): void { this.strokeTextValue = {s, x, y, color: this.strokeStyle, width: this.lineWidth}; }
  // 同内容/字号不重复写 Label；倒计时输入是 ceil 秒，只在整秒改变时重建文字纹理。
  fillText(s: string, x: number, y: number): void {
    // 最终Label边界兜底，必须在缺字/系统字体回退判断之前处理动态称呼和飘字。
    s = displayText(s);
    const p = this.at(x, y); if (this.cull && (p.x < -300 || p.y < -100 || p.x > this.width + 300 || p.y > this.height + 100)) { this.strokeTextValue = null; return; }
    this.flushGraphics(); const e = this.take('l'), label = e.label!;
    const size = Number(this.font.match(/([\d.]+)px/)?.[1] || 16), outline = this.strokeTextValue;
    if (label.fontSize !== size) { label.fontSize = size; label.lineHeight = size * 1.2; }
    // 世界文字遵照ctx.font：快乐体，领导名牌额外加粗；为后续画面保留700/900的明确选择。
    const font = /900|body-900/.test(this.font) ? this.assets.body900 : /700|body-700/.test(this.font) ? this.assets.body700 : /body-400/.test(this.font) ? this.assets.body400 : this.assets.title;
    const key=/900|body-900/.test(this.font)?'body-900':/700|body-700/.test(this.font)?'body-700':/body-400/.test(this.font)?'body-400':'title';
    // 用户自定义称呼可能超出子集；整段回退系统字，避免方块和空名牌。
    const fallback=Array.from(s).some(ch=>!UI_METRICS[key]?.[ch]&&ch!=='\n');
    if(fallback){label.font=null;label.fontFamily='sans-serif';label.useSystemFont=true;}else{if(label.font!==font)label.font=font;label.useSystemFont=false;}
    label.isBold = /bold/.test(this.font);
    if (label.string !== s) label.string = s;
    label.color = this.color(this.fillStyle); label.enableOutline = !!outline;
    // 3.8.8的outlineColor setter只比对象身份；同值新Color也会重排字并上传整张纹理。
    if (outline) { label.outlineWidth = outline.width / 2; const ink=this.color(outline.color); if(!label.outlineColor?.equals?.(ink))label.outlineColor=ink; }
    this.place(e.node, x, y); this.strokeTextValue = null;
  }
}
