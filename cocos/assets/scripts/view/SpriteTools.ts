import {clamp, dist} from '../core/engine';
import {DrawSurface} from './DrawSurface';
import {WorldAssets} from './WorldAssets';
import {HEADS} from './visual-data';

interface SpriteOptions {h?: number; rot?: number; flip?: boolean; sy?: number; alpha?: number | null}
// 对应 engine 的 label、drawSprite、drawStanding、edgeHint、drawStick；只提供表现工具。
export class SpriteTools {
  DISPLAY_FONT = 'title';
  spr: WorldAssets['spr'];
  dist = dist; clamp = clamp;
  // 纯表现随机，不调用 core.E 或玩法随机流。
  fxRand(a: number, b: number): number { return a + Math.random() * (b - a); }
  constructor(readonly assets: WorldAssets) { this.spr = assets.spr; }
  // 标题字体由资源加载完成后统一设置，描边宽度与原型相同。
  label(ctx: DrawSurface, s: string, x: number, y: number, size: number, fill = '#1F2A44', stroke = '#FFFDF5'): void {
    ctx.font = `${size}px title`; ctx.lineWidth = Math.max(3, size / 5); ctx.strokeStyle = stroke; ctx.strokeText(s, x, y); ctx.fillStyle = fill; ctx.fillText(s, x, y);
  }
  // 原型全身精灵的缩放/旋转/镜像，保持透明度覆盖规则。
  drawSprite(ctx: DrawSurface, name: string, cx: number, cy: number, w: number, o: SpriteOptions = {}): void {
    const s = this.spr[name]; if (!s) return;
    if (o.h) w = o.h * s.w / s.h; const h = w * s.h / s.w;
    ctx.save(); if (o.alpha != null) ctx.globalAlpha = o.alpha;
    ctx.translate(cx, cy); if (o.rot) ctx.rotate(o.rot); if (o.flip) ctx.scale(-1, 1); if (o.sy) ctx.scale(1, o.sy);
    ctx.drawImage(s, -w / 2, -h / 2, w, h); ctx.restore();
  }
  // 脚底相对身体中心的偏移由调用方给出。
  drawStanding(ctx: DrawSurface, name: string, x: number, footY: number, h: number, o: SpriteOptions = {}): void {
    const s = this.spr[name]; if (s) this.drawSprite(ctx, name, x, footY - h / 2, h * s.w / s.h, o);
  }
  // 固定摇杆画面，中心/死区/推幅由 InputView 使用同一公式。
  drawStick(ctx: DrawSurface, inp: {down: boolean; x: number; y: number}): void {
    const c = stickCenter(ctx.width, ctx.height); ctx.save(); ctx.globalAlpha = inp.down ? .32 : .16; ctx.fillStyle = '#1F2A44';
    ctx.beginPath(); ctx.arc(c.x, c.y, 52, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = inp.down ? .75 : .35; ctx.fillStyle = '#FFFDF5'; ctx.beginPath(); ctx.arc(inp.down ? inp.x : c.x, inp.down ? inp.y : c.y, 22, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  // 屏外头像、箭头和怒气徽标；圆形 Mask 与原型 clip 对应。
  edgeHint(ctx: DrawSurface, st: {w?: number; h?: number; width: number; height: number}, sx: number, sy: number, icon: string | {sprite: string; whole?: boolean}, color: string, badge?: string | null): void {
    const width = st.width, height = st.height, top = 70, R = 21;
    if (sx > 0 && sx < width && sy > top && sy < height) return;
    const cx = width / 2, cy = (height + top) / 2, a = Math.atan2(sy - cy, sx - cx);
    const t = Math.min((width / 2 - 36) / Math.max(1e-6, Math.abs(Math.cos(a))), ((height - top) / 2 - 36) / Math.max(1e-6, Math.abs(Math.sin(a))));
    const x = cx + Math.cos(a) * t, y = cy + Math.sin(a) * t;
    ctx.save(); ctx.fillStyle = color; ctx.translate(x, y); ctx.save(); ctx.rotate(a);
    ctx.beginPath(); ctx.moveTo(R + 11, 0); ctx.lineTo(R - 2, -9); ctx.lineTo(R - 2, 9); ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
    const s = typeof icon === 'string' ? null : this.spr[icon.sprite];
    if (s && typeof icon !== 'string') {
      ctx.fillStyle = '#FFF8E7'; ctx.beginPath(); ctx.arc(0, 0, R - 3, 0, Math.PI * 2); ctx.fill(); ctx.save(); ctx.clip();
      const head = this.assets.headCrop(icon.sprite, HEADS), size = icon.whole ? Math.max(s.w, s.h) : head!.size;
      const d = (R - 3) * (icon.whole ? 1.6 : 2.15);
      // 道具按原比例整张居中，不对透明范围以外的像素取样。
      if (icon.whole) this.drawSprite(ctx, icon.sprite, 0, 0, d * s.w / size);
      else ctx.drawImage(s, head!.sx, 0, size, size, -d / 2, -d / 2 + 2, d, d);
      ctx.restore();
    } else if (typeof icon === 'string') {
      // 本卡按原型保留既有 emoji，像素图标替换由 P4 裁定单列。
      ctx.font = '18px title'; ctx.fillStyle = color; ctx.fillText(icon, 0, 1);
    }
    ctx.restore(); if (badge) this.drawSprite(ctx, badge, x + R * .75, y - R * .75, 20);
  }
}
// 固定摇杆中心：离边至少 80px，与原型 stickCenter 逐项相同。
export function stickCenter(w: number, h: number): {x: number; y: number} {return {x: clamp(w * .24, 80, w / 2), y: clamp(h * .8, h / 2, h - 80)};}
