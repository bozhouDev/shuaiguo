import {Match} from '../core/match';
import {OFFICE} from '../core/levels';
import {Box, UiPaint} from './UiPaint';
import {PRAISE} from './praise-data';
import {uiEase} from './ui-data';
type Kind = keyof typeof PRAISE;
const KINDS = {calm:{title:'稳住了！',sub:'零背锅',pri:1,hold:.9,cool:10},parry:{title:'漂亮！',sub:'反弹成功',pri:2,hold:.9,cool:3},rankup:{title:'好样的！',sub:'',pri:3,hold:1.2,cool:0}};
interface Item {kind: Kind; at: number; y: number; scale: number; out?: number; interrupt?: boolean; reduce: boolean}
// 原型praise/checkPraiseRank和E.praise；冷却用对局秒，动画用真实秒，全归画面层。
export class PraiseView {
  private current: Item | null = null; private leaving: Item[] = [];
  private at: Partial<Record<Kind,number>> = {}; private outSince: number | null = null;
  constructor(readonly p: UiPaint, readonly sound: (name:string)=>void, readonly buzz: (ms:number)=>void) {}
  // 弹窗/大厅/新局清理全部动画状态，不改玩法字段。
  clear(): void {this.current=null;this.leaving=[];}
  // 新局另重置冷却和排名连续计时。
  reset(): void {this.clear();this.at={};this.outSince=null;}
  // 按屏幕中心30%/62%和原型避让公式选择一次位置，播放中不移动。
  show(kind: string, m: Match, real: number, occupied: Box[], reduce: boolean, paused=false): boolean {
    if(!(kind in KINDS)||!this.p.c.assets.spr[`praise-${kind}`]||paused||m.simulating||m.S.tut||m.mode!=='play'||m.S.over)return false;
    const k=kind as Kind,def=KINDS[k];if(k==='calm'&&m.S.player.blames!==0)return false;if(m.S.t-(this.at[k]??-Infinity)<def.cool||this.current&&def.pri<=KINDS[this.current.kind].pri)return false;
    const c=this.p.c,data=PRAISE[k],scale=Math.min(1,(c.width-24)/((data.w+18)*1.06)),half=(data.h+20)*scale*1.06/2,me=m.S.player.sn,camY=OFFICE.world.h<c.height?(OFFICE.world.h-c.height)/2:Math.max(0,Math.min(OFFICE.world.h-c.height,me.y-c.height/2)),avoidY=me.y-camY;
    const rects=[...occupied.map(b=>({top:b.y,bottom:b.y+b.h})),{top:avoidY-50,bottom:avoidY+40}],target=c.height*(avoidY>=c.height*.16&&avoidY<=c.height*.46?.62:.30),safe=(y:number)=>y-half-28>=12&&y+half<=c.height-12&&rects.every(r=>y+half<r.top-8||y-half-28>r.bottom+8);
    const y=safe(target)?target:[c.height*.62,c.height*.30,...rects.flatMap(r=>[r.bottom+half+37,r.top-half-9])].filter(safe).sort((a,b)=>Math.abs(a-target)-Math.abs(b-target))[0];if(y===undefined)return false;
    if(this.current){this.current.out=real;this.current.interrupt=true;this.leaving.push(this.current);}this.current={kind:k,at:real,y,scale,reduce};this.at[k]=m.S.t;if(k==='rankup'){this.sound('rankup');this.buzz(30);}return true;
  }
  // 连续名额外3秒才表扬；首次掉出名额播放rankDown，由音效层统一去重。
  rank(m: Match, real: number, occupied: Box[], reduce: boolean, paused: boolean): void {if(paused||m.simulating||m.S.tut||m.mode!=='play'||m.S.over||m.workT()<=15){this.outSince=null;return;}if(m.ranking().indexOf(m.S.player)+1>m.passRank()){if(this.outSince===null){this.outSince=m.S.t;this.sound('rankDown');}}else{if(this.outSince!==null&&m.S.t-this.outSince>=3)this.show('rankup',m,real,occupied,reduce);this.outSince=null;}}
  // 后到横幅优先，按原型当前贴纸矩形检测遮挡，立即移除。
  draw(real: number, occupied: Box[], rankWords: string): void {
    const c=this.p.c;if(this.current){const v=this.current,d=PRAISE[v.kind],top=v.y-d.h*v.scale/2;if(occupied.some(b=>c.width/2-d.w*v.scale/2<b.x+b.w&&c.width/2+d.w*v.scale/2>b.x&&top-28<b.y+b.h+8&&top+d.h*v.scale>b.y-8))this.clear();}
    for(const v of [...this.leaving,...(this.current?[this.current]:[])]){const d=PRAISE[v.kind],def=KINDS[v.kind],age=real-v.at,pop=v.reduce?.16:.22;if(v.out===undefined&&age>=pop+def.hold)v.out=v.at+pop+def.hold;const duration=v.reduce?.16:v.interrupt?.12:.36,out=v.out===undefined?0:Math.min(1,Math.max(0,(real-v.out)/duration));if(out>=1){if(this.current===v)this.current=null;this.leaving=this.leaving.filter(i=>i!==v);continue;}
      const t=uiEase(Math.min(1,age/pop),.2,.8,.3,1),sc=v.reduce?1:t<.6?.72+.34*t/.6:1.06-.06*(t-.6)/.4,nod=!v.reduce&&age>.48&&age<.74?-3*((age-.48)/.26<.3?(age-.48)/.078:(.74-age)/.182):0,dy=v.reduce?0:6*(1-Math.min(1,t/.6))+nod-uiEase(out,.5,0,.9,.6)*(v.interrupt?10:28);
      c.save();c.globalAlpha=(v.reduce?t:Math.min(1,t/.6))*(1-uiEase(out,.5,0,.9,.6));c.translate(c.width/2,v.y+dy);c.scale(v.scale*sc,v.scale*sc);this.p.image(`praise-${v.kind}`,-d.w/2,-d.h/2,d.w,d.h);const sub=v.kind==='rankup'?`冲进${rankWords}`:def.sub;const sw=this.p.width(sub,18,'body-900')+[...sub].length*2;let xx=-d.w/2+d.subX-sw/2;for(const ch of sub){this.p.text(ch,xx+2,-d.h/2+d.subY-9,18,'#0F1628','body-900');this.p.text(ch,xx,-d.h/2+d.subY-11,18,'#FFD84D','body-900');xx+=this.p.width(ch,18,'body-900')+2;}
      // 原型九格闪光，按每颗s取整像素格；不是用普通五角星替换。
      const spark=['....K....','...KYK...','...KYK...','.KKYWYKK.','KYYWWWYYK','.KKYWYKK.','...KYK...','...KYK...','....K....'];
      for(const [i,star] of d.sparks.entries()){const local=age-i*.12,phase=Math.max(0,local)%.96,scale=v.reduce?1:local<0?1:phase<.48?.55:1,b=Math.max(1,Math.round(2*star.s)),size=9*b;for(let y=0;y<9;y++)for(let x=0;x<9;x++){const color={K:'#1F2A44',Y:'#FFD84D',W:'#FFF8E6'}[spark[y][x]];if(!color)continue;c.fillStyle=color;c.fillRect(-d.w/2+star.x+(x*b-size/2)*scale,-d.h/2+star.y+(y*b-size/2)*scale,b*scale,b*scale);}}
      c.restore();}
  }
}
