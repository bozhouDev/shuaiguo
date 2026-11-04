// 只在内存转译；运行真实页面和DrawSurface，在最终Label赋值处拒绝emoji，不启动编辑器。
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const ts = require('/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources/resources/3d/engine/node_modules/typescript');
const root = path.resolve(__dirname, '../..'), cache = new Map(), labels = [], images = [];
// 独立于生产过滤器的验收规则，包含旗帜、肤色、ZWJ、变体、键帽、字符星与播放三角。
const forbidden = /\p{Extended_Pictographic}|[\u2300-\u23ff\u2600-\u27bf\u{1f000}-\u{1ffff}\u200d\u20e3\ufe0e\ufe0f\u{e0020}-\u{e007f}★☆▶]/u;
class Label {
  static Overflow = {NONE: 0}; static HorizontalAlign = {CENTER: 0, LEFT: 1}; static VerticalAlign = {CENTER: 0};
  get string() { return this.value || ''; }
  set string(value) { assert.doesNotMatch(value, forbidden, `最终Label仍含图标字符：${value}`); this.value = value; labels.push(value); }
}
class Color { constructor() { this.a = 255; } }
class UITransform { setContentSize() {} setAnchorPoint() {} }
class Sprite { static SizeMode = {CUSTOM: 0}; }
class Mask { static Type = {GRAPHICS_RECT: 0, GRAPHICS_ELLIPSE: 1}; }
// 按本机3.8.8公开string setter的调用顺序：先写textLabel，再通知文字事件。
class EditBox {
  static InputMode = {SINGLE_LINE: 0}; static KeyboardReturnType = {DONE: 0}; static EventType = {EDITING_DID_BEGAN: 'began'};
  get string() { return this.value; } set string(value) { this.value = value; if (this.textLabel) this.textLabel.string = value; }
  focus() {}
}
class Node {
  children = []; components = new Map(); position = {x: 0, y: 0};
  addComponent(Type) { const c = new Type(); c.node = this; this.components.set(Type, c); return c; }
  getComponent(Type) { return this.components.get(Type); }
  addChild(n) { n.parent = this; this.children.push(n); }
  setPosition(x, y) { this.position = {x, y}; } setScale() {} setSiblingIndex() {} on() {} off() {}
}
const cc = {Label, Color, UITransform, Sprite, Mask, Node, EditBox, view: {getVisibleSize: () => ({width: 375, height: 812})}, Layers: {Enum: {UI_2D: 1}},
  KeyCode: new Proxy({}, {get: (_, k) => k}), Graphics: class {static LineCap = {ROUND: 0, BUTT: 1}; clear() {} moveTo() {} lineTo() {} close() {} fill() {} stroke() {}}};
