#!/usr/bin/env node
// 直接加载微信包中的 System.register core，复用冻结录像的适配器与比较契约。
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..', '..');
const INDEX = path.join(ROOT, 'cocos/build/wechatgame-001/assets/main/index.js');
const HELPERS = path.join(ROOT, 'cocos/build/wechatgame-001/src/chunks/bundle.js');
const MANIFEST = path.join(ROOT, 'tests/golden/manifest.json');
const ADAPTER = path.join(ROOT, 'cocos/tests/golden-adapter.cjs');
const RECORD = path.join(ROOT, 'tests/golden/record.cjs');
const VERIFY = path.join(ROOT, 'tests/golden/verify.cjs');

// 录像源文件由调用方提供；此脚本只读它们，不调用原型 harness。
function loadCommonJS(filename, customRequire) {
  const module = {exports: {}};
  const localRequire = customRequire || require;
  localRequire.main = {};
  const run = new Function('require', 'module', 'exports', '__filename', '__dirname', fs.readFileSync(filename, 'utf8'));
  run(localRequire, module, module.exports, filename, path.dirname(filename));
  return module.exports;
}

// SystemJS 的核心语法先登记模块；依赖只在真正加载 core 时递归执行。
function makeSystemLoader(indexSource, helperSource) {
  const definitions = new Map();
  const system = {
    register(id, dependencies, declare) {
      // Creator用匿名注册包裹共享helper，执行外壳后才会登记内部具名模块。
      if (typeof id !== 'string') {
        const anonymous = dependencies(() => {}, {import: async () => {throw new Error('anonymous System.register import');}});
        anonymous.execute?.();
        return;
      }
      if (definitions.has(id)) throw new Error(`重复 System.register 模块：${id}`);
      definitions.set(id, {dependencies, declare});
    },
  };
  const sandbox = {System: system, console};
  vm.runInNewContext(helperSource, sandbox, {filename: 'wechat/src/chunks/bundle.js'});
  vm.runInNewContext(indexSource, sandbox, {filename: 'wechat/assets/main/index.js'});

  const cache = new Map();
  const ccLegacy = {_RF: {push() {}, pop() {}}};
  const cc = {cclegacy: ccLegacy};
  function resolve(from, dependency) {
    if (dependency === 'cc') return dependency;
    if (!dependency.startsWith('.')) throw new Error(`core 引入了未接桩依赖 ${dependency}（来自 ${from}）`);
    const prefix = 'chunks:///_virtual/';
    const fromName = from.startsWith(prefix) ? from.slice(prefix.length) : from;
    return `chunks:///_virtual/${path.posix.normalize(path.posix.join(path.posix.dirname(fromName), dependency))}`;
  }
  function load(id) {
    if (id === 'cc') return cc;
    if (cache.has(id)) return cache.get(id);
    const def = definitions.get(id);
    if (!def) throw new Error(`编译包缺少 System.register 模块：${id}`);
    const exports = {};
    // System.register 的导出函数同时支持命名导出和对象导出。
    const exportValue = (name, value) => {
      if (typeof name === 'object' && name !== null) Object.assign(exports, name);
      else exports[name] = value;
      return value;
    };
    cache.set(id, exports);
    const deps = def.dependencies.map(name => load(resolve(id, name)));
    const declaration = def.declare(exportValue, {id, import: async name => load(resolve(id, name))});
    for (let i = 0; i < (declaration.setters || []).length; i++) declaration.setters[i](deps[i]);
    declaration.execute?.();
    return exports;
  }
  return {load, definitions, loaded: () => [...cache.keys()]};
}

// golden-adapter 规则保持唯一来源：只替换它 require 的 TS core 模块。
function makeCompiledAdapter(loader) {
  const fakeRequire = request => {
    if (request === './register-core.cjs') return {};
    if (request === '../assets/scripts/core/match.ts') return loader.load('chunks:///_virtual/match.ts');
    if (request === '../assets/scripts/core/remote-config.ts') return loader.load('chunks:///_virtual/remote-config.ts');
    throw new Error(`黄金录像适配器请求了未预期模块：${request}`);
  };
  return loadCommonJS(ADAPTER, fakeRequire);
}

// 同一 verify.cjs.firstDiff / record.cjs.compact 契约，避免维护第二套比较规则。
function loadComparison() {
  let record;
  record = loadCommonJS(RECORD, request => {
    if (request === 'node:fs' || request === 'node:path' || request === 'node:zlib' || request === 'node:crypto') return require(request);
    if (request === '../../cocos/tests/golden-adapter.cjs') return {runCase() {throw new Error('compiled comparison only imports compact helpers');}};
    throw new Error(`录像记录器请求了未预期模块：${request}`);
  });
  const verify = loadCommonJS(VERIFY, request => {
    if (request === 'node:fs' || request === 'node:path' || request === 'node:zlib' || request === 'node:crypto') return require(request);
    if (request === './record.cjs') return record;
    throw new Error(`录像比较器请求了未预期模块：${request}`);
  });
  return {...verify, compact: record.compact};
}

