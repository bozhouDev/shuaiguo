// 对应原型 js/game.js 的 TIP_CHECKS，由每个 Match 单独创建。
import type { Match } from './match';

import * as C from './config';

// 建立本局条件与回调，不持有全局对局状态。
export function createTIP_CHECKS(m: Match): Record<string, () => boolean> { return {
    potWarn: () => m.urgentLeft(m.S.player) < C.DUE_WARN,                                   // 身上有锅快到点
    seen: () => m.potsOf(m.S.player) > 0 && !!m.seenBy(m.S.player),                          // 带着锅站进领导视野
    rankOut: () => m.workT() > 15 && m.ranking().indexOf(m.S.player) + 1 > m.passRank(),     // 掉出前三（开局 15 秒内大家都没背锅，不算）
    incoming: () => m.S.throws.some((f) => f.target === m.S.player && f.owner && !f.owner.isPlayer), // 同事的锅第一次朝你飞来（教反弹）
    nephewAim: () => m.potsOf(m.S.player) > 0 && !!m.S.player.aimTgt && m.S.player.aimTgt.key === 'nephew' && !!m.nephewGuardian(m.S.player.aimTgt), // 正瞄着亲属眼皮底下的小舅子
    pies: () => m.S.pies.length > 0,                                                    // 地上第一次有饼
  }; }
