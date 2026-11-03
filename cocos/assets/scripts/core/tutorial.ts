// 对应原型 js/game.js：coachLocked agentByKey tutLater tutNext tutEvent updateTutorial tutCanFire startWork；设计依据《这锅你来背-核心玩法》。
import type { Match } from './match';
import type { Agent, Leader, TutorialStepDef } from './types';
import * as C from './config';

export const tutorialLogic = {

// 最后一步只有开始按钮可操作；进入和离开时清空输入，避免按住摇杆或键盘带入正式局。
  coachLocked(this: Match): boolean { return !!(this.S && this.S.tut && this.S.tut.def && this.S.tut.def.btn); },

  // 按人设名找场上的同事
  agentByKey(this: Match, k: string): Agent { return this.S.agents.find((a) => a.key === k)!; },

// 带教里的延时（跟着对局时间走，暂停时也停）
  tutLater(this: Match, sec: number, fn: () => void): void { this.S.tut!.timers.push({ t: sec, fn }); },

// 进下一步；没有下一步就开始上班
  tutNext(this: Match): void {
    const T = this.S.tut;
    if (!T) return;
    T.i++; T.timers = []; T.ring = null; T.done = false;
    const step = this.L.tutorial!.steps[T.i];
    if (!step) { this.startWork(); return; }
    T.step = step; T.def = this.TUT_STEPS[step.do];
    this.showCoach(step.say, T.def.btn);
    if (T.def.enter) T.def.enter(step);
  },

// 带教里发生的事（砸中主角、甩中同事、有人背锅、老板走到位）转给当前步骤处理
  tutEvent(this: Match, name: string, arg?: Agent | Leader): void {
    const T = this.S && this.S.tut;
    if (T && T.def && (T.def[name as keyof TutorialStepDef] as ((arg?: Agent | Leader) => void) | undefined) && !T.done) (T.def[name as keyof TutorialStepDef] as ((arg?: Agent | Leader) => void) | undefined)!(arg);
  },

// 带教每帧：推进定时器，检查当前步骤是否完成
  updateTutorial(this: Match, dt: number): void {
    const T = this.S.tut!, i = T.i;
    for (const x of T.timers) x.t -= dt;
    const due = T.timers.filter((x) => x.t <= 0);
    T.timers = T.timers.filter((x) => x.t > 0);
    for (const x of due) { if (this.S.tut !== T || T.i !== i) break; x.fn(); }
    if (this.S.tut === T && T.i === i && T.def && T.def.check && T.def.check()) { T.done = true; this.tutNext(); }
  },

// 带教里按「甩」：还没讲到甩锅、站在领导视野里、扇形里没人，都只提醒不扔
  tutCanFire(this: Match, a: Agent): boolean {
    const def = this.S.tut!.def;
    if (!def || !def.fire) return false;
    if (!this.canFire(a)) return true; // 冷却、没锅等交给正常流程处理
    const eye = this.seenBy(a);
    if (eye) { this.E.toast(`${eye.name}在看！先走出红扇形`, 1400); this.E.sfx('miss'); return false; }
    if (!this.pickAim(a)) { this.E.toast('扇形里没人，走近点、对准了再甩', 1400); return false; }
    return true;
  },

// 带教结束（做完或跳过）：上班时钟从现在起算，带教里的锅开始走时间，大家回到正常状态
  startWork(this: Match): void {
    if (!this.S || !this.S.tut) return;
    this.resetCoachInput();
    this.S.tut = null;
    this.S.t0 = this.S.t;
    for (const a of this.S.agents) for (const pot of a.sn.segs) if (pot.due === Infinity) pot.due = this.S.t + this.potLife();
    for (const f of this.S.throws) if (f.pot.due === Infinity) f.pot.due = this.S.t + this.potLife();
    for (const a of this.S.agents) {
      a.hitsBy = { sky: 0, leader: 0, burst: 0, mate: 0, bump: 0 }; // 带教记录清零
      a.blames = 0; a.caught = 0; // 带教里的背锅不算数，免得重玩跳过带教时难度不一样
      if (!a.isPlayer) this.giveStartPots(a.sn, this.S.t);
    }
    for (const l of this.S.leaders) {
      l.tgo = null; l.faceLock = null; l.state = 'patrol'; l.targets = [];
      l.i = this.nearestRoute(l); l.path = []; l.goal = null; l.wait = 0.5; l.throwCd = this.E.rand(0.5, 1.5);
    }
    const prog = this.loadProgress();
    if (!prog.tutDone) { prog.tutDone = true; this.saveProgress(prog); }
    this.forceTut = false;
    this.clearBanners();
    this.E.toast('09:00 正式上班！', 1600);
    this.E.sfx('workStart');
  },
};
