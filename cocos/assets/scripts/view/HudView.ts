import {Match} from '../core/match';
import {BUFFS, MAX_POTS, POT_ALARM} from '../core/config';
import {TopAvoidance} from '../platform/Platform';
import {PX_ICONS} from './ui-data';
import {MatchNode} from './MatchNodes';
import {UiPaint, Box} from './UiPaint';
export interface HudAction extends Box {action: string; disabled?: boolean}
// 对应 index.html #hud 与 updateHud；布局先计算整行，再把右侧按钮推到最右。
export class HudView {
  bottom = 0;
  actions: HudAction[] = [];
  pulseAt = -Infinity;
  boxes: Record<string, Box> = {};
  private retainedKeys=new Map<string,string>();
  constructor(readonly p: UiPaint,readonly retained?:MatchNode) {}
  // 闪烁是 CSS 的真实时间动画：.45秒一次，六次往返，不随暂停停止。
  draw(m: Match, real: number, avoid: TopAvoidance): void {
    const c = this.p.c, narrow = c.width <= 420, fs = narrow ? 14 : 15, pad = narrow ? 7 : 9, gap = narrow ? 5 : 6;
    const P = m.S.player, n = m.potsOf(P), ranking = m.ranking(), rank = ranking.indexOf(P) + 1, w = m.workT(), carry = m.carryOf(P), hide = !!m.S.tut && !m.S.tut.showRank, clearing = m.isClearing();
    const entries: {id: string; text: string; icon?: string; hot?: boolean; buff?: boolean; bar?: boolean; action?: string; clearingClock?: boolean}[] = [
      {id: 'clock', text: m.clockAt(w), icon: 'ui_clock', hot: !clearing && w >= m.L.duration - 13, clearingClock: clearing},
      {id: 'pots', text: `${n}/${MAX_POTS}`, icon: 'ui_wok', hot: n >= POT_ALARM, bar: true},
    ];
    if (!hide) entries.push({id: 'rank', text: `第 ${rank}/${ranking.length} 名`, icon: 'ui_crown', hot: rank > m.passRank()}, {id: 'blame', text: carry ? `背锅 ${P.blames}+${m.fmtDebt(carry)}` : `背锅 ${P.blames}`, icon: 'ui_warning'});
    const buff = m.S.buff && BUFFS[m.S.buff];
    if (buff && !(m.S.buff === 'trip' && w >= 30) && !(m.S.buff === 'gold' && m.S.buffUsed)) entries.push({id: 'buff', text: buff.name + (m.S.buff === 'trip' ? ` ${Math.ceil(30 - w)}s` : ''), icon: buff.img, buff: true});
    if (P.combo >= 2) entries.push({id: 'combo', text: `连甩 ×${P.combo}`, hot: true});
    const buttons = [...(m.S.tut && m.mode === 'play' ? [{id: 'skip', text: '跳过教学', action: 'skip'}] : []), {id: 'settings', text: '', action: 'settings'}, {id: 'pause', text: '', icon: 'ui_pause', action: 'pause'}];
    const iconSize = fs * 1.15, barWidth = narrow ? 40 : 64;
    // 原型 inline img 后保留HTML空格；bar 使用 content-box（总宽+4）。
    // 带教隐藏排名时保留原型的比例数字宽度，避免等宽数字多占11px挤走跳过键。
    // 窄屏#hud .chip的14px优先于#btnSkip的13px；只有设置按钮预留图标宽度。
    const textSize = (e: typeof entries[number]) => e.clearingClock ? fs + 3 : e.id === 'skip' && !narrow ? 13 : fs;
    const width = (e: typeof entries[number]) => 4 + pad * 2 + this.p.width(e.text, textSize(e), 'title', !hide) + (e.icon ? iconSize * (c.assets.spr[e.icon]?.w / c.assets.spr[e.icon]?.h || 1) + (e.action ? 0 : 3) : e.id === 'settings' ? iconSize : 0) + (e.bar ? barWidth + 8 : 0);
    const height = (fs + (clearing ? 3 : 0)) * 1.15 + 10, rightWidth = buttons.reduce((s, e) => s + width(e), 0) + (buttons.length - 1) * 6;
    let x = 12, y = avoid.top + 10;
    this.actions = []; this.boxes = {};
    // 任一行与胶囊矩形相交，就缩短该行可用宽；窄到放不下的块整体下移。
    const edge = () => avoid.capsule && y < avoid.capsule.y + avoid.capsule.h && y + height > avoid.capsule.y ? Math.min(c.width - 12, avoid.capsule.x - 8) : c.width - 12;
    const reserve = (size: number) => {while (x + size > edge() + .01 && (x > 12 || edge() < c.width - 12)) {x = 12; y += height + gap;}};
    const draw = (e: typeof entries[number], b: Box) => {
      this.boxes[e.id] = b;
      if(this.retained){this.drawRetained(e,b,m,real,fs,pad,iconSize,barWidth,height,hide);if(e.action)this.actions.push({...b,action:e.action,disabled:m.mode==='closing'});return;}
      c.save();
      const elapsed = real - this.pulseAt;
      if (e.id === 'rank' && elapsed >= 0 && elapsed < .45 * 6) {const phase = elapsed / .45, f = (Math.floor(phase) % 2 ? 1 - phase % 1 : phase % 1), s = 1 + .15 * (.5 - .5 * Math.cos(f * Math.PI)); c.translate(b.x + b.w / 2, b.y + b.h / 2); c.scale(s, s); c.translate(-b.x - b.w / 2, -b.y - b.h / 2); c.fillStyle = '#FFD84D'; c.fillRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4);}
      if (e.action && m.mode === 'closing') c.globalAlpha = .5;
      this.p.panel(b, e.hot ? '#E8504A' : e.buff ? '#FFD84D' : '#26324F', !!e.hot);
      let xx = b.x + 2 + pad;
      if (e.icon) {const pic = c.assets.spr[e.icon], iw = iconSize * (pic?.w / pic?.h || 1); this.p.image(e.icon, xx, b.y + (height - iconSize) / 2, iw, iconSize); xx += iw + 3;}
      if (e.id === 'settings') this.gear(xx, b.y + (height - iconSize) / 2, iconSize);
      else this.p.text(e.text, xx, b.y + (height - textSize(e) * 1.2) / 2, textSize(e), e.clearingClock ? '#E8504A' : e.hot ? '#FFFFFF' : e.buff ? '#1F2A44' : '#FFF6D8', 'title', !hide);
      if (e.bar) {const bx = b.x + b.w - pad - barWidth - 6, by = b.y + (height - 13) / 2; c.fillStyle = '#0F1628'; c.fillRect(bx, by, barWidth + 4, 13); c.fillStyle = '#11192D'; c.fillRect(bx + 2, by + 2, barWidth, 9); c.fillStyle = '#E8504A'; c.fillRect(bx + 2, by + 2, barWidth * Math.min(1, n / MAX_POTS), 9);}
      if (e.action) this.actions.push({...b, action: e.action, disabled: m.mode === 'closing'});
      c.restore();
    };
    if(this.retained){const shown=new Set([...entries,...buttons].map(e=>e.id));for(const [name,node]of this.retained.children)node.show(shown.has(name));}
    for (const e of entries) {const ww = width(e); reserve(ww); draw(e, {x, y, w: ww, h: height}); x += ww + gap;}
    // 两组相邻边框按像素栅格允许2px取整余量；避免字体hmtx与DOM像素舍入将整组挤下。
    reserve(rightWidth - (hide ? 2 : 0)); x = edge() - rightWidth;
    for (const e of buttons) {const ww = width(e); draw(e, {x, y, w: ww, h: height}); x += ww + 6;}
    this.bottom = y + height;
  }
  // 每个筹码一个常驻容器；内容/布局变了才更新，排名脉冲只改变容器transform和底板显隐。
  private drawRetained(e:{id:string;text:string;icon?:string;hot?:boolean;buff?:boolean;bar?:boolean;action?:string;clearingClock?:boolean},b:Box,m:Match,real:number,fs:number,pad:number,iconSize:number,barWidth:number,height:number,hide:boolean):void {
    const n=this.retained!.child(e.id).show(true),elapsed=real-this.pulseAt,pulse=e.id==='rank'&&elapsed>=0&&elapsed<.45*6;
    let scale=1;if(pulse){const phase=elapsed/.45,f=Math.floor(phase)%2?1-phase%1:phase%1;scale=1+.15*(.5-.5*Math.cos(f*Math.PI));}
    n.at(b.x+b.w/2,b.y+b.h/2,0,scale);const content=n.child('content').at(-b.w/2,-b.h/2),glow=content.child('pulse').show(pulse);if(pulse)glow.rect(-2,-2,b.w+4,b.h+4,'#FFD84D');
    const pots=m.potsOf(m.S.player),alpha=e.action&&m.mode==='closing'?.5:1,key=JSON.stringify([e,b.w,b.h,fs,pad,iconSize,barWidth,hide,alpha,e.bar?pots:0]);if(this.retainedKeys.get(e.id)===key)return;this.retainedKeys.set(e.id,key);
    content.child('shadow').rect(2,2,b.w,b.h,'#0F1628',alpha);content.child('border').rect(0,0,b.w,b.h,'#0F1628',alpha);content.child('fill').rect(2,2,b.w-4,b.h-4,e.hot?'#E8504A':e.buff?'#FFD84D':'#26324F',alpha);content.child('highlight').rect(2,2,b.w-4,2,e.hot?'#FF8A80':'#3A4A70',alpha);
    let x=2+pad;const icon=content.child('icon').show(!!e.icon);if(e.icon){const pic=this.p.c.assets.spr[e.icon],w=iconSize*pic.w/pic.h;icon.image(e.icon,x+w/2,height/2,w,{h:iconSize,alpha});x+=w+3;}
    const gear=content.child('gear').show(e.id==='settings');if(e.id==='settings'){const rows=PX_ICONS.gear,xy:number[]=[],indices:number[]=[],y=(height-iconSize)/2,d=iconSize/16;rows.forEach((row,yy)=>Array.from(row).forEach((ch,xx)=>{if(ch!=='#')return;const i=xy.length/2,px=x+xx*d,py=y+yy*d;xy.push(px,py,px+d,py,px,py+d,px+d,py+d);indices.push(i,i+1,i+2,i+1,i+3,i+2);}));gear.mesh({xy,indices},'#FFF6D8',alpha);}
    const label=content.child('text').show(e.id!=='settings');if(e.id!=='settings'){const size=e.clearingClock?fs+3:e.id==='skip'&&this.p.c.width>420?13:fs;this.retainedText(label,e.text,x,(height-size*1.2)/2,size,e.clearingClock?'#E8504A':e.hot?'#FFFFFF':e.buff?'#1F2A44':'#FFF6D8',!hide,alpha);}
    const bar=content.child('bar').show(!!e.bar);if(e.bar){const x=b.w-pad-barWidth-6,y=(height-13)/2;bar.child('border').rect(x,y,barWidth+4,13,'#0F1628');bar.child('bg').rect(x+2,y+2,barWidth,9,'#11192D');bar.child('value').rect(x+2,y+2,barWidth*Math.min(1,pots/MAX_POTS),9,'#E8504A');}
  }
  // 逐run复用UiPaint既有tabular布局公式，确保时间/名次数字的字距和折行不变。
  private retainedText(node:MatchNode,text:string,x:number,y:number,size:number,color:string,tabular:boolean,alpha:number):void {
    const runs=tabular?text.match(/\d|[^\d]+/g)||[]:[text];for(const [name,n]of node.children)if(Number(name)>=runs.length)n.show(false);
    runs.forEach((run,i)=>{const width=this.p.width(run,size,'title',tabular),actual=this.p.width(run,size,'title');node.child(String(i)).text(run,x+(width-actual)/2+actual/2,y+size*.6,size,color,'','title',alpha);x+=width;});
  }
  // 原型 PX_ICONS.gear 的16×16点阵，使用Graphics复刻，不另引素材。
  private gear(x: number, y: number, size: number): void {const rows = PX_ICONS.gear; const c = this.p.c; c.fillStyle = '#FFF6D8'; rows.forEach((row, yy) => Array.from(row).forEach((ch, xx) => {if (ch === '#') c.fillRect(x + xx * size / 16, y + yy * size / 16, size / 16, size / 16);}));}
}
