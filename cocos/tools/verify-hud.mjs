// P3-2浏览器验收：复用现有编辑器预览，原型只做内存路由注入。finally清理所有页面。
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'), out=path.join(root,'port/tmp/p3-2'); await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const options={viewport:{width:375,height:812},deviceScaleFactor:1,isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36'};
const evidence={recordedAt:new Date().toISOString(),errors:[],pairs:[],checks:[]};
const get=()=>window.cc.director.getScene().getChildByName('Canvas').getChildByName('Boot').getComponent('Boot').world;
async function open(kind,level=0,extra='',width=375,tutorial=false){
 const p=await browser.newPage({...options,viewport:{width,height:width===360?780:812}});p.setDefaultTimeout(60000);
 p.on('pageerror',e=>evidence.errors.push({kind,error:e.message}));p.on('console',m=>{if(m.type()==='error')evidence.errors.push({kind,error:m.text()});});
 if(kind==='prototype'){
  await p.route('**/js/engine.js',async r=>{let s=await fs.readFile(path.join(root,'js/engine.js'),'utf8');s=s.replace('  E.loop = function (fn) {','  E.loop = function (fn) {window.__loop=fn;return;');await r.fulfill({body:s,contentType:'application/javascript'});});
  await p.route('**/js/game.js',async r=>{let s=await fs.readFile(path.join(root,'js/game.js'),'utf8');s=s.replace('  /* ---------------- 启动 ---------------- */',`window.TEST={get S(){return S},get L(){return L},get mode(){return mode},get inp(){return inp},E,boot(i,seed,a,t,buff){E.seed(seed);L=LEVELS[i];auto=a;simulating=false;S=null;S=makeState(t,buff);mode='play';floats.list=[];shake=0;E.hidePanel();document.getElementById('lobby').hidden=true;document.getElementById('hud').hidden=false;clearBanners();window.__time=0;if(t)tutNext();updateHud();draw(0);updateCoachHand();},step(n){for(let i=0;i<n;i++){window.__time+=1/60;__loop(1/60,__time);}},draw(){draw(window.__time);updateHud();placeBanners();updateCoachHand();updateClosingNotice()},showHint,showMsg,startWork,updateHud,placeBanners,updateCoachHand,updateClosingNotice,ranking,carryOf,potsOf,seenBy,canFire,pickAim,workT,passRank,fmtDebt,fireThrow,tutNext};\n  /* ---------------- 启动 ---------------- */`);s=s.replace('E.fillPxImages(); qLevel ? showIntro() : showLobby();','E.fillPxImages(); qLevel ? showIntro() : showLobby(); window.__prototypeReady=true;');await r.fulfill({body:s,contentType:'application/javascript'});});
  await p.goto('http://127.0.0.1:8765/');await p.waitForFunction(()=>window.__prototypeReady);
  await p.evaluate(async({level,tutorial,extra})=>{await document.fonts.ready;E.sfx=E.bgm=E.praise=()=>{};TEST.boot(level,1001,!tutorial,tutorial,new URLSearchParams(extra).get('buff'));},{level,tutorial,extra});
 }else{
  if(extra.includes('saved'))await p.addInitScript(()=>localStorage.setItem('shuaiguo_v3',JSON.stringify({unlocked:1,best:{},tutDone:true})));
  await p.goto(`http://localhost:7456/?scene=3b08c73f-d17c-4dfc-a45e-854ddae97b2f&level=${level+1}&seed=1001&freeze=0${tutorial?(extra.startsWith('entry')?'':'&tut=1'):'&auto=1'}&${extra}`);
  await p.waitForFunction(()=>window.cc?.director.getScene()?.getChildByName('Canvas')?.getChildByName('Boot')?.getComponent('Boot')?.app?.ready);
  await p.evaluate(async()=>{const a=cc.director.getScene().getChildByName('Canvas').getChildByName('Boot').getComponent('Boot').app;await a.startGame();a.frozen=true;});
  await p.waitForFunction(()=>window.cc?.director.getScene()?.getChildByName('Canvas')?.getChildByName('Boot')?.getComponent('Boot')?.world?.ready);
  await p.evaluate(async()=>{const cc=await System.import('cc');cc.profiler.hideStats();await document.fonts.ready;});await p.addStyleTag({content:'#__vconsole{display:none!important}'});
  const fresh=await p.evaluate(get=>{const w=(0,eval)(`(${get})`)();return{clock:w.ui.hud.boxes.clock.w,skip:w.ui.hud.boxes.skip?.w,expectedSkip:18+w.ui.p.width('跳过教学',14,'title'),lines:w.ui.p.wrap([{text:'甲乙18:00前三',color:'#fff'}],70,17,'body-900').map(l=>l.map(r=>r.text).join(''))};},get.toString());
  assert.ok(Math.abs(fresh.clock-80.09458333333333)<.01,'7456尚未编译本轮等宽HUD，请刷新现有编辑器资源');
  assert.ok(fresh.lines.some(l=>l.includes('18:00')),'7456尚未编译本轮横幅断行');
  if(fresh.skip)assert.ok(Math.abs(fresh.skip-fresh.expectedSkip)<.01,'7456尚未编译修正后的跳过教学按钮');
 }
 return p;
}
async function run(p,kind,n){await p.evaluate(({kind,n,get})=>{if(kind==='prototype')TEST.step(n);else{const w=(0,eval)(`(${get})`)();for(let i=0;i<n;i++)w.tick(1/60);}},{kind,n,get:get.toString()});}
async function measure(p,kind){return p.evaluate(({kind,get})=>{if(kind==='prototype'){const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}};return{t:TEST.S.t,work:TEST.workT(),mode:TEST.mode,rank:TEST.ranking().indexOf(TEST.S.player)+1,pots:TEST.potsOf(TEST.S.player),blames:TEST.S.player.blames,rng:E.rngState(),hud:rect('#hud'),chips:[...document.querySelectorAll('#hud>.chip,#hud .hud-right>.chip')].filter(e=>!e.hidden).map(e=>({id:e.id||e.textContent,rect:{x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y,w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height},text:e.textContent})),hint:rect('#hint'),msg:rect('#msg')};}const w=(0,eval)(`(${get})`)(),m=w.match;return{t:m.S.t,work:m.workT(),mode:m.mode,rank:m.ranking().indexOf(m.S.player)+1,pots:m.potsOf(m.S.player),blames:m.S.player.blames,rng:m.E.rngState(),hudBottom:w.ui.hud.bottom,boxes:w.ui.hud.boxes,hint:w.ui.messages.hintBox,msg:w.ui.messages.msgBox,hand:w.ui.tutorial.target,labels:w.surfaces[5].root.getComponentsInChildren(cc.Label).filter(l=>l.node.activeInHierarchy).map(l=>l.string)};},{kind,get:get.toString()});}
async function pair(p,c,stem,description){
 // 固定步快进可能在同一JS任务里同时显隐消息；等DOM提交并播完出入过渡，避免截到旧气泡残影。
 await p.waitForTimeout(400);
 const animation=await c.evaluate(get=>{const w=(0,eval)(`(${get})`)(),m=w.ui.messages;return{real:w.real,beat:w.ui.closing.beatAt,pulse:w.ui.hud.pulseAt,hintAt:m.hintChange,hintOn:m.hintOn,msgAt:m.msgChange,msgOn:m.msgOn,toastAt:m.toastAt,toastUntil:m.toastUntil};},get.toString());
 // 只冻结CSS动画的相位，不改原型玩法；两边在相同真实时间停住，手指/脉冲/数字可直接比较。
 await p.evaluate(a=>{
  // DOM过渡用原CSS重建并固定到同一真实时刻；避免快进后原型已淡入、Cocos才刚收到消息。
  for(const [selector,on,at] of [['#hint',a.hintOn,a.hintAt],['#msg',a.msgOn,a.msgAt],['#toast',a.real<a.toastUntil,a.real<a.toastUntil?a.toastAt:a.toastUntil]]){
   const el=document.querySelector(selector);if(!Number.isFinite(at))continue;
   const old=el.style.transition;el.style.transition='none';el.classList.toggle('on',!on);void el.offsetWidth;
   el.style.transition=old;el.classList.toggle('on',on);void el.offsetWidth;
   for(const anim of el.getAnimations()){if(anim.animationName)continue;anim.pause();anim.currentTime=Math.max(0,a.real-at)*1000;}
  }
  // 快进后有限次CSS动画可能已从getAnimations移除；只重启相同CSS动画再固定相位，不改样式参数或玩法。
  for(const el of document.querySelectorAll('#closingDigit,#coachHand img,#hud .pulse,.closing-clock img')){
   if(getComputedStyle(el).animationName==='none')continue;
   const old=el.style.animationName;el.style.animationName='none';void el.offsetWidth;el.style.animationName=old;
  }
  for(const anim of document.getAnimations()){const name=anim.animationName;if(!name)continue;anim.pause();anim.currentTime=(name==='chipPulse'?a.real-a.pulse:name.startsWith('closingPop')?a.real-a.beat:a.real)*1000;}
 },animation);
 const left=await measure(p,'prototype'),right=await measure(c,'cocos');for(const key of ['t','work','mode','rank','pots','blames','rng'])assert.equal(right[key],left[key],stem+' '+key);await p.screenshot({path:path.join(out,stem+'-prototype.png')});await c.screenshot({path:path.join(out,stem+'-cocos.png')});evidence.pairs.push({stem,description,left,right});console.log('PASS pair',stem);}
