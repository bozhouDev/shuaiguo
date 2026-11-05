// 原型音效表逐项搬运；按移植计划§9补齐掉出名额的已有采样。
export const SFX: Record<string, {id:string;vol:number;rate?:number;twice?:number;fb?:string}> = {
    // 对局核心
    whoosh: { id: 'sfx_throw', vol: 0.45 },                       // 玩家把锅甩出去
    throw: { id: 'sfx_throw_hit', vol: 0.5 },                     // 甩中同事
    combo: { id: 'sfx_combo', vol: 0.4, fb: 'combo' },            // 连甩，调用方按连甩数提高音高
    hit: { id: 'sfx_pot_hit_me', vol: 0.5 },                      // 被锅砸中
    back: { id: 'sfx_pot_back', vol: 0.4 },                       // 同事把锅甩给我
    parry: { id: 'sfx_parry', vol: 0.5 },                         // 反甩弹回
    miss: { id: 'sfx_miss', vol: 0.4 },                           // 甩空，锅弹回自己
    blame: { id: 'sfx_blame', vol: 0.45, fb: 'back' },            // 背锅 +N
    caught: { id: 'sfx_caught', vol: 0.5, fb: 'boss' },           // 当着领导甩锅被抓 / 领导盯上你
    aim: { id: 'sfx_boss_aim', vol: 0.35, fb: 'warn' },           // 领导瞄准你
    leaderThrow: { id: 'sfx_boss_throw', vol: 0.35 },             // 领导朝你丢出锅
    skyWarn: { id: 'sfx_sky_warn', vol: 0.35, fb: 'warn' },       // 天降锅阴影出现
    skyLand: { id: 'sfx_sky_land', vol: 0.45, fb: 'hit' },        // 天降锅砸下来
    hotHit: { id: 'sfx_hot_fuse', vol: 0.4, fb: 'boss' },         // 急件砸到手里
    boom: { id: 'sfx_hot_boom', vol: 0.5, fb: 'boss' },           // 急件炸了
    bump: { id: 'sfx_leader_bump', vol: 0.5, fb: 'boss' },        // 撞上领导 +3
    alarm: { id: 'sfx_alarm', vol: 0.3, fb: 'warn' },             // 快压垮报警
    crush: { id: 'sfx_crush', vol: 0.4, fb: 'lose' },             // 同事被压垮
    // 办公室事件
    chat: { id: 'sfx_chat_msg', vol: 0.35, fb: 'tick' },          // 工作群消息
    burst: { id: 'sfx_meeting_burst', vol: 0.45, fb: 'warn' },    // 会议室散会喷锅
    printer: { id: 'sfx_printer_jam', vol: 0.45, fb: 'warn' },    // 打印机卡纸喷锅
    tea: { id: 'sfx_tea', vol: 0.35, fb: 'bell' },                // 下午茶 / 茶水间收尾
    workStart: { id: 'sfx_work_start', vol: 0.45, fb: 'boss' },   // 09:00 正式上班
    rush: { id: 'sfx_rush', vol: 0.45, fb: 'boss' },              // 17:00 突击派活
    // 表扬贴纸实际用rankup采样；praise别名供归属反馈复用，不新增音频。
    praise: { id: 'sfx_rank_up', vol: 0.4, fb: 'rankup' },
    rankup: { id: 'sfx_rank_up', vol: 0.4 },                      // 冲回前三
    rankDown: { id: 'sfx_rank_down', vol: 0.4 },                  // 掉出过关名额，音量与冲回名额一致
    tick: { id: 'sfx_tick', vol: 0.4 },                           // 最后 10 秒
    tickUrgent: { id: 'sfx_tick', vol: 0.5, rate: 1.35, twice: 0.1 }, // 最后 3 秒：升调连响两下
    bell: { id: 'sfx_bell', vol: 0.45 },                          // 18:00 下班铃
    // 短曲
    win: { id: 'jg_win', vol: 0.5 },
    lose: { id: 'jg_lose', vol: 0.5 },
    crushed: { id: 'jg_crushed', vol: 0.5, fb: 'lose' },
    unlock: { id: 'jg_unlock', vol: 0.45, fb: 'rankup' },
    // 界面
    click: { id: 'ui_click', vol: 0.3 },
    uiBack: { id: 'ui_back', vol: 0.35 },
    toggle: { id: 'ui_toggle', vol: 0.4, fb: 'tick' },
    star: { id: 'ui_star', vol: 0.4, fb: 'tick' },
    revive: { id: 'ui_revive', vol: 0.45, fb: 'win' },
    buff: { id: 'ui_buff', vol: 0.4, fb: 'rankup' },
  };
