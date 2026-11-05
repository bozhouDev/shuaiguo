// 对应原型 js/game.js 的 TUT_STEPS，由每个 Match 单独创建。
import type { Match } from './match';
import type { TutorialStepDef } from './types';
import * as C from './config';

// 建立本局条件与回调，不持有全局对局状态。
export function createTUT_STEPS(m: Match): Record<string, TutorialStepDef> { return {
    // 按住摇杆走进黄圈
    walk: {
      enter() { m.S.tut!.ring = m.L.tutorial!.spots.ring; },
      check: () => m.E.dist(m.S.player.sn.x, m.S.player.sn.y, m.S.tut!.ring!.x, m.S.tut!.ring!.y) < C.TUT_RING_R,
    },
    // 老板丢一口天降锅；砸到身上后说下一句
    sky: {
      enter() { m.tutLater(0.4, () => m.launchSky(m.S.player, m.S.leaders[0])); },
      potOnMe() { m.showCoach(m.S.tut!.step!.say2!); m.tutLater(2.2, m.tutNext); }, // 带教提速：3.6 → 2.2 秒
    },
    // 甩给同事（谁都行，记下是谁，下一步让他的锅到点）
    throw: {
      fire: true,
      land(b) { m.S.tut!.victim = b; m.showCoach(m.S.tut!.step!.say2!); m.tutLater(0.9, m.tutNext); },
    },
    // 刚被甩中的同事身上的锅快进到点，看他背锅
    expire: {
      enter() {
        const v = m.S.tut!.victim || m.agentByKey('intern');
        if (!m.potsOf(v)) m.receivePot(v, m.newPot(m.S.t));
        for (const pot of v.sn.segs) pot.due = m.capDue(m.S.t + 2.2); // 带教提速：3.5 → 2.2 秒到点
      },
      blame() { m.showCoach(m.S.tut!.step!.say2!); m.tutLater(1.8, m.tutNext); },
    },
    // 老板出来巡视：给实习生一口锅，实习生想当面甩给主角，被抓现行
    sight: {
      enter() { const l = m.S.leaders[0]; l.tgo = m.L.tutorial!.spots.boss; l.wait = 0; },
      arrive(l) {
        const it = m.agentByKey('intern'), P = m.S.player;
        // 视野朝实习生和主角的中间看，尽量同时罩住两个人
        l.faceLock = Math.atan2((it.sn.y + P.sn.y) / 2 - l.y, (it.sn.x + P.sn.x) / 2 - l.x);
        l.state = 'aim'; l.targets = [it]; l.aimT = C.AIM_TIME;
        m.tutLater(C.AIM_TIME + 0.6, () => m.floats.add('嘿嘿……这个给新人', it.sn.x, it.sn.y - 50, '#1F2A44'));
        m.tutLater(C.AIM_TIME + 1.4, () => {
          m.caught(it, l);
          m.shake = 6;
          m.E.sfx('caught');
          m.showCoach(m.S.tut!.step!.say2!);
          m.tutLater(2.2, m.tutNext);
        });
      },
    },
    // 老板再丢主角一口：走出视野，甩给同事
    dodge: {
      fire: true,
      enter(step) {
        if (!m.seenBy(m.S.player)) m.showCoach(step.alt || step.say); // 主角本来就不在视野里，换个说法
        m.tutLater(0.4, () => m.launchSky(m.S.player, m.S.leaders[0]));
      },
      land() { m.tutLater(0.7, m.tutNext); },
    },
    // 亮出右上角名次，点「开始上班」
    rank: {
      btn: '开始上班',
      enter() {
        m.resetCoachInput();
        m.emit('coachLock', true);
        m.emit('coachFocus');
        m.S.tut!.showRank = true;
        m.emit('coachRankPulse');
      },
    },
  }; }
