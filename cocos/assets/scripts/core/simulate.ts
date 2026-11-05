// 对应原型 SG_DEBUG.simulate：保持同一局对象、随机流和累计运算顺序；设计依据《这锅你来背-核心玩法》。
import type {Match} from './match';
import {LEVELS} from './levels';
export interface SimulationStats {
 runs:number;crushedPlayer:number;rankHist:Record<string,number>;avgLeft:Record<string,number>;avgBlame:Record<string,number>;avgCaught:Record<string,number>;
 avgBooms:number;avgSkies:number;crushedBots:number;avgSpawned:number;avgThrown:number;avgLaunched:number;avgMiss:number;avgParry:number;avgLeaderHits:number;avgCrushT:number;passed:number;passRate:number;
 items?: {picked:number;expired:number;byKind:Record<string,number>};
 avgPiesEaten:number;avgAllPiesEaten:number;avgPieMeetings:number;avgPiesSpawned:number;avgNephewReceived:number;nephewCrushed:number;nephewProtected:number;avgFinBlame?:number;
}
// 固定种子只在本次模拟生效；成功与异常都恢复原对局与随机状态，无种子继续消费本局流。
export function simulate(this:Match,levelIdx=0,runs=20,seed?:number,itemDrops=false):SimulationStats {
      const keepL = this.L, keepAuto = this.auto, keepS = this.S, keepMode = this.mode;
      const keepItems = this.itemDrops;
      const keepRng = this.E.rngState(), keepSim = this.simulating;
      this.simulating = true;
      const keepMuted = this.E.muted;
      this.E.muted = true; // 模拟对局不出声
      try {
      if (seed !== undefined) this.E.seed(seed); // 固定种子只在本次模拟内生效。
      this.L = LEVELS[levelIdx || 0]; this.auto = true; this.itemDrops = itemDrops;
      const out: SimulationStats = { runs: runs || 20, crushedPlayer: 0, rankHist: {}, avgLeft: {}, avgBlame: {}, avgCaught: {}, avgBooms: 0, avgSkies: 0, crushedBots: 0, avgSpawned: 0, avgThrown: 0, avgLaunched: 0, avgMiss: 0, avgParry: 0, avgLeaderHits: 0, avgCrushT: 0, passed: 0, passRate: 0, avgPiesEaten: 0, avgAllPiesEaten: 0, avgPieMeetings: 0, avgPiesSpawned: 0, avgNephewReceived: 0, nephewCrushed: 0, nephewProtected: 0 };
      if (itemDrops) out.items = {picked:0,expired:0,byKind:{clear:0,invincible:0,delay:0}};
      for (let r = 0; r < out.runs; r++) {
        this.S = this.makeState(false); this.mode = 'play';
        while (!this.S.over) this.update(1 / 30);
        if (out.items && this.S.items) {
          out.items.picked += this.S.items.stats.picked; out.items.expired += this.S.items.stats.expired;
          for (const kind of ['clear','invincible','delay'] as const) out.items.byKind[kind] += this.S.items.stats.byKind[kind];
        }
        if (this.S.over === 'crushed') out.crushedPlayer++;
        const rank = this.ranking();
        const pr = this.S.over === 'crushed' ? rank.length : rank.indexOf(this.S.player) + 1;
        if (this.S.over !== 'crushed' && pr <= this.passRank()) out.passed++;
        out.avgPiesEaten += this.S.player.piesEaten / out.runs;
        out.avgAllPiesEaten += this.S.agents.reduce((n, a) => n + a.piesEaten, 0) / out.runs;
        out.avgPieMeetings += this.S.pieMeetingsDone / out.runs;
        out.avgPiesSpawned += this.S.piesSpawned / out.runs;
        const nephew = this.S.agents.find((a) => a.key === 'nephew');
        out.avgNephewReceived += (nephew ? nephew.received : 0) / out.runs;
        if (this.S.nephewCrushed) out.nephewCrushed++;
        out.nephewProtected += this.S.nephewProtected;
        out.rankHist[pr] = (out.rankHist[pr] || 0) + 1;
        for (const a of this.S.agents) {
          out.avgLeft[a.name] = (out.avgLeft[a.name] || 0) + this.potsOf(a) / out.runs;
          out.avgBlame[a.name] = (out.avgBlame[a.name] || 0) + a.blames / out.runs;
          out.avgCaught[a.name] = (out.avgCaught[a.name] || 0) + a.caught / out.runs;
          if (a.crushed) { out.crushedBots++; out.avgCrushT += a.crushedAt; }
        }
        out.avgSpawned += this.S.spawned / out.runs;
        if (this.S.finBlame0 != null) out.avgFinBlame = (out.avgFinBlame || 0) + (this.S.player.blames - this.S.finBlame0) / out.runs;
        out.avgBooms += this.S.booms / out.runs; out.avgSkies += this.S.skies / out.runs;
        out.avgLeaderHits += this.S.leaderHits / out.runs;
        out.avgThrown += this.S.agents.reduce((s, a) => s + a.thrown, 0) / out.runs;
        out.avgLaunched += this.S.agents.reduce((s, a) => s + a.launched, 0) / out.runs;
        out.avgMiss += this.S.agents.reduce((s, a) => s + a.misses, 0) / out.runs;
        out.avgParry += this.S.agents.reduce((s, a) => s + a.parries, 0) / out.runs;
      }
      out.passRate = +(out.passed / out.runs).toFixed(4);
      out.avgNephewReceived = +out.avgNephewReceived.toFixed(2);
      for (const m of [out.avgLeft, out.avgBlame, out.avgCaught]) for (const k in m) m[k] = +m[k].toFixed(1);
      out.avgBooms = +out.avgBooms.toFixed(1); out.avgSkies = +out.avgSkies.toFixed(1);
      out.avgSpawned = +out.avgSpawned.toFixed(1); out.avgLeaderHits = +out.avgLeaderHits.toFixed(1);
      out.avgCrushT = out.crushedBots ? Math.round(out.avgCrushT / out.crushedBots) : 0; out.avgThrown = +out.avgThrown.toFixed(1);
      for (const k of ['avgLaunched', 'avgMiss', 'avgParry'] as const) out[k] = +out[k].toFixed(1);
      this.L = keepL; this.auto = keepAuto; this.S = keepS; this.mode = keepMode;
      this.floats.list = []; this.clearBanners();
      return out;
      } finally { this.itemDrops = keepItems; if (seed !== undefined) this.E.setRngState(keepRng); this.simulating = keepSim; this.E.muted = keepMuted; this.L = keepL; this.auto = keepAuto; this.S = keepS; this.mode = keepMode; }
    
}
