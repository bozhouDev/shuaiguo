// 隐藏调试入口的Node契约；只在内存转译，不启动编辑器、不写资源。
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const ts = require('/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources/resources/3d/engine/node_modules/typescript');
const cache = new Map();
class Node {
  children = []; position = {};
  addChild(n) {n.parent = this; this.children.push(n);}
  setSiblingIndex() {} destroy() {} setPosition() {}
}
const cc = {Node, Layers: {Enum: {UI_2D: 1}}, KeyCode: {}, Game: {EVENT_HIDE: 'hide', EVENT_SHOW: 'show'},
  Input: {EventType: {}}, input: {on() {}, off() {}}, game: {on() {}, off() {}}, view: {on() {}, off() {}}, sys: {platform: 'web', Platform: {WECHAT_GAME: 'wechat'}}};
// Cocos仅在设备边界替换；App动作、关卡创建、core和页面排版均运行源码。
function load(file) {
  file = path.resolve(file); if (!file.endsWith('.ts')) file += '.ts';
  if (cache.has(file)) return cache.get(file).exports;
  const mod = {exports: {}}; cache.set(file, mod);
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
  new Function('require', 'module', 'exports', js)(s => s === 'cc' ? cc : s === 'cc/env' ? {PREVIEW: false} : load(path.resolve(path.dirname(file), s)), mod, mod.exports);
  return mod.exports;
}
// 记录平台读写，不替代PlayerStore的实际存档实现。
function storage(enabled = true) {
  const memory = new Map(), writes = [];
  return {kind: 'web', memory, writes, debugEnabled: () => enabled,
    getStorage: k => memory.get(k) ?? null, setStorage(k, v) {writes.push(k); memory.set(k, v);}, removeStorage(k) {writes.push(k); memory.delete(k);}};
}
// 只替代最末端绘图设备，真实ScreenPaint负责文本和命中框。
function paint(width = 375, height = 812) {
  const texts = [], surface = new Proxy({width, height, assets: {spr: {}}, fillText(t) {texts.push(t);}}, {get: (o, k) => k in o ? o[k] : () => {}});
  const {ScreenPaint} = load('cocos/assets/scripts/view/ScreenPaint');
  return {p: new ScreenPaint(surface), surface, texts};
}
(async () => {
  const {WebPlatform} = load('cocos/assets/scripts/platform/WebPlatform'), web = new WebPlatform();
  const oldLocation = global.location, oldWx = global.wx;
  try {
    for (const [search, enabled] of [['', false], ['?debug=0', false], ['?debug=1', true], ['?level=5&auto=1', false]]) {
      global.location = {search}; assert.equal(web.debugEnabled(), enabled, `网页debug门禁 ${search}`);
    }
    delete global.location; assert.equal(web.debugEnabled(), false);
    const {WechatPlatform} = load('cocos/assets/scripts/platform/WechatPlatform'), wechat = new WechatPlatform();
    for (const [envVersion, enabled] of [['release', false], ['develop', true], ['trial', true], ['unknown', false]]) {
      global.wx = {getAccountInfoSync: () => ({miniProgram: {envVersion}})};
      assert.equal(wechat.debugEnabled(), enabled, `微信环境 ${envVersion}`);
    }
    global.wx = {getAccountInfoSync() {throw Error('接口失败');}}; assert.equal(wechat.debugEnabled(), false);
    delete global.wx; assert.equal(wechat.debugEnabled(), false);
    assert.throws(() => wechat.removeStorage('shuaiguo_v3'));
    const removed=[];global.wx={removeStorageSync: key=>removed.push(key)};wechat.removeStorage('shuaiguo_v3');assert.deepEqual(removed,['shuaiguo_v3']);
  } finally {if (oldLocation === undefined) delete global.location; else global.location = oldLocation; if (oldWx === undefined) delete global.wx; else global.wx = oldWx;}
  console.log('PASS 网页debug=1与微信开发/体验版门禁；正式版、未知环境、接口异常关闭');

  const {AppView} = load('cocos/assets/scripts/view/AppView'), {LobbyView, LobbyDebug} = load('cocos/assets/scripts/view/LobbyView');
  const {PlayerStore} = load('cocos/assets/scripts/view/PlayerStore'), {Match} = load('cocos/assets/scripts/core/match');
  const {LEVELS} = load('cocos/assets/scripts/core/levels');
  // 运行真实App字段初始化；只替换设备节点创建，证明旧URL和全局入口也受debug约束。
  const original = Object.fromEntries(['node','pane','loadingCard','resize'].map(k=>[k,AppView.prototype[k]]));
  const oldWindow=global.window, previousLocation=global.location;
  try {
    delete global.window;AppView.prototype.node=()=>new Node();AppView.prototype.pane=()=>({});AppView.prototype.loadingCard=()=>new Node();AppView.prototype.resize=()=>{};
    for(const enabled of [false,true]){
      global.location={search:`?level=5&auto=1&seed=0&tut=1${enabled?'&debug=1':''}`};
      const app=new AppView(new Node());assert.equal(app.params.has('level'),enabled);assert.equal(app.params.has('seed'),enabled);
      global.window={};app.exposeDebug();assert.equal(!!window.SG_DEBUG,enabled);delete global.window;
    }
  }finally{Object.assign(AppView.prototype,original);if(oldWindow===undefined)delete global.window;else global.window=oldWindow;if(previousLocation===undefined)delete global.location;else global.location=previousLocation;}
  console.log('PASS 真实App初始化：无debug时旧level/auto/tut/seed参数及SG_DEBUG均不生效');
  // 使用App原型及真实持久层，避免为测试添加生产接口。
  function host(enabled = true) {
    const platform = storage(enabled), {p, surface, texts} = paint();
    return Object.assign(Object.create(AppView.prototype), {platform, debugEnabled: enabled, store: new PlayerStore(platform), params: new URLSearchParams(), debug: new LobbyDebug(),
      parent: new Node(), root: new Node(), assets: {}, ready: true, alive: true, serial: 0, real: 0, screen: 'lobby', panel: '', selected: 0,
      heights: {}, scroll: 0, actions: [], surface, paint: p, texts, lobby: new LobbyView(p), praise: {clear() {}, reset() {}},
      audio: {unlock() {}, sfx() {}, bgm() {}, sync() {}, hidden() {}}, render() {}, removeEdit() {}, messages: {event() {}},
      panes: [{p, surface, mask: {setPosition() {}, getComponent() {return {setContentSize() {}};}}, root: new Node()}]});
  }
  // 从真实工牌命中框走触控down/up，关闭时没有热区、动作也无效果。
  function badgeTap(app, at) {
    app.real = at; app.paint.actions = [];
    app.lobby.draw(0, app.store.read(), at, {top: 0}, true, app.platform.debugEnabled()); app.actions = app.paint.actions;
    const e = {getID: () => 1, getUILocation: () => ({x: 24, y: 812 - 20})}, now = performance.now;
    try {performance.now = () => at * 1000; app.down(e); app.up(e);} finally {performance.now = now;}
  }
  for (const enabled of [false, true]) {
    const app = host(enabled);
    for (let i = 0; i < 4; i++) badgeTap(app, i * .25);
    assert.equal(app.panel, ''); badgeTap(app, 1);
    assert.equal(app.panel, enabled ? 'debug' : '', '五连点仅在开关开启时打开');
    if (!enabled) {for (const name of ['debug-badge', 'debug:start', 'debug:clear', 'debug:confirm-clear']) app.action(name); assert.equal(app.panel, ''); assert.equal(app.platform.writes.length, 0);}
  }
  const slow = host(); for (const at of [0, .5, 1, 1.5, 2]) badgeTap(slow, at); assert.equal(slow.panel, '');
  for (const at of [2.1, 2.2, 2.3, 2.4]) badgeTap(slow, at); assert.equal(slow.panel, 'debug', '窗口应保留最近五次点击');
  const boundary=host();for(const at of [0,.3,.6,.9,1.5])badgeTap(boundary,at);assert.equal(boundary.panel,'debug');
  const hidden=host();for(const at of [0,.1,.2,.3])badgeTap(hidden,at);hidden.hide();badgeTap(hidden,.4);assert.equal(hidden.panel,'');
  console.log('PASS 真实工牌触控：四下不打开、1.5秒五下打开、超时重计；关闭时连点/动作无效');

  // 直接开局仍经过真实WorldView构造和Match，只跳过设备资源初始化。
  const {WorldView} = load('cocos/assets/scripts/view/WorldView');
  const start = WorldView.prototype.start; WorldView.prototype.start = async function () {this.ready = true;};
  try {
    const app = host(); app.panel = 'debug'; app.store.save({unlocked: 1, best: {}, tutDone: true}); app.debug.level = 4; app.debug.seed = '1001'; app.debug.auto = true;
    app.action('debug:start'); await Promise.resolve(); await Promise.resolve();
    assert.equal(app.screen, 'play'); assert.equal(app.panel, ''); assert.equal(app.world.match.L, LEVELS[4]); assert.equal(app.world.match.auto, true); assert.equal(app.world.match.S.tut, null);
    const oracle = new Match({level: 4, seed: 1001, auto: true, progress: app.store.read()}); assert.deepEqual(app.world.match.S, oracle.S);
    assert.equal(app.store.read().unlocked, 5); app.world.destroy();
    const tut = host(); tut.panel = 'debug'; tut.store.save({unlocked: 5, best: {}, tutDone: true}); tut.debug.auto = true;
    tut.action('debug:tutorial'); assert.equal(tut.debug.auto, false); assert.equal(tut.debug.tutorial, true); assert.equal(tut.debug.level, 0);
    tut.action('debug:start'); await Promise.resolve(); await Promise.resolve(); assert.ok(tut.world.match.S.tut, '已完成带教也强制重走'); tut.world.destroy();
    const auto = host(); auto.panel = 'debug'; auto.debug.tutorial = true; auto.action('debug:auto'); assert.equal(auto.debug.tutorial, false); assert.equal(auto.debug.auto, true);
  } finally {WorldView.prototype.start = start;}
  console.log('PASS 面板选第5关直接开局、seed1001初态一致、auto与强制带教互斥、已完成带教可重走');

  // 输入保存走真实动作校验；种子0合法，错误输入不能覆盖既有值。
  const edit=host();edit.panel='debug-edit';edit.debugField='seed';edit.edit={string:'0'};edit.action('debug:save-edit');assert.equal(edit.debug.seed,'0');assert.equal(edit.panel,'debug');
  for(const value of ['-1','1.5','4294967296','Infinity']){edit.panel='debug-edit';edit.edit={string:value};edit.action('debug:save-edit');assert.equal(edit.panel,'debug-edit');assert.equal(edit.debug.seed,'0');}
  edit.edit={string:''};edit.action('debug:save-edit');assert.equal(edit.debug.seed,'');
  edit.panel='debug-edit';edit.debugField='runs';edit.edit={string:'200'};edit.action('debug:save-edit');assert.equal(edit.debug.runs,200);
  for(const value of ['0','201','1.5','']){edit.panel='debug-edit';edit.edit={string:value};edit.action('debug:save-edit');assert.equal(edit.panel,'debug-edit');assert.equal(edit.debug.runs,200);}
  console.log('PASS 输入校验：零种子/留空/uint32上界、1～200整数局数；非法输入保留原值');

  const sim = host(); sim.panel = 'debug'; sim.debug.level = 0; sim.debug.runs = 2; sim.debug.seed = '1001';
  sim.world = {match: new Match({level: 2, seed: 321})}; const current = sim.world.match, rng = current.E.rngState(), state = current.S;
  sim.store.save({unlocked: 4, best: {}, bossName: '王总'}); const before = [...sim.platform.memory], writes = sim.platform.writes.length;
  sim.action('debug:simulate'); assert.equal(sim.debug.busy, true); sim.action('debug:simulate');
  await new Promise(resolve => setTimeout(resolve, 80));
  const expected = new Match({level: 0, seed: 1001, progress: sim.store.read()}).simulate(0, 2, 1001);
  assert.deepEqual(sim.debug.result, expected); assert.equal(sim.debug.busy, false); assert.equal(current.S, state); assert.equal(current.E.rngState(), rng);
  assert.deepEqual([...sim.platform.memory], before); assert.equal(sim.platform.writes.length, writes);
  AppView.prototype.modal.call(sim, 'debug'); assert.match(sim.texts.join(''), /过关/); assert.match(sim.texts.join(''), /版本/); assert.match(sim.texts.join(''), /构建时间/);
  console.log('PASS simulate(0,2,1001)摘要与真实core一致，不写存档、不改活动对局/RNG；面板显示版本和构建状态');

  const clear = host(); clear.panel = 'debug'; clear.store.save({unlocked: 5, best: {1: {stars: 3}}, tutDone: true, bossName: '王总', achievements: {nephewCrushed: true}}); clear.store.set('music', false);
  const saved = clear.platform.memory.get('shuaiguo_v3'); clear.action('debug:confirm-clear'); assert.equal(clear.platform.memory.get('shuaiguo_v3'), saved);
  clear.action('debug:clear'); assert.equal(clear.panel, 'debug-clear'); assert.equal(clear.platform.memory.get('shuaiguo_v3'), saved);
  clear.action('debug:cancel-clear'); assert.equal(clear.panel, 'debug'); assert.equal(clear.platform.memory.get('shuaiguo_v3'), saved);
  clear.action('debug:clear'); clear.action('debug:confirm-clear'); assert.deepEqual(clear.store.read(), {unlocked: 1, best: {}}); assert.equal(clear.platform.memory.has('shuaiguo_v3'), false); assert.equal(clear.store.settings.music, false); assert.equal(clear.selected, 0);
  console.log('PASS 清档必须二次确认，可取消；进度/称呼/教学/成就清空，声音设置保留');
  const failed=host();failed.panel='debug-clear';failed.platform.removeStorage=()=>{throw Error('存储被禁用');};failed.action('debug:confirm-clear');assert.equal(failed.panel,'debug-clear');
  const cancel=host();cancel.panel='debug';cancel.action('debug:simulate');assert.equal(cancel.debug.busy,true);cancel.action('close');await new Promise(resolve=>setTimeout(resolve,50));assert.equal(cancel.debug.busy,false);assert.equal(cancel.debug.result,null);assert.equal(cancel.debugTimer,undefined);
  console.log('PASS 清档异常保留确认页；关闭面板取消模拟计时器，无延迟写入或后台任务');
  const destroyed=host();destroyed.audio.destroy=()=>{};destroyed.assets.destroy=()=>{};destroyed.panel='debug';destroyed.action('debug:simulate');destroyed.destroy();await new Promise(resolve=>setTimeout(resolve,50));assert.equal(destroyed.debugTimer,undefined);assert.equal(destroyed.debug.busy,false);assert.equal(destroyed.debug.result,null);
  // 三屏卡片用真实绘字/命中框检查；竖向超出交给已有Mask滚动，水平不得越界。
  for(const [width,height] of [[375,812],[375,667],[360,780]]){const {p}=paint(width,height),d=new LobbyDebug(),b={x:16,y:0,w:width-32,h:1200};d.seed='4294967295';d.result=expected;d.summary=sim.debug.summary;const total=d.draw(p,b);assert.ok(total>height*.92);for(const a of p.actions){assert.ok(a.x>=b.x&&a.x+a.w<=b.x+b.w,`${a.action}水平越界`);assert.ok(a.y+a.h<=total);}assert.ok(p.actions.some(a=>a.action==='debug:clear'));}
  console.log('PASS 销毁取消模拟任务；375×812/375×667/360×780面板按钮水平不越界，长内容由Mask滚动');
})().catch(error => {console.error(error); process.exitCode = 1;});
