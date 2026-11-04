import {EventKeyboard, EventTouch, Input, KeyCode, input, sys} from 'cc';
import {Match} from '../core/match';
import {THROW_CD} from '../core/config';
import {RetainedWorld} from './RetainedWorld';
import {MatchNode} from './MatchNodes';
import {DrawSurface} from './DrawSurface';
import {SpriteTools, stickCenter} from './SpriteTools';

const KEYS: Record<number, string> = {
  [KeyCode.ARROW_LEFT]: 'arrowleft', [KeyCode.ARROW_RIGHT]: 'arrowright', [KeyCode.ARROW_UP]: 'arrowup', [KeyCode.ARROW_DOWN]: 'arrowdown',
  [KeyCode.KEY_A]: 'a', [KeyCode.KEY_D]: 'd', [KeyCode.KEY_W]: 'w', [KeyCode.KEY_S]: 's', [KeyCode.SPACE]: ' ', [KeyCode.KEY_J]: 'j', [KeyCode.ESCAPE]: 'escape', [KeyCode.KEY_P]: 'p',
};
// 对应 engine createInput；全局触摸可同时读两根手指，甩锅触点从摇杆输入中排除。
export class InputView {
  private tools: SpriteTools;private retained?:MatchNode;
  private fireTouches = new Set<number>();
  private pressed = new Set<number>();
  constructor(readonly match: Match, readonly surface: DrawSurface, readonly togglePause: () => void, readonly pointer: (x: number, y: number) => boolean, readonly key: (code: number) => boolean, readonly enabled: () => boolean,nodes?:RetainedWorld) {
    this.tools = new SpriteTools(surface.assets);this.retained=nodes?new MatchNode(surface.root,'ThrowButton',nodes.atlas):undefined;
    input.on(Input.EventType.TOUCH_START, this.down, this); input.on(Input.EventType.TOUCH_MOVE, this.move, this);
    input.on(Input.EventType.TOUCH_END, this.up, this); input.on(Input.EventType.TOUCH_CANCEL, this.up, this);
    if (sys.isBrowser) { input.on(Input.EventType.KEY_DOWN, this.keyDown, this); input.on(Input.EventType.KEY_UP, this.keyUp, this); }
  }
  // right=22、bottom=max(34,20vh−46)，按钮直径92，与原型 CSS 相同。
  fireCenter(): {x: number; y: number} {return {x: this.surface.width - 22 - 46, y: this.surface.height - Math.max(34, this.surface.height * .2 - 46) - 46};}
  // 原型6px死区、52px半径；轻推仅旋转的0.35阈值由core计算。
  private aim(x: number, y: number): void {
    const inp = this.match.inp, c = stickCenter(this.surface.width, this.surface.height), dx = x - c.x, dy = y - c.y, d = Math.hypot(dx, dy);
    if (d > 6) inp.angle = Math.atan2(dy, dx); inp.mag = Math.min(1, d / 52);
    const k = d > 52 ? 52 / d : 1; inp.x = c.x + dx * k; inp.y = c.y + dy * k;
  }
  // 按下立即计一次甩；第二根摇杆手指不抢第一根的ID。
  private down(e: EventTouch): void {
    const p = e.getUILocation(), x = p.x, y = this.surface.height - p.y, id = e.getID()!, c = this.fireCenter();
    if (this.pointer(x, y) || !this.enabled() || this.match.mode !== 'play') return;
    if (Math.hypot(x - c.x, y - c.y) <= 46) {this.fireTouches.add(id); this.match.inp.fire++; return;}
    if (this.match.inp.down) return; this.match.inp.down = true; this.match.inp.id = id; this.aim(x, y);
  }
  private move(e: EventTouch): void {if (this.enabled() && e.getID() === this.match.inp.id) {const p = e.getUILocation(); this.aim(p.x, this.surface.height - p.y);}}
  private up(e: EventTouch): void {const id = e.getID()!; this.fireTouches.delete(id); if (id === this.match.inp.id) {this.match.inp.down = false; this.match.inp.id = null;}}
  // 文字输入框保留浏览器的空格/方向键；按住空格或J不连发。
  private keyDown(e: EventKeyboard): void {
    if (typeof document !== 'undefined' && document.activeElement?.matches('input,textarea,[contenteditable]')) return;
    if (this.pressed.has(e.keyCode)) return;
    this.pressed.add(e.keyCode);
    if (this.match.coachLocked()) {this.key(e.keyCode); return;}
    if (e.keyCode !== KeyCode.KEY_P && e.keyCode !== KeyCode.ESCAPE && this.key(e.keyCode)) return;
    const k = KEYS[e.keyCode]; if (!k) return; const repeat = this.match.inp.keys[k]; this.match.inp.keys[k] = true;
    if (!repeat && (k === 'p' || k === 'escape')) this.togglePause();
    if (!repeat && (k === ' ' || k === 'j') && this.match.mode === 'play') this.match.inp.fire++;
  }
  private keyUp(e: EventKeyboard): void {this.pressed.delete(e.keyCode); const k = KEYS[e.keyCode]; if (k) this.match.inp.keys[k] = false;}
  // 切后台/暂停时清空输入，手指回来不会带入一帧移动或出手。
  clear(background = false): void {if (background) this.pressed.clear(); const i = this.match.inp; i.down = false; i.id = null; i.angle = null; i.mag = 0; i.keys = {}; i.fire = 0; this.fireTouches.clear();}
  // 对应 updateThrowBtn；仅本卡操作按钮，不做 HUD。
  draw(time: number): void {
    if(this.retained){this.drawRetained(time);return;}
    const ctx = this.surface; ctx.begin();
    if (this.match.mode !== 'play') {ctx.end(); return;}
    const P = this.match.S.player, c = this.fireCenter();
    const parry = P.parryLock <= 0 && this.match.S.throws.some(f => f.owner !== P && this.match.incomingTTI(f, P) <= this.match.parryWin(f));
    const has = this.match.potsOf(P) > 0 && !(this.match.S.tut && !this.match.S.tut.def?.fire);
    const scale = parry ? 1 + .08 * (1 - Math.cos(time / .18 * Math.PI)) / 2 : 1;
    ctx.save(); ctx.translate(c.x, c.y); ctx.scale(scale, scale);
    ctx.fillStyle = '#1F2A44'; ctx.beginPath(); ctx.arc(3, 4, 46, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = parry ? '#E8504A' : has ? '#FFD84D' : '#D5DAE3'; ctx.strokeStyle = '#1F2A44'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 46, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // 原型按钮底部的5px硬内阴影，沿圆边形成弧带。
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath();
    ctx.arc(0, 0, 43, 0, Math.PI);
    for (let a = Math.PI; a >= 0; a -= Math.PI / 32) ctx.lineTo(Math.cos(a) * 43, Math.sin(a) * 43 - 5);
    ctx.closePath(); ctx.fill();
    // 冷却遮罩顺时针扫过，比例与原型conic-gradient一致。
    const cd = parry ? 0 : Math.max(0, P.cool, P.stun) / THROW_CD;
    if (cd > 0) {ctx.fillStyle = 'rgba(31,42,68,.45)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 46, -Math.PI / 2, -Math.PI / 2 + Math.min(1, cd) * Math.PI * 2); ctx.closePath(); ctx.fill();}
    this.tools.label(ctx, parry ? '弹!' : this.match.holdsHot(P) ? '急件' : '甩!', 0, 0, 30, parry ? '#FFFDF5' : has ? '#1F2A44' : '#5E6A84', 'rgba(0,0,0,0)');
    ctx.restore(); ctx.end();
  }
  // 常驻甩键：反甩只缩放容器；冷却只更新同一扇形的顶点，不重建Graphics。
  private drawRetained(time:number):void {
    const m=this.match,n=this.retained!.show(m.mode==='play');if(m.mode!=='play')return;const P=m.S.player,c=this.fireCenter(),parry=P.parryLock<=0&&m.S.throws.some(f=>f.owner!==P&&m.incomingTTI(f,P)<=m.parryWin(f)),has=m.potsOf(P)>0&&!(m.S.tut&&!m.S.tut.def?.fire),scale=parry?1+.08*(1-Math.cos(time/.18*Math.PI))/2:1;
    n.at(c.x,c.y,0,scale);n.child('shadow').ellipse(3,4,46,46,'#1F2A44');n.child('face').ellipse(0,0,46,46,parry?'#E8504A':has?'#FFD84D':'#D5DAE3');n.child('border').ellipse(0,0,46,46,'#1F2A44',1,0,Math.PI*2,3);
    // 下半圆两条同形弧相差5px，构成原按钮硬内阴影。
    const inner=n.child('inner');if(!inner.retainMesh()){const xy:number[]=[],indices:number[]=[];for(let i=0;i<=64;i++){const a=i*Math.PI/64,x=Math.cos(a)*43,y=Math.sin(a)*43;xy.push(x,y,x,y-5);if(i){const j=(i-1)*2;indices.push(j,j+1,j+2,j+1,j+3,j+2);}}inner.mesh({xy,indices},'rgba(0,0,0,.18)');}
    const cd=parry?0:Math.max(0,P.cool,P.stun)/THROW_CD,cool=n.child('cooldown').show(cd>0);if(cd>0)cool.ellipse(0,0,46,46,'rgba(31,42,68,.45)',1,-Math.PI/2,-Math.PI/2+Math.min(1,cd)*Math.PI*2);
    n.child('label').text(parry?'弹!':m.holdsHot(P)?'急件':'甩!',0,0,30,parry?'#FFFDF5':has?'#1F2A44':'#5E6A84','rgba(0,0,0,0)');
  }
  // 释放全局监听，不留下触摸或键盘抢占。
  destroy(): void {
    input.off(Input.EventType.TOUCH_START, this.down, this); input.off(Input.EventType.TOUCH_MOVE, this.move, this);
    input.off(Input.EventType.TOUCH_END, this.up, this); input.off(Input.EventType.TOUCH_CANCEL, this.up, this);
    input.off(Input.EventType.KEY_DOWN, this.keyDown, this); input.off(Input.EventType.KEY_UP, this.keyUp, this); this.clear(true);if(this.retained){this.retained.node.removeFromParent();this.retained.destroy();}
  }
}
