import {Match} from '../core/match';
import {BUFFS, MAX_POTS, POT_ALARM} from '../core/config';
import {TopAvoidance} from '../platform/Platform';
import {UiPaint, Box} from './UiPaint';
export interface HudAction extends Box {action: string; disabled?: boolean}
// 对应 index.html #hud 与 updateHud；布局先计算整行，再把右侧按钮推到最右。
export class HudView {
  bottom = 0;
  actions: HudAction[] = [];
  pulseAt = -Infinity;
  boxes: Record<string, Box> = {};
  constructor(readonly p: UiPaint) {}
  // 闪烁是 CSS 的真实时间动画：.45秒一次，六次往返，不随暂停停止。
  draw(m: Match, real: number, avoid: TopAvoidance): void {
    const c = this.p.c, narrow = c.width <= 420, fs = narrow ? 14 : 15, pad = narrow ? 7 : 9, gap = narrow ? 5 : 6;
    const P = m.S.player, n = m.potsOf(P), ranking = m.ranking(), rank = ranking.indexOf(P) + 1, w = m.workT(), carry = m.carryOf(P), hide = !!m.S.tut && !m.S.tut.showRank;
    const entries: {id: string; text: string; icon?: string; hot?: boolean; buff?: boolean; bar?: boolean; action?: string}[] = [
      {id: 'clock', text: m.clockAt(w), icon: 'ui_clock', hot: w >= m.L.duration - 13},
      {id: 'pots', text: `${n}/${MAX_POTS}`, icon: 'ui_wok', hot: n >= POT_ALARM, bar: true},
    ];
    if (!hide) entries.push({id: 'rank', text: `第 ${rank}/${ranking.length} 名`, icon: 'ui_crown', hot: rank > m.passRank()}, {id: 'blame', text: carry ? `背锅 ${P.blames}+${m.fmtDebt(carry)}` : `背锅 ${P.blames}`, icon: 'ui_warning'});
    const buff = m.S.buff && BUFFS[m.S.buff];
    if (buff && !(m.S.buff === 'trip' && w >= 30) && !(m.S.buff === 'gold' && m.S.buffUsed)) entries.push({id: 'buff', text: buff.name + (m.S.buff === 'trip' ? ` ${Math.ceil(30 - w)}s` : ''), icon: buff.img, buff: true});
    if (P.combo >= 2) entries.push({id: 'combo', text: `连甩 ×${P.combo}`, hot: true});
    const buttons = [...(m.S.tut && m.mode === 'play' ? [{id: 'skip', text: '跳过教学', action: 'skip'}] : []), {id: 'settings', text: '', action: 'settings'}, {id: 'pause', text: '', icon: 'ui_pause', action: 'pause'}];
    const iconSize = fs * 1.15, barWidth = narrow ? 40 : 64;
    // 原型 inline img 后保留HTML空格；bar 使用 content-box（总宽+4）。
    // 窄屏#hud .chip的14px优先于#btnSkip的13px；只有设置按钮预留图标宽度。
    const textSize = (e: typeof entries[number]) => e.id === 'skip' && !narrow ? 13 : fs;
    const width = (e: typeof entries[number]) => 4 + pad * 2 + this.p.width(e.text, textSize(e), 'title', true) + (e.icon ? iconSize * (c.assets.spr[e.icon]?.w / c.assets.spr[e.icon]?.h || 1) + (e.action ? 0 : 3) : e.id === 'settings' ? iconSize : 0) + (e.bar ? barWidth + 8 : 0);
    const height = fs * 1.15 + 10, rightWidth = buttons.reduce((s, e) => s + width(e), 0) + (buttons.length - 1) * 6;
    let x = 12, y = avoid.top + 10;
    this.actions = []; this.boxes = {};
    // 任一行与胶囊矩形相交，就缩短该行可用宽；窄到放不下的块整体下移。
    const edge = () => avoid.capsule && y < avoid.capsule.y + avoid.capsule.h && y + height > avoid.capsule.y ? Math.min(c.width - 12, avoid.capsule.x - 8) : c.width - 12;
    const reserve = (size: number) => {while (x + size > edge() + .01 && (x > 12 || edge() < c.width - 12)) {x = 12; y += height + gap;}};
    const draw = (e: typeof entries[number], b: Box) => {
      this.boxes[e.id] = b; c.save();
      const elapsed = real - this.pulseAt;
      if (e.id === 'rank' && elapsed >= 0 && elapsed < .45 * 6) {const phase = elapsed / .45, f = (Math.floor(phase) % 2 ? 1 - phase % 1 : phase % 1), s = 1 + .15 * (.5 - .5 * Math.cos(f * Math.PI)); c.translate(b.x + b.w / 2, b.y + b.h / 2); c.scale(s, s); c.translate(-b.x - b.w / 2, -b.y - b.h / 2); c.fillStyle = '#FFD84D'; c.fillRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4);}
      if (e.action && m.mode === 'closing') c.globalAlpha = .5;
      this.p.panel(b, e.hot ? '#E8504A' : e.buff ? '#FFD84D' : '#26324F', !!e.hot);
      let xx = b.x + 2 + pad;
      if (e.icon) {const pic = c.assets.spr[e.icon], iw = iconSize * (pic?.w / pic?.h || 1); this.p.image(e.icon, xx, b.y + (height - iconSize) / 2, iw, iconSize); xx += iw + 3;}
      if (e.id === 'settings') this.gear(xx, b.y + (height - iconSize) / 2, iconSize);
      else this.p.text(e.text, xx, b.y + (height - textSize(e) * 1.2) / 2, textSize(e), e.hot ? '#FFFFFF' : e.buff ? '#1F2A44' : '#FFF6D8', 'title', true);
      if (e.bar) {const bx = b.x + b.w - pad - barWidth - 6, by = b.y + (height - 13) / 2; c.fillStyle = '#0F1628'; c.fillRect(bx, by, barWidth + 4, 13); c.fillStyle = '#11192D'; c.fillRect(bx + 2, by + 2, barWidth, 9); c.fillStyle = '#E8504A'; c.fillRect(bx + 2, by + 2, barWidth * Math.min(1, n / MAX_POTS), 9);}
      if (e.action) this.actions.push({...b, action: e.action, disabled: m.mode === 'closing'});
      c.restore();
    };
    for (const e of entries) {const ww = width(e); reserve(ww); draw(e, {x, y, w: ww, h: height}); x += ww + gap;}
    reserve(rightWidth); x = edge() - rightWidth;
    for (const e of buttons) {const ww = width(e); draw(e, {x, y, w: ww, h: height}); x += ww + 6;}
    this.bottom = y + height;
  }
  // 原型 PX_ICONS.gear 的16×16点阵，使用Graphics复刻，不另引素材。
  private gear(x: number, y: number, size: number): void {const rows = ['.......##.......','......####......','...##.####.##...','..############..','..############..','...##########...','.#####....#####.','######....######','######....######','.#####....#####.','...##########...','..############..','..############..','...##.####.##...','......####......','.......##.......']; const c = this.p.c; c.fillStyle = '#FFF6D8'; rows.forEach((row, yy) => [...row].forEach((ch, xx) => {if (ch === '#') c.fillRect(x + xx * size / 16, y + yy * size / 16, size / 16, size / 16);}));}
}
