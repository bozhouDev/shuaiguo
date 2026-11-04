import {Hint} from '../core/types';
import {UiPaint, Box} from './UiPaint';
import {displayText} from './ui-data';
// 对应 showHint/showMsg/placeBanners/E.toast：停留由core对局秒控制，CSS过渡用真实时间。
export class MessageView {
  hint: Hint | null = null; message = ''; coachButton = '';
  hintOn = false; msgOn = false;
  hintChange = -Infinity; msgChange = -Infinity; toastAt = -Infinity; toastUntil = -Infinity;
  toast = ''; startBox: Box | null = null; hintBox: Box | null = null; msgBox: Box | null = null;
  constructor(readonly p: UiPaint) {}
  // 每个事件只改显示状态；不在view重跑教学推进逻辑。
  event(kind: string, args: unknown[], real: number): void {
    if (kind === 'showHint') {if (!this.hintOn) this.hintChange = real; this.hint = args[0] as Hint; this.hintOn = true; this.coachButton = '';}
    if (kind === 'showMsg') {if (!this.msgOn) this.msgChange = real; this.message = String(args[0]); this.msgOn = true;}
    if (kind === 'coachButton') this.coachButton = String(args[0]);
    if (kind === 'hideHint' || kind === 'clearBanners') {if (this.hintOn) this.hintChange = real; this.hintOn = false; this.coachButton = '';}
    if (kind === 'hideMsg' || kind === 'clearBanners') {if (this.msgOn) this.msgChange = real; this.msgOn = false;}
    if (kind === 'toast') {this.toast = String(args[0]); this.toastAt = real; this.toastUntil = real + ((args[1] as number) || 1600) / 1000;}
  }
  // 三次贝塞尔求值，精确对应横幅 .2,.9,.3,1.12 的回弹曲线。
  private ease(t: number, x1 = .25, y1 = .1, x2 = .25, y2 = 1): number {if (t <= 0) return 0; if (t >= 1) return 1; let lo = 0, hi = 1; for (let i = 0; i < 16; i++) {const x = (lo + hi) / 2, v = 3 * (1 - x) ** 2 * x * x1 + 3 * (1 - x) * x * x * x2 + x ** 3; if (v < t) lo = x; else hi = x;} const x = (lo + hi) / 2; return 3 * (1 - x) ** 2 * x * y1 + 3 * (1 - x) * x * x * y2 + x ** 3;}
  // HUD的实际底边决定横幅/消息位置；倒计时隐藏两者，仍继续core倒数。
  draw(real: number, hudBottom: number, closing: boolean): void {
    const c = this.p.c; this.startBox = this.hintBox = this.msgBox = null;
    if (!closing && this.hint && (this.hintOn || real - this.hintChange < .34)) {
      const h = this.hint, width = Math.min(c.width - 32, 420), icon = !!h.icon?.length, textX = icon ? 85 : 33, content = width - textX - 25;
      const main = this.p.wrap(this.p.runs(h.text), content, 17, 'body-900'), sub = h.sub ? this.p.wrap(this.p.runs(h.sub, '#C4D6F2'), content, 13, 'body-900') : [];
      const subHeight = sub.length * 13 * 1.35, textHeight = main.length * 17 * 1.3 + subHeight + (this.coachButton ? 48 : 0), height = 42 + Math.max(icon ? 50 : 0, textHeight);
      const b = {x: 12, y: hudBottom + (h.title ? 30 : 8), w: width, h: height}; this.hintBox = b;
      const t = Math.min(1, Math.max(0, real - this.hintChange) / .34), amount = this.hintOn ? this.ease(t, .2, .9, .3, 1.12) : 1 - this.ease(t, .2, .9, .3, 1.12), alpha = this.ease(Math.min(1, (real - this.hintChange) / .2));
      c.save(); c.globalAlpha = this.hintOn ? alpha : 1 - alpha; c.translate(-(width + 40) * (1 - amount), 0);
      c.fillStyle = 'rgba(15,22,40,.55)'; c.fillRect(b.x + 5, b.y + 4, b.w - 10, b.h); this.p.frame(b, true);
      if (h.title) {const tw = this.p.width(h.title, 17, 'body-900') + 36 + Array.from(h.title).length * 1.02, tb = {x: b.x + 37, y: b.y - 15, w: tw, h: 32}; this.p.frame(tb); this.p.text(h.title, tb.x + 18, tb.y + 6, 17, '#1F2A44', 'body-900');}
      if (icon) {const ib = {x: b.x + 17, y: b.y + (height - 58) / 2, w: 58, h: 58}; this.p.frame(ib); this.p.contain(h.icon![0], {x: ib.x + 6, y: ib.y + 6, w: 46, h: 46}); if (h.icon![1]) this.p.contain(h.icon![1], {x: ib.x + 32, y: ib.y - 4, w: 26, h: 26});}
      const yy = b.y + (height - textHeight) / 2; this.p.lines(sub, b.x + textX, yy, 13, 'body-900', 13 * 1.35); this.p.lines(main, b.x + textX, yy + subHeight, 17, 'body-900', 17 * 1.3);
      if (this.coachButton) {const bb = {x: b.x + textX, y: yy + subHeight + main.length * 22.1 + 6, w: this.p.width(this.coachButton, 17, 'body-900') + 44, h: 42}; this.startBox = bb; this.p.frame(bb); c.fillStyle = '#E0A800'; c.fillRect(bb.x + 6, bb.y + bb.h - 9, bb.w - 12, 3); this.p.text(this.coachButton, bb.x + (bb.w - this.p.width(this.coachButton, 17, 'body-900')) / 2, bb.y + 11, 17, '#1F2A44', 'body-900');}
      c.restore();
    }
    if (!closing && this.message && (this.msgOn || real - this.msgChange < .25)) {
      // 群消息先取纯文字显示副本再拆行，移除末尾图标留下的空格；原始事件不改。
      const visible = displayText(this.message).trimEnd(), match = visible.match(/^(【[^】]+】)([^：]+)：(.*)$/), header = match ? `${match[1]} ${match[2]}` : '', text = match ? match[3] : visible;
      const max = Math.min(260, c.width - 160), content = Math.min(max, Math.max(this.p.width(header, 11, 'body-700'), this.p.width(text, 13, 'body-400')));
      const lines = this.p.wrap([{text, color: '#1F2A44'}], content, 13, 'body-400'), heads = header ? this.p.wrap([{text: header, color: '#2F9E6B'}], content, 11, 'body-700') : [];
      const b = {x: c.width - 12 - content - 24, y: this.hintOn && this.hintBox ? this.hintBox.y + this.hintBox.h + 10 : hudBottom + 8, w: content + 24, h: 16 + lines.length * 18.85 + heads.length * 15.95}; this.msgBox = b;
      const t = Math.min(1, Math.max(0, real - this.msgChange) / .25), amount = this.msgOn ? this.ease(t) : 1 - this.ease(t);
      c.save(); c.globalAlpha = amount; c.translate(16 * (1 - amount), 0); c.fillStyle = '#1F2A44'; c.fillRect(b.x + 3, b.y + 3, b.w, b.h); c.fillRect(b.x, b.y, b.w, b.h); c.fillStyle = '#FFFFFF'; c.fillRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4); this.p.lines(heads, b.x + 12, b.y + 8, 11, 'body-700', 15.95); this.p.lines(lines, b.x + 12, b.y + 8 + heads.length * 15.95, 13, 'body-400', 18.85); c.restore();
    }
  }
  // toast用真实时间（暂停照走），默认1.6秒，替换旧消息，进出各.2秒；超长省略。
  drawToast(real: number): void {const c = this.p.c, alpha = Math.min(this.ease(Math.max(0, Math.min(1, (real - this.toastAt) / .2))), 1 - this.ease(Math.max(0, Math.min(1, (real - this.toastUntil) / .2)))); if (!alpha) return; let text = this.toast; while (this.p.width(text, 14, 'body-400') > c.width * .9) text = Array.from(text).slice(0, -2).join('') + '…'; const width = this.p.width(text, 14, 'body-400') + 28, height = 33, x = (c.width - width) / 2, y = c.height * .8 - 112 - height; c.save(); c.globalAlpha = alpha; c.fillStyle = '#1F2A44'; c.fillRect(x, y, width, height); this.p.text(text, x + 14, y + 8, 14, '#FFFDF5', 'body-400'); c.restore();}
}