// 只支持定向录像和内存变异，不提供写入构建目录的选项。
function parseArgs(argv) {
  const mutation = argv.includes('--mutation-test');
  const levelIndex = argv.indexOf('--level'), seedIndex = argv.indexOf('--seed');
  const level = levelIndex < 0 ? undefined : Number(argv[levelIndex + 1]);
  const seed = seedIndex < 0 ? undefined : Number(argv[seedIndex + 1]);
  return {mutation, level, seed};
}

// 找第一处不同，快照和事件差异都给出对应的60Hz逻辑帧。
function firstDifference(loader, adapter, comparison, cases) {
  for (const entry of cases) {
    const old = JSON.parse(require('node:zlib').gunzipSync(fs.readFileSync(path.join(path.dirname(MANIFEST), entry.file))));
    const record = adapter.runCase(entry.level, entry.seed);
    const fresh = entry.compact ? comparison.compact(record) : record;
    const diff = comparison.firstDiff(old, fresh);
    if (diff) {
      const match = diff.field.match(/\.(snapshots|events)\[(\d+)\]/);
      const list = match?.[1], index = match ? Number(match[2]) : -1;
      const point = list && index >= 0 ? (old[list][index] || fresh[list][index]) : null;
      return {level: entry.level, seed: entry.seed, step: point?.step ?? (point?.t === undefined ? null : Math.round(point.t / old.dt)),
        time: point?.t ?? old.result?.t ?? null, field: diff.field, old: diff.old, fresh: diff.fresh};
    }
  }
  return null;
}

// 清单是只读事实来源，定向条件不能默认为空通过。
function casesFromManifest({level, seed}) {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const cases = manifest.cases.filter(entry => (level === undefined || entry.level === level) && (seed === undefined || entry.seed === seed));
  if (!cases.length) throw new Error('没有匹配的黄金录像');
  return cases;
}

// 每次构造独立注册表，防止变异模块缓存污染正常重放。
function build(indexSource, helperSource) {
  const loader = makeSystemLoader(indexSource, helperSource);
  return {loader, adapter: makeCompiledAdapter(loader)};
}

// 先在内存变异副本上验证失败，再用原字节重放，最后确认磁盘哈希。
function run() {
  const args = parseArgs(process.argv.slice(2));
  const originalIndex = fs.readFileSync(INDEX, 'utf8');
  const helperSource = fs.readFileSync(HELPERS, 'utf8');
  const indexHash = crypto.createHash('sha256').update(originalIndex).digest('hex');
  const helperHash = crypto.createHash('sha256').update(helperSource).digest('hex');
  const comparisons = loadComparison();
  const cases = casesFromManifest(args);

  if (args.mutation) {
    const mutationSource = originalIndex.replace('e("BASE_SPEED",145)', 'e("BASE_SPEED",146)');
    if (mutationSource === originalIndex) throw new Error('变异目标 BASE_SPEED 未在编译产物中找到');
    const mutated = build(mutationSource, helperSource);
    const diff = firstDifference(mutated.loader, mutated.adapter, comparisons, [cases[0]]);
    if (!diff) throw new Error(`变异未触发录像差异：关卡=${cases[0].level} 种子=${cases[0].seed}`);
    console.log(`MUTATION PASS 首组录像捕获 BASE_SPEED 变异：关卡=${diff.level} 种子=${diff.seed} 帧=${diff.step} 时间=${diff.time} 字段=${diff.field}`);
  }

  const {loader, adapter} = build(originalIndex, helperSource);
  const diff = firstDifference(loader, adapter, comparisons, cases);
  if (crypto.createHash('sha256').update(fs.readFileSync(INDEX)).digest('hex') !== indexHash ||
      crypto.createHash('sha256').update(fs.readFileSync(HELPERS)).digest('hex') !== helperHash) {
    throw new Error('编译产物在检查期间发生变化；本工具未写入这些文件');
  }
  if (diff) {
    console.error(JSON.stringify(diff, (_key, value) => value === undefined ? '<undefined>' : value, 2));
    process.exitCode = 1;
    return;
  }
  console.log(`PASS ${cases.length}/${cases.length} 组编译产物黄金录像完全一致（快照 + 事件 + 最终结果）`);
  console.log(`已登记 ${loader.definitions.size} 个 System.register 定义；本次加载：${loader.loaded().join(', ')}`);
  console.log(`构建产物 SHA-256 未变化：assets/main/index.js=${indexHash} src/chunks/bundle.js=${helperHash}`);
}

if (require.main === module) {
  try {run();}
  catch (error) {console.error(error?.stack || error); process.exitCode = 1;}
}

