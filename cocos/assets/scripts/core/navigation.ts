// 对应原型 js/game.js 的 NAV，由每个 Match 单独创建。
import type { Match } from './match';
import type { Navigation } from './types';
import { OFFICE } from './levels';
import * as C from './config';

// 建立本局寻路网格，不持有全局对局状态。
export function createNAV(m: Match): Navigation { return (() => {
    const W = OFFICE.world, cols = Math.ceil(W.w / C.NAV_CELL), rows = Math.ceil(W.h / C.NAV_CELL);
    const block = new Uint8Array(cols * rows);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = (c + 0.5) * C.NAV_CELL, y = (r + 0.5) * C.NAV_CELL;
      let b = x < C.LEADER_R || y < C.LEADER_R || x > W.w - C.LEADER_R || y > W.h - C.LEADER_R;
      for (const o of m.obstacles) {
        if (b) break;
        b = x > o.x - C.LEADER_R && x < o.x + o.w + C.LEADER_R && y > o.y - C.LEADER_R && y < o.y + o.h + C.LEADER_R;
      }
      block[r * cols + c] = b ? 1 : 0;
    }
    return { cols, rows, block };
  })(); }
