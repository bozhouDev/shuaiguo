// 按移植计划§5共享本地/云存档比较规则；不访问平台、时钟或随机源。
import type {Best, Progress} from './types';

// 星级优先；同星时新记录用总账，旧记录没有总账则用背锅次数；平手保留已有值。
export function isBetterBest(candidate: Best, old?: Best): boolean {
  return candidate.stars > 0 && (!old || candidate.stars > old.stars ||
    candidate.stars === old.stars && (candidate.debt ?? candidate.blames ?? Infinity) < (old.debt ?? old.blames ?? Infinity));
}
// 合并只增加进度；称呼独立按修改时间选取，无时间戳的旧档视为0，平手保留已有称呼。
export function mergeProgress(current: Progress, incoming: Progress): Progress {
  const out: Progress = JSON.parse(JSON.stringify(current));
  out.unlocked = Math.max(current.unlocked, incoming.unlocked);
  out.best = {...current.best};
  for (const [id, best] of Object.entries(incoming.best)) if (isBetterBest(best, out.best[+id])) out.best[+id] = {...best};
  if (current.tutDone || incoming.tutDone) out.tutDone = true;
  if (current.achievements || incoming.achievements) {
    out.achievements = {...current.achievements};
    for (const [key, value] of Object.entries(incoming.achievements || {})) out.achievements[key] = !!(out.achievements[key] || value);
  }
  if (incoming.bossName !== undefined && (current.bossName === undefined || (incoming.bossNameAt || 0) > (current.bossNameAt || 0))) {
    out.bossName = incoming.bossName; out.bossNameAt = incoming.bossNameAt || 0;
  }
  return out;
}
