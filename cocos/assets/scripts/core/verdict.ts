// 迭代需求§6：结算文案只从实际账目和日志生成，不消费随机数、不改S或存档。
import type {Match} from './match';
import type {BlameEvent, BlameSource} from './types';
import {rankedAgents} from './agents';
import {MAX_POTS} from './config';

// 仅复制玩家的背锅字段；原数组、角色、锅和排名规则全部保持原值。
export function hypotheticalRank(m: Match, n: number): {rank: number; gap: number} {
  const player = {...m.S.player, blames: Math.max(0, m.S.player.blames - n)};
  const ranked = rankedAgents(m.S.agents.map(a => a === m.S.player ? player : a), m.L.nephewRanked, a => m.debtOf(a));
  const rank = ranked.indexOf(player) + 1, passed = rank <= m.passRank();
  const line = ranked[passed ? m.passRank() : m.passRank() - 1];
  return {rank, gap: line ? (passed ? line.blames - player.blames : player.blames - line.blames) : 0};
}

// 同一次碰撞只有最终归到玩家且来源仍为bump的口数才可合并；其他事件不跨条拼凑。
function events(m: Match): BlameEvent[] {
  const out: BlameEvent[] = [], bumps = new Map<number, BlameEvent>();
  for (const log of m.S.player.blameLog ?? []) {
    const source = log.src === 'bell' ? log.orig : log;
    if (source?.src === 'bump' && log.origin?.id !== undefined) {
      let group = bumps.get(log.origin.id);
      if (!group) {
        group = {...log, src: 'bump', from: source.from, n: 0, t: log.origin.t,
          clock: log.origin.clock ?? m.clockAt(log.origin.t - m.S.t0)};
        bumps.set(log.origin.id, group); out.push(group);
      }
      group.n += log.n;
    } else out.push({...log, ...(source ? {src: source.src, from: source.from} : {})});
  }
  return out;
}
// 来源短语只用于有事实依据的记录，未知旧夹具不给副句。
function sourcePhrase(src: BlameSource, from: string, boss: string): string {
  return {sky: `${boss}点名的那口`, leader: `${from}丢的那口`, burst: `${from}喷的那口`, mate: `${from}甩你的那口`,
    bump: `撞上${from}派的那口`, p0: '急件那口', nephew: '甩给小舅子的那口', caught: '', protect: '', bell: ''}[src];
}
// 多口事件只取需求列出的急件/护短/撞领导，不把同一帧独立一口锅凑成“大事件”。
function eventPhrase(log: BlameEvent): string {
  return log.src === 'p0' ? '急件炸在你手里' : log.src === 'protect' ? `当着${log.from}甩小舅子` : log.src === 'bump' ? `撞上${log.from}` : '';
}
export interface Verdict {main: string; sub: string; color: string; retryLabel: string}
// 分档按任务卡已定裁定：副句和广告均真算减锅后的排序，不用gap-n+1近似。
export function verdict(r: ReturnType<Match['calculateResult']>, m: Match): Verdict {
  const p = m.S.player, i = r.lineInfo, out = {main: '', sub: '', color: '#E8504A', retryLabel: '再来'};
  if (r.crushed) {
    out.main = `堆到 ${MAX_POTS} 口，压垮了`; out.retryLabel = '再熬一天';
    // 玩家压垮即冻结，S.t就是本次压垮时刻；不改原本仅用于同事排序的crushedAt字段。
    const second = Math.floor(m.S.t - m.S.t0 - 10), rank = m.S.rankTrail[second];
    if (rank > 0 && rank <= m.passRank()) out.sub = `压垮前 10 秒你还排第 ${rank}`;
    return out;
  }
  if (r.buzzer) return {...out, color: '#2F9E6B', retryLabel: '再来一局', main: `最后 15 秒从第 ${r.buzzer.from} 翻到第 ${r.buzzer.to}`};
  if (r.stars) return {...out, color: '#2F9E6B', retryLabel: '再来一局', main: i ? i.gap === 0
    ? `和第 ${m.passRank() + 1} 名背锅一样多，靠甩得多留下来的` : `领先加班线 ${i.gap} 口` : ''};
  if (!i) return out;
  const logs = events(m), multi = logs.find(log => log.n >= 2 && eventPhrase(log));
  if (i.gap === 0) {
    out.main = `和第 ${i.rank} 名${i.name}背锅一样多`; out.retryLabel = '再来一局，就差那一口';
    if (i.hisThrown !== i.myThrown) out.sub = `他甩出去 ${i.hisThrown} 口，你 ${i.myThrown} 口，手快的留下`;
  } else if (i.gap === 1) {
    out.main = '离下班线就差 1 口'; out.retryLabel = '再来一局，就差那一口';
    // 最后一口按原始日志顺序取，不能让碰撞聚合的首次插入位置改变末次归责。
    const last = p.blameLog?.[p.blameLog.length - 1], source = last?.src === 'bell' ? last.orig : last;
    const log = last && source ? {...last, src: source.src, from: source.from,
      clock: source.src === 'bump' && last.origin ? (last.origin.clock ?? m.clockAt(last.origin.t - m.S.t0)) : last.clock} : undefined;
    // 按这一条实际记的口数假想减掉（急件是 3 次），不是一律减 1。
    const hypothetical = hypotheticalRank(m, last?.n ?? 1);
    if (log && hypothetical.rank <= m.passRank()) {
      const prefix = log.src === 'caught' ? '被抓现行那次不算' : log.src === 'protect' ? `当着${log.from}甩小舅子那次不算` : sourcePhrase(log.src, log.from, m.bossName());
      if (prefix) out.sub = `${log.clock} ${prefix}${log.src === 'caught' || log.src === 'protect' ? '，' : '，甩出去'}你就是第 ${hypothetical.rank} 名`;
    }
  } else if (i.gap <= 3) {
    out.main = `差 ${i.gap} 口。${i.name} ${i.hisBlames} 次，你 ${i.hisBlames + i.gap} 次`; out.retryLabel = '再打一次';
    if (multi) {
      const hypothetical = hypotheticalRank(m, multi.n);
      out.sub = `${multi.clock} ${eventPhrase(multi)} +${multi.n} 太狠，不然${hypothetical.rank <= m.passRank() ? '就过了' : `就差 ${hypothetical.gap} 口`}`;
    } else if (p.bellPots! >= 1) out.sub = `最后 15 秒你还甩出去 ${p.clearingThrown} 口，手里那 ${p.bellPots} 口没来得及`;
  } else {
    out.main = '今天差得有点多';
    if (multi) out.sub = `${multi.clock} ${eventPhrase(multi)} +${multi.n} 太狠`;
    else {
      let last = m.S.rankTrail.length - 1;
      while (last >= m.L.duration * .5 && !(m.S.rankTrail[last] > 0 && m.S.rankTrail[last] <= m.passRank())) last--;
      if (last < m.L.duration * .5) last = -1;
      if (last >= 0) out.sub = `${m.clockAt(last)} 你还排第 ${m.S.rankTrail[last]}`;
      else if (r.rank.every(a => a.thrown <= p.thrown)) out.sub = `你甩出去 ${p.thrown} 口，全场最多，就是背得也多`;
    }
  }
  return out;
}

