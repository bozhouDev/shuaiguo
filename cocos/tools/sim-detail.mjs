// 逐局明细模拟（在 cocos/ 下运行，关卡序号从 0 开始）：
// node --experimental-strip-types --import ./tests/register-core.mjs tools/sim-detail.mjs 100 0,1,2,3,4 --seed 6011
// node --experimental-strip-types --import ./tests/register-core.mjs tools/sim-detail.mjs 300 2 --seed 7013 --items --json
// node --experimental-strip-types --import ./tests/register-core.mjs tools/sim-detail.mjs 300 2 --seeds 6011,7013 --json
// --seeds 的局数是每个种子的局数；保留分种子结果，并按原始计数合并，不能平均差一点比例。
// 默认：100 局、全部关卡、种子 6011、关闭道具；--json 只输出机读 JSON。
// 同关各局连续消费随机流，各关重置种子，与 P9-2 原始脚本保持一致。
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { Match } from '../assets/scripts/core/match.ts';
import { LEVELS } from '../assets/scripts/core/levels.ts';

// 每局走真实更新与结算入口；不修改 AI、计分或清账规则。
export function simulateDetail({ runs = 100, levels = LEVELS.map((_, i) => i), seed = 6011, items = false } = {}) {
  const m = new Match({ itemDrops: items, seed: 1001 });
  m.simulating = true; m.E.muted = true; m.auto = true;
  const results = [];
  for (const level of levels) {
    const L = LEVELS[level]; m.L = L; m.E.seed(seed);
    let passed = 0, crushed = 0, rankFailed = 0, sumGap = 0;
    const crushQuarters = [0, 0, 0, 0];
    // 差距分桶互斥：0～1、恰好2、恰好3、大于3；另给累计值，避免误读。
    const gapBuckets = { le1: 0, eq2: 0, eq3: 0, gt3: 0 };
    const hits = { sky: 0, burst: 0, leader: 0, mate: 0 };
    for (let r = 0; r < runs; r++) {
      m.S = m.makeState(false); m.mode = 'play';
      while (!m.S.over) m.update(1 / 30);
      const res = m.calculateResult(m.S.over === 'crushed' ? 'crushed' : 'time', { best: {}, unlocked: 1 });
      for (const key of Object.keys(hits)) hits[key] += m.S.player.hitsBy[key] || 0;
      if (res.crushed) {
        crushed++; crushQuarters[Math.min(3, Math.floor(m.workT() / L.duration * 4))]++; continue;
      }
      if (res.stars) { passed++; continue; }
      if (!res.lineInfo) throw new Error(`第 ${L.id} 关排名失败却没有下班线数据`);
      rankFailed++; const gap = res.lineInfo.gap; sumGap += gap;
      gapBuckets[gap <= 1 ? 'le1' : gap <= 2 ? 'eq2' : gap <= 3 ? 'eq3' : 'gt3']++;
    }
    const nearMissCount = gapBuckets.le1 + gapBuckets.eq2;
    results.push({ level, id: L.id, name: L.name, duration: L.duration, runs, passed, crushed, rankFailed,
      passRate: passed / runs, crushRate: crushed / runs, crushQuarters, gapBuckets,
      gapCumulative: { le1: gapBuckets.le1, le2: nearMissCount, le3: nearMissCount + gapBuckets.eq3, gt3: gapBuckets.gt3 },
      nearMissCount, nearMissRate: rankFailed ? nearMissCount / rankFailed : null,
      avgGap: rankFailed ? sumGap / rankFailed : null,
      hitsPerRun: Object.fromEntries(Object.entries(hits).map(([key, n]) => [key, n / runs])),
    });
  }
  return { runs, seed, items, dt: 1 / 30, results };
}

