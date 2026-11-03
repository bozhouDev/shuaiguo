// 对应原型 js/engine.js：小工具、pollKeys、Snake、Floats、pushOut、collide；剥离绘制与平台调用。
import { Mulberry32 } from './random';
import type { Point, Rect, Pot, Input } from './types';

// 两点距离，保留原型运算顺序。
export const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
// 数值夹在 [a,b] 之间。
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
// 求最短角度差。
export function angDiff(a: number, b: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
// 读取键盘方向，方向键覆盖摇杆。
export function pollKeys(inp: Input) {
  const k = inp.keys;
  let x = 0, y = 0;
  if (k['arrowleft'] || k['a']) x -= 1;
  if (k['arrowright'] || k['d']) x += 1;
  if (k['arrowup'] || k['w']) y -= 1;
  if (k['arrowdown'] || k['s']) y += 1;
  if (x || y) inp.angle = Math.atan2(y, x);
  return !!(x || y);
}
// 飘字列表由每局单独持有，新增先发事件，再入列表。
export class Floats {
  list: { text: string; x: number; y: number; color: string; life: number }[] = [];
  private emit: (kind: string, ...args: unknown[]) => void;
  // 注入本局事件出口。
  constructor(emit: (kind: string, ...args: unknown[]) => void) { this.emit = emit; }
  // 新增一条飘字；事件保留调用时的参数个数。
  add(...args: [text: string, x: number, y: number, color?: string]) {
    this.emit('floats', ...args);
    const [text, x, y, color] = args;
    this.list.push({ text, x, y, color: color || '#1F2A44', life: 1.1 });
  }
  // 上浮并淡出，由画面帧循环决定何时调用。
  update(dt: number) {
    for (const f of this.list) { f.life -= dt; f.y -= 38 * dt; }
    this.list = this.list.filter(f => f.life > 0);
  }
}
export class Snake {
    x: number; y: number; angle: number; speed: number; turn: number; spacing: number;
    segs: Pot[]; trail: Point[];
    // x,y 初始位置；o.speed 速度(px/s)；o.turn 转向速度(rad/s)；o.spacing 每节间距
    constructor(x: number, y: number, o: { speed: number; turn?: number; spacing?: number }) {
      this.x = x; this.y = y;
      this.angle = -Math.PI / 2;
      this.speed = o.speed;
      this.turn = o.turn || 5;
      this.spacing = o.spacing || 20;
      this.segs = [];            // 每节身体的数据，由各游戏自行定义
      this.trail = [{ x, y }];   // 蛇头走过的轨迹点（新的在前）
    }
    // 每帧：朝目标角度转向 → 前进 → 记录轨迹
    update(dt: number, target: number | null) {
      if (target != null) {
        const d = angDiff(this.angle, target);
        const m = this.turn * dt;
        this.angle += clamp(d, -m, m);
      }
      this.x += Math.cos(this.angle) * this.speed * dt;
      this.y += Math.sin(this.angle) * this.speed * dt;
      this.record();
    }
    // 记录轨迹点（每隔约 3px 记一次），并裁掉用不到的旧轨迹
    record() {
      const last = this.trail[0];
      if (dist(this.x, this.y, last.x, last.y) >= 3) this.trail.unshift({ x: this.x, y: this.y });
      const keep = Math.ceil(((this.segs.length + 2) * this.spacing) / 3 * 1.6) + 30;
      if (this.trail.length > keep) this.trail.length = keep;
    }
    // 沿轨迹往回量距离，算出每节身体的位置
    positions(): Point[] {
      const out: Point[] = [];
      const tr = this.trail;
      let px = this.x, py = this.y, acc = 0, i = 0;
      while (out.length < this.segs.length) {
        if (i >= tr.length) { out.push({ x: px, y: py }); continue; } // 轨迹不够长：叠在末端
        const q = tr[i];
        const d = dist(px, py, q.x, q.y);
        if (acc + d >= this.spacing) {
          const r = (this.spacing - acc) / d;
          px += (q.x - px) * r;
          py += (q.y - py) * r;
          out.push({ x: px, y: py });
          acc = 0;
        } else {
          acc += d; px = q.x; py = q.y; i++;
        }
      }
      return out;
    }
    // 撞到矩形边界时反弹，返回是否撞墙
    bounce(x0: number, y0: number, x1: number, y1: number) {
      let hit = false;
      if (this.x < x0) { this.x = x0; this.angle = Math.PI - this.angle; hit = true; }
      if (this.x > x1) { this.x = x1; this.angle = Math.PI - this.angle; hit = true; }
      if (this.y < y0) { this.y = y0; this.angle = -this.angle; hit = true; }
      if (this.y > y1) { this.y = y1; this.angle = -this.angle; hit = true; }
      return hit;
    }
  }

// 圆与矩形碰撞，原样保留内部推出及遍历顺序。
export function pushOut(o: Point, r: number, rect: Rect) {
    const nx = clamp(o.x, rect.x, rect.x + rect.w);
    const ny = clamp(o.y, rect.y, rect.y + rect.h);
    const dx = o.x - nx, dy = o.y - ny;
    const d = Math.hypot(dx, dy);
    if (d >= r) return false;
    if (d < 0.001) {
      // 圆心在矩形内部：从最近的边推出去
      const l = o.x - rect.x, rr = rect.x + rect.w - o.x, t = o.y - rect.y, b = rect.y + rect.h - o.y;
      const m = Math.min(l, rr, t, b);
      if (m === l) o.x = rect.x - r; else if (m === rr) o.x = rect.x + rect.w + r;
      else if (m === t) o.y = rect.y - r; else o.y = rect.y + rect.h + r;
      return true;
    }
    o.x = nx + (dx / d) * r;
    o.y = ny + (dy / d) * r;
    return true;
  }
  // 对所有障碍物做推出，返回是否撞到任何一个
export function collide(o: Point, r: number, rects: Rect[]) {
    let hit = false;
    for (const k of rects) if (pushOut(o, r, k)) hit = true;
    return hit;
  }

// 每局的 E 门面：工具运算不变，随机流归本局所有，表现实现改为事件。
export class Engine {
  rng: Mulberry32;
  private emit: (kind: string, ...args: unknown[]) => void;
  Snake = Snake;
  dist = dist;
  clamp = clamp;
  angDiff = angDiff;
  pollKeys = pollKeys;
  pushOut = pushOut;
  collide = collide;
  // 不使用时钟起种，调用方明确传入本局种子。
  constructor(seed: number, emit: (kind: string, ...args: unknown[]) => void) { this.rng = new Mulberry32(seed); this.emit = emit; }
  // 与原型对应的随机接口。
  random() { return this.rng.next(); }
  // 重置本局随机流。
  seed(n: number) { this.rng.setState(n); }
  // 读取当前随机状态。
  rngState() { return this.rng.getState(); }
  // 恢复当前随机状态。
  setRngState(s: number) { this.rng.setState(s); }
  // 区间随机数。
  rand(a: number, b: number) { return a + this.random() * (b - a); }
  // 从数组随机取一项。
  pick<T>(arr: T[]): T { return arr[Math.floor(this.random() * arr.length)]; }
  // 洗牌并返回新数组，保持交换顺序。
  shuffle<T>(arr: T[]): T[] {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  // 音效调用意图，保留省略的参数。
  sfx(...args: [name: string, opt?: { vol?: number; rate?: number; delay?: number }]) { this.emit('sfx', ...args); }
  // 提示调用意图。
  toast(...args: [msg: string, ms?: number]) { this.emit('toast', ...args); }
  // 震动调用意图。
  buzz(...args: [ms: number]) { this.emit('buzz', ...args); }
  // 配乐调用意图（黄金录像不录 bgm）。
  bgm(...args: [name: string | boolean, fromStart?: boolean]) { this.emit('bgm', ...args); }
}
