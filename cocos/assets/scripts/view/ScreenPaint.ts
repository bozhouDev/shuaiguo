import {UiPaint, Box} from './UiPaint';
import {PX_ICONS} from './ui-data';
export interface ScreenAction extends Box {action: string; label: string}
// 外围页面共用像素切角框、按钮、图标和换行；对应原型v4/v5 CSS。
export class ScreenPaint extends UiPaint {
  actions: ScreenAction[] = [];
  // 9×9原型SVG的九宫格，边宽8px；不是新增手画素材。
  box(b: Box, fill = '#FFF8E6', border = 8, shadow = true): void {
    if (shadow) this.box({...b, x: b.x + 4, y: b.y + 5}, '#0F1628', border, false);
    const at = (i: number, len: number) => i <= 4 ? i * border / 4 : i >= 5 ? len - (9 - i) * border / 4 : 0;
    for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) {
      const edge = y === 0 || y === 8 ? 2 : y === 1 || y === 7 ? 1 : 0;
      if (x < edge || x >= 9 - edge) continue;
      const inside = y >= 2 && y <= 6 && x >= (y === 2 || y === 6 ? 3 : 2) && x < 9 - (y === 2 || y === 6 ? 3 : 2);
      this.c.fillStyle = inside ? fill : '#1F2A44'; this.c.fillRect(b.x + at(x, b.w), b.y + at(y, b.h), at(x + 1, b.w) - at(x, b.w), at(y + 1, b.h) - at(y, b.h));
    }
  }
  // CSS letter-spacing逐字落实，标题与按钮不依赖Label额外字距属性。
  tracked(text:string,x:number,y:number,size:number,gap:number,color:string,font:string):void {for(const ch of text){this.text(ch,x,y,size,color,font);x+=this.width(ch,size,font)+gap;}}
  // 当前日历的深蓝金边，保留阶梯切角。
  goldFrame(b:Box):void {this.box({...b,x:b.x+2,y:b.y+2,w:b.w-4,h:b.h-4},'#F0C000',6,false);this.box({...b,x:b.x+4,y:b.y+4,w:b.w-8,h:b.h-8},'#26324F',3,false);}
  // 原型CSS的SVG点阵转Graphics，小色块不依赖系统emoji。
  icon(name: string, x: number, y: number, size = 30, color = '#1F2A44'): void {const colors: Record<string,string> = {'#': color, w: '#FFFFFF', y: '#FFD84D', o: '#C98A00'}; (PX_ICONS[name] || []).forEach((row, yy) => [...row].forEach((ch, xx) => {if (colors[ch]) {this.c.fillStyle = colors[ch]; this.c.fillRect(x + xx * size / 16, y + yy * size / 16, size / 16, size / 16);}}));}
  // 居中单行，不自动改文案，尺寸按CSS指定。
  center(text: string, x: number, y: number, width: number, size: number, color = '#1F2A44', font = 'body-900', stroke?: string): void {this.text(text, x + (width - this.width(text, size, font)) / 2, y, size, color, font, false, stroke);}
  // 多行正文返回高度供下一块布局，默认原型系统正文字体对应400。
  paragraph(text: string, b: Box, size = 14, color = '#1F2A44', font = 'body-400', line = 1.5): number {const lines = this.wrap([{text, color}], b.w, size, font); this.lines(lines, b.x, b.y, size, font, size * line); return lines.length * size * line;}
  // 元素命中框与画面共用同一数据，方便键盘和真实触控验证。
  hit(action: string, label: string, b: Box): void {this.actions.push({...b, action, label});}
  // 主/次按钮、广告前缀与三级链接；使用真实文本宽度避免前缀压字。
  button(action: string, label: string, b: Box, style: 'main'|'ghost'|'link'|'ad'|'share' = 'main', icon?: string): void {
    const link = style === 'link', fs = link ? 16 : style === 'main' ? 22 : style === 'ad' ? 17 : style === 'share' ? 16 : 18;
    if (!link) {this.box(b, style === 'main' ? '#FFD84D' : style === 'share' && action === 'share-blame' ? '#2F9E6B' : '#FFF8E6', style === 'share' ? 6 : 8);}
    const prefix = style === 'ad' || action === 'buff' ? '▶ 广告 · ' : '', w = this.width(label, fs, link ? 'body-700' : 'body-900'), pw = this.width(prefix, fs * .8, 'body-900'), iw = icon ? 28 : 0, x = b.x + (b.w - w - pw - iw) / 2, y = b.y + (b.h - fs * 1.2) / 2;
    if (icon) this.icon(icon, x, b.y + (b.h - 20) / 2, 20,style==='share'&&action==='share-blame'?'#FFFFFF':'#1F2A44');
    if (prefix) this.text(prefix, x + iw, y + fs * .15, fs * .8, '#E8504A', 'body-900');
    this.text(label, x + iw + pw, y, fs, style==='share'&&action==='share-blame'?'#FFFFFF':link ? '#5E6A84' : '#1F2A44', link ? 'body-700' : 'body-900'); this.hit(action, label, b);
  }
  // 弹窗标题条，边距和原型pop-head一致。
  heading(title: string, icon: string, b: Box, close?: string): void {this.c.fillStyle = '#C9D5E8'; this.c.fillRect(b.x + 16, b.y + 12, b.w - 32, 48); this.c.fillStyle = '#AEBBD2'; this.c.fillRect(b.x + 16, b.y + 57, b.w - 32, 3); const width = this.width(title, 22, 'body-900') + (icon ? 40 : 0), x = b.x + (b.w - width) / 2; if (icon) this.icon(icon, x, b.y + 21, 30); this.text(title, x + (icon ? 40 : 0), b.y + 23, 22, '#1F2A44', 'body-900'); if (close) {this.icon('close', b.x + b.w - 52, b.y + 22, 28); this.hit(close, '关闭', {x: b.x + b.w - 56, y: b.y + 19, w: 34, h: 34});}}
  // 主体两侧各三道黄色放射线，尺寸照CSS。
  rays(b: Box, leftOnly = false): void {for (const side of leftOnly ? [-1] : [-1, 1]) for (let i = 0; i < 3; i++) {this.c.save(); const x = side < 0 ? b.x - (i === 1 ? 30 : 22) : b.x + b.w + (i === 1 ? 24 : 16); this.c.translate(x, b.y + b.h * [.18,.46,.74][i]); this.c.rotate((i - 1) * side * Math.PI / 5); this.c.fillStyle = '#C98A00'; this.c.fillRect(-2,-2,18,10); this.c.fillStyle = '#FFD84D'; this.c.fillRect(0,0,14,6); this.c.restore();}}
  // 同图集星星，保持空星/实星的比例。
  stars(n: number, x: number, y: number, size = 20, gap = 3): void {for (let i = 0; i < 3; i++) {const name=i<n?'ui_star':'ui_star_empty',pic=this.c.assets.spr[name]||{w:96,h:93};this.image(name,x,y,size*pic.w/pic.h,size);x+=size*pic.w/pic.h+gap;}}
}