async function screens(){
 for(let level=0;level<(process.env.HUD_SCREEN_SET==='special'?0:5);level++){const p=await open('prototype',level),c=await open('cocos',level);let last=0;for(const [name,n] of [['start',180],['middle',(level?60:35)*60]]){await run(p,'prototype',n-last);await run(c,'cocos',n-last);last=n;await pair(p,c,`level-${level}-${name}`,'自然同关卡/seed1001/同步数');}await p.close();await c.close();}
 for(const name of ['messages','hint','toast','toast-long','hud-all','closing-10','closing-5','closing-2','bell','feedback','feedback-failed','narrow','capsule']){
  const width=name==='narrow'?360:375,extra=name==='hud-all'?'buff=trip':name==='capsule'?'capsule=1':'';
  const p=await open('prototype',0,extra,width),c=await open('cocos',0,extra,width);
  if(name.startsWith('closing')||name==='bell'||name.startsWith('feedback')){
   if(name==='feedback-failed'){
    // 只在两边内存构造落榜样本；仍由真实到点流程锁榜、选择失败文案。
    await p.evaluate(()=>{TEST.S.player.blames=999;});await c.evaluate(get=>{(0,eval)(`(${get})`)().match.S.player.blames=999;},get.toString());
   }
   const seconds=name==='closing-10'?10:name==='closing-5'?5:name==='closing-2'?2:0,n=(70-seconds)*60+(name.startsWith('feedback')?32:1);
   await run(p,'prototype',n);await run(c,'cocos',n);
   const notice=await c.evaluate(get=>(0,eval)(`(${get})`)().ui.closing.notice,get.toString());
   if(name.startsWith('closing'))assert.equal(notice.seconds,seconds);
   else {assert.equal(notice.result,name.startsWith('feedback'));if(name==='feedback-failed')assert.equal(notice.passed,false);}
  }
  else {
   const fixture=(m,name)=>{if(name==='messages'){m.showHint({title:'领导视野',icon:['boss_idle','ui_warning'],sub:'你站在老板的!红扇形!里',text:'先*走出去*再甩'});m.showMsg('【全员群】人事：下午茶到了，茶水间自取 🧋');}if(name==='hint')m.showHint({title:'反弹',icon:['ui_wok'],sub:'同事的锅朝你飞来了',text:'快砸中时按「*甩*」，*弹回去*'});if(name==='toast')m.E.toast('09:00 正式上班！',1600);if(name==='toast-long'){m.E.toast('09:00 正式上班！',1600);m.E.toast('扇形里没人，走近点、对准了再甩。'.repeat(4),1600);}if(name==='hud-all'){const P=m.S.player;P.combo=4;P.blames=7;P.sn.segs=Array.from({length:9},(_,i)=>({label:'返工',hot:i===0,due:40}));}};
   await p.evaluate(({fixture,name})=>{(0,eval)(`(${fixture})`)(TEST,name);TEST.draw();},{fixture:fixture.toString(),name});
   await c.evaluate(({fixture,name,get})=>{const w=(0,eval)(`(${get})`)();(0,eval)(`(${fixture})`)(w.match,name);w.consumeEvents();w.real+=.5;w.render();},{fixture:fixture.toString(),name,get:get.toString()});
   await p.waitForTimeout(400);
  }
  if(name==='capsule')await p.addStyleTag({content:'#hud{padding-top:54px;padding-right:106px}'});
  if(name==='capsule'){
   const proof=await c.evaluate(get=>{const w=(0,eval)(`(${get})`)();return {avoid:w.topAvoidance(),boxes:w.ui.hud.boxes,labels:w.surfaces[5].root.getComponentsInChildren(cc.Label).filter(l=>l.node.activeInHierarchy).map(l=>l.string)};},get.toString());
   assert.ok(proof.labels.includes('87×32'),'7456尚未编译假胶囊可见框');const cap=proof.avoid.capsule;
   for(const b of Object.values(proof.boxes))assert.ok(!(b.x<cap.x+cap.w&&b.x+b.w>cap.x&&b.y<cap.y+cap.h&&b.y+b.h>cap.y),'HUD不得和胶囊重叠');evidence.checks.push({capsule:proof});
  }
  if(name==='toast-long'){
   const labels=(await measure(c,'cocos')).labels;assert.ok(labels.some(s=>s.endsWith('…')));assert.ok(!labels.includes('09:00 正式上班！'));evidence.checks.push({longToast:'一行省略且替换旧提示'});
  }
  await pair(p,c,`special-${name}`,name==='capsule'?'假顶部44/右上87x32，不要求原型同布局':'同状态专项夹具');await p.close();await c.close();
 }
}
// 只通过真实触点传动作；方向从关卡目标点读取，不瞬移人物、不跳教学状态。
async function touchDriver(c,p,record,completion='tap'){
 const cdp=await c.context().newCDPSession(c);let previous=-1, touching=false;
 const touch=async(type,points)=>{if(type==='touchEnd'&&!touching)return;await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([id,x,y])=>({id,x,y,radiusX:1,radiusY:1,force:1}))});touching=points.length>0;};
 for(let i=0;i<2500;i++){
  const info=await c.evaluate(get=>{const w=(0,eval)(`(${get})`)(),m=w.match,T=m.S.tut,P=m.S.player;if(!T)return null;let goal=null;if(T.step.do==='walk')goal=T.ring;if(['throw','dodge'].includes(T.step.do))goal=m.S.agents.find(a=>a.key===(T.step.do==='throw'?'intern':'pm')).sn;const d=goal?Math.hypot(goal.x-P.sn.x,goal.y-P.sn.y):0,a=goal?Math.atan2(goal.y-P.sn.y,goal.x-P.sn.x):0;return {step:T.i,name:T.step.do,goal:!!goal,angle:a,mag:T.step.do==='walk'||d>95?1:.2,fire:m.potsOf(P)>0&&!m.seenBy(P)&&m.S.agents.some(a=>m.inAimFan(P,a,1))&&!!T.def.fire,inp:{...m.inp},start:w.ui.messages.startBox};},get.toString());
  if(!info)return;
  if(info.step!==previous){
   if(record) {await c.evaluate(get=>{const w=(0,eval)(`(${get})`)();w.real+=.5;w.render();},get.toString());await p.waitForTimeout(400);await pair(p,c,`tutorial-${info.step+1}-${info.name}`,'实际摇杆/甩锅输入推进到本步');}
   previous=info.step;
  }
  if(info.name==='rank'){
   const before=await c.evaluate(get=>{const w=(0,eval)(`(${get})`)();return {t:w.match.S.t,inp:JSON.stringify(w.match.inp)};},get.toString());
   await touch('touchStart',[[1,145,650]]);await touch('touchEnd',[]);await c.keyboard.press('p');await c.keyboard.press('j');
   const after=await c.evaluate(get=>{const w=(0,eval)(`(${get})`)();w.tick(1/60);return{t:w.match.S.t,inp:JSON.stringify(w.match.inp),paused:w.paused};},get.toString());assert.equal(after.t,before.t);assert.equal(after.paused,false);
   const box=info.start;if(completion==='tap')await c.touchscreen.tap(box.x+box.w/2,box.y+box.h/2);else await c.keyboard.press(completion);if(p)await p.locator('#hint .h-go').click();
   const done=await c.evaluate(get=>{const w=(0,eval)(`(${get})`)();return{tutorial:w.match.S.tut,work:w.match.workT(),progress:w.match.loadProgress(),storage:JSON.parse(localStorage.getItem('shuaiguo_v3')),inp:w.match.inp,statistics:w.match.S.agents.map(a=>({blames:a.blames,caught:a.caught,hitsBy:a.hitsBy})),leaders:w.match.S.leaders.map(l=>l.state),potDeadlines:w.match.S.agents.flatMap(a=>a.sn.segs.map(p=>p.due))};},get.toString());assert.equal(done.tutorial,null);assert.equal(done.storage.tutDone,true);assert.equal(done.inp.down,false);assert.equal(done.work,0);assert.ok(done.statistics.every(a=>a.blames===0&&a.caught===0&&Object.values(a.hitsBy).every(n=>n===0)));assert.ok(done.leaders.every(s=>s==='patrol'));assert.ok(done.potDeadlines.every(Number.isFinite));evidence.checks.push({tutorial:done,completion});
   if(record){await p.evaluate(()=>TEST.draw());await c.evaluate(get=>{const w=(0,eval)(`(${get})`)();w.real+=.4;w.render();},get.toString());await p.waitForTimeout(400);await pair(p,c,'tutorial-start-work','点真实开始按钮，教学统计清零并存档');}return;
  }
  if(info.goal){const xx=90+Math.cos(info.angle)*52*info.mag,yy=649.6+Math.sin(info.angle)*52*info.mag;await touch('touchStart',[[1,xx,yy]]);if(info.fire){await touch('touchStart',[[1,xx,yy],[2,307,650]]);await touch('touchEnd',[[2,307,650]]);}}
  else await touch('touchEnd',[]);
  // 把Cocos实际接收到的输入原样重放给原型，两边同一真实触控语义。
  const input=await c.evaluate(get=>{const i=(0,eval)(`(${get})`)().match.inp;return{down:i.down,angle:i.angle,mag:i.mag,fire:i.fire,x:i.x,y:i.y};},get.toString());
  if(p)await p.evaluate(input=>Object.assign(TEST.inp,input),input);
  await run(c,'cocos',6);if(p)await run(p,'prototype',6);
  await touch('touchEnd',[]);
 }
 throw Error('七步教学未能完成');
}
async function tutorial(){const p=await open('prototype',0,'',375,true),c=await open('cocos',0,'',375,true);await touchDriver(c,p,true);await p.close();await c.close();}
// 暂停真实计时、跳过、到点锁榜与重新开局均从现有预览入口验证。
async function play(){
 const p=await open('prototype',0,'',375,true);const c=await open('cocos',0,'',375,true);const skip=await c.evaluate(get=>(0,eval)(`(${get})`)().ui.hud.boxes.skip,get.toString());await c.touchscreen.tap(skip.x+skip.w/2,skip.y+skip.h/2);
 let info=await measure(c,'cocos');assert.equal(info.work,0);assert.equal(await c.evaluate(get=>!!(0,eval)(`(${get})`)().match.S.tut,get.toString()),false);await p.locator('#btnSkip').click();await p.evaluate(()=>TEST.draw());await c.evaluate(get=>{const w=(0,eval)(`(${get})`)();w.real+=.4;w.render();},get.toString());await p.waitForTimeout(400);await pair(p,c,'tutorial-skipped','真实跳过教学，时钟归零/持久化/正式上班toast');await p.close();
 // 通过真实主循环推进，暂停后群消息停留，toast真实计时继续。
 await c.evaluate(get=>{const w=(0,eval)(`(${get})`)();w.match.showMsg('【工作群】老板：暂停计时检查');w.match.E.toast('真实时间提示',800);w.consumeEvents();w.frozen=false;},get.toString());
 const pause=await c.evaluate(get=>(0,eval)(`(${get})`)().ui.hud.boxes.pause,get.toString());await c.touchscreen.tap(pause.x+pause.w/2,pause.y+pause.h/2);
 const before=await c.evaluate(get=>{const w=(0,eval)(`(${get})`)();return{t:w.match.S.t,msg:w.match.msgTimer,real:w.real};},get.toString());await c.waitForTimeout(1300);
 const after=await c.evaluate(get=>{const w=(0,eval)(`(${get})`)();return{t:w.match.S.t,msg:w.match.msgTimer,real:w.real,toastUntil:w.ui.messages.toastUntil,paused:w.paused};},get.toString());assert.equal(after.t,before.t);assert.equal(after.msg,before.msg);assert.ok(after.real>after.toastUntil+.2);assert.equal(after.paused,true);
 await c.touchscreen.tap(187,406);await c.waitForTimeout(100);assert.equal(await c.evaluate(get=>(0,eval)(`(${get})`)().paused,get.toString()),false);evidence.checks.push({pause:{before,after}});
 await c.evaluate(get=>{const w=(0,eval)(`(${get})`)();w.frozen=true;w.match.auto=true;for(let i=0;i<9000&&w.match.mode!=='closing';i++)w.tick(1/60);},get.toString());
 assert.equal(await c.evaluate(get=>(0,eval)(`(${get})`)().match.mode,get.toString()),'closing');
 await c.keyboard.press('p');assert.equal(await c.evaluate(get=>(0,eval)(`(${get})`)().paused,get.toString()),false);
 const closing=await c.evaluate(async get=>{const w=(0,eval)(`(${get})`)(),cc=await System.import('cc'),t=w.match.S.closing.t;cc.game.emit(cc.Game.EVENT_HIDE);w.update(10);cc.game.emit(cc.Game.EVENT_SHOW);return{before:t,after:w.match.S.closing.t,disabled:w.ui.hud.actions.every(a=>a.disabled)};},get.toString());assert.equal(closing.before,closing.after);assert.equal(closing.disabled,true);
 await run(c,'cocos',90);assert.equal(await c.evaluate(get=>(0,eval)(`(${get})`)().match.mode,get.toString()),'over');await c.screenshot({path:path.join(out,'placeholder-result-cocos.png')});
 await c.touchscreen.tap(187,406);await c.waitForFunction(()=>cc.director.getScene().getChildByName('Canvas').getChildByName('Boot').getComponent('Boot').world.ready);
 const restarted=await c.evaluate(get=>{const w=(0,eval)(`(${get})`)();return{t:w.match.S.t,mode:w.match.mode,tutorial:!!w.match.S.tut};},get.toString());assert.deepEqual(restarted,{t:0,mode:'play',tutorial:false});evidence.checks.push({closing,restarted});await c.close();
}

