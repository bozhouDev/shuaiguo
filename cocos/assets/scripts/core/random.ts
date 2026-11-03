// 与原型 js/engine.js 的 E.random 保持同一算法；不依赖 Cocos 或平台。
export class Mulberry32 {
  private state: number;

  // 每个调用者持有自己的随机流，不共享全局对局状态。
  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  // 每次加法都截为 uint32，保持原型的溢出行为和调用顺序。
  next(): number {
    this.state = (this.state + 0x6D2B79F5) >>> 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}
