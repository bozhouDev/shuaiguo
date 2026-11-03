// 对应原型 js/game.js 的闭包、表现入口、finish 纯计算和收尾计时；不含 DOM、存储或 Cocos。
import { Engine, Floats } from './engine';
import { OFFICE, LEVELS } from './levels';
import { stateLogic } from './state';
import { potsLogic } from './pots';
import { leadersLogic } from './leaders';
import { scheduleLogic } from './schedule';
import { tutorialLogic } from './tutorial';
import { agentsLogic } from './agents';
import { createNAV } from './navigation';
import { createTIP_CHECKS } from './tips';
import { createTUT_STEPS } from './tutorial-steps';
import * as C from './config';
import type { State, Level, Input, MatchOptions, CoreEvent, Hint, Fx, Progress } from './types';

type StateLogic = typeof stateLogic;
type PotsLogic = typeof potsLogic;
type LeadersLogic = typeof leadersLogic;
type ScheduleLogic = typeof scheduleLogic;
type TutorialLogic = typeof tutorialLogic;
type AgentsLogic = typeof agentsLogic;
// 分文件的方法仍属于同一对局对象，互相调用不使用全局变量。
export interface Match extends StateLogic, PotsLogic, LeadersLogic, ScheduleLogic, TutorialLogic, AgentsLogic {}
export class Match {
  S!: State;
  L: Level;
  E: Engine;
  floats: Floats;
  inp: Input = { down: false, id: null, x: 0, y: 0, angle: null, mag: 0, keys: {}, fire: 0 };
  forceTut = false;
  auto: boolean;
  simulating: boolean;
  mode = 'play';
  hintTimer = 0;
  msgTimer = 0;
  private shakeValue = 0;
  private progress: Progress;
  private onEvent?: (event: CoreEvent) => void;
  obstacles = OFFICE.walls.concat(OFFICE.props.filter(p => p.hit).map(p => p.hit!));
  NAV = createNAV(this);
  TIP_CHECKS = createTIP_CHECKS(this);
  TUT_STEPS = createTUT_STEPS(this);

