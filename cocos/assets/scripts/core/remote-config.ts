// 移植计划§5：线上只调关卡中已有的数值，绝不修改全局常量或对局中的对象。
import {LEVELS} from './levels';
import type {Level} from './types';
export interface RemoteConfig {version: number; levels: Record<number, Record<string, number>>}
// 时长最低仍覆盖现有全部时间表；其余字段可独立安全覆盖，非法字段逐项忽略。
export const REMOTE_BOUNDS: Record<string, readonly [number, number]> = {
  duration: [60, 240], potLife: [10, 60], skyChance: [0, 1], leaderFocus: [0, 1],
  'ai.aggr': [0.1, 3], 'ai.parry': [0, 3], 'ai.dodge': [0.1, 3], 'ai.sneak': [0, 3], 'ai.focus': [0, 3],
  'aiEnd.aggr': [0.1, 3], 'aiEnd.parry': [0, 3], 'aiEnd.dodge': [0.1, 3], 'aiEnd.sneak': [0, 3], 'aiEnd.focus': [0, 3],
};
// 接口和磁盘缓存都必须经过同一个白名单；过低时长不能截断本关原有日程。
export function sanitizeConfig(value: unknown): RemoteConfig {
  const empty: RemoteConfig = {version: 0, levels: {}};
  if (!value || typeof value !== 'object') return empty;
  const v = value as RemoteConfig;
  if (!Number.isSafeInteger(v.version) || v.version < 0 || !v.levels || typeof v.levels !== 'object') return empty;
  const out: RemoteConfig = {version: v.version, levels: {}};
  for (const lv of LEVELS) {
    const patch = v.levels[lv.id]; if (!patch || typeof patch !== 'object') continue;
    const fields: Record<string, number> = {};
    const last = Math.max(0, ...lv.pace.map(x=>x.t), ...lv.bursts.map(x=>x.t), ...(lv.incidents||[]).map(x=>x.t),
      ...(lv.pieMeetings||[]).map(x=>x.t+x.duration), lv.finale?.t||0, lv.rushAt||0, lv.events?.window[1]||0);
    for (const [key, [min,max]] of Object.entries(REMOTE_BOUNDS)) {
      const n = patch[key];
      if (typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max && (key !== 'duration' || n > last)) fields[key] = n;
    }
    if (Object.keys(fields).length) out.levels[lv.id] = fields;
  }
  return out;
}
// 每次开局深拷贝，缓存后续更新和外部对象修改不会影响已开始的局。
export function levelForMatch(index: number, config: RemoteConfig): Level {
  const lv: Level = JSON.parse(JSON.stringify(LEVELS[index]));
  const fields = sanitizeConfig(config).levels[lv.id] || {};
  for (const [key, value] of Object.entries(fields)) {
    const [outer, inner] = key.split('.');
    if (inner) (lv[outer as 'ai'|'aiEnd'] ||= {})[inner] = value;
    else (lv as unknown as Record<string, unknown>)[outer] = value;
  }
  return lv;
}
