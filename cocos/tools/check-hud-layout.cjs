// 无编辑器的排版契约检查；不把几何检查冒充Cocos实际渲染验收。
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const ts = require('/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources/resources/3d/engine/node_modules/typescript');
const base = path.resolve(__dirname, '../assets/scripts'), cache = new Map();
// 只在内存转译UI/core；不写Cocos缓存或构建产物。
function load(file) {file = path.resolve(file); if (!file.endsWith('.ts')) file += '.ts'; if (cache.has(file)) return cache.get(file).exports; const mod = {exports: {}}; cache.set(file, mod); const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS}}).outputText; new Function('require','module','exports', source)(s => load(path.resolve(path.dirname(file), s)), mod, mod.exports); return mod.exports;}
const {Match} = load(base + '/core/match'), {UiPaint} = load(base + '/view/UiPaint'), {HudView} = load(base + '/view/HudView'), {MessageView} = load(base + '/view/MessageView'), {ATLAS} = load(base + '/view/atlas-data');
const spr = Object.fromEntries(ATLAS.sheets.flatMap(s => Object.entries(s.frames).map(([name,r]) => [name,{w:r[2],h:r[3]}])));
// 门面只收集几何与字符串；实际字体栅格和触摸必须另外跑Playwright。
const surface = {width:375,height:812,assets:{spr},save(){},restore(){},translate(){},scale(){},fillRect(){},drawImage(){},fillText(){},strokeText(){}};
const p = new UiPaint(surface), hud = new HudView(p), m = new Match({seed:1001,level:0,auto:true});
// 同位数切换不得改变HUD宽度：快乐体本身没有tnum，必须由画面层落实。
const clockAt = m.clockAt;
Object.defineProperty(m, 'clockAt', {value: () => '11:11', configurable:true}); hud.draw(m, 1, {top:0}); const clockWidth = hud.boxes.clock.w;
Object.defineProperty(m, 'clockAt', {value: () => '44:44', configurable:true}); hud.draw(m, 1, {top:0});
assert.equal(hud.boxes.clock.w, clockWidth, 'HUD数字等宽：11:11和44:44不得跳宽');
Object.defineProperty(m, 'clockAt', {value: clockAt, configurable:true}); hud.draw(m, 1, {top:0});
// 原型冻结矩形加明确的等宽数字增量；14px下取最宽4的0.718em，误差仅允许DOM取整。
const tabularDelta = {clock:4.116, pots:6.986, rank:4.956, blame:.728, settings:0, pause:0};
for (let [name,x,y,w,h] of [['clock',12,10,75.96875,26.09375],['pots',92.96875,10,119,26.09375],['rank',216.96875,10,91.734375,26.09375],['blame',12,41.09375,77.765625,26.09375],['settings',291,41.09375,34.09375,26.09375],['pause',331.09375,41.09375,31.90625,26.09375]]) {const b = hud.boxes[name]; w += tabularDelta[name]; x += name === 'pots' ? tabularDelta.clock : name === 'rank' ? tabularDelta.clock + tabularDelta.pots : 0; for (const [key,value] of Object.entries({x,y,w,h})) assert.ok(Math.abs(b[key]-value)<.06, `${name}.${key}: ${b[key]} != ${value}`);}
// CSS正常断行：时刻/数字不拆，逗号不能跑到下一行行首。
const wrapped = text => p.wrap([{text,color:'#fff'}], 70, 17, 'body-900').map(line=>line.map(r=>r.text).join(''));
assert.ok(wrapped('甲乙18:00前三').some(line=>line.includes('18:00')), '横幅不能拆开18:00');
assert.ok(wrapped('甲乙丙丁，戊').every(line=>!line.startsWith('，')), '中文逗号不得出现在行首');
const initialRng=m.E.rngState();
for(const width of [360,375,414,768]) {surface.width=width;const capsule={x:width-94,y:50,w:87,h:32};hud.draw(m,2,{top:44,capsule});for(const b of Object.values(hud.boxes)){assert.ok(b.x>=12&&b.x+b.w<=width-11.9);assert.ok(!(b.x<capsule.x+capsule.w&&b.x+b.w>capsule.x&&b.y<capsule.y+capsule.h&&b.y+b.h>capsule.y));}assert.ok(hud.bottom>=80);}
assert.equal(m.E.rngState(),initialRng,'只读绘制不得消费玩法RNG');surface.width=375;
const coach=new Match({seed:1001,level:0,tutorial:true});hud.draw(coach,1,{top:0});
assert.ok(Math.abs(hud.boxes.skip.w-(18+p.width('跳过教学',14,'title')))<.01,'窄屏跳过教学用14px，不能额外预留图标宽度');
assert.equal(hud.boxes.skip.y,hud.boxes.clock.y,'375px带教的跳过教学必须和时钟同一行');
surface.width=768;hud.draw(coach,1,{top:0});assert.ok(Math.abs(hud.boxes.skip.w-(22+p.width('跳过教学',13,'title')))<.01,'宽屏跳过教学用13px');surface.width=375;
const messages=new MessageView(p);messages.event('showHint',[{title:'教学',icon:['veteran_tea'],sub:'老周',text:'我是老周，今天带你。按住*左下摇杆*，走到*黄圈*。'}],0);messages.draw(1,67.1875,false);assert.equal(messages.hintBox.w,343);assert.equal(messages.hintBox.y,97.1875);
const toastLabels=[];surface.fillText=(text)=>toastLabels.push(text);
messages.event('toast',['真实提示',800],1);messages.drawToast(2.1);assert.equal(toastLabels.length,0,'toast淡出结束不再保留文字节点');assert.equal(messages.toastUntil,1.8);
console.log('PASS HUD等宽数字与6个矩形、4种屏宽胶囊避让、横幅宽度/位置、toast真实截止、只读RNG');