// 常驻层只替换原生网格/图集上传边界；真实RetainedWorld仍负责状态、图标选择、布局与只读约束。
class RetainedNode {
  children=new Map();constructor(parent,name,atlas){this.atlas=atlas;this.node=new Node();this.node.active=true;parent.addChild(this.node);}
  child(name){if(!this.children.has(name))this.children.set(name,new RetainedNode(this.node,name,this.atlas));return this.children.get(name);}
  retainMesh(){return false;}show(v){this.node.active=v;return this;}at(){return this;}order(){}rect(){return this;}ellipse(){return this;}path(){return this;}mesh(){return this;}
  image(name){images.push(name);return this;}picture(){return this;}
  text(text){const c=surface(375,812);c.fillText(text,0,0);return this;}
  nativeText(...args){return this.text(...args);}destroy(){}
}
const retainedBoundary={MatchNode:RetainedNode,MatchCollection:class{constructor(parent,name){this.parent=parent;this.name=name;}sync(values,draw){values.forEach((v,i)=>draw(this.parent.child(this.name+i),v,i));}},MatchAtlas:class{constructor(texture,assets){this.assets=assets;this.pictures=Object.fromEntries(Object.entries(assets.spr).map(([name,p])=>[name,{...p,frame:{rect:{x:0,y:0,width:p.w,height:p.h},texture:{width:4096,height:4096}}}]));}}};
// 设备边界桩只代替Cocos节点，不代替页面、排版、字体回退或最终写字逻辑。
function load(file) {
  file = path.resolve(root, file); if (!file.endsWith('.ts')) file += '.ts';
  if(file.endsWith('/MatchNodes.ts'))return retainedBoundary; if (cache.has(file)) return cache.get(file).exports;
  const mod = {exports: {}}; cache.set(file, mod);
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
  new Function('require', 'module', 'exports', js)(s => s === 'cc' ? cc : s === 'cc/env' ? {PREVIEW: true} : load(path.resolve(path.dirname(file), s)), mod, mod.exports);
  return mod.exports;
}
const {ATLAS} = load('cocos/assets/scripts/view/atlas-data');
const spr = Object.fromEntries(ATLAS.sheets.flatMap(s => Object.entries(s.frames).map(([name, r]) => [name, {name, w: r[2], h: r[3], frame: {}}])));
// 验证每个复用图标来自已导入PNG内的有效切片；不接受只有名字的假素材。
for (const name of ['ui_clock', 'ui_wok', 'ui_warning', 'ui_book', 'wok_flying', 'fx_impact', 'wok', 'ui_star', 'ui_star_empty']) {
  const sheet = ATLAS.sheets.find(s => s.frames[name]); assert.ok(sheet, name);
  const png = fs.readFileSync(path.join(root, 'cocos/assets/resources', sheet.file + '.png'));
  const [x, y, w, h] = sheet.frames[name]; assert.ok(x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= png.readUInt32BE(16) && y + h <= png.readUInt32BE(20), name);
}
const {DrawSurface} = load('cocos/assets/scripts/view/DrawSurface'), {ScreenPaint} = load('cocos/assets/scripts/view/ScreenPaint');
const geometry = new Proxy({}, {get: () => () => {}});
function surface(width = 375, height = 812) {
  const c = new DrawSurface(new Node(), {spr, title: {}, body400: {}, body700: {}, body900: {}, crop: p => p});
  c.width = width; c.height = height; c.cull = false; c.graphics = () => geometry;
  const draw = c.drawImage.bind(c); c.drawImage = (pic, ...args) => {images.push(pic.name); draw(pic, ...args);};
  return c;
}
const {Match} = load('cocos/assets/scripts/core/match'), {EVENTS, LEADER_TYPES} = load('cocos/assets/scripts/core/config');
const {MessageView} = load('cocos/assets/scripts/view/MessageView');
const {IntroView} = load('cocos/assets/scripts/view/IntroView'), {LobbyView} = load('cocos/assets/scripts/view/LobbyView');
const {ResultView} = load('cocos/assets/scripts/view/ResultView'), {ShareView} = load('cocos/assets/scripts/view/ShareView');
const {AppView} = load('cocos/assets/scripts/view/AppView'), {createWorldPainter} = load('cocos/assets/scripts/view/WorldPainter');
const {SpriteTools} = load('cocos/assets/scripts/view/SpriteTools');
// 扫描全部画面源码的字符串/模板片段，防止新页面再次写入固定emoji；正则与注释不是显示文案。
for (const file of fs.readdirSync(path.join(root, 'cocos/assets/scripts/view')).filter(n => n.endsWith('.ts'))) {
  const source = ts.createSourceFile(file, fs.readFileSync(path.join(root, 'cocos/assets/scripts/view', file), 'utf8'), ts.ScriptTarget.Latest, true);
  function inspect(node) {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) assert.doesNotMatch(node.text, forbidden, `${file}仍含固定图标字符`);
    ts.forEachChild(node, inspect);
  }
  inspect(source);
}
// 先用真实事件复现原问题；core原文必须始终保留奶茶。
assert.ok(EVENTS.tea.msg.endsWith('🧋'));
const c = surface(), p = new ScreenPaint(c), messages = new MessageView(p);
messages.event('showMsg', [EVENTS.tea.msg], 0); messages.draw(1, 70, false);
assert.equal(messages.message, EVENTS.tea.msg, '画面处理不能改写收到的原始消息');
assert.ok(labels.join('').includes('下午茶到了，茶水间自取'));
console.log('PASS core奶茶原文保留，真实群消息排版后的最终Label无emoji');