// 空存档首次进入、完成存档不再带教、tut=1强制重看；都从预览入口判断。
async function entry(){
 for(const [extra,expected] of [['entry-first',true],['entry-saved',false],['saved-force',true]]){
  const c=await open('cocos',0,extra,375,true);
  const value=await c.evaluate(get=>{const w=(0,eval)(`(${get})`)();return{tutorial:!!w.match.S.tut,work:w.match.workT(),buff:w.match.S.buff};},get.toString());
  assert.equal(value.tutorial,expected);evidence.checks.push({entry:extra,...value});await c.close();
 }
}

// HUD分支使用两边相同的内存夹具；增益到期仍由正常步进，金牌由真实甩锅API消费。
async function branches(){
 for(const buff of (process.env.HUD_BRANCH_SET==='protection'?[]:['trip','gold','news','legs'])){
  const p=await open('prototype',0,`buff=${buff}`),c=await open('cocos',0,`buff=${buff}`);
  await c.evaluate(get=>{const w=(0,eval)(`(${get})`)();w.real+=.4;w.render();},get.toString());
  assert.ok((await measure(c,'cocos')).boxes.buff);await pair(p,c,`buff-${buff}`,'真实增益开局HUD');
  if(buff==='trip'){
   for(const [name,frames] of [['last-second',29*60+1],['expired',60]]){
    await run(p,'prototype',frames);await run(c,'cocos',frames);
    const visible=!!(await measure(c,'cocos')).boxes.buff;assert.equal(visible,name!=='expired');await pair(p,c,`buff-trip-${name}`,'领导出差30秒到期隐藏');
   }
  }
  if(buff==='gold'){
   // 固定领导位于主角身旁且面向主角；不用直接写buffUsed来冒充消耗。
   const fixture=m=>{const P=m.S.player,l=m.S.leaders[0];l.x=P.sn.x-30;l.y=P.sn.y;l.face=0;P.sn.segs.push({label:'返工',hot:false,due:40});};
   await p.evaluate(f=>{(0,eval)(`(${f})`)(TEST);TEST.fireThrow(TEST.S.player);TEST.draw();},fixture.toString());
   await c.evaluate(({f,get})=>{const w=(0,eval)(`(${get})`)();(0,eval)(`(${f})`)(w.match);w.match.fireThrow(w.match.S.player);w.consumeEvents();w.render();},{f:fixture.toString(),get:get.toString()});
   assert.equal(await c.evaluate(get=>(0,eval)(`(${get})`)().match.S.buffUsed,get.toString()),true);assert.ok(!(await measure(c,'cocos')).boxes.buff);await pair(p,c,'buff-gold-used','领导视野内真实甩锅，金牌消耗并立即隐藏');
  }
  await p.close();await c.close();
 }
 for(const key of (process.env.HUD_BRANCH_SET==='protection'?[]:['Enter','Space'])){const c=await open('cocos',0,'',375,true);await touchDriver(c,null,false,key);await c.close();}
 // 两个保护分支只布置站位，仍用真实J键→InputView→core.pressFire；不直接发toast。
 for(const seen of [false,true]){
  const p=await open('prototype',0,'',375,true),c=await open('cocos',0,'',375,true);
  const fixture=(m,seen)=>{while(m.S.tut.step.do!=='throw')m.tutNext();const P=m.S.player;P.sn.segs=[{label:'返工',hot:false,due:Infinity}];P.cool=P.stun=0;P.sn.x=800;P.sn.y=700;P.sn.angle=0;for(const a of m.S.agents)if(a!==P){a.sn.x=180;a.sn.y=700;}for(const l of m.S.leaders){l.x=seen?770:200;l.y=seen?700:200;l.face=0;}m.pickAim(P);};
  await p.evaluate(({f,seen})=>{(0,eval)(`(${f})`)(TEST,seen);TEST.draw();},{f:fixture.toString(),seen});
  await c.evaluate(({f,seen,get})=>{const w=(0,eval)(`(${get})`)();(0,eval)(`(${f})`)(w.match,seen);w.consumeEvents();w.render();},{f:fixture.toString(),seen,get:get.toString()});
  // Cocos键盘监听在画布上；专项夹具没有先触屏，需先聚焦画布，再确认InputView收到J。
  await c.locator('#GameCanvas').focus();await c.keyboard.down('j');await c.waitForFunction(get=>(0,eval)(`(${get})`)().match.inp.fire>0,get.toString());await c.keyboard.up('j');await p.keyboard.press('j');await run(p,'prototype',1);await run(c,'cocos',1);
  const proof=await c.evaluate(get=>{const w=(0,eval)(`(${get})`)();return{toast:w.ui.messages.toast,life:w.ui.messages.toastUntil-w.ui.messages.toastAt,pots:w.match.potsOf(w.match.S.player),throws:w.match.S.throws.length};},get.toString());
  console.log('保护提示实际结果',JSON.stringify({seen,...proof}));
  assert.equal(proof.pots,1);assert.equal(proof.throws,0);assert.ok(Math.abs(proof.life-1.4)<1e-6);assert.ok(proof.toast.includes(seen?'先走出红扇形':'扇形里没人'));
  await c.evaluate(get=>{const w=(0,eval)(`(${get})`)();w.real+=.3;w.render();},get.toString());await p.waitForTimeout(300);await pair(p,c,seen?'tutorial-protected-seen':'tutorial-protected-empty','保护分支内存站位夹具+真实键盘输入');evidence.checks.push({protection:proof,seen});await p.close();await c.close();
 }
}

