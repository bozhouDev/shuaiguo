// P4-1：只读现有7456，原型仅在内存注入观察入口；结束时关闭本任务浏览器。
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=path.join(root,'port/tmp/p4-1',process.env.P4_PHASE||'baseline');await fs.mkdir(out,{recursive:true});
const evidence={time:new Date().toISOString(),phase:process.env.P4_PHASE||'baseline',pairs:[],checks:[],errors:[]};
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
  await p.route('**/js/game.js',async r=>{let s=await fs.readFile(path.join(root,'js/game.js'),'utf8');s=s.replace('  /* ---------------- 启动 ---------------- */',`window.TEST={get S(){return S},get L(){return L},get mode(){return mode},get inp(){return inp},E,boot(i=0,t=false){E.seed(1001);L=LEVELS[i];auto=!t;forceTut=t;document.getElementById('lobby').hidden=true;{const pv=document.getElementById('sharePv');if(pv)pv.hidden=true;}startGame();window.__time=0;},step(n,dt=1/30){for(let i=0;i<n;i++){window.__time+=dt;__loop(dt,__time);}},draw(){draw(window.__time||0);updateHud();placeBanners();updateCoachHand();updateClosingNotice()},lobby(i=0){L=LEVELS[i];showLobby();},showIntro,pauseGame,resumeGame,showSettings,showBossNameEditor,showRules,finish,praise,checkPraiseRank,tutNext,showSharePreview,loadProgress,saveProgress};window.__sfxOriginal=E.sfx;E.sfx=(n,o)=>{__sounds[n]=(__sounds[n]||0)+1;__sfxOriginal(n,o)};\n  /* ---------------- 启动 ---------------- */`);s=s.replace('E.fillPxImages(); qLevel ? showIntro() : showLobby();','E.fillPxImages(); qLevel ? showIntro() : showLobby(); window.__prototypeReady=true;');await r.fulfill({body:s,contentType:'application/javascript'});});
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
try{
 const p=await open('prototype'),c=await open('cocos');
 evidence.checks.push({fresh:await ev(c,a=>({version:'P4-1',assets:Object.keys(a.assets.spr).length,screen:a.screen}))});
 await pair(p,c,'lobby-default');
 await p.locator('.lb-hero').click();await click(c,'cocos','hero');await pair(p,c,'lobby-hero','随机台词独立；姿势和气泡比较');
 for(const i of [0,4]){await p.evaluate(i=>TEST.lobby(i),i);await ev(c,(a,i)=>{a.selected=i;a.showLobby();},i);await pair(p,c,'lobby-level-'+(i+1));}
 await p.evaluate(()=>TEST.lobby(0));await ev(c,a=>{a.selected=0;a.showLobby();});await click(p,'prototype','rules');await click(c,'cocos','rules');await pair(p,c,'rules');
 for(let i=0;i<5;i++){await p.evaluate(i=>{TEST.lobby(i);TEST.showIntro();},i);await ev(c,async(a,i)=>{a.selected=i;await a.showIntro();},i);await pair(p,c,'intro-'+(i+1));}
 await boot(p,c);await p.evaluate(()=>TEST.pauseGame());await click(c,'cocos','pause');await pair(p,c,'pause');
 await p.evaluate(()=>TEST.resumeGame());await click(c,'cocos','resume');await p.evaluate(()=>TEST.showSettings());await click(c,'cocos','settings');await pair(p,c,'settings');
 for(const [type,stem,lv] of [['three','result-3star',0],['one','result-1star',0],['fail','result-failed',1],['crush','result-crushed',1],['three','result-friday-cert',4]]){await result(p,c,type,lv);await pair(p,c,stem);}
 await p.locator('#ui [data-act="share"]').click();await click(c,'cocos','share');await pair(p,c,'share');
 await result(p,c,'crush',1);await p.locator('#ui [data-act="revive"]').click();await click(c,'cocos','revive');await p.waitForTimeout(2200);await pair(p,c,'revived');evidence.checks.push({revived:await ev(c,a=>a.world.match.S.revived)});
 await result(p,c,'fail',1);await p.locator('#ui [data-act="rescue"]').click();await click(c,'cocos','rescue');await p.waitForTimeout(2200);await pair(p,c,'rescued');evidence.checks.push({rescued:await ev(c,a=>a.world.match.S.rescued)});
 await p.evaluate(()=>TEST.lobby(0));await ev(c,a=>{a.selected=0;a.showLobby();});await p.locator('.lb-subs [data-act]').first().click();await click(c,'cocos','boss-name');await pair(p,c,'boss-name');
 for(const kind of ['calm','parry','rankup']){await boot(p,c);await p.evaluate(k=>{TEST.S.t=25;TEST.praise(k);TEST.draw();},kind);await ev(c,(a,k)=>{a.world.match.S.t=25;return a.praise.show(k,a.world.match,a.real,[],false,false);},kind);await pair(p,c,'praise-'+kind);}
 for(const step of [1,3]){await boot(p,c,0,true);if(step===3){await p.evaluate(()=>{TEST.tutNext();TEST.tutNext();TEST.draw();});await ev(c,a=>{a.world.match.tutNext();a.world.match.tutNext();a.world.flush();a.render();});}await pair(p,c,'tutorial-'+step);}
 await p.close();await c.close();
 for(const [stem,size,query] of [['lobby-short',{width:375,height:667},''],['lobby-narrow',{width:360,height:780},''],['lobby-capsule',{width:375,height:812},'capsule=1']]){const p=await open('prototype',size),c=await open('cocos',size,query);await pair(p,c,stem,query?'Cocos假胶囊；原型无微信避让':'同尺寸');await p.close();await c.close();}
 // 加载卡取真实下载阶段，网络延迟仅作用本次页面。
 const lp=await open('prototype'),lc=await open('cocos',{width:375,height:812},'',true);await lc.waitForFunction(()=>window.cc?.director.getScene()?.getChildByName('Canvas')?.getChildByName('Boot')?.getComponent('Boot')?.app?.loading?.active);await lc.addStyleTag({content:'#__vconsole{display:none!important}'});await lp.evaluate(()=>E.showPanel('<h1>加载中…</h1><p class="sub">正在把锅摆好</p>'));await lp.screenshot({path:path.join(out,'loading-prototype.png')});await lc.screenshot({path:path.join(out,'loading-cocos.png')});evidence.pairs.push({stem:'loading',note:'原型同加载DOM内存重放；Cocos真实延迟资源下载'});await lp.close();await lc.close();
}catch(error){evidence.failure=error.stack;console.error(error);process.exitCode=1;}finally{await fs.writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));await browser.close();}