// 三行真账同样是纯文案；并列以首次达到最终计数的先后决定，不按名字排序。
export function battleLines(m: Match): string[] {
  const p = m.S.player;
  if (!p) return [];
  const lines: string[] = [];
  const victim = Object.keys(p.kills ?? {}).sort((a, b) => p.kills![b] - p.kills![a] || p.killOrder![a] - p.killOrder![b])[0];
  if (victim) lines.push(`最大受害者：${victim}（炸在他身上 ${p.kills![victim]} 口）`);
  const counts = new Map<string, number>(); let villain = '', most = 0;
  for (const log of p.blameLog ?? []) {
    const source = log.src === 'bell' ? log.orig : log;
    if (source?.src !== 'mate' || !source.from) continue;
    const n = (counts.get(source.from) ?? 0) + 1; counts.set(source.from, n);
    if (n > most) {villain = source.from; most = n;}
  }
  if (villain) lines.push(`害你最多：${villain}（甩你 ${most} 口）`);
  if (p.closestThrow && p.closestThrow.seconds < 3) {
    // 先命中后到期的同帧可能略过零；原始记录不改，舍入后的负零按零显示。
    const seconds = p.closestThrow.seconds.toFixed(1);
    lines.push(`最险一口：${p.closestThrow.clock} 剩 ${seconds === '-0.0' ? '0.0' : seconds} 秒甩出去的那口`);
  }
  return lines;
}
