// 仅连接已有7456；DPR=1、CDP CPU×6；finally关闭浏览器，不启动/构建Creator。
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const arg=(key,fallback)=>process.argv.find(s=>s.startsWith(`--${key}=`))?.slice(key.length+3)??fallback;
const phase=arg('phase','before'),seconds=Number(arg('seconds','10')),mode=arg('mode','bench'),variant=arg('variant','native');
const out=path.resolve(root,arg('out',`port/tmp/p7-3/${phase}`));await fs.mkdir(out,{recursive:true});
const base=arg('url','http://localhost:7456/'),url=new URL('?scene=3b08c73f-d17c-4dfc-a45e-854ddae97b2f&debug=1&seed=1001&auto=1',base).href;
// HTTP先核对刷新版本；旧P7-2绝不进入性能测量，也不做源码替换。
async function freshness(){
 const b=new URL('/scripting/x/',base),map=await (await fetch(new URL('import-map.json',b))).json(),sources={};
 for(const name of ['AppView','WorldAssets','DrawSurface','WorldView']){const key=Object.keys(map.imports).find(k=>k.endsWith(`/${name}.ts`));sources[name]=key?await(await fetch(new URL(map.imports[key],b))).text():'';}
 return {at:new Date().toISOString(),p72:sources.WorldAssets.includes('ribbon_red')&&sources.AppView.includes('step.buff'),p73:sources.AppView.includes('PerfProbe'),outline:sources.DrawSurface.includes('3.8.8的outlineColor'),idle:sources.AppView.includes('frameKey()'),warm:sources.AppView.includes('takeVisuals()'),fps:sources.AppView.includes('frameRate(60)'),geometry:sources.DrawSurface.includes('recordGeometry'),sources:Object.fromEntries(Object.entries(sources).map(([n,s])=>[n,{bytes:s.length,sha256:createHash('sha256').update(s).digest('hex')}]))};
}
const fresh=await freshness();await fs.appendFile(path.join(out,'freshness.ndjson'),JSON.stringify(fresh)+'\n');console.log('FRESHNESS',JSON.stringify(fresh));
if(mode==='freshness')process.exit(0);
assert.ok(fresh.p72,'7456仍是旧P7-2，先等泊舟刷新；本次未测量');
if(phase==='after'&&!process.argv.includes('--source-overlay'))for(const feature of ['outline','idle','warm','fps','geometry'])assert.equal(fresh[feature],true,`7456尚未导入${feature}，本次未测量`);
for(const feature of arg('expect','').split(',').filter(Boolean))assert.equal(fresh[feature],true,`7456尚未导入${feature}，本次未测量`);
assert.ok(['native','outline-guard'].includes(variant),'未知A/B变体');
if(variant==='outline-guard')assert.equal(fresh.outline,false,'单项A/B必须基于尚无该修复的原生基线');
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/tmp/shuaiguo-browser-check/node_modules/playwright/index.mjs');
const require=createRequire(import.meta.url),ts=require('/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources/resources/3d/engine/node_modules/typescript');
const sourceOverlay=process.argv.includes('--source-overlay');
// 额外A/B沿用项目既有做法：只在测试页面替换App，结果明确标注，不能冒充Creator原生预览。
async function sourceModules(dir,base=dir){const result={};for(const entry of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())Object.assign(result,await sourceModules(file,base));else if(entry.name.endsWith('.ts')&&entry.name!=='Boot.ts')result[path.relative(base,file).split(path.sep).join('/')]=ts.transpileModule(await fs.readFile(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;}return result;}
const modules=sourceOverlay?await sourceModules(path.resolve(root,arg('source-dir','cocos/assets/scripts'))):undefined;
// 基线也用同一份调试仪器；只注入观察hook，不替换App/World/绘图源码。
const probeSource=ts.transpileModule(await fs.readFile(path.join(root,'cocos/assets/scripts/view/PerfProbe.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
const report={phase,seconds,cpuThrottle:6,dpr:Number(arg('dpr','1')),renderDprOverride:arg('render-dpr',null),fresh,variant,sourceOverlay,sourceRoot:sourceOverlay?arg('source-dir','cocos/assets/scripts'):null,moduleHashes:modules?Object.fromEntries(Object.entries(modules).map(([n,s])=>[n,createHash('sha256').update(s).digest('hex')])):undefined,levels:[],screens:[],errors:[]};
report.browserPids=execFileSync('ps',['-axo','pid,ppid,comm'],{encoding:'utf8'}).trim().split('\n').slice(1).map(s=>s.trim().split(/\s+/)).filter(([pid,parent,...command])=>Number(parent)===process.pid&&/chrome|chromium/i.test(command.join(' '))).map(([pid])=>Number(pid));
const get=()=>cc.director.getScene().getChildByName('Canvas').getChildByName('Boot').getComponent('Boot').app;
const ev=(page,fn,data)=>page.evaluate(({get,fn,data})=>(0,eval)(`(${fn})`)((0,eval)(`(${get})`)(),data),{get:get.toString(),fn:fn.toString(),data});
// CDP样本按叶节点累计自耗时，明确排除(program)；保留原始profile供复核。
function top(profile){
 const nodes=new Map(profile.nodes.map(n=>[n.id,n])),totals=new Map(),functions=new Map();
 profile.samples?.forEach((id,i)=>totals.set(id,(totals.get(id)||0)+(profile.timeDeltas?.[i]||0)));
 for(const [id,us]of totals){const f=nodes.get(id).callFrame,key=[f.scriptId,f.functionName,f.lineNumber,f.columnNumber].join('|'),entry=functions.get(key)||{function:f.functionName||'(anonymous)',url:f.url,scriptId:f.scriptId,line:f.lineNumber+1,selfMs:0};entry.selfMs+=us/1000;functions.set(key,entry);}
 return [...functions.values()].filter(x=>!['(program)','(idle)','(garbage collector)'].includes(x.function)).sort((a,b)=>b.selfMs-a.selfMs).slice(0,20);
}
async function open(level,freeze){const page=await browser.newPage({viewport:{width:375,height:812},deviceScaleFactor:Number(arg('dpr','1')),isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36'});page.setDefaultTimeout(90000);
 if(arg('render-dpr',''))await page.route('**/scripting/engine/bin/.cache/dev/preview/bundled/index.js',async route=>{
  // 只在本测试页模拟微信的满DPR画布；不改引擎文件、服务器或工程缩放路径。
  const response=await route.fetch(),body=await response.text(),pattern=/Math\.min\(\(_window\$devicePixelRa = window\.devicePixelRatio\)[^;]+?, 2\)/g;
  const matches=body.match(pattern);assert.equal(matches?.length,1,'无法定位网页引擎DPR上限，禁止冒充DPR3实验');
  await route.fulfill({response,body:body.replace(pattern,m=>m.replace(/, 2\)$/,`, ${Number(arg('render-dpr','2'))})`))});
 });page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});await page.goto(url+`&level=${level}${freeze===undefined?'':`&freeze=${freeze}`}`,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>globalThis.cc?.director.getScene()?.getChildByName('Canvas')?.getChildByName('Boot')?.getComponent('Boot')?.app?.ready);await ev(page,a=>{a.frozen=true;cc.profiler.hideStats();});
 if(modules)await page.evaluate(async modules=>{
  const cc=await System.import('cc'),cache={};const load=id=>{if(cache[id])return cache[id].exports;const mod={exports:{}};cache[id]=mod;const localRequire=s=>{if(s==='cc')return cc;if(s==='cc/env')return {PREVIEW:true};const parts=id.split('/');parts.pop();for(const part of s.split('/')){if(part==='..')parts.pop();else if(part!=='.')parts.push(part);}let target=parts.join('/');if(!target.endsWith('.ts'))target+='.ts';return load(target);};new Function('require','module','exports',modules[id])(localRequire,mod,mod.exports);return mod.exports;};
  const boot=cc.director.getScene().getChildByName('Canvas').getChildByName('Boot').getComponent('Boot'),old=boot.app;boot.app=undefined;old.destroy();await new Promise(requestAnimationFrame);const {AppView}=load('view/AppView.ts');boot.app=new AppView(boot.node);await boot.app.start();boot.app.frozen=true;
 },modules);
 return page;}
try{
 if(mode==='checkpoints'){
  // 固定步只用于独立测试页面；每次先逐帧回放到请求点，再按真实rAF采集同样数量的玩法帧。
  // 不延长关卡、不复活、不改数值；超过下班的请求点明确记录终态，不能冒充后期对局。
  report.checkpoints=[];
  const checkpoints=arg('checkpoints','10,60,100,150,170').split(',').map(Number),levels=arg('levels','1,5').split(',').map(Number);
  for(const level of levels)for(const requested of checkpoints){
   const page=await open(level),cdp=await page.context().newCDPSession(page);
   await ev(page,async(a,requested)=>{a.audio.bgm(false);Math.random=()=>.5;await a.startGame();a.frozen=true;for(let i=0;i<Math.round(requested*60);i++){a.tick(1/60);if(a.world.match.mode==='over'){a.real=Math.max(a.real,requested);a.render();break;}}},requested);
   const state=await ev(page,a=>({id:a.world.match.L.id,agents:a.world.match.S.agents.length,leaders:a.world.match.S.leaders.length,auto:a.world.match.auto,screen:a.screen,mode:a.world.match.mode,t:a.world.match.S.t,steps:a.world.steps,rng:a.world.match.E.rngState(),pots:a.world.match.S.agents.reduce((n,p)=>n+p.sn.segs.length,0),flying:a.world.match.S.flying.length,throws:a.world.match.S.throws.length,fx:a.world.match.S.fx.length,floats:a.world.match.S.floats?.length??null,canvas:{width:document.querySelector('#GameCanvas').width,height:document.querySelector('#GameCanvas').height},visible:cc.view.getVisibleSize(),dpr:cc.view.getDevicePixelRatio(),renderer:cc.director.root.device.renderer}));
   assert.equal(state.id,level);assert.equal(state.agents,level===5?8:level===3?7:4);assert.equal(state.leaders,level===5?3:level===3?2:1);assert.equal(state.auto,true);
   await page.addStyleTag({content:'#__vconsole{display:none!important}'});await page.waitForTimeout(200);
   await page.locator('#GameCanvas').screenshot({path:path.join(out,`level-${level}-at-${requested}.png`),scale:'device'});
   if(state.mode!=='play'){const entry={level,requested,state,summary:null,notAssessed:'请求点已自然结算，不作为对局性能样本'};report.checkpoints.push(entry);console.log('CHECKPOINT',JSON.stringify(entry));await cdp.detach();await page.close();continue;}
   await ev(page,(a,source)=>{const exports={};new Function('require','exports',source)(()=>cc,exports);a.__perf=new exports.PerfProbe(a,a.world.constructor.prototype,false);},probeSource);
   await cdp.send('Emulation.setCPUThrottlingRate',{rate:6});await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:1000});await cdp.send('Profiler.start');
   const sampleFrames=Number(arg('frames',String(Math.round(seconds*60))));
   const sampleWindow=await ev(page,async(a,count)=>{a.frameRate(60);a.__perf.reset();let completed=0;for(let i=0;i<count;i++){if(a.world.match.mode!=='play')break;a.tick(1/60);if(a.world.match.mode!=='play')break;await new Promise(requestAnimationFrame);completed++;}return {requestedFrames:count,completedFrames:completed,truncated:completed<count};},sampleFrames);
   const measurements=await ev(page,a=>({summary:a.__perf.summary(1e9),frames:a.__perf.frames,mode:a.world.match.mode,t:a.world.match.S.t,steps:a.world.steps,rng:a.world.match.E.rngState(),pools:a.world.surfaces.map(s=>s.stats())}));
   if(sampleWindow.truncated)measurements.summary=null;
   const {profile}=await cdp.send('Profiler.stop');await fs.writeFile(path.join(out,`level-${level}-at-${requested}.cpuprofile`),JSON.stringify(profile));
   const categories=await ev(page,a=>{
    // 定格后单独追踪一次画笔调用，不计入计时窗口；只统计请求数，不冒充GPU批次。
    const proto=a.world.surfaces[0].constructor.prototype,originals={},counts={};
    for(const method of ['drawImage','fillText','fill','stroke']){originals[method]=proto[method];proto[method]=function(...args){const stack=new Error().stack||'',name=['drawFloats','edgeHint','drawStatusFx','drawDueTag','drawPotBadge','drawShadow','drawHotPot','drawFlyingWok','drawWok','drawAims','drawTail','drawLeader','drawHead'].find(n=>stack.includes('at '+n+' ')||stack.includes('.'+n+' ('))||'other';const key=name+':'+method;counts[key]=(counts[key]||0)+1;return originals[method].apply(this,args);};}
    try{a.world.render();}finally{for(const method in originals)proto[method]=originals[method];}return counts;
   });
   let touchCheck;
   if(process.argv.includes('--touch-check')&&measurements.mode==='play'){
    const button=await ev(page,a=>a.world.ui.hud.actions.find(b=>b.action==='pause')),box=await page.locator('#GameCanvas').boundingBox(),size=await ev(page,a=>({width:a.surface.width,height:a.surface.height}));assert.ok(button);
    await page.touchscreen.tap(box.x+(button.x+button.w/2)*box.width/size.width,box.y+(button.y+button.h/2)*box.height/size.height);assert.equal(await ev(page,a=>a.panel),'pause','DPR实验暂停触点错位');
    await ev(page,a=>a.render());const resume=await ev(page,a=>a.actions.find(b=>b.action==='resume'));assert.ok(resume);await page.touchscreen.tap(box.x+(resume.x+resume.w/2)*box.width/size.width,box.y+(resume.y+resume.h/2)*box.height/size.height);assert.equal(await ev(page,a=>a.panel),'','DPR实验继续触点错位');
    touchCheck=await ev(page,async a=>{let resizes=0;const listener=()=>resizes++,read=()=>({canvas:[document.querySelector('#GameCanvas').width,document.querySelector('#GameCanvas').height],visible:cc.view.getVisibleSize(),dpr:cc.view.getDevicePixelRatio()});cc.view.on('canvas-resize',listener);try{const before=read();a.frameRate(15);await new Promise(r=>setTimeout(r,150));const idle=read();a.frameRate(60);await new Promise(r=>setTimeout(r,150));return {pauseAndResume:true,before,idle,after:read(),resizes};}finally{cc.view.off('canvas-resize',listener);}});
    assert.deepEqual(touchCheck.before,touchCheck.idle);assert.deepEqual(touchCheck.before,touchCheck.after);assert.equal(touchCheck.resizes,0);
   }
   const entry={level,requested,state,...measurements,sampleWindow,categories,touchCheck,top20:top(profile)};report.checkpoints.push(entry);console.log('CHECKPOINT',JSON.stringify({level,requested,state,summary:measurements.summary}));
   await ev(page,a=>a.__perf.destroy());await cdp.detach();await page.close();
  }
 }else if(mode==='idle-rate'){
  const page=await open(5,120),cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:6});
  await ev(page,async(a,source)=>{await a.startGame();a.action('pause');a.frozen=true;a.world.render();a.world.render();const exports={};new Function('require','exports',source)(()=>cc,exports);a.__perf=new exports.PerfProbe(a,a.world.constructor.prototype,false);},probeSource);report.idleRateAB=[];
  // 相同节点、相同定格画面，仅切换引擎提交频率，不让auto轨迹差异混进节电收益。
  for(const fps of [60,15]){await ev(page,(a,fps)=>{a.frameRate(fps);},fps);await page.waitForTimeout(300);await ev(page,a=>a.__perf.reset());await page.waitForTimeout(2000);report.idleRateAB.push({fps,...await ev(page,async a=>({actualRate:(await System.import('cc')).game.frameRate,globalRate:cc.game.frameRate,appFrozen:a.frozen,...a.__perf.summary(1e9)}))});}
  await ev(page,a=>{a.__perf.destroy();cc.game.frameRate=60;});await cdp.detach();await page.close();console.log('IDLE RATE A/B',JSON.stringify(report.idleRateAB));
 }else if(mode==='startup'){
  assert.ok(sourceOverlay,'冷/热节点池因果实验仅用于本轮源码页面');report.startupAB=[];
  for(const level of [1,5]){const page=await open(level),cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:6});await ev(page,(a,source)=>{const exports={};new Function('require','exports',source)(()=>cc,exports);a.__perf=new exports.PerfProbe(a,a.world.constructor.prototype,false);},probeSource);
   for(const warm of [false,true])for(let run=0;run<5;run++){
    await ev(page,async(a,warm)=>{a.frozen=true;await a.showIntro();if(!warm)a.world.ready=false;},warm);
    const button=await ev(page,a=>a.actions.find(b=>b.action==='start')),canvas=await page.locator('#GameCanvas').boundingBox(),size=await ev(page,a=>({w:a.surface.width,h:a.surface.height}));assert.ok(button);
    await page.touchscreen.tap(canvas.x+(button.x+button.w/2)*canvas.width/size.w,canvas.y+(button.y+button.h/2)*canvas.height/size.h);await page.waitForTimeout(150);
    const entry=await ev(page,a=>({id:a.world.match.L.id,agents:a.world.match.S.agents.length,leaders:a.world.match.S.leaders.length,...a.__perf.starts.at(-1)}));assert.equal(entry.id,level);assert.ok(entry.firstSubmitted>=0);report.startupAB.push({level,warm,run,...entry});console.log('STARTUP',JSON.stringify({level,warm,run,...entry}));
   }
   await ev(page,a=>a.__perf.destroy());await cdp.detach();await page.close();
  }
 }else if(mode==='flow'){
  const page=await open(5,0);await page.addStyleTag({content:'#__vconsole{display:none!important}'});report.flow=[];
  await ev(page,a=>{a.showLobby();a.setPerformance(true);});await page.waitForTimeout(300);report.flow.push('lobby');
  await ev(page,async a=>{await a.showIntro();});report.flow.push('intro');
  await ev(page,async a=>{await a.startGame();});assert.equal(await ev(page,a=>a.world.match.L.id),5);report.flow.push('play');
  await page.waitForTimeout(500);await page.locator('#GameCanvas').screenshot({path:path.join(out,'performance-overlay-level5.png')});
  await ev(page,a=>{a.action('pause');a.frozen=false;a.world.frozen=false;});assert.equal(await ev(page,a=>a.panel),'pause');await page.waitForTimeout(800);assert.equal(await ev(page,()=>cc.game.frameRate),15);report.flow.push('pause-15fps');
  await ev(page,a=>{a.action('resume');if(cc.game.frameRate!==60)throw Error('继续游戏没有立即唤回60帧');for(let i=0;i<6000&&a.world.match.mode!=='over';i++)a.tick(1/30);});assert.equal(await ev(page,a=>a.panel),'result');report.flow.push('natural-result');
  await ev(page,a=>{a.action('menu');});assert.equal(await ev(page,a=>a.screen),'lobby');report.flow.push('return-lobby');
  await ev(page,a=>{a.setPerformance(false);});await page.waitForTimeout(100);assert.equal(await ev(page,a=>a.parent.getChildByName('DebugPerformance')!==null),false);await page.close();
 }else if(mode==='screens'){
  for(const level of [1,3,5]){const page=await open(level,120);await ev(page,async(a,level)=>{if(a.selected!==level-1)throw Error('选关失败');a.real=0;const random=Math.random;Math.random=()=>.5;try{await a.startGame();a.frozen=true;a.real=2;a.world.real=2;a.world.render();a.render();}finally{Math.random=random;}},level);await page.addStyleTag({content:'#__vconsole{display:none!important}'});await page.waitForTimeout(300);const state=await ev(page,a=>({id:a.world.match.L.id,agents:a.world.match.S.agents.length,leaders:a.world.match.S.leaders.length,steps:a.world.steps,t:a.world.match.S.t,rng:a.world.match.E.rngState(),screen:a.screen,canvas:{width:document.querySelector('#GameCanvas').width,height:document.querySelector('#GameCanvas').height}}));assert.equal(state.id,level);assert.equal(state.steps,120);const canvas=page.locator('#GameCanvas');await canvas.screenshot({path:path.join(out,`level-${level}-freeze-120.png`)});report.screens.push(state);console.log('SCREEN',JSON.stringify(state));await page.close();}
 }else{
  for(const level of [1,5]){
   const page=await open(level),cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:6});
   // 单变量因果实验仅存在本页面：模拟源码同值描边保护；必须单独标记，不能充当新预览验收。
   if(variant==='outline-guard')await page.evaluate(()=>{const property=Object.getOwnPropertyDescriptor(cc.Label.prototype,'outlineColor');Object.defineProperty(cc.Label.prototype,'outlineColor',{...property,set(value){if(!property.get.call(this).equals(value))property.set.call(this,value);}});});
   await ev(page,(a,source)=>{a.audio.bgm(false);const exports={};new Function('require','exports',source)(()=>cc,exports);a.__perf=new exports.PerfProbe(a,a.world.constructor.prototype,false);},probeSource);
   const intro=await ev(page,a=>({id:a.world.match.L.id,agents:a.world.match.S.agents.length,leaders:a.world.match.S.leaders.length}));assert.equal(intro.id,level);
   // 通过实际按钮命中触发；不是无参数startGame误入默认关。
   const button=await ev(page,a=>a.actions.find(b=>b.action==='start'));assert.ok(button,'缺少开始上班按钮');const canvas=await page.locator('#GameCanvas').boundingBox(),size=await ev(page,a=>({width:a.surface.width,height:a.surface.height}));await page.touchscreen.tap(canvas.x+(button.x+button.w/2)*canvas.width/size.width,canvas.y+(button.y+button.h/2)*canvas.height/size.height);await page.waitForFunction(()=>cc.director.getScene().getChildByName('Canvas').getChildByName('Boot').getComponent('Boot').app.screen==='play');await page.waitForTimeout(200);
   const start=await ev(page,a=>({id:a.world.match.L.id,agents:a.world.match.S.agents.length,leaders:a.world.match.S.leaders.length,auto:a.world.match.auto,startup:a.__perf.starts.at(-1),screen:a.screen,renderer:cc.director.root.device.renderer,vendor:cc.director.root.device.vendor,frameRate:cc.game.frameRate,dpr:cc.view.getDevicePixelRatio()}));assert.equal(start.screen,'play');assert.ok(start.startup?.firstSubmitted>=0,'没有首帧提交记录');assert.equal(start.id,level);assert.equal(start.agents,level===5?8:4);assert.equal(start.leaders,level===5?3:1);assert.equal(start.auto,true);console.log('ENTERED',JSON.stringify(start));
   // Profiler启停本身可能阻塞超过1秒：在冻结状态先启动，统计在停止之前原子读回。
   await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:1000});await cdp.send('Profiler.start');await ev(page,a=>{a.frozen=false;a.__perf.reset();});await page.waitForTimeout(seconds*1000);
   const measurements=await ev(page,a=>{a.frozen=true;return {summary:a.__perf.summary(1e9),last2Seconds:a.__perf.summary(),frames:a.__perf.frames,mode:a.world.match.mode,t:a.world.match.S.t,steps:a.world.steps,pools:a.world.surfaces.map(s=>s.stats())};});const {profile}=await cdp.send('Profiler.stop');
   await fs.writeFile(path.join(out,`level-${level}.cpuprofile`),JSON.stringify(profile));const result={level,intro,start,...measurements,top20:top(profile)};report.levels.push(result);console.log('METRICS',level,JSON.stringify(measurements.summary));console.table(result.top20);
   // 暂停/介绍/大厅每种静止状态各2秒，读真实重画次数与脚本耗时。
   result.idle={};for(const screen of ['pause','intro','lobby']){await ev(page,async(a,screen)=>{a.frozen=false;if(screen==='pause')a.action('pause');if(screen==='intro')await a.showIntro();if(screen==='lobby')a.showLobby();a.__perf.reset();},screen);await page.waitForTimeout(2000);result.idle[screen]=await ev(page,a=>({...a.__perf.summary(1e9),targetFrameRate:cc.game.frameRate}));}
   await ev(page,a=>{a.__perf.destroy();delete a.__perf;});await cdp.detach();await page.close();
  }
 }
 assert.deepEqual(report.errors,[]);
}catch(error){report.failure=error.stack;throw error;}finally{await browser.close();report.browserClosed=true;report.browserProcessesGone=report.browserPids.every(pid=>{try{process.kill(pid,0);return false;}catch{return true;}});await fs.writeFile(path.join(out,'evidence.json'),JSON.stringify(report,null,2));}
