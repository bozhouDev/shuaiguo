import {DrawSurface} from './DrawSurface';
import {UI_METRICS} from './ui-metrics';
import {displayText} from './ui-data';
// 字体表固定，预先计算数字占位，避免HUD每帧逐字反复建数组。
const DIGIT_WIDTH = Object.fromEntries(Object.entries(UI_METRICS).map(([font, metrics]) => [font, Math.max(...'0123456789'.split('').map(d => metrics[d]))]));
export interface Box {x: number; y: number; w: number; h: number}
export interface Run {text: string; color: string}
// DOM/CSS 的尺寸与逐字换行共用门面；所有图形都是 Cocos 节点，不用网页覆盖层。
export class UiPaint {
  constructor(readonly c: DrawSurface) {}
  // 用源字体 hmtx 算字宽；快乐体无tnum，数字按最宽数字占位，避免挤字或时钟跳宽。
  width(text: string, size: number, font = 'title', tabular = false): number {
    const metrics = UI_METRICS[font] || UI_METRICS.title;
    return Array.from(displayText(text)).reduce((n, ch) => n + (tabular && /\d/.test(ch) ? DIGIT_WIDTH[font] ?? DIGIT_WIDTH.title : metrics[ch] ?? 1), 0) * size;
  }
  // 以左上角为坐标写字，Label 仅在显示内容变化时改 string（DrawSurface 池）。
  text(text: string, x: number, y: number, size: number, color: string, font = 'title', tabular = false, stroke?: string): void {
    text = displayText(text);
    const c = this.c; c.font = `${size}px ${font}`; c.fillStyle = color;
    if (tabular) {for (const run of text.match(/\d|[^\d]+/g) || []) {const w = this.width(run, size, font, true); this.text(run, x + (w - this.width(run, size, font)) / 2, y, size, color, font, false, stroke); x += w;} return;}
    if (stroke) {c.strokeStyle = stroke; c.lineWidth = 4; c.strokeText(text, x + this.width(text, size, font) / 2, y + size * .6);}
    c.fillText(text, x + this.width(text, size, font) / 2, y + size * .6);
  }
  // 像素图按指定矩形显示，保留图集的透明留白。
  image(name: string, x: number, y: number, w: number, h?: number): void {const p = this.c.assets.spr[name]; if (p) this.c.drawImage(p, x, y, w, h ?? w * p.h / p.w);}
  // 对应 object-fit:contain，不裁人物。
  contain(name: string, b: Box): void {const p = this.c.assets.spr[name]; if (!p) return; const s = Math.min(b.w / p.w, b.h / p.h); this.image(name, b.x + (b.w - p.w * s) / 2, b.y + (b.h - p.h * s) / 2, p.w * s, p.h * s);}
  // DESIGN §7：九宫格保留素材四角，边缘按逻辑像素显示；切片由WorldAssets缓存。
  sliced(name: string, b: Box, inset = 16, edge = 8): void {
    const pic = this.c.assets.spr[name]; if (!pic) return;
    const sx = [0, inset, pic.w - inset, pic.w], sy = [0, inset, pic.h - inset, pic.h];
    const ex = Math.min(edge, b.w / 2), ey = Math.min(edge, b.h / 2);
    const dx = [b.x, b.x + ex, b.x + b.w - ex, b.x + b.w], dy = [b.y, b.y + ey, b.y + b.h - ey, b.y + b.h];
    for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++)
      this.c.drawImage(pic, sx[col], sy[row], sx[col + 1] - sx[col], sy[row + 1] - sy[row], dx[col], dy[row], dx[col + 1] - dx[col], dy[row + 1] - dy[row]);
  }
  // 深蓝 HUD 的 2px 描边、内高光和右下硬投影。
  panel(b: Box, fill = '#26324F', hot = false): void {const c = this.c; c.fillStyle = '#0F1628'; c.fillRect(b.x + 2, b.y + 2, b.w, b.h); c.fillRect(b.x, b.y, b.w, b.h); c.fillStyle = fill; c.fillRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4); c.fillStyle = hot ? '#FF8A80' : '#3A4A70'; c.fillRect(b.x + 2, b.y + 2, b.w - 4, 2);}
  // 将原型 border-image 的源像素按九宫格伸缩成 Graphics；navy 源11格、黄色源9格。
  frame(b: Box, navy = false): void {
    const c = this.c, size = navy ? 11 : 9, edge = navy ? 5 : 4, border = navy ? 15 : 6;
    const at = (i: number, length: number) => i <= edge ? i * border / edge : i >= size - edge ? length - (size - i) * border / edge : border + (i - edge) * (length - border * 2) / (size - edge * 2);
    // 逐像素复刻CSS内嵌SVG的源图，含阶梯切角和2×2铆钉，再做九宫格伸缩。
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const outer = y === 0 || y === size - 1 ? 2 : y === 1 || y === size - 2 ? 1 : 0;
      if (x < outer || x >= size - outer) continue;
      let color = navy ? '#0F1628' : '#1F2A44';
      if (navy) {
        const blue = y === 1 || y === 9 ? 3 : y === 2 || y === 8 ? 2 : 1;
        if (y >= 1 && y <= 9 && x >= blue && x < size - blue) color = '#3D63B0';
        if ((y === 4 || y === 6) && x === 5 || y === 5 && x >= 4 && x <= 6) color = '#1E2C52';
        if ((x >= 2 && x <= 3 || x >= 7 && x <= 8) && (y >= 2 && y <= 3 || y >= 7 && y <= 8)) color = '#FFD84D';
      } else if (y >= 2 && y <= 6 && x >= (y === 2 || y === 6 ? 3 : 2) && x < size - (y === 2 || y === 6 ? 3 : 2)) color = '#FFD84D';
      c.fillStyle = color;
      c.fillRect(b.x + at(x, b.w), b.y + at(y, b.h), at(x + 1, b.w) - at(x, b.w), at(y + 1, b.h) - at(y, b.h));
    }
  }
  // *黄* !红! ~绿~ 只解析三个标记，其余文字逐字原样显示。
  runs(text: string, color = '#FFFFFF'): Run[] {const out: Run[] = []; const re = /\*([^*]+)\*|!([^!]+)!|~([^~]+)~/g; let start = 0; for (const m of text.matchAll(re)) {if (m.index! > start) out.push({text: text.slice(start, m.index), color}); out.push({text: m[1] || m[2] || m[3], color: m[1] ? '#FFD84D' : m[2] ? '#FF6F61' : '#67D893'}); start = m.index! + m[0].length;} out.push({text: text.slice(start), color}); return out;}
  // 按CSS正常断行：连续数字/时间整体换行，中文句末标点不落行首；保留跨高亮段的颜色。
  wrap(runs: Run[], width: number, size: number, font: string): Run[][] {
    const tokens: Run[][] = []; let previous = '';
    for (const run of runs) for (const ch of displayText(run.text)) {
      const join = tokens.length && ch !== '\n' && previous !== '\n' &&
        (/[，。、：；！？）〉》」』】”’]/.test(ch) || /[（〈《「『【“‘]/.test(previous) || /[A-Za-z0-9.:+/-]/.test(ch) && /[A-Za-z0-9.:+/-]/.test(previous));
      if (!join) tokens.push([]);
      tokens[tokens.length - 1].push({text: ch, color: run.color}); previous = ch;
    }
    const lines: Run[][] = [[]]; let used = 0;
    for (const token of tokens) {
      const text = token.map(r => r.text).join(''), w = this.width(text, size, font);
      if (text === '\n' || used > 0 && used + w > width + .01) {lines.push([]); used = 0;}
      if (text === '\n' || !used && text === ' ') continue;
      for (const run of token) {const line = lines[lines.length - 1], last = line[line.length - 1]; if (last?.color === run.color) last.text += run.text; else line.push({...run});}
      used += w;
    }
    return lines;
  }
  // 多色多行排版，行高直接沿用 CSS。
  lines(lines: Run[][], x: number, y: number, size: number, font: string, height: number): void {lines.forEach((line, i) => {let xx = x; for (const run of line) {this.text(run.text, xx, y + i * height, size, run.color, font); xx += this.width(run.text, size, font);}});}
}
