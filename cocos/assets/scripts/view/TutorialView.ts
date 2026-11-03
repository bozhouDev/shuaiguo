import {Match} from '../core/match';
import {UiPaint, Box} from './UiPaint';
import {stickCenter} from './SpriteTools';
// 对应 updateCoachHand：只读带教状态，不调用pickAim，不消费玩法随机数。
export class TutorialView {
  target: {x: number; y: number} | null = null;
  constructor(readonly p: UiPaint) {}
  // 真实时间的1.1秒两帧点按；指尖相对目标(-19,-17)，位置跟随实际按钮布局。
  draw(m: Match, real: number, start: Box | null, fire: {x: number; y: number}, reduce: boolean): void {
    const t = m.mode === 'play' && m.S.tut; let target = null;
    if (t && t.step) {
      if (t.def?.btn && start) target = {x: start.x + start.w - 16, y: start.y + start.h - 12};
      else if (t.step.do === 'walk' && !m.inp.down && !Object.values(m.inp.keys).some(Boolean)) target = stickCenter(this.p.c.width, this.p.c.height);
      else if (t.def?.fire && m.potsOf(m.S.player) && m.S.player.aimTgt && !m.seenBy(m.S.player)) target = fire;
    }
    this.target = target;
    if (target) {const phase = real % 1.1 / 1.1, offset = reduce ? 0 : phase < .45 ? 1 - Math.floor(phase / .45 * 2) / 2 : phase < .65 ? 0 : Math.floor((phase - .65) / .35 * 2) / 2; this.p.image('ui_coach_hand', target.x - 19 + 7 * offset, target.y - 17 + 9 * offset, 80, 88);}
  }
}
