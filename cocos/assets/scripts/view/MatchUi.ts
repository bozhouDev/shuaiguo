import {Match} from '../core/match';
import {CoreEvent} from '../core/types';
import {TopAvoidance} from '../platform/Platform';
import {RetainedWorld} from './RetainedWorld';
import {MatchNode} from './MatchNodes';
import {DrawSurface} from './DrawSurface';
import {UiPaint, Box} from './UiPaint';
import {HudView} from './HudView';
import {MessageView} from './MessageView';
import {ClosingView, ClosingNotice} from './ClosingView';
import {TutorialView} from './TutorialView';
// HUD、消息、带教、收尾的组织器；所有输入仍交回core公开API。
export class MatchUi {
  readonly p: UiPaint; readonly hud: HudView; readonly messages: MessageView; readonly closing: ClosingView; readonly tutorial: TutorialView;
  real = 0; result: {myRank: number} | null = null;
  private panel: Box | null = null;private calloutNodes?:MatchNode;
  callout?:{text:string;color:string;until:number;clock?:boolean};private hudNodes?:MatchNode;private clearingNodes?:MatchNode;private lastDrawKey:string|null=null;
  // CSS真实时间使用performance.now，浏览器暂停/后台不会停止toast；freeze截图可固定real。
  constructor(readonly surface: DrawSurface, readonly match: Match, readonly avoidance: () => TopAvoidance, readonly paused: () => boolean, readonly action: (name: string) => void,nodes?:RetainedWorld) {this.p = new UiPaint(surface);this.calloutNodes=nodes?new MatchNode(surface.root,'MatchCallout',nodes.atlas):undefined; this.hudNodes=nodes?new MatchNode(surface.root,'HUD',nodes.atlas):undefined;this.clearingNodes=nodes?new MatchNode(surface.root,'ClearingCountdown',nodes.atlas):undefined;this.hud = new HudView(this.p,this.hudNodes); this.messages = new MessageView(this.p); this.closing = new ClosingView(this.p); this.tutorial = new TutorialView(this.p);}
  // 事件消费与世界层共享同一队列，声音意图留给P4。
  event(e: CoreEvent): void {this.messages.event(e.kind, e.args, this.real); if (e.kind === 'closingNotice') this.closing.event(e.args[0] as ClosingNotice, this.real); if (e.kind === 'coachRankPulse' || e.kind === 'rankChange') this.hud.pulseAt = this.real;
    // 同一个常驻横幅替换内容，不进入tips计数，也不堆叠消息。
    if(e.kind==='rankCallout'){const r=e.args[0] as {from:number;to:number;who:string},up=r.to<r.from;this.callout={text:up?`超了${r.who}，第 ${r.to}！`:`被${r.who}挤到第 ${r.to}，要加班了`,color:up?'#2F9E6B':'#E8504A',until:this.real+.8};}
    if(e.kind==='buzzer')this.callout={text:'压哨下班',color:'#2F9E6B',until:this.real+.6,clock:true};
    if(e.kind==='revenge'&&(e.args[0] as {count:number}).count===3)this.callout={text:'冤冤相报',color:'#2F9E6B',until:this.real+1};
    if(e.kind==='finish')this.clearFeedback();
  }
  // 休息、后台与结束立刻收起表现横幅，复用节点仍留给下一次事件。
  clearFeedback():void {this.callout=undefined;this.calloutNodes?.show(false);}
  // 在HUD下沿绘制独立常驻横幅，清账也显示，时钟用现有像素图标。
  private drawCallout(real:number):void {
    const n=this.calloutNodes;if(!n)return;const info=this.callout,on=!!info&&real<info.until;n.show(on);if(!on||!info)return;
    // 与ClosingView相同比例计算下沿，清账和铃响时留8px间隔，不遮原数字。
    const closingHeight=this.closing.notice.hidden?0:Math.min(390,this.surface.width-16)*296/1204+8;
    const hint=this.messages?.hintBox,msg=this.messages?.msgBox;
    const width=Math.min(this.surface.width-24,420),x=(this.surface.width-width)/2,y=Math.max(this.hud.bottom+10+closingHeight,hint?hint.y+hint.h+8:0,msg?msg.y+msg.h+8:0),size=Math.min(17,(width-32-(info.clock?24:0))/Math.max(1,Array.from(info.text).length));
    n.child('shadow').rect(x+3,y+3,width,38,'#1F2A44');n.child('paper').rect(x,y,width,38,info.color);
    n.child('clock').show(!!info.clock);if(info.clock)n.child('clock').image('ui_clock',x+width/2-56,y+19,20);
    n.child('text').text(info.text,x+width/2+(info.clock?12:0),y+19,size,'#FFFDF5','','body-900');
  }
  // 显示池移交时仅移除本实例的HUD，不能留下引用旧图集帧的节点。
  destroy():void {for(const n of [this.hudNodes,this.clearingNodes,this.calloutNodes])if(n){n.node.removeFromParent();n.destroy();}}
  // 指针命中在InputView摇杆处理之前调用，面板/最后一步不允许穿透操作。
  pointer(x: number, y: number): boolean {
    const inside = (b: Box | null) => b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
    if (this.paused()) return true;
    if (this.match.coachLocked()) {if (inside(this.messages.startBox)) this.action('start'); return true;}
    for (const b of this.hud.actions) if (inside(b)) {if (!b.disabled) this.action(b.action); return true;}
    return this.match.mode !== 'play';
  }
  // Enter/空格仅激活最后一步的开始上班按钮，其他输入锁定。
  key(code: number): boolean {if (!this.match.coachLocked()) return this.paused() || this.match.mode !== 'play'; if (code === 13 || code === 32) this.action('start'); return true;}
  // 暂停不冻结尚未结束的CSS等价动画；稳态才复用HUD/横幅节点，null表示本帧仍需绘制。
  pausedVisualKey(real:number,reduce:boolean):string|null {
    const m=this.messages,n=this.closing.notice;
    if(real-m.hintChange<.34||real-m.msgChange<.25||real-m.toastAt<.2||real>=m.toastUntil&&real-m.toastUntil<.2||!reduce&&(real-this.hud.pulseAt<2.7||!!this.match.S.tut||!n.hidden&&!!n.warning))return null;
    return [m.hintOn,m.hintChange,m.msgOn,m.msgChange,m.toastAt,real<m.toastUntil,n.hidden,n.seconds,n.title,n.detail,n.passed].join(':');
  }
  // 中央末五秒是独立常驻节点；只读取游戏秒，不另发滴答声，横幅仍占HUD下方。
  private drawClearing():void {
    const n=this.clearingNodes;if(!n)return;const m=this.match,left=Math.ceil(m.L.duration-m.workT()),on=m.mode==='play'&&m.isClearing()&&left>=1&&left<=5;
    n.show(on);if(!on)return;
    const c=this.surface,size=80,bannerBottom=this.hud.bottom+10+Math.min(390,c.width-16)*296/1204;
    const y=Math.max(c.height/2,bannerBottom+size/2+18);
    n.child('digit').text(String(left),c.width/2,y,size,'#E8504A','#FFFDF5','body-900');
  }
  // 本层只负责对局HUD与提示，外围卡片由AppView接管。
  draw(real: number, fire: {x: number; y: number}, reduce: boolean, debugCapsule = false): void {
    this.real = real; const c = this.surface, avoid = this.avoidance();
    if(this.hudNodes){
      this.hud.draw(this.match,real,avoid);this.drawClearing();
      // 稳定消息/提示沿用已有节点；入退场、倒计时警告与教学目标仍逐帧绘制，HUD单独更新。
      const visual=this.match.S.tut?null:this.pausedVisualKey(real,reduce),key=visual===null?null:JSON.stringify([visual,c.width,c.height,this.hud.bottom,avoid,reduce,debugCapsule]);
      if(key!==null&&key===this.lastDrawKey){this.drawCallout(real);return;}this.lastDrawKey=key;c.begin();c.insertLayer(this.hudNodes.node);
    }else {c.begin();this.hud.draw(this.match,real,avoid);}
    // 仅预览 capsule=1 时标出假胶囊和44px顶部边界，正式平台不画调试框。
    if (debugCapsule && avoid.capsule) {
      const b = avoid.capsule; c.fillStyle = 'rgba(255,216,77,.2)'; c.fillRect(b.x, b.y, b.w, b.h);
      c.strokeStyle = '#E8504A'; c.lineWidth = 3; c.strokeRect(b.x, b.y, b.w, b.h);
      c.fillStyle = '#E8504A'; c.fillRect(0, avoid.top - 1, c.width, 2);
      this.p.text('87×32', b.x + 10, b.y + 9, 14, '#E8504A', 'title');
    }
    this.messages.draw(real, this.hud.bottom, !this.closing.notice.hidden); this.tutorial.draw(this.match, real, this.messages.startBox, fire, reduce); this.closing.draw(real, this.hud.bottom, reduce);
    this.drawCallout(real); // 先取得本帧消息/提示矩形，首帧也不能压住它们。
    this.panel = null;

    this.messages.drawToast(real);if(this.clearingNodes)c.insertLayer(this.clearingNodes.node);if(this.calloutNodes)c.insertLayer(this.calloutNodes.node); c.end();
  }
}