// 编辑器扫描尚未完成时也能先采集冻结原型，作为后续并排图的基线。
async function references(){for(let level=0;level<5;level++){const p=await open('prototype',level);let last=0;for(const [name,n]of[['start',180],['middle',(level?60:35)*60]]){await run(p,'prototype',n-last);last=n;await p.screenshot({path:path.join(out,`level-${level}-${name}-prototype.png`)});evidence.checks.push({reference:`level-${level}-${name}`,state:await measure(p,'prototype')});}await p.close();}}

try{const mode=process.argv[2]||'screens';if(mode==='references')await references();else if(mode==='screens')await screens();else if(mode==='tutorial')await tutorial();else if(mode==='play')await play();else if(mode==='entry')await entry();else if(mode==='branches')await branches();else if(mode==='inspect'){const p=await open('prototype');console.log(JSON.stringify(await measure(p,'prototype'),null,2));await p.screenshot({path:path.join(out,'prototype-layout.png')});const c=await open('cocos');console.log(JSON.stringify(await measure(c,'cocos'),null,2));await c.screenshot({path:path.join(out,'cocos-layout.png')});}assert.deepEqual(evidence.errors,[]);}finally{const name=process.argv[2]==='screens'&&process.env.HUD_SCREEN_SET==='special'?'screens-special':process.argv[2]||'screens';await fs.writeFile(path.join(out,name+'-evidence.json'),JSON.stringify(evidence,null,2));await browser.close();}
