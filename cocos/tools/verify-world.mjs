// P3-1浏览器验收：只使用既有7456；原型通过路由内存注入，不改冻结文件。
// PLAYWRIGHT_MODULE=/绝对路径/playwright/index.mjs node cocos/tools/verify-world.mjs [screens|play|perf|fonts|assets|before-ruling2|ruling2]
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=path.join(root,'port/tmp/p3-1'); await fs.mkdir(out,{recursive:true});
const preview='http://localhost:7456/?scene=3b08c73f-d17c-4dfc-a45e-854ddae97b2f';
const prototype='http://127.0.0.1:8765/';
const options={viewport:{width:375,height:812},deviceScaleFactor:1,isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36'};
const browser=await chromium.launch({headless:true});
const evidence={errors:[],warnings:[],comparisons:[],auto:[],singleImageRequests:[]};
// 从实际场景定位脚本，不往产品代码增加测试专用全局。
const world=()=>window.cc.director.getScene().getChildByName('Canvas').getChildByName('Boot').getComponent('Boot').world;
// 同步状态取最关键的玩法字段，额外保证左右截图不是不同时间/不同随机序列。
function snapshot(m) {const s=m.S;return {t:s.t,mode:m.mode,rng:m.E.rngState(),agents:s.agents.map(a=>({id:a.id,x:a.sn.x,y:a.sn.y,angle:a.sn.angle,pots:a.sn.segs.map(p=>({label:p.label,due:p.due,hot:p.hot,passAt:p.passAt??null,sender:p.nephewSender?.id??null})),blames:a.blames,crushed:!!a.crushed,aim:a.aimTgt?.id ?? null})),leaders:s.leaders.map(l=>({type:l.type,x:l.x,y:l.y,face:l.face,state:l.state,aimT:l.aimT,targets:l.targets.map(a=>a.id)})),flying:s.flying.map(f=>({x:f.x,y:f.y,t:f.t,phase:f.phase,label:f.label})),throws:s.throws.map(f=>({x:f.x,y:f.y,a:f.a,hot:f.hot})),pies:s.pies.map(p=>({x:p.x,y:p.y,expires:p.expires}))};}
// 统计独立浏览器rAF真实间隔，避免把min(.033,dt)当成真实帧时间。
function summary(values) {const a=[...values].sort((a,b)=>a-b),n=a.length,tail=a.slice(Math.floor(n*.99));return {frames:n,average:a.reduce((s,v)=>s+v,0)/n,p99:a[Math.min(n-1,Math.floor(n*.99))],worst1Percent:tail.reduce((s,v)=>s+v,0)/tail.length,max:a.at(-1)};}
async function page(kind,level=0,freeze=0,auto=true) {
 const p=await browser.newPage(options);p.setDefaultTimeout(90000);
 p.on('request',r=>{if(r.url().includes('/fallback/'))evidence.singleImageRequests.push({kind,level,url:r.url()});});
 p.on('pageerror',e=>evidence.errors.push({kind,level,error:e.message}));
 p.on('console',m=>{if(m.type()==='error')evidence.errors.push({kind,level,error:m.text()});if(m.type()==='warning')evidence.warnings.push({kind,level,error:m.text()});});
 if(kind==='prototype') {
  await p.route('**/js/engine.js',async r=>{let s=await fs.readFile(path.join(root,'js/engine.js'),'utf8');s=s.replace('  E.loop = function (fn) {','  E.loop = function (fn) { window.__loop = fn; return;');await r.fulfill({body:s,contentType:'application/javascript'});});
  await p.route('**/js/game.js',async r=>{let s=await fs.readFile(path.join(root,'js/game.js'),'utf8');s=s.replace('  /* ---------------- 启动 ---------------- */',`window.TEST={get S(){return S},get L(){return L},get mode(){return mode},get inp(){return inp},E,boot(i,seed,a){E.seed(seed);L=LEVELS[i];auto=a;simulating=false;S=null;S=makeState(false);mode='play';floats.list=[];shake=0;E.hidePanel();window.__time=0;draw(0);},step(n){for(let i=0;i<n;i++){window.__time+=1/60;__loop(1/60,__time);}},draw(){draw(window.__time);updateThrowBtn()},potsOf,seenBy,canFire,pickAim,holdsHot,incomingTTI,parryWin};\n  /* ---------------- 启动 ---------------- */`);s=s.replace('E.fillPxImages(); qLevel ? showIntro() : showLobby();','E.fillPxImages(); qLevel ? showIntro() : showLobby(); window.__prototypeReady=true;');await r.fulfill({body:s,contentType:'application/javascript'});});
  await p.goto(prototype);await p.waitForFunction(()=>window.__prototypeReady&&window.TEST&&window.E?.spr?.cashier_normal);
  await p.evaluate(async({level,auto})=>{await document.fonts.load('16px "ZCOOL KuaiLe"');await document.fonts.ready;for(const k of ['sfx','bgm','toast','showPanel','praise','checkPraiseOcclusion'])E[k]=()=>{};TEST.boot(level,1001,auto);},{level,auto});
  await p.addStyleTag({content:'#hud,#ui,#msg,#hint,#coachHand,#closingNotice,.praise-item,#lobby,#toast{display:none!important}'});
  if(freeze)await p.evaluate(n=>TEST.step(n),freeze);
 } else {
  await p.goto(`${preview}&level=${level}&seed=1001${auto?'&auto=1':''}${freeze===null?'':`&freeze=${freeze}`}`);
  await p.waitForFunction(()=>window.cc?.director.getScene()?.getChildByName('Canvas')?.getChildByName('Boot')?.getComponent('Boot')?.world?.ready);
  await p.evaluate(async()=>{const cc=await System.import('cc');cc.profiler.hideStats();await document.fonts.ready;});
  await p.addStyleTag({content:'#__vconsole{display:none!important}'});
 }
 return p;
}
// 同一夹具只在验收页面内构造，产品view仍然只读core。
function fixture(m,name) {
 const S=m.S,P=S.player,B=S.bots[0],boss=S.leaders[0],t=S.t;
 const move=(a,x,y)=>{a.sn.x=x;a.sn.y=y;a.sn.trail=[{x,y}];a.sn.angle=0;};
 move(P,470,700);move(B,550,700);P.sn.segs=[{label:'返工',due:t+7,hot:false}];P.cool=P.stun=0;P.aimTgt=null;
 for(const l of S.leaders){l.x=740;l.y=300;l.face=0;l.targets=[];l.state='patrol';}
 if(name.startsWith('aim-')) {
  if(name==='aim-green') {m.frameAim?.();m.pickAim?.(P);}
  if(name==='aim-gray')P.cool=.45;
  if(name==='aim-white')move(B,800,1000);
  if(name==='aim-red'){boss.x=380;boss.y=700;boss.face=0;}
 }
 if(name==='rage-inspect'){boss.x=540;boss.y=620;boss.face=2;boss.rageUntil=t+10;boss.inspectUntil=t+9;boss.state='chase';}
 if(name==='explosion-follow'){S.fx.push({name:'pot_explosion',x:0,y:0,dx:0,dy:-10,follow:P,size:92,t:.36,dur:1.1});}
 if(name==='meeting'){boss.x=500;boss.y=580;boss.meeting={t:0};boss.pieSay='明年公司上市，在座的都是元老。';boss.pieSayUntil=t+3;S.pies=[{x:440,y:780,expires:t+1,id:1}];}
 if(name==='nephew-wife'){const nephew=S.bots.find(a=>a.key==='nephew');move(nephew,520,650);nephew.sn.segs=[];const wife=S.leaders.find(l=>l.type==='wife');wife.x=570;wife.y=570;wife.face=Math.PI/2;wife.state='aim';wife.targets=[P];wife.aimT=.3;wife.pieSay='账做得这么干净？我查查';wife.pieSayUntil=t+2;}
 if(name==='sweat-flat-hot'){P.sn.segs=Array.from({length:8},(_,i)=>({label:i===0?'急件':'返工',hot:i===0,due:t+3+i}));B.crushed=true;B.sn.segs=Array.from({length:12},()=>({label:'返工',due:t+6}));B.crushedAt=t;S.flying=[{phase:'sky',x:P.sn.x,y:P.sn.y,t:.4,warn0:1,label:'盘点',a:0}];}
 if(name==='tea'){P.sn.x=200;P.sn.y=1300;S.tea=8;}
}
async function screens() {
 for(let level=0;level<5;level++) {
  const p=await page('prototype',level),c=await page('cocos',level);let last=0;
  const duration=level===0?70:120;
  for(const [label,n] of [['start',120],['middle',duration*30],['end',(duration-2)*60]]) {
   await p.evaluate(n=>TEST.step(n),n-last);await c.evaluate(({n,get})=>{const w=(0,eval)(`(${get})`)();for(let i=0;i<n;i++)w.tick(1/60);},{n:n-last,get:world.toString()});last=n;
   const left=await p.evaluate(src=>(0,eval)(`(${src})`)(TEST),snapshot.toString());
   const right=await c.evaluate(({get,snap})=>(0,eval)(`(${snap})`)((0,eval)(`(${get})`)().match),{get:world.toString(),snap:snapshot.toString()});
   assert.deepEqual(right,left,`level ${level} ${label}状态不同`);
   const stem=`level-${level}-${label}`;await p.screenshot({path:path.join(out,stem+'-prototype.png')});await c.screenshot({path:path.join(out,stem+'-cocos.png')});
   evidence.comparisons.push({stem,level,seed:1001,steps:n,t:left.t,mode:left.mode,stateEqual:true,type:'natural'});console.log('PASS screenshot',stem,left.t,left.mode);
  }
  // 连续跑到真实终局；结算UI不属于本卡，验证world/core mode=over。
  await c.evaluate(get=>{const w=(0,eval)(`(${get})`)();for(let i=0;i<1000&&w.match.mode!=='over';i++)w.tick(1/60);},world.toString());
  const end=await c.evaluate(get=>{const w=(0,eval)(`(${get})`)();return {level:w.match.L.id-1,t:w.match.S.t,mode:w.match.mode,reason:w.match.S.over,pools:w.surfaces.map(s=>s.stats()),result:w.match.calculateResult(w.match.S.over||'time').myRank};},world.toString());assert.equal(end.mode,'over');evidence.auto.push(end);await p.close();await c.close();
 }
 const names=['rage-inspect','explosion-follow','aim-green','aim-red','aim-white','aim-gray','meeting','nephew-wife','sweat-flat-hot','tea'];
 for(const name of names) {
  const p=await page('prototype',4),c=await page('cocos',4);
  await p.evaluate(({name,fx})=>{(0,eval)(`(${fx})`)(TEST,name);TEST.draw();},{name,fx:fixture.toString()});
  await c.evaluate(({name,fx,get})=>{const w=(0,eval)(`(${get})`)();(0,eval)(`(${fx})`)(w.match,name);if(!w.match.S.player.crushed&&w.match.potsOf(w.match.S.player))w.match.frameAim();w.render();},{name,fx:fixture.toString(),get:world.toString()});
  const stem=`special-${name}`;await p.screenshot({path:path.join(out,stem+'-prototype.png')});await c.screenshot({path:path.join(out,stem+'-cocos.png')});evidence.comparisons.push({stem,level:4,seed:1001,steps:0,type:'fixture',name});await p.close();await c.close();console.log('PASS fixture',name);
 }
}
// 裁定2只重验周一/周五整局及周五中段，保留上一轮全卡证据。
async function ruling2(before = false) {
 const c = await page('cocos',4,3600);
 const state = await c.evaluate(({get,snap}) => (0,eval)(`(${snap})`)((0,eval)(`(${get})`)().match), {get:world.toString(),snap:snapshot.toString()});
 const stem = before ? 'ruling2-before-level-4-middle' : 'ruling2-level-4-middle';
 await c.screenshot({path:path.join(out,stem+'-cocos.png')});
 await fs.writeFile(path.join(out,stem+'-state.json'),JSON.stringify(state,null,2));
 if(before) {await c.close();console.log('PASS before-ruling2 Friday middle baseline',state.t);return;}
 const baseline = JSON.parse(await fs.readFile(path.join(out,'ruling2-before-level-4-middle-state.json'),'utf8'));
 assert.deepEqual(state,baseline,'删单图前后周五中段玩法状态不同');
 const p=await page('prototype',4,3600);
 const original=await p.evaluate(src=>(0,eval)(`(${src})`)(TEST),snapshot.toString());
 assert.deepEqual(state,original,'周五中段与原型状态不同');
 await p.screenshot({path:path.join(out,stem+'-prototype.png')});
 evidence.comparisons.push({stem,level:4,seed:1001,steps:3600,t:state.t,stateEqual:true,beforeEqual:true});
 await p.close();await c.close();
 for(const level of [0,4]) {
  const live=await page('cocos',level,null);
  await live.waitForFunction(get=>(0,eval)(`(${get})`)().match.mode==='over',world.toString(),{timeout:180000});
  const end=await live.evaluate(get=>{const w=(0,eval)(`(${get})`)();return {level:w.match.L.id-1,t:w.match.S.t,mode:w.match.mode,reason:w.match.S.over,steps:w.steps,auto:w.match.auto};},world.toString());
  assert.equal(end.mode,'over');assert.equal(end.auto,true);assert.deepEqual(evidence.singleImageRequests,[]);
  evidence.auto.push(end);console.log('PASS live auto',JSON.stringify(end));await live.close();
 }
 console.log('PASS ruling2 Friday middle state equals baseline and prototype');
}
// 实际双指/键盘输入，随后继续同一局至终局；不直接写inp。
async function play() {
 const p=await page('cocos',0,0,false),cdp=await p.context().newCDPSession(p);
 const get=world.toString();const state=()=>p.evaluate(get=>{const w=(0,eval)(`(${get})`)();return {inp:{...w.match.inp},x:w.match.S.player.sn.x,y:w.match.S.player.sn.y,t:w.match.S.t,paused:w.paused,steps:w.steps,mode:w.match.mode};},get);
 const touch=async(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([id,x,y])=>({id,x,y,radiusX:1,radiusY:1,force:1}))});
 const before=await state();await touch('touchStart',[[1,145,650]]);const one=await state();assert.equal(one.inp.down,true);assert.equal(one.inp.mag,1);
 await touch('touchStart',[[1,145,650],[2,307,650]]);const two=await state();assert.equal(two.inp.down,true);assert.equal(two.inp.id,one.inp.id);assert.equal(two.inp.fire,1);
 await touch('touchEnd',[[2,307,650]]);assert.equal((await state()).inp.down,true);
 await p.evaluate(get=>{const w=(0,eval)(`(${get})`)();for(let i=0;i<60;i++)w.tick(1/60);},get);const moved=await state();assert.ok(Math.hypot(moved.x-before.x,moved.y-before.y)>20);
 await touch('touchEnd',[]);assert.equal((await state()).inp.down,false);
 await touch('touchStart',[[3,95,650]]);assert.ok((await state()).inp.mag<.35);await touch('touchEnd',[]);
 await p.keyboard.down('ArrowUp');assert.equal((await state()).inp.keys.arrowup,true);await p.keyboard.up('ArrowUp');await p.keyboard.down('w');assert.equal((await state()).inp.keys.w,true);await p.keyboard.up('w');
 await p.keyboard.down('Space');await p.keyboard.down('Space');assert.equal((await state()).inp.fire,1);await p.keyboard.up('Space');
 const beforeTyping=await state();await p.evaluate(()=>{const f=document.createElement('input');f.id='typing-proof';document.body.appendChild(f);f.focus();});await p.keyboard.type('w ');const duringTyping=await state();assert.equal(duringTyping.inp.fire,beforeTyping.inp.fire);assert.equal(duringTyping.inp.keys.w,beforeTyping.inp.keys.w);await p.evaluate(()=>{document.getElementById('typing-proof').remove();document.getElementById('GameCanvas').focus();});
 // P/Esc暂停，后台事件通过Cocos官方Game事件派发；不改玩法字段。
 await p.keyboard.press('p');assert.equal((await state()).paused,true);await p.keyboard.press('Escape');assert.equal((await state()).paused,false);
 const background=await p.evaluate(async get=>{const w=(0,eval)(`(${get})`)(),cc=await System.import('cc'),t=w.match.S.t;cc.game.emit(cc.Game.EVENT_HIDE);w.update(10);cc.game.emit(cc.Game.EVENT_SHOW);w.update(10);return {t,beforeResume:w.match.S.t,paused:w.paused,fire:w.match.inp.fire,down:w.match.inp.down};},get);assert.equal(background.t,background.beforeResume);assert.equal(background.paused,true);assert.equal(background.fire,0);
 await touch('touchStart',[[4,145,650]]);await touch('touchEnd',[]);assert.equal((await state()).paused,false);
 await p.setViewportSize({width:414,height:896});await p.waitForTimeout(250);const resized=await p.evaluate(get=>{const w=(0,eval)(`(${get})`)();return {visible:cc.view.getVisibleSize(),surfaces:w.surfaces.map(s=>({w:s.width,h:s.height})),root:w.root.position};},get);assert.ok(resized.surfaces.every(s=>Math.abs(s.h-resized.visible.height)<.01));await p.setViewportSize({width:375,height:812});await p.waitForTimeout(200);
 await p.evaluate(get=>{const w=(0,eval)(`(${get})`)();w.frozen=false;w.paused=false;},get);
 // 同一局，真实触摸每1秒重新定向、第二指按甩；可变dt由编辑器主循环推进。
 for(let i=0;i<100;i++){
  if((await state()).mode==='over')break;
  const a=i*.91,x=90+Math.cos(a)*52,y=649.6+Math.sin(a)*52;
  await touch('touchStart',[[10,x,y]]);await touch('touchStart',[[10,x,y],[11,307,650]]);await touch('touchEnd',[[11,307,650]]);await p.waitForTimeout(800);await touch('touchEnd',[]);
 }
 const end=await state();assert.equal(end.mode,'over');await p.screenshot({path:path.join(out,'manual-end.png')});evidence.manual={before,one,two,moved,background,resized,end};await p.close();console.log('PASS manual multitouch keyboard background resize full-match',end.t);
}
// 同一Chromium实例/上下文参数，rAF逐帧画完整周五；共同1/60负载消除可变dt导致的早死偏差，间隔统计仍是真实rAF。
async function perf() {
 for(const kind of ['prototype','cocos']) {
  const p=await page(kind,4,0,true);const get=world.toString();
  const profiler=await p.context().newCDPSession(p);await profiler.send('Profiler.enable');await profiler.send('Profiler.setSamplingInterval',{interval:1000});await profiler.send('Profiler.start');
  await p.evaluate(({kind,get})=>{
   window.__perf={intervals:[],work:[],longFrames:[]};let last=0;
   if(PerformanceObserver.supportedEntryTypes.includes('long-animation-frame'))new PerformanceObserver(list=>__perf.longFrames.push(...list.getEntries().map(e=>({duration:e.duration,scripts:e.scripts.map(s=>({source:s.sourceURL,duration:s.duration}))})))).observe({type:'long-animation-frame'});
   const w=kind==='cocos'?(0,eval)(`(${get})`)():null;if(w){w.frozen=true;w.freezeAt=null;w.timings.length=0;}
   const frame=now=>{if(last){const delta=now-last;__perf.intervals.push(delta);const start=performance.now();if(kind==='prototype'){__time+=1/60;__loop(1/60,__time);}else w.tick(1/60);__perf.work.push(performance.now()-start);}last=now;const mode=w?w.match.mode:TEST.mode;if(mode==='over')__perf.done=true;else requestAnimationFrame(frame);};requestAnimationFrame(frame);
  },{kind,get});
  await p.waitForFunction(()=>window.__perf.done,{},{timeout:240000});
  const {profile}=await profiler.send('Profiler.stop');await profiler.detach();
  await fs.writeFile(path.join(out,`profile-${kind}.json`),JSON.stringify(profile));
  const data=await p.evaluate(({kind,get})=>{const w=kind==='cocos'?(0,eval)(`(${get})`)():null;return {...__perf,t:w?w.match.S.t:TEST.S.t,mode:w?w.match.mode:TEST.mode,steps:w?.steps,timings:w?.timings,pools:w?.surfaces.map(s=>s.stats())};},{kind,get});
  assert.equal(data.mode,'over');assert.equal(data.t,120,'共同负载必须完整跑到18:00');
  const counts=new Map();for(const id of profile.samples||[])counts.set(id,(counts.get(id)||0)+1);
  data.hotFunctions=profile.nodes.map(n=>({function:n.callFrame.functionName,url:n.callFrame.url,line:n.callFrame.lineNumber+1,samples:counts.get(n.id)||0})).sort((a,b)=>b.samples-a.samples).slice(0,25);
  data.frames=summary(data.intervals);if(data.work.length)data.workSummary=summary(data.work);if(data.timings){data.updateSummary=summary(data.timings.map(x=>x.update));data.drawSummary=summary(data.timings.map(x=>x.draw));}
  await fs.writeFile(path.join(out,`performance-${kind}.json`),JSON.stringify(data,null,2));evidence[kind+'Performance']=data.frames;console.log('PASS performance',kind,JSON.stringify(data.frames));await p.close();
 }
}
// 缺帧/爆炸降级以及纯绘制不改玩法状态，均在临时浏览器里验证。
async function assets() {
 const p=await page('cocos',0,0);const get=world.toString();
 evidence.assets=await p.evaluate(async({get,snap})=>{const w=(0,eval)(`(${get})`)(),cc=await System.import('cc'),before=JSON.stringify((0,eval)(`(${snap})`)(w.match));
 for(const key of Object.keys(w.assets.spr))if(key.startsWith('player_walk_'))delete w.assets.spr[key];w.render();
 const sprites=()=>w.surfaces.flatMap(s=>s.root.getComponentsInChildren(cc.Sprite)).filter(s=>s.node.activeInHierarchy);
 const walkFallback=sprites().some(s=>s.spriteFrame===w.assets.spr.player_normal.frame);
 const after=JSON.stringify((0,eval)(`(${snap})`)(w.match));
 delete w.assets.spr['pot-cartoon-pow-bd83d9f0'];w.match.S.fx.push({name:'pot_explosion',x:w.match.S.player.sn.x,y:w.match.S.player.sn.y-20,size:92,t:.2,dur:1.1});w.render();
 const shadow=new w.assets.constructor(),pixels=shadow.pixels.bind(shadow),requests=[],reported=[],error=console.error;
 shadow.pixels=path=>{requests.push(path);return path.startsWith('atlas/')?Promise.reject(new Error('P3-1 fixture: missing atlas')):pixels(path);};
 // 仅收集本夹具预期的图集失败；其他console.error仍进入页面错误统计。
 console.error=(...args)=>{if(args[0]==='图集加载失败')reported.push(args[1]);else error.apply(console,args);};
 try {await shadow.load();} finally {console.error=error;}
 const atlasFailureReported=reported.length===14&&new Set(reported).size===14;
 const noSingleImageLoads=requests.length===15&&!requests.some(path=>path.startsWith('fallback/'))&&Object.keys(shadow.spr).length===1&&!shadow.spr.player_normal;
 shadow.destroy();
 return {walkFallback,renderReadOnly:before===after,explosionFallback:sprites().some(s=>s.spriteFrame===w.assets.spr.fx_impact.frame),atlasFailureReported,noSingleImageLoads};},{get,snap:snapshot.toString()});
 assert.deepEqual(evidence.assets,{walkFallback:true,renderReadOnly:true,explosionFallback:true,atlasFailureReported:true,noSingleImageLoads:true});await p.close();console.log('PASS missing atlas reports errors without single-image loads; walk / explosion fallback; render read-only');
}
// 对照旧8字子集、当前子集、冻结原型WOFF2的实际栅格字形，不凭字体资源名字判断。
async function fonts() {
 const p=await page('cocos',0,0);const get=world.toString();
 const old=await import('node:child_process').then(({execFileSync})=>execFileSync('git',['show','HEAD:cocos/assets/resources/title.ttf'],{cwd:root}).toString('base64'));
 const css=await fs.readFile(path.join(root,'css/fonts.css'),'utf8');
 const fontFile=css.match(/src: url\(([^)]+)\)/)[1];
 const reference=(await fs.readFile(path.resolve(root,'css',fontFile))).toString('base64');
 const result=await p.evaluate(async({old,get,reference})=>{
  const w=(0,eval)(`(${get})`)(),cc=await System.import('cc');
  const oldFace=new FontFace('P1Subset',Uint8Array.from(atob(old),c=>c.charCodeAt(0)));document.fonts.add(await oldFace.load());
  const ref=new FontFace('FrozenReference',Uint8Array.from(atob(reference),c=>c.charCodeAt(0)));document.fonts.add(await ref.load());
  const raster=(family,text)=>{const c=document.createElement('canvas');c.width=400;c.height=64;const x=c.getContext('2d');x.font=`32px ${family}`;x.textBaseline='middle';x.fillText(text,0,32);return c.toDataURL();};
  const sample='这锅你来背',extended='会议室 老板 急件';
  const result={originalTitleOldMatchesReference:raster('P1Subset',sample)===raster('FrozenReference',sample),originalTitleNewMatchesReference:raster('title_LABEL',sample)===raster('FrozenReference',sample),oldExtendedMatchesReference:raster('P1Subset',extended)===raster('FrozenReference',extended),newExtendedMatchesReference:raster('title_LABEL',extended)===raster('FrozenReference',extended),fontFaces:[...document.fonts].map(f=>({family:f.family,status:f.status})),samples:[]};
  for(const family of ['P1Subset','title_LABEL','FrozenReference','sans-serif'])result.samples.push({family,title:raster(family,sample),extended:raster(family,extended)});
  result.samplers=[...new Set(Object.values(w.assets.spr).map(p=>p.frame.texture))].map(t=>({name:t.name,min:t.getSamplerInfo().minFilter,mag:t.getSamplerInfo().magFilter,mip:t.getSamplerInfo().mipFilter}));
  const a=w.assets.crop(w.assets.spr.player_normal,0,0,24,24),b=w.assets.crop(w.assets.spr.intern_normal,0,0,24,24);
  result.cropIdentity={differentSources:a!==b,sameSourceReused:a===w.assets.crop(w.assets.spr.player_normal,0,0,24,24),sourceA:a.frame.rect,sourceB:b.frame.rect};
  result.nearest=result.samplers.every(s=>s.min===cc.Texture2D.Filter.NEAREST&&s.mag===cc.Texture2D.Filter.NEAREST&&s.mip===cc.Texture2D.Filter.NONE);
  return result;
 },{old,get,reference});
 assert.equal(result.originalTitleOldMatchesReference,true);assert.equal(result.originalTitleNewMatchesReference,true);assert.equal(result.oldExtendedMatchesReference,false);assert.equal(result.newExtendedMatchesReference,true);assert.equal(result.nearest,true);assert.equal(result.cropIdentity.differentSources,true);assert.equal(result.cropIdentity.sameSourceReused,true);
 const high=await browser.newPage({...options,deviceScaleFactor:3});await high.goto(preview+'&freeze=0');await high.waitForFunction(()=>window.cc?.director.getScene()?.getChildByName('Canvas')?.getChildByName('Boot')?.getComponent('Boot')?.world?.ready);
 result.highDpr=await high.evaluate(()=>({device:devicePixelRatio,effective:cc.view.getDevicePixelRatio(),canvasWidth:document.getElementById('GameCanvas').width,canvasHeight:document.getElementById('GameCanvas').height}));assert.equal(result.highDpr.device,3);assert.equal(result.highDpr.effective,2);assert.equal(result.highDpr.canvasWidth,750);await high.close();
 // 内存中模拟正式包PREVIEW=false分支；不是正式构建的替代证据。
 const release=await browser.newPage(options);let replaced=false;
 await release.route('**/scripting/x/chunks/**/*.js',async route=>{const response=await route.fetch();let source=await response.text();if(source.includes('var params = PREVIEW && platform.kind')){source=source.replace('var params = PREVIEW && platform.kind','var params = false && platform.kind');replaced=true;}await route.fulfill({response,body:source});});
 await release.goto(preview+'&level=4&seed=1001&auto=1&freeze=120');await release.waitForFunction(()=>window.cc?.director.getScene()?.getChildByName('Canvas')?.getChildByName('Boot')?.getComponent('Boot')?.world?.ready);
 result.releaseBranch=await release.evaluate(get=>{const w=(0,eval)(`(${get})`)();return {level:w.match.L.id-1,auto:w.match.auto,frozen:w.frozen};},get);assert.equal(replaced,true);assert.deepEqual(result.releaseBranch,{level:0,auto:false,frozen:false});await release.close();
 await fs.writeFile(path.join(out,'font-reference-proof.json'),JSON.stringify(result,null,2));await p.close();console.log('PASS fonts original/new title pixel-equal frozen reference, missing-title glyphs fixed; all nearest');
}
try {
 const mode=process.argv[2]||'screens';if(mode==='screens')await screens();else if(mode==='play')await play();else if(mode==='perf')await perf();else if(mode==='fonts')await fonts();else if(mode==='assets')await assets();else if(mode==='before-ruling2')await ruling2(true);else if(mode==='ruling2')await ruling2();else throw Error('未知模式 '+mode);
 assert.deepEqual(evidence.errors,[]);console.log('PASS',mode,'console errors 0');
} finally {await fs.writeFile(path.join(out,(process.argv[2]||'screens')+'-evidence.json'),JSON.stringify(evidence,null,2));await browser.close();}