  // 方法逐个绑定，保留原型把 makeLeader/tutNext/raging 直接当回调传递的写法。
  constructor(options: MatchOptions) {
    const logic = { ...stateLogic, ...potsLogic, ...leadersLogic, ...scheduleLogic, ...tutorialLogic, ...agentsLogic };
    for (const [name, fn] of Object.entries(logic)) Object.defineProperty(this, name, { value: fn.bind(this), configurable: true });
    this.onEvent = options.onEvent;
    this.L = LEVELS[options.level ?? 0];
    this.auto = options.auto ?? false;
    this.simulating = options.simulating ?? false;
    this.progress = JSON.parse(JSON.stringify(options.progress ?? { unlocked: 1, best: {} }));
    this.E = new Engine(options.seed, this.emit.bind(this));
    this.floats = new Floats(this.emit.bind(this));
    // 此时 S 与原型 makeState 首次调用时一样不存在，不能先创建一个占位状态。
    this.S = this.makeState(options.tutorial ?? false, options.buff);
    if (options.tutorial) this.tutNext();
  }
  // 事件出口不消费随机数，不规范化参数，由接收者按用途存档。
  emit(kind: string, ...args: unknown[]) { this.onEvent?.({ t: this.S?.t || 0, kind, args }); }
  // 原型对 shake 的每次赋值均保留，并发出画面意图。
  get shake() { return this.shakeValue; }
  set shake(value: number) { this.shakeValue = value; this.emit('shake', value); }
  // 表扬路径定为画面层，core 只发出每次调用意图，不推进贴纸冷却。
  praise(kind: string) { this.emit('praise', kind); }
  // 原型 spawnFx 先记录调用，再创建特效；follow 等附加字段由调用点继续设置。
  spawnFx(...args: [name: string, x: number, y: number, size: number, dur?: number]): Fx {
    this.emit('spawnFx', ...args);
    const [name, x, y, size, dur] = args;
    const e = { name, x, y, size, t: 0, dur: dur || 0.35 };
    this.S.fx.push(e);
    return e;
  }
  // 教学横幅保留逻辑计时，DOM 交给画面层。
  showHint(h: Hint) { this.emit('showHint', h); this.hintTimer = h.sub ? 3.4 : 2.8; }
  // 群消息保留 chat 音效的调用顺序。
  showMsg(text: string) { this.emit('showMsg', text); this.msgTimer = 3.4; this.E.sfx('chat'); }
  // 横幅由帧循环单独推进，黄金录像只调用 update，因此不能在 update 中偷偷推进。
  updateBanners(dt: number) {
    if (this.hintTimer > 0) { this.hintTimer -= dt; if (this.hintTimer <= 0) this.emit('hideHint'); }
    if (this.msgTimer > 0) { this.msgTimer -= dt; if (this.msgTimer <= 0) this.emit('hideMsg'); }
  }
  // 清理表现输入并请求画面层释放指针。
  resetCoachInput() {
    if (this.inp.id !== null) this.emit('releasePointerCapture', this.inp.id);
    this.inp.down = false; this.inp.id = null; this.inp.mag = 0; this.inp.angle = null; this.inp.fire = 0; this.inp.keys = {};
  }
  // 教学说话沿用横幅，无 DOM 按钮；画面按钮回调 startWork。
  showCoach(text: string, btn?: string) {
    const who = (this.S.tut && this.S.tut.victim && this.S.tut.victim.name) || '新来的';
    this.showHint({ title: '教学', icon: ['veteran_tea'], sub: '老周', text: text.replace('{who}', who) });
    this.hintTimer = 0;
    if (btn) this.emit('coachButton', btn);
  }
  // 清空横幅逻辑计时，并发出画面清理意图。
  clearBanners() { this.hintTimer = this.msgTimer = 0; this.emit('clearBanners'); }
  // 存档作为调用方传入的数据；core 不读取任何平台存储。
  loadProgress(): Progress { return JSON.parse(JSON.stringify(this.progress)); }
  // 保存计算结果并发出意图，由平台层选择是否持久化。
  saveProgress(p: Progress) { this.progress = JSON.parse(JSON.stringify(p)); this.emit('progress', this.loadProgress()); }
  // 称呼清理规则和默认值保持原型写法。
  bossName() { return this.cleanBossName(this.loadProgress().bossName) || '老板'; }

