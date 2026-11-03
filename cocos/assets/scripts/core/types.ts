// 对应原型 levels.js/game.js 的数据字段；类型只描述结构，不增加运行时字段或默认值。
import type { Snake } from './engine';

export interface Point { x: number; y: number }
export interface Rect extends Point { w: number; h: number }
export interface RoutePoint extends Point { wait?: number }
export interface Prop extends Point { sprite: string; w: number; hit?: Rect }
export interface Office {
  world: { w: number; h: number }; rooms: (Rect & { name: string; tile: string })[];
  walls: Rect[]; props: Prop[]; sources: Record<string, Point & { name: string }>;
  tea: Point; player: Point; spawns: Point[]; routes: Record<string, RoutePoint[]>; potLabels: string[];
}
export interface LeaderDef { type: string; route: string }
export interface Incident { t: number; kind: string; who?: string }
export interface MeetingConfig { t: number; duration: number; count: number; life: number }
export interface Hint { title?: string; icon?: string[]; sub?: string; text: string; on?: string; t?: number }
export interface TutorialStep { do: string; say: string; say2?: string; alt?: string }
export interface Finale { t: number; pots: number; msg: string; say: string }
export interface Level {
  id: number; name: string; theme: string; desc: string; duration: number; startPots: number;
  potLife?: number; skyChance?: number; basic?: boolean; bots: string[]; leaders: LeaderDef[];
  ai?: Record<string, number>; aiEnd?: Record<string, number>; leaderFocus?: number;
  pace: { t: number; every: number }[]; rushAt?: number; incidents?: Incident[];
  bursts: { t: number; src: string; n: number; msg: string }[];
  events?: { n: number; window: number[]; pool: string[] }; pieMeetings?: MeetingConfig[];
  news?: { icon: string; text: string }[]; tips?: (Hint & { on: string })[];
  hints?: (Hint & { t: number })[]; finale?: Finale;
  tutorial?: { spots: Record<string, Point>; steps: TutorialStep[] };
  nephewRanked?: boolean; passRank?: number; passStars?: number;
}
export interface Persona {
  name: string; sprite: string; speed: number; turn: number; react: number; aggr: number;
  seekR: number; seekMin: number; dodge: number; caution: number; parry: number;
  throwR: number; sneak: number; tea?: boolean;
}
export interface LeaderConfig {
  name: string; sprite: string; h: number; emoji?: string; speed: number; count: number;
  range: number; everyMul: number; visionCone?: number; aimTime?: number;
}
export interface Buff { name: string; desc: string; img: string }
export interface Pot { label: string; due: number; hot: boolean; passAt?: number; nephewSender?: Agent | null }
export interface HitsBy { [key: string]: number; sky: number; leader: number; burst: number; mate: number; bump: number }
export interface Agent {
  id: number; key: string; p: Persona; name: string; isPlayer: boolean; sn: Snake;
  want: number; thinkT: number; target: Agent | null; blames: number; caught: number; alarmed: boolean;
  hitsBy: HitsBy; thrown: number; combo: number; comboT: number; maxCombo: number; victims: Record<string, number>;
  cool: number; stun: number; shield: number; lock: Record<number, number>; parryLock: number;
  launched: number; misses: number; parries: number; aimTgt: Agent | null; cry: number; teaCd: number;
  teaT: number; angry: number; piesEaten: number; hypeUntil: number; pieBatch: number; wantsPie: boolean;
  lastMateHitAt: number; received: number; lastThrower: Agent | null; crushed: boolean; crushedAt: number;
  stuckT: number; lastX: number; lastY: number; panicT: number; pieSay?: string; pieSayUntil?: number;
}
export interface Leader extends Point {
  type: string; cfg: LeaderConfig; name: string; route: RoutePoint[]; i: number; wait: number;
  tgo: Point | null; faceLock: number | null; path: Point[]; goal: Point | null; repathT: number;
  state: string; st: number; aimT: number; targets: Agent[]; chase: Agent | null;
  hitCd: Record<number, number>; alertCd: number; throwCd: number; face: number; baseFace: number;
  meeting?: (MeetingConfig & { elapsed: number; lines: string[] }) | null;
  afterMeetingHot?: boolean; rageUntil?: number; inspectUntil?: number; pieSay?: string; pieSayUntil?: number;
}
export interface FlyingPot extends Point {
  src: string; phase: string; t: number; warn0: number; target: Agent; hot: boolean;
  a: number; spin: number; life: number; label: string; dead?: boolean;
}
export interface ThrownPot extends Point {
  owner: Agent; target: Agent | null; a: number; speed: number; pot: Pot; label: string; hot: boolean;
  dist: number; range: number; bounces: number; spin: number; rolled: Set<number>; dead?: boolean;
}
export interface Fx extends Point { name: string; size: number; t: number; dur: number; follow?: Agent; dx?: number; dy?: number }
export interface Arc { x0: number; y0: number; to: () => Point; t: number; dur: number; label: string }
export interface Pie extends Point { boss: Leader; expires: number; batch: number }
export interface ScheduleItem { t: number; act: string; text?: string; src?: string; n?: number; kind?: string; inc?: Incident; meeting?: MeetingConfig }
export interface TutorialStepDef {
  fire?: boolean; btn?: string; enter?: (step: TutorialStep) => void; check?: () => boolean;
  potOnMe?: () => void; land?: (a: Agent) => void; blame?: () => void; arrive?: (l: Leader) => void;
}
export interface Tutorial {
  i: number; timers: { t: number; fn: () => void }[]; ring: Point | null;
  step: TutorialStep | null; def: TutorialStepDef | null; done: boolean; victim: Agent | null; showRank: boolean;
}
export interface State {
  pies: Pie[]; pieBatch: number; pieMeetingsDone: number; piesSpawned: number; piesExpired: number;
  nephewProtected: number; nephewCrushed: boolean; praiseAt: Record<string, number>; outSince: number | null;
  buff: string | null; buffUsed: boolean; t: number; t0: number; player: Agent; bots: Agent[]; agents: Agent[];
  leaders: Leader[]; flying: FlyingPot[]; throws: ThrownPot[]; arcs: Arc[]; fx: Fx[]; tea: number;
  pace: { t: number; every: number } | null; paceIdx: number; schedule: ScheduleItem[]; hintIdx: number; tipsShown: Record<string, boolean>;
  tut: Tutorial | null; finale: boolean; finMsg: boolean; finDone: boolean; skyFirst: boolean;
  revived: boolean; rescued: boolean; over: 'crushed' | 'time' | null; lastTick: number | null;
  spawned: number; leaderHits: number; booms: number; skies: number; rushHour?: boolean; rush?: boolean;
  finBlame0?: number; wifeToastAt?: number; closing?: { t: number; passed: boolean } | null;
}
export interface Navigation { cols: number; rows: number; block: Uint8Array }
export interface Input { down: boolean; id: number | null; x: number; y: number; angle: number | null; mag: number; keys: Record<string, boolean>; fire: number }
export interface Best { stars: number; blames?: number; debt?: number }
export interface Progress { unlocked: number; best: Record<number, Best>; bossName?: string; bossNameAt?: number; tutDone?: boolean; achievements?: Record<string, boolean> }
export interface Diagnosis { buff: string; img: string; html: string }
// 事件只表达调用意图；可选参数的缺省和调用顺序由调用点保留。
export interface CoreEvent { t: number; kind: string; args: unknown[] }
export interface MatchOptions { levelParams?: Level; level?: number; seed: number; auto?: boolean; simulating?: boolean; tutorial?: boolean; buff?: string | null; progress?: Progress; onEvent?: (event: CoreEvent) => void }
