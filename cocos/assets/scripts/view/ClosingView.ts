import {UiPaint} from './UiPaint';
export interface ClosingNotice {hidden: boolean; warning?: boolean; seconds?: number; title?: string; detail?: string; result?: boolean; passed?: boolean}
// 原型 closingNotice 的1204×296参考切片，比例/坐标直接照CSS。
export class ClosingView {
  notice: ClosingNotice = {hidden: true};
  beatAt = -Infinity;
  constructor(readonly p: UiPaint) {}
  // 数字弹跳和闹钟抖动是CSS真实时间；倒数、铃声/结果的阶段由core推进。
  event(value: ClosingNotice, real: number): void {if (value.warning && this.notice.seconds !== value.seconds) this.beatAt = real; this.notice = value;}
  draw(real: number, bottom: number, reduce = false): void {
    const n = this.notice; if (n.hidden) return;
    const c = this.p.c, w = Math.min(390, c.width - 16), h = w * 296 / 1204, x = (c.width - w) / 2, y = bottom + 10, seconds = n.seconds || 0;
    const color = seconds <= 2 ? 'red' : seconds <= 5 ? 'orange' : 'yellow';
    this.p.image(`closing_base_${n.warning ? color : 'plain'}`, x, y, w, h);
    let dx = 0, dy = 0;
    if (n.warning && seconds <= 5 && !reduce) {
      const phase = (real % (seconds <= 2 ? .12 : .24)) / (seconds <= 2 ? .12 : .24), keys = [[0, 0], [.25, -1], [.75, 1], [1, 0]];
      const i = keys.findIndex(k => k[0] > phase), a = keys[i - 1], b = keys[i], t = Math.floor((phase - a[0]) / (b[0] - a[0]) * 2) / 2, v = a[1] + (b[1] - a[1]) * t;
      dx = v * (seconds <= 2 ? 3 : 2); dy = v * (seconds <= 2 ? 2 : 1);
    }
    this.p.image(`closing_clock_${n.warning ? color : 'yellow'}`, x + w * .02990 + dx, y + h * .16554 + dy, w * .21927, h * .68581);
    const titleSize = w * (n.warning ? .081 : .075), copyX = x + w * .25415, copyWidth = w * (n.warning ? .42359 : .68), copyY = y + h * .15541;
    const titleColor = n.result ? n.passed ? '#2F9E6B' : '#E8504A' : '#FFF6D8';
    this.p.text(n.title!, copyX + (copyWidth - this.p.width(n.title!, titleSize, 'body-900')) / 2, copyY, titleSize, titleColor, 'body-900', false, '#0F1628');
    const detailSize = w * (n.warning ? .05 : .04), detailWidth = this.p.width(n.detail!, detailSize, 'body-900'), detailX = copyX + (copyWidth - detailWidth) / 2, detailY = copyY + h * .67568 * .62;
    this.p.text(n.detail!, detailX, detailY, detailSize, '#DCE6F7', 'body-900', false, '#0F1628');
    if (n.warning) {
      c.fillStyle = '#7E94C8'; for (const sx of [detailX - w * .068, detailX + detailWidth + w * .018]) c.fillRect(sx, detailY + detailSize * .5, w * .05, w * .0085);
      const nx = x + w * .74585, ny = y + h * .18919, nw = w * .18771, nh = h * .58784, fs = w * (seconds === 10 ? .11 : .16), digit = String(seconds), fg = seconds <= 5 ? '#FFF6D8' : '#1F2A44', shadow = seconds <= 2 ? '#B51F32' : seconds <= 5 ? '#E83512' : '#C98A00';
      // steps(3,end) 的0.18秒弹跳，暂停时仍会播完；减少动态时不缩放。
      const t = Math.min(1, Math.max(0, real - this.beatAt) / .18), scale = reduce ? 1 : 1.16 - .16 * Math.floor(t * 3) / 3;
      c.save(); c.translate(nx + nw * .305, ny + fs * .6); c.scale(scale, scale); c.translate(-nx - nw * .305, -ny - fs * .6);
      const digitX = nx + (nw * .61 - this.p.width(digit, fs, 'body-900')) / 2, digitY = ny + (seconds === 10 ? nh * .15 : 0);
      this.p.text(digit, digitX, digitY + 2, fs, shadow, 'body-900'); this.p.text(digit, digitX, digitY, fs, fg, 'body-900'); c.restore();
      this.p.text('秒', nx + nw - w * .06, ny + nh - w * .06, w * .06, fg, 'body-900');
    }
  }
}
