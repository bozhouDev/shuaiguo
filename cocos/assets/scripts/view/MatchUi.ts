import {Match} from '../core/match';
import {CoreEvent} from '../core/types';
import {TopAvoidance} from '../platform/Platform';
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
  private panel: Box | null = null;
  // CSS真实时间使用performance.now，浏览器暂停/后台不会停止toast；freeze截图可固定real。
  constructor(readonly surface: DrawSurface, readonly match: Match, readonly avoidance: () => TopAvoidance, readonly paused: () => boolean, readonly action: (name: string) => void) {this.p = new UiPaint(surface); this.hud = new HudView(this.p); this.messages = new MessageView(this.p); this.closing = new ClosingView(this.p); this.tutorial = new TutorialView(this.p);}
  // 事件消费与世界层共享同一队列，声音意图留给P4。
  event(e: CoreEvent): void {this.messages.event(e.kind, e.args, this.real); if (e.kind === 'closingNotice') this.closing.event(e.args[0] as ClosingNotice, this.real); if (e.kind === 'coachRankPulse') this.hud.pulseAt = this.real; }
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
  // 本层只负责对局HUD与提示，外围卡片由AppView接管。
  draw(real: number, fire: {x: number; y: number}, reduce: boolean, debugCapsule = false): void {
    this.real = real; const c = this.surface, avoid = this.avoidance(); c.begin(); this.hud.draw(this.match, real, avoid);
    // 仅预览 capsule=1 时标出假胶囊和44px顶部边界，正式平台不画调试框。
    if (debugCapsule && avoid.capsule) {
      const b = avoid.capsule; c.fillStyle = 'rgba(255,216,77,.2)'; c.fillRect(b.x, b.y, b.w, b.h);
      c.strokeStyle = '#E8504A'; c.lineWidth = 3; c.strokeRect(b.x, b.y, b.w, b.h);
      c.fillStyle = '#E8504A'; c.fillRect(0, avoid.top - 1, c.width, 2);
      this.p.text('87×32', b.x + 10, b.y + 9, 14, '#E8504A', 'title');
    }
    this.messages.draw(real, this.hud.bottom, !this.closing.notice.hidden); this.tutorial.draw(this.match, real, this.messages.startBox, fire, reduce); this.closing.draw(real, this.hud.bottom, reduce);
    this.panel = null;

    this.messages.drawToast(real); c.end();
  }
}