// 每个种子独立重跑；用局数和排名失败数分别加权，保留无排名失败时的 null。
export function simulateSeeds({ seeds = [6011, 7013], ...options } = {}) {
  const perSeed = seeds.map(seed => simulateDetail({ ...options, seed }));
  const results = perSeed[0].results.map((first, index) => {
    const rows = perSeed.map(output => output.results[index]);
    const sum = key => rows.reduce((n, row) => n + row[key], 0);
    const runs = sum('runs'), passed = sum('passed'), crushed = sum('crushed'), rankFailed = sum('rankFailed');
    const gapBuckets = Object.fromEntries(Object.keys(first.gapBuckets).map(key => [key, rows.reduce((n, row) => n + row.gapBuckets[key], 0)]));
    const nearMissCount = sum('nearMissCount');
    return { ...first, runs, passed, crushed, rankFailed, passRate: passed / runs, crushRate: crushed / runs,
      crushQuarters: first.crushQuarters.map((_, i) => rows.reduce((n, row) => n + row.crushQuarters[i], 0)),
      gapBuckets, gapCumulative: { le1: gapBuckets.le1, le2: nearMissCount, le3: nearMissCount + gapBuckets.eq3, gt3: gapBuckets.gt3 },
      nearMissCount, nearMissRate: rankFailed ? nearMissCount / rankFailed : null,
      avgGap: rankFailed ? rows.reduce((n, row) => n + (row.avgGap ?? 0) * row.rankFailed, 0) / rankFailed : null,
      hitsPerRun: Object.fromEntries(Object.keys(first.hitsPerRun).map(key => [key, rows.reduce((n, row) => n + row.hitsPerRun[key] * row.runs, 0) / runs])),
    };
  });
  return { runs: perSeed[0].runs * seeds.length, runsPerSeed: perSeed[0].runs, seeds, items: perSeed[0].items, dt: perSeed[0].dt, perSeed, results };
}

// 解析命令行，拒绝无效局数/关卡/种子，避免把错误参数当成有效调参证据。
function main(args) {
  const positional = []; let seed = 6011, seeds, seedSpecified = false, items = false, json = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--seed') { seed = Number(args[++i]); seedSpecified = true; }
    else if (arg === '--seeds') seeds = (args[++i] ?? '').split(',').map(s => s.trim() === '' ? NaN : Number(s));
    else if (arg === '--items') items = true;
    else if (arg === '--json') json = true;
    else if (arg.startsWith('--')) throw new Error(`未知参数：${arg}`);
    else positional.push(arg);
  }
  const runs = Number(positional[0] ?? 100);
  const levels = positional[1] === undefined ? LEVELS.map((_, i) => i) : positional[1].split(',').map(Number);
  if (positional.length > 2 || !Number.isInteger(runs) || runs <= 0 || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff ||
      levels.some(i => !Number.isInteger(i) || i < 0 || i >= LEVELS.length) || new Set(levels).size !== levels.length ||
      (seeds && (seedSpecified || seeds.some(s => !Number.isInteger(s) || s < 0 || s > 0xffffffff) || new Set(seeds).size !== seeds.length))) {
    throw new Error('参数应为：正整数局数 [关卡序号0,1,...] [--seed 单种子 或 --seeds 种子1,种子2] [--items] [--json]；种子范围0至4294967295，不可重复');
  }
  const output = seeds ? simulateSeeds({ runs, levels, seeds, items }) : simulateDetail({ runs, levels, seed, items });
  if (json) { console.log(JSON.stringify(output, null, 2)); return; }
  const pct = n => n === null ? '无排名失败样本' : `${(n * 100).toFixed(1)}%`;
  console.log(`${seeds ? `每关合计 ${output.runs} 局，每种子 ${runs} 局，种子 ${seeds.join(',')}` : `每关 ${runs} 局，种子 ${seed}`}，道具${items ? '开启' : '关闭'}；差距分桶互斥，压垮局不计排名失败。`);
  for (const r of output.results) {
    console.log(`${r.name} | 通过 ${pct(r.passRate)} | 压垮 ${pct(r.crushRate)} | 差≤2/排名失败 ${r.nearMissCount}/${r.rankFailed} (${pct(r.nearMissRate)}) | 压垮时刻四等分 ${r.crushQuarters.join(',')} | 排名失败差距 ≤1/2/3/>3口 ${Object.values(r.gapBuckets).join('/')}，平均差 ${r.avgGap?.toFixed(2) ?? '无'} | 每局被砸 天降/散会/领导/同事 ${Object.values(r.hitsPerRun).map(n => n.toFixed(2)).join('/')}`);
  }
}

// 导入时供调参证据脚本复用，直接执行时才读取命令行。
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
