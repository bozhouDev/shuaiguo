// P4-1：只读现有7456，原型仅在内存注入观察入口；结束时关闭本任务浏览器。
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=path.join(root,'port/tmp/p4-1',process.env.P4_PHASE||'sounds-supplemental');await fs.mkdir(out,{recursive:true});
const evidence={time:new Date().toISOString(),phase:process.env.P4_PHASE||'sounds-supplemental',pairs:[],checks:[],errors:[]};
const browser=await chromium.launch({headless:true});
const opts={viewport:{width:375,height:812},deviceScaleFactor:1,isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36'};
const app=()=>cc.director.getScene().getChildByName('Canvas').getChildByName('Boot').getComponent('Boot').app;
const ev=async(p,fn,arg)=>p.evaluate(({app,fn,arg})=>(0,eval)(`(${fn})`)((0,eval)(`(${app})`)(),arg),{app:app.toString(),fn:fn.toString(),arg});
async function open(kind,size={width:375,height:812},query='',slow=false){
 const p=await browser.newPage({...opts,viewport:size});p.setDefaultTimeout(60000);
 p.on('pageerror',e=>evidence.errors.push({kind,error:e.message}));p.on('console',m=>{if(m.type()==='error')evidence.errors.push({kind,error:m.text()});});
 await p.addInitScript(()=>{localStorage.clear();window.__sounds={};window.__vibrations=[];navigator.vibrate=n=>{__vibrations.push(n);return true;};});
 if(kind==='prototype'){
  await p.route('**/js/engine.js',async r=>{let s=await fs.readFile(path.join(root,'js/engine.js'),'utf8');s=s.replace('  E.loop = function (fn) {','  E.loop = function (fn) {window.__loop=fn;return;');await r.fulfill({body:s,contentType:'application/javascript'});});
  await p.route('**/js/game.js',async r=>{let s=await fs.readFile(path.join(root,'js/game.js'),'utf8');s=s.replace('  /* ---------------- 启动 ---------------- */',`window.TEST={get S(){return S},get L(){return L},get mode(){return mode},get inp(){return inp},E,boot(i=0,t=false){E.seed(1001);L=LEVELS[i];auto=!t;forceTut=t;document.getElementById('lobby').hidden=true;{const pv=document.getElementById('sharePv');if(pv)pv.hidden=true;}startGame();window.__time=0;},step(n,dt=1/30){for(let i=0;i<n;i++){window.__time+=dt;__loop(dt,__time);}},draw(){draw(window.__time||0);updateHud();placeBanners();updateCoachHand();updateClosingNotice()},lobby(i=0){L=LEVELS[i];showLobby();},showIntro,pauseGame,resumeGame,showSettings,showBossNameEditor,showRules,finish,praise,checkPraiseRank,tutNext,showSharePreview,potHit,loadProgress,saveProgress};window.__sfxOriginal=E.sfx;E.sfx=(n,o)=>{__sounds[n]=(__sounds[n]||0)+1;__sfxOriginal(n,o)};\n  /* ---------------- 启动 ---------------- */`);s=s.replace('E.fillPxImages(); qLevel ? showIntro() : showLobby();','E.fillPxImages(); qLevel ? showIntro() : showLobby(); window.__prototypeReady=true;');await r.fulfill({body:s,contentType:'application/javascript'});});
  await p.goto('http://127.0.0.1:8765/?'+query);if(!slow){await p.waitForFunction(()=>window.__prototypeReady);await p.evaluate(()=>document.fonts.ready);}
 }else{
  if(slow)await p.route('**/assets/**',async r=>{await new Promise(ok=>setTimeout(ok,1600));await r.continue();});
  await p.goto('http://localhost:7456/?scene=3b08c73f-d17c-4dfc-a45e-854ddae97b2f&seed=1001&auto=1&freeze=0&'+query);
  if(!slow){await p.waitForFunction(()=>window.cc?.director.getScene()?.getChildByName('Canvas')?.getChildByName('Boot')?.getComponent('Boot')?.app?.ready);await ev(p,a=>{a.frozen=true;cc.profiler.hideStats();});await p.addStyleTag({content:'#__vconsole{display:none!important}'});}
 }
 return p;
}
async function click(p,kind,name){if(kind==='prototype'){const map={'share-close':'close'};const selector=`[data-act="${map[name]||name}"]`;await p.locator(selector).filter({visible:true}).last().click();}else{await ev(p,a=>a.render());const a=await ev(p,(a,n)=>a.actions.find(x=>x.action===n)||a.world?.ui.hud.boxes[n],name);assert.ok(a,'缺少按钮 '+name);await p.touchscreen.tap(a.x+a.w/2,a.y+a.h/2);await p.waitForTimeout(80);await ev(p,a=>a.render());}}
async function pair(p,c,stem,note='同状态；左原型右Cocos'){
 await p.waitForTimeout(300);await ev(c,a=>{a.real+=.4;if(a.world){a.world.real+=.4;a.world.render();}a.render();});
 await p.screenshot({path:path.join(out,stem+'-prototype.png')});await c.screenshot({path:path.join(out,stem+'-cocos.png')});
 const right=await ev(c,a=>({screen:a.screen,panel:a.panel,selected:a.selected,actions:a.actions,labels:a.root.getComponentsInChildren(cc.Label).filter(l=>l.node.activeInHierarchy).map(l=>l.string),hud:a.world?.ui.hud.boxes}));
 const left=await p.evaluate(()=>({mode:TEST?.mode,text:[...document.querySelectorAll('#ui:not([hidden]),#sharePv:not([hidden]),#lobby:not([hidden])')].map(n=>n.innerText),rects:Object.fromEntries(['.lb-title','.lb-crew','.lb-days','.lb-menu','.lb-go','#ui .card','#sharePv .card','#hud','#skipTut'].map(sel=>{const r=document.querySelector(sel)?.getBoundingClientRect();return[sel,r?{x:r.x,y:r.y,w:r.width,h:r.height}:null]}))}));
 evidence.pairs.push({stem,note,left,right});await fs.writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));console.log('PAIR',stem);
}
async function boot(p,c,level=0,t=false){await p.evaluate(({level,t})=>{{const pv=document.getElementById('sharePv');if(pv)pv.hidden=true;}TEST.boot(level,t);TEST.draw();},{level,t});await ev(c,async(a,{level,t})=>{a.selected=level;if(t)a.params.delete('auto');else a.params.set('auto','1');await a.startGame(t);a.frozen=true;},{level,t});}
async function result(p,c,type,level=0){await boot(p,c,level);const fixture=(m,type)=>{const P=m.S.player;for(const [i,a] of m.S.agents.entries()){a.sn.segs=[];a.blames=i+1;a.crushed=false;}P.blames=type==='one'?3.5:type==='fail'?99:0;if(type==='crush'){P.crushed=true;P.sn.segs=Array.from({length:12},()=>({due:50,label:'周报'}));}if(type==='crush')P.crushed=false;m.finish(type==='crush'?'crushed':'time');};await p.evaluate(({f,type})=>{(0,eval)(`(${f})`)(TEST,type);TEST.draw();},{f:fixture.toString(),type});await ev(c,(a,{f,type})=>{(0,eval)(`(${f})`)(a.world.match,type);a.world.flush();a.render();},{f:fixture.toString(),type});}
try{const p=await open('prototype'),c=await open('cocos');await boot(p,c,0,true);await p.evaluate(()=>{window.__sounds={};});await ev(c,a=>{for(const n in a.audio.calls)delete a.audio.calls[n];});await p.locator('#btnSkip').click();await click(c,'cocos','skip');await p.evaluate(()=>TEST.potHit(TEST.S.player,{hot:true,label:'急件',src:'leader'}));await ev(c,a=>{a.world.match.potHit(a.world.match.S.player,{hot:true,label:'急件',src:'leader'});a.world.flush();});evidence.checks.push({scenario:'教学结束与急件命中',left:await p.evaluate(()=>__sounds),right:await ev(c,a=>a.audio.calls)});
 for(const [type,action] of [['crush','revive'],['fail','buff']]){await result(p,c,type,1);await p.evaluate(()=>{window.__sounds={};});await ev(c,a=>{for(const n in a.audio.calls)delete a.audio.calls[n];});await p.locator(`#ui [data-act="${action}"]`).click();await click(c,'cocos',action);await p.waitForTimeout(2300);evidence.checks.push({scenario:action,left:await p.evaluate(()=>__sounds),right:await ev(c,a=>a.audio.calls)});}
 console.log(JSON.stringify(evidence.checks));await p.close();await c.close();}catch(error){evidence.failure=error.stack;console.error(error);process.exitCode=1;}finally{await fs.writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));await browser.close();}