  // finish 的纯计算部分：排名、总账、星级、最好成绩和下一关解锁，不写平台存储。
  calculateResult(reason: 'time' | 'crushed', prog: Progress = this.loadProgress()) {
    const P = this.S.player, crushed = reason === 'crushed';
    const rank = this.ranking();
    const myRank = crushed ? rank.length : rank.indexOf(P) + 1;
    const stars = crushed ? 0 : this.starsOfRank(myRank);
    const old = prog.best[this.L.id];
    const myDebt = this.debtOf(P), oldDebt = old ? old.debt ?? old.blames ?? Infinity : Infinity;
    const isBest = stars > 0 && (!old || stars > old.stars || (stars === old.stars && myDebt < oldDebt));
    if (isBest) prog.best[this.L.id] = { blames: P.blames, debt: myDebt, stars };
    const unlockedNew = stars > 0 && this.L.id + 1 > prog.unlocked && LEVELS.some(lv => lv.id === this.L.id + 1);
    if (stars > 0) prog.unlocked = Math.max(prog.unlocked, this.L.id + 1);
    const title = crushed ? '锅太多，走不动了' : !stars ? '被留下加班' : ['', '甩锅宗师', '职场老油条', '勉强下班'][myRank];
    const nephew = this.S.agents.find(a => a.key === 'nephew');
    const pieReport = P.piesEaten ? `今天吃了老板 ${P.piesEaten} 张饼` : '';
    const nephewReport = !nephew ? '' : this.S.nephewCrushed ? '今天我把老板小舅子压垮了' : '老板小舅子今天背锅 0 次，第一个下班';
    const next = LEVELS[LEVELS.indexOf(this.L) + 1];
    const diag = !stars ? this.diagnose(P) : null;
    const shareKind = !stars ? 'blame' : next ? 'brag' : 'cert';
    return { reason, crushed, rank, myRank, stars, myDebt, isBest, unlockedNew, prog, title, pieReport, nephewReport, next, diag,
      accounts: rank.map(a => ({ id: a.id, blames: a.blames, pots: this.potsOf(a), carry: this.carryOf(a), debt: this.debtOf(a) })),
      shareInfo: { pieReport, nephewReport, nephewCrushed: this.S.nephewCrushed, kind: shareKind, crushed, blames: P.blames,
        rank: myRank, total: rank.length, stars, title, day: this.L.name.split('·')[0].trim(), revived: !!this.S.revived, rescued: !!this.S.rescued } };
  }
  // 结算仅执行计算、声音与存档事件，界面由调用方处理。
  finish(reason: 'time' | 'crushed') {
    this.mode = 'over'; this.resetCoachInput();
    const result = this.calculateResult(reason);
    this.saveProgress(result.prog);
    if (!this.S.closing) this.E.sfx(result.crushed ? 'crushed' : result.stars > 0 ? 'win' : 'lose');
    for (let i = 0; i < result.stars; i++) this.E.sfx('star', { delay: 0.3 + i * 0.18, rate: 1 + i * 0.12 });
    if (result.unlockedNew) this.E.sfx('unlock', { delay: 0.4 + result.stars * 0.18 });
    if (result.crushed) this.E.buzz(200);
    this.E.bgm(false); this.clearBanners(); this.emit('finish', result);
    return result;
  }
  // 到点锁榜，停止物理推进。
  startClosing() {
    this.mode = 'closing';
    this.S.closing = { t: 0, passed: this.starsOfRank(this.ranking().indexOf(this.S.player) + 1) > 0 };
    this.resetCoachInput(); this.clearBanners(); this.emit('hidePanel'); this.E.bgm(false); this.E.sfx('bell');
  }
  // 对应 updateClosingNotice 的纯计算：每个新秒数只响一次，画面读事件显示倒计时或胜负反馈。
  updateClosingNotice() {
    const left = this.S ? this.L.duration - this.workT() : Infinity;
    const warning = this.mode === 'play' && !this.S.tut && left > 0 && left <= C.FINAL_RUSH;
    if (!warning && this.mode !== 'closing') { this.emit('closingNotice', { hidden: true }); return; }
    if (warning) {
      const seconds = Math.ceil(left), rank = this.ranking().indexOf(this.S.player) + 1;
      this.emit('closingNotice', { hidden: false, warning, seconds, rank,
        title: '下班倒计时', detail: rank <= this.passRank() ? `守住${this.rankWords()}` : `冲进${this.rankWords()}`,
        beat: seconds % 2 ? 'odd' : 'even' });
      if (this.S.lastTick !== seconds) {
        this.S.lastTick = seconds;
        this.E.sfx(seconds <= 3 ? 'tickUrgent' : 'tick');
      }
    } else {
      const result = this.S.closing!.t >= C.CLOSING_BELL_TIME;
      this.emit('closingNotice', { hidden: false, warning, result, passed: this.S.closing!.passed,
        title: result ? (this.S.closing!.passed ? '准点下班！' : '这次得加班了') : '叮！下班时间到',
        detail: result ? (this.S.closing!.passed ? '撑到下班，这局赢了' : `没进${this.rankWords()}，下局再甩回来`) : '18:00 · 本局成绩已锁定' });
    }
  }
  // 原型的 document.hidden 由调用方以 hidden 传入，不引用 DOM。
  updateClosing(dt: number, hidden = false) {
    if (hidden) return;
    for (const e of this.S.fx) e.t += dt;
    this.S.fx = this.S.fx.filter(e => e.t < e.dur);
    const closing = this.S.closing!;
    const before = closing.t;
    closing.t += dt;
    if (before < C.CLOSING_BELL_TIME && closing.t >= C.CLOSING_BELL_TIME) this.E.sfx(closing.passed ? 'win' : 'lose');
    if (closing.t >= C.CLOSING_BELL_TIME + C.CLOSING_FEEDBACK_TIME) this.finish('time');
  }
}