// 五关、三种屏幕、默认/含emoji称呼：大厅、介绍、玩法、结算、分享、世界、飘字。
for (const [width, height] of [[375, 812], [375, 667], [360, 780]]) for (const bossName of ['老板', '王总🧋']) for (let level = 0; level < 5; level++) {
  const progress = {unlocked: 5, bossName, best: Object.fromEntries([1, 2, 3, 4, 5].map(id => [id, {stars: id % 3 + 1, debt: 2.5}]))};
  const m = new Match({level, seed: 1001, progress}), s = surface(width, height), paint = new ScreenPaint(s);
  new LobbyView(paint).draw(level, progress, 1, {top: 0}, true);
  images.length = 0; new IntroView(paint).draw(m, progress);
  assert.ok(images.includes('ui_star'), '介绍页最好成绩和关卡标签应使用图集星星');
  const mask = new Node(); mask.addComponent(UITransform);
  const pane = {surface: s, p: paint, mask, root: new Node()};
  const host = {panes: [pane], surface: s, paint, heights: {}, scroll: 0, selected: level, real: 1, panelAt: 0, panel: 'rules', rulesBossName: bossName, actions: [], reduced: () => true};
  images.length = 0; AppView.prototype.modal.call(host, 'rules');
  assert.ok(images.includes('ui_clock') && images.includes('ui_wok'), '玩法列表使用现成图集');
  for (const reason of ['time', 'crushed']) {const r = m.calculateResult(reason); new ResultView(paint).draw(m, r, {x: 0, y: 0, w: 340, h: 600}); new ShareView(paint).draw(r.shareInfo, {x: 0, y: 0, w: 320, h: 600});}
  const {MatchUi} = load('cocos/assets/scripts/view/MatchUi'), ui = new MatchUi(s, m, () => ({top: 0}), () => false, () => {});
  ui.draw(1, {x: width - 68, y: height - 100}, true);
  ui.event({kind: 'closingNotice', args: [{hidden: false, warning: true, seconds: 3, title: '下班倒计时', detail: '冲进前三'}]}, 1);
  ui.draw(1, {x: width - 68, y: height - 100}, true);
  const layers = Array.from({length: 4}, () => surface(width, height));
  const painter = createWorldPainter(m, ...layers, {spr,matchTexture:{}, headCrop: () => ({sx: 0, size: 40})});
  m.S.player.sn.segs = [{label: '急件', hot: true, due: 3}]; m.S.tea = 5;
  m.S.bots[0].sn.x = 0; m.S.bots[0].sn.y = 0; m.S.bots[0].sn.segs = [{label: '急件', hot: true, due: 3}];
  const before = JSON.stringify(m.S), rng = m.E.rngState();
  images.length = 0; painter.event('floats', [`${bossName}：这个你来🧋`, 200, 300]); painter.draw(1);
  assert.ok(images.includes('ui_clock'), '到期倒计时应画像素闹钟');
  assert.ok(images.includes('wok'), '屏外急件持有者应画锅图');
  assert.equal(JSON.stringify(m.S), before); assert.equal(m.E.rngState(), rng, '渲染不能改玩法随机流');
  const view = new MessageView(paint); view.event('showHint', [{title: '教学', sub: bossName, text: '站好🧋'}], 0); view.draw(1, 70, false);
  view.event('toast', [`${bossName}来了🧋`, 1000], 0); view.drawToast(.5);
}
console.log('PASS 30组真实页面/世界渲染，图集闹钟/锅/规则/星级，状态与RNG不变');

// 过滤发生在字体回退判定之前；数字键帽保留数字，不吞中文/数字/职场标点。
for (const text of ['王总🧋🔥🤵👔', '⏰🕹️👀🧾☄️🛡️💥★☆▶', '👩🏽‍💻🇨🇳1️⃣', '18:00 总账 × ½ · 王总$&']) {c.font = '14px body-400'; c.fillText(text, 0, 0);}
assert.ok(labels.includes('18:00 总账 × ½ · 王总$&'));
const {guardLabelText} = load('cocos/assets/scripts/view/DrawSurface'), inputLabel = new Label();
guardLabelText(inputLabel); inputLabel.string = '王总🧋👩🏽‍💻🇨🇳1️⃣';
assert.equal(inputLabel.string, '王总1', 'EditBox内部写Label也须过滤，不能等文字事件之后再改');
const editHost = {root: new Node(), assets: c.assets, platform: {kind: 'wechat'}, positionEdit() {}, store: {read: () => ({bossName: '王总🧋'})},
  node(name, parent) {const n = new Node(); n.addComponent(UITransform); parent.addChild(n); return n;}};
AppView.prototype.loadingCard.call(editHost);
AppView.prototype.ensureEdit.call(editHost); assert.equal(editHost.edit.string, '王总🧋'); assert.equal(editHost.edit.textLabel.string, '王总');
editHost.cachedEdit = editHost.edit; editHost.edit = null; AppView.prototype.ensureEdit.call(editHost);
editHost.edit.string = '王总👩🏽‍💻'; assert.equal(editHost.edit.textLabel.string, '王总', '复用的输入Label仍须过滤');
const labelsBefore = labels.length; new SpriteTools({spr, headCrop: () => null}).edgeHint(c, c, -100, 200, {sprite: '不存在', whole: true}, '#E8504A');
assert.equal(labels.length, labelsBefore, '边缘提示缺图用像素警告图，不退回emoji字符');
assert.equal(LEADER_TYPES.boss.emoji, '🤵'); assert.equal(LEADER_TYPES.director.emoji, '👔');
console.log(`PASS 最终Label赋值扫描 ${labels.length} 次，无emoji区段/变体/字符星星/播放三角，core领导字段不变`);
// 读取实际TTF的cmap，不能只以字宽表已删除图标为字体裁剪成功的证据。
const fontCmaps = JSON.parse(execFileSync(path.join(root, 'cocos/.venv/bin/python'), ['-c',
  'from fontTools.ttLib import TTFont; import sys,json; print(json.dumps({p:"".join(chr(c) for c in TTFont(p).getBestCmap()) for p in sys.argv[1:]}))',
  ...['title', 'body-400', 'body-700', 'body-900'].map(name => path.join(root, 'cocos/assets/resources', name + '.ttf'))], {encoding: 'utf8'}));
for (const [file, text] of Object.entries(fontCmaps)) assert.doesNotMatch(text, forbidden, `${file}字体cmap仍含图标`);
console.log('PASS 四份实际TTF cmap图标字符0，全部画面源码字符串/模板片段无固定emoji');
