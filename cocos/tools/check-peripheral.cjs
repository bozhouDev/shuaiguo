// 不启动编辑器的外围契约：原型存档兼容、广告完整等待/取消和采样表/Bundle字节。
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const ts=require('/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources/resources/3d/engine/node_modules/typescript');
const cache=new Map();
// WebAudio边界桩只记录实际排音参数，不替画面/玩法作结论。
const scheduled=[],oscillators=[];
class Param {value=1;setValueAtTime(v,t){this.value=v;return this;}linearRampToValueAtTime(v,t){this.value=v;return this;}exponentialRampToValueAtTime(v,t){this.value=v;return this;}cancelScheduledValues(){return this;}}
class Context {currentTime=1;state='running';destination={};createGain(){return {gain:new Param(),connect(){},disconnect(){}};}createBufferSource(){const s={playbackRate:new Param(),connect(gain){s.gain=gain;},disconnect(){},start(t,offset){scheduled.push({t,offset,rate:s.playbackRate.value,loop:s.loop,buffer:s.buffer,volume:s.gain.gain.value});},stop(){}};return s;}createOscillator(){const o={frequency:new Param(),connect(){},start(t){oscillators.push({t,f:o.frequency.value,type:o.type});},stop(){}};return o;}resume(){this.state='running';return Promise.resolve();}suspend(){this.state='suspended';return Promise.resolve();}close(){this.state='closed';return Promise.resolve();}}
const ccStub={KeyCode:new Proxy({},{get:(_,k)=>k}),AudioClip:class{},AudioSource:class{},Node:class{},assetManager:{loadBundle(){}}};

// 只在内存转译，避免写编辑器缓存。
function load(file){file=path.resolve(file);if(!file.endsWith('.ts'))file+='.ts';if(cache.has(file))return cache.get(file).exports;const mod={exports:{}};cache.set(file,mod);const text=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','module','exports',text)(s=>s==='cc'?ccStub:s==='cc/env'?{PREVIEW:true}:load(path.resolve(path.dirname(file),s)),mod,mod.exports);return mod.exports;}
(async()=>{
 const {PlayerStore}=load('cocos/assets/scripts/view/PlayerStore'),memory=new Map(),platform={getStorage:k=>memory.get(k)||null,setStorage:(k,v)=>memory.set(k,v)},store=new PlayerStore(platform);
 assert.deepEqual(store.read(),{unlocked:1,best:{}});assert.deepEqual(store.settings,{music:true,sfx:true,vibrate:true});
 const old={unlocked:5,best:{1:{stars:3,blames:2},3:{stars:1,blames:4,debt:6.5}},tutDone:true,bossName:'老王',achievements:{nephewCrushed:true}};memory.set('shuaiguo_v3',JSON.stringify(old));assert.deepEqual(store.read(),old);store.save(old);assert.equal(memory.get('shuaiguo_v3'),JSON.stringify(old));
 memory.set('shuaiguo_v3','{broken');assert.deepEqual(store.read(),{unlocked:1,best:{}});memory.set('shuaiguo_settings','{broken');assert.deepEqual(new PlayerStore(platform).settings,{music:true,sfx:true,vibrate:true});store.set('music',false);assert.deepEqual(JSON.parse(memory.get('shuaiguo_settings')),{music:false,sfx:true,vibrate:true});
 assert.equal(new PlayerStore({...platform,setStorage(){throw new Error('quota');}}).save(old),false);
 console.log('PASS 原型旧存档/无debt/成就/Unicode称呼，默认/损坏读取，设置与写失败');
 const {WebPlatform}=load('cocos/assets/scripts/platform/WebPlatform');const originalSet=global.setTimeout,originalClear=global.clearTimeout;let time=0,seq=0,tasks=new Map();global.setTimeout=(fn,ms)=>{const id=++seq;tasks.set(id,{fn,at:time+ms});return id;};global.clearTimeout=id=>tasks.delete(id);
 try {const web=new WebPlatform(),ticks=[];let reward=false;const promise=web.showRewardedAd(n=>ticks.push({n,time})).then(ok=>reward=ok);assert.equal(reward,false);for(const expected of [650,1300,1950]){const [id,task]=[...tasks.entries()].sort((a,b)=>a[1].at-b[1].at)[0];tasks.delete(id);time=task.at;task.fn();await Promise.resolve();if(expected<1950)assert.equal(reward,false);}await promise;assert.equal(reward,true);assert.deepEqual(ticks,[{n:3,time:0},{n:2,time:650},{n:1,time:1300},{n:null,time:1950}]);const pending=web.showRewardedAd();web.dispose();assert.equal(await pending,false);assert.equal(tasks.size,0);}finally{global.setTimeout=originalSet;global.clearTimeout=originalClear;}
 console.log('PASS 假广告1950ms结束才发奖，取消释放定时器不发奖');
 const source=fs.readFileSync('js/engine.js','utf8'),raw=source.slice(source.indexOf('  const SFX = {')+'  const SFX = '.length,source.indexOf('  const lastPlay')).trim().replace(/;$/,'');const oracle=vm.runInNewContext('('+raw+')'),{SFX}=load('cocos/assets/scripts/view/audio-data');const {rankDown,...unchanged}=SFX;assert.deepEqual(JSON.parse(JSON.stringify(unchanged)),JSON.parse(JSON.stringify(oracle)));const names=fs.readdirSync('assets/audio').filter(n=>n.endsWith('.mp3'));assert.equal(names.length,41);for(const name of names)assert.deepEqual(fs.readFileSync('cocos/assets/audio/'+name),fs.readFileSync('assets/audio/'+name));assert.deepEqual(fs.readdirSync('cocos/assets/audio').filter(n=>n.endsWith('.mp3')).sort(),names.concat('bgm_clearing.mp3').sort());const bundle=JSON.parse(fs.readFileSync('cocos/assets/audio.meta'));assert.equal(bundle.userData.bundleName,'audio');assert.equal(bundle.userData.bundleConfigID,'default');const config=JSON.parse(fs.readFileSync('cocos/settings/v2/packages/builder.json'));assert.equal(config.bundleConfig.custom.default.configs.miniGame.overwriteSettings.wechatgame.compressionType,'subpackage');
 // 同名去重、双响音高、总线、暂停恢复位置和缺采样兜底。
 const previousWindow=global.window;global.window={AudioContext:Context};let audio;
 try {const {AudioView}=load('cocos/assets/scripts/view/AudioView'),settings={music:true,sfx:true,vibrate:true};audio=new AudioView({}, {kind:'web'},settings);audio.unlock();
  assert.equal(audio.sfxBus.gain.value,1);assert.equal(audio.musicBus.gain.value,.32);
  audio.buffers.set('sfx_tick',{duration:1});audio.sfx('tickUrgent');audio.sfx('tickUrgent');assert.equal(scheduled.length,2);assert.deepEqual(scheduled.map(x=>[x.t,x.rate]),[[1,1.35],[1.1,1.5120000000000002]]);
  settings.sfx=false;audio.sfx('hit');assert.equal(scheduled.length,2);settings.sfx=true;
  audio.sfx('hit');assert.ok(oscillators.length>0,'缺采样应按原型synth兜底，首次交互加载期间也不能吞音');
  audio.buffers.set('bgm_work',{duration:100});audio.clips.set('bgm_work',{});audio.bgm('work',true);assert.equal(scheduled.at(-1).offset,0);audio.context.currentTime=7;audio.bgm(false);audio.bgm('work');assert.equal(scheduled.at(-1).offset,6);audio.bgm(false);audio.bgm('work',true);assert.equal(scheduled.at(-1).offset,0);
  audio.hidden(true);assert.equal(audio.context.state,'suspended');audio.hidden(false);assert.equal(audio.context.state,'running');
  audio.bgm(false);audio.want='lobby';audio.loads.set('bgm_lobby',Promise.resolve(null));audio.failed.add('bgm_lobby');let before=oscillators.length;audio.synthMusic();assert.ok(oscillators.length>before);audio.hidden(true);before=oscillators.length;audio.synthMusic();assert.equal(oscillators.length,before);
  // 用真实排名触发画面层掉榜入口，覆盖前三与周五前两名；只替换最外层音频设备。
  const {Match}=load('cocos/assets/scripts/core/match'),{PraiseView}=load('cocos/assets/scripts/view/PraiseView');
  audio.hidden(false);audio.want=null;
  const buffer={duration:1};audio.buffers.set('sfx_rank_down',buffer);
  for(const level of [0,4]){
   const m=new Match({level,seed:1001}),praise=new PraiseView({},name=>audio.sfx(name),()=>{});
   m.S.t=16;const clock=8+level,before=scheduled.length,calls=audio.calls.rankDown||0;
   const renderRank=()=>praise.rank(m,0,[],false,false);
   assert.ok(m.ranking().indexOf(m.S.player)+1<=m.passRank());renderRank();assert.equal(scheduled.length,before);
   audio.context.currentTime=clock;m.S.player.blames=20;
   assert.ok(m.ranking().indexOf(m.S.player)+1>m.passRank());renderRank();
   assert.equal(scheduled.length,before+1,'掉出名额应实际排播 sfx_rank_down');
   assert.equal(scheduled.at(-1).buffer,buffer);assert.equal(scheduled.at(-1).volume,.4);assert.equal(scheduled.at(-1).rate,1);
   renderRank();assert.equal(audio.calls.rankDown,calls+1,'持续落榜不逐帧重复触发');
   // 快速回榜再掉榜，49ms应去重；51ms应再次播放同一采样。
   m.S.player.blames=0;renderRank();audio.context.currentTime=clock+.049;m.S.player.blames=20;renderRank();
   assert.equal(audio.calls.rankDown,calls+2);assert.equal(scheduled.length,before+1,'49ms重复掉榜应静音');
   m.S.player.blames=0;renderRank();audio.context.currentTime=clock+.051;m.S.player.blames=20;renderRank();
   assert.equal(audio.calls.rankDown,calls+3);assert.equal(scheduled.length,before+2,'超过50ms应恢复排播');assert.equal(scheduled.at(-1).buffer,buffer);
  }
  assert.deepEqual(rankDown,{id:'sfx_rank_down',vol:.4});assert.equal(rankDown.vol,SFX.rankup.vol);
 }finally{audio?.destroy();global.window=previousWindow;}
 console.log('PASS WebAudio总线/50ms去重/双响音高/静音/缺采样兜底/BGM续播与从头/后台暂停');
 console.log('PASS 真实排名掉出前三/前两名播放sfx_rank_down，音量0.4，持续落榜不重播，49ms去重/51ms恢复');
 // 真正的App动作入口必须结束当前教学，不能重建一局。
 const {AppView}=load('cocos/assets/scripts/view/AppView'),{Match}=load('cocos/assets/scripts/core/match');
 const m=new Match({level:0,seed:1001,tutorial:true});for(let i=0;i<6;i++)m.tutNext();assert.equal(m.coachLocked(),true);
 let restarts=0;const host={ready:true,panel:'',world:{match:m,clearInput(){},flush(){}},audio:{unlock(){},sfx(){}},render(){},startGame(){restarts++;}};
 AppView.prototype.action.call(host,'start');assert.equal(restarts,0);assert.equal(m.S.tut,null);assert.equal(m.workT(),0);assert.equal(m.loadProgress().tutDone,true);
 console.log('PASS 教学末步使用原有对局正式上班，不重建/不重新进入教学');
 const {WechatPlatform}=load('cocos/assets/scripts/platform/WechatPlatform');const failedMatch=new Match({level:1,seed:1001,auto:true}),result=failedMatch.calculateResult('crushed');let message='';const adEvents=[];const adHost={cloud:{track(...args){adEvents.push(args);}},result,world:{match:failedMatch},alive:true,serial:1,panel:'result',platform:new WechatPlatform(),open(name){this.panel=name;},toast(text){message=text;},render(){}};await AppView.prototype.ad.call(adHost,'revive');assert.equal(adHost.panel,'result');assert.equal(message,'广告不可用');assert.equal(failedMatch.S.revived,false);assert.equal(adHost.result,result);assert.deepEqual(adEvents.map(e=>[e[0],e[2].action,e[2].success]),[['ad_show','revive',undefined],['ad_result','revive',false]]);
 console.log('PASS 微信广告不可用保留结算与次数，不发复活奖励');
 // 真实玩家被压垮只置S.over，不置player.crushed；上报时刻必须取本局工作时钟。
 failedMatch.S.t=12;const cloudEvents=[];AppView.prototype.cloudResult.call(Object.assign(Object.create(AppView.prototype),{world:{match:failedMatch},cloud:{track(...args){cloudEvents.push(args);},settled(){},background(){}}}),result);assert.equal(cloudEvents[0][2].crushed,true);assert.equal(cloudEvents[0][2].crushedAt,12);
 console.log('PASS 云埋点按真实结算记录玩家压垮时刻');
 // 名称修改在真实保存入口写独立时间戳；旧档未带时间戳仍能修改并触发同步。
 let renamed={unlocked:1,best:{},bossName:'旧名'},syncs=0;const nameHost={edit:{string:'新名'},world:{match:failedMatch},store:{read:()=>structuredClone(renamed),save(p){renamed=p;return true;}},cloud:{progressChanged(){syncs++;}},showLobby(){},toast(){}};AppView.prototype.saveName.call(nameHost);assert.equal(renamed.bossName,'新名');assert.ok(renamed.bossNameAt>0);assert.equal(syncs,1);
 const coach=new Match({seed:1,tutorial:true}),tutorialEvents=[],tutorialHost={world:{match:coach},cloudTutorialStep:-1,cloud:{track(...v){tutorialEvents.push(v);}}};for(let i=0;i<coach.L.tutorial.steps.length;i++){coach.S.tut.i=i;AppView.prototype.event.call(tutorialHost,{kind:'showHint',args:[]});AppView.prototype.event.call(tutorialHost,{kind:'showHint',args:[]});}assert.deepEqual(tutorialEvents.map(v=>v[2].step),[0,1,2,3,4,5,6]);
 console.log('PASS 真实改名写bossNameAt并请求云同步，带教七步各记一次');


 const sounds=[];AppView.prototype.action.call({...host,panel:'boss',audio:{unlock(){},sfx(n){sounds.push(n);}},closePanel(){this.panel='';}},'cancel');assert.deepEqual(sounds,['click']);
 console.log('PASS 老板名称取消按钮音效与原型一致');

 // 自定义称呼从真实core事件一直验到绘字边界；默认称呼保留原型逐字文案。
 const {MessageView}=load('cocos/assets/scripts/view/MessageView'),{IntroView}=load('cocos/assets/scripts/view/IntroView'),{ResultView}=load('cocos/assets/scripts/view/ResultView'),{ShareView}=load('cocos/assets/scripts/view/ShareView');
 const {EVENTS,LEADER_TYPES}=load('cocos/assets/scripts/core/config'),{LEVELS}=load('cocos/assets/scripts/core/levels');
 // 绘图设备仅记录最终文字；真实排版、换行和页面函数照常执行。
 function textPaint(){const texts=[],surface=new Proxy({width:375,height:812,assets:{spr:{}},fillText(text){texts.push(text);}},{get:(o,k)=>k in o?o[k]:()=>{}}),{ScreenPaint}=load('cocos/assets/scripts/view/ScreenPaint');return {p:new ScreenPaint(surface),texts};}
 for(const name of ['老板','王总','王老板$&']){
  const events=[],progress={unlocked:5,best:{},tutDone:true,bossName:name},named=new Match({level:3,seed:1001,progress,onEvent:e=>events.push(e)});
  const expected=[`【全员群】${name}：大家停一下，开个三分钟短会。`,`【工作群】${name}：@所有人 大客户急件，今天必须交，谁来跟一下？`];
  const messages=named.S.schedule.filter(it=>it.act==='msg').map(it=>it.text);
  assert.ok(named.S.schedule.find(it=>it.act==='msg'&&it.t===named.L.incidents.find(inc=>inc.kind==='rage').t-2).text.startsWith(`【工作群】${name}：`),'发火预告也应逐字保留自定义称呼');
  for(const text of expected){assert.ok(messages.includes(text),`群消息应使用称呼：${text}`);named.showMsg(text);const {p,texts}=textPaint(),view=new MessageView(p);view.event('showMsg',[text],0);view.draw(1,70,false);assert.ok(texts.join('').includes(name));}
  named.launchSky(named.S.player);named.launchSky(named.S.player,named.S.leaders.find(l=>l.type==='director'));
  const pot=named.newPot(0),thrown={owner:named.S.player,pot,label:pot.label,x:100,y:700};
  named.missThrow({...thrown},'nephew');named.missThrow({...thrown},'wife');named.startFinale(LEVELS[0].finale);
  const floats=events.filter(e=>e.kind==='floats').map(e=>e.args[0]);
  for(const text of [`${name}：这个你来`,`${name}护短，锅弹回来`,`${name}：下班前这几个你分一下`,'经理：这个你来','老板娘护短，锅弹回来'])assert.ok(floats.includes(text),`飘字应逐字匹配：${text}`);
  named.S.player.hitsBy.sky=4;
  assert.equal(named.diagnose(named.S.player).html,`复盘：${name}的天降锅砸了你 <b>4</b> 口，躲都躲不掉。`);
  named.S.player.piesEaten=2;
  for(const crushed of [false,true]){named.S.nephewCrushed=crushed;const result=named.calculateResult('time'),{p,texts}=textPaint();assert.equal(result.pieReport,`今天吃了${name} 2 张饼`);assert.equal(result.nephewReport,crushed?`今天我把${name}小舅子压垮了`:`${name}小舅子今天背锅 0 次，第一个下班`);new ResultView(p).draw(named,result,{x:0,y:0,w:340,h:600});assert.ok(texts.includes(`${name}小舅子`));const share=new ShareView(p);if(crushed){const info={...result.shareInfo,kind:'brag'};assert.equal(share.title(info),`今天我把${name}小舅子压垮了`);texts.length=0;share.draw(info,{x:0,y:0,w:320,h:600});assert.ok(texts.join('').includes(name));}}
  const friday=new Match({level:4,seed:1001,progress}),ranked=textPaint();new ResultView(ranked.p).draw(friday,friday.calculateResult('time'),{x:0,y:0,w:340,h:600});assert.ok(ranked.texts.includes(`${name}小舅子`),'周五参与排名的关系称呼也应生效');
  // 教学与条件提示都走真实文本出口；不改全局LEVELS，也不重复替换含“老板”的称呼。
  const coach=new Match({level:0,seed:1001,tutorial:true,progress,onEvent:e=>events.push(e)});coach.tutNext();coach.showHint(LEVELS[0].tips[0]);
  assert.ok(events.some(e=>e.kind==='showHint'&&e.args[0].text===`站好，!${name}点名了!。`));
  assert.ok(events.some(e=>e.kind==='showHint'&&e.args[0].sub===`你站在${name}的!红扇形!里`));
  for(const level of [0,1,2,3,4]){const m=new Match({level,seed:1001,progress}),{p,texts}=textPaint();new IntroView(p).draw(m,progress);const joined=texts.join('');if(level!==4)assert.ok(joined.includes(name));if(name==='王总')assert.doesNotMatch(joined.replace(m.L.name,'').replaceAll('老板娘',''),/老板/);}
  // 大厅尚无world时，玩法弹窗也必须读取存档中的称呼；其他领导类别保持原名。
  const {p,texts}=textPaint(),surface=p.c,pane={surface,p,mask:{active:false,setPosition(){},getComponent(){return {setContentSize(){}};}},root:{setPosition(){}}};
  const rulesHost={panes:[pane],surface,paint:p,heights:{},scroll:0,selected:4,real:0,panelAt:0,panel:'rules',store:{read:()=>progress},actions:[],praise:{clear(){}},removeEdit(){}};
  AppView.prototype.open.call(rulesHost,'rules');AppView.prototype.modal.call(rulesHost,'rules');assert.ok(texts.join('').includes(`${name}、经理、老板娘`));
  if(name==='王总')for(const text of [...expected,...floats.filter(t=>!t.startsWith('老板娘')),named.diagnose(named.S.player).html])assert.doesNotMatch(text,/老板/);
 }
 assert.equal(EVENTS.p0.msg,'【工作群】老板：@所有人 大客户急件，今天必须交，谁来跟一下？');assert.equal(LEADER_TYPES.boss.name,'老板');assert.equal(LEADER_TYPES.wife.name,'老板娘');assert.equal(LEVELS[3].name,'周四 · 老板画饼');
 console.log('PASS 默认/王总/含老板与$&称呼：群消息、天降/护短/收尾飘字、复盘、结算分享、教学提示、介绍及大厅玩法；类型/老板娘/原始关卡数据不变');

 // 真实字体与图集尺寸计算大厅，对照浏览器采得的CSS矩形；不替代栅格截图。
 const {ScreenPaint}=load('cocos/assets/scripts/view/ScreenPaint'),{LobbyView}=load('cocos/assets/scripts/view/LobbyView'),{ATLAS}=load('cocos/assets/scripts/view/atlas-data');
 const spr=Object.fromEntries(ATLAS.sheets.flatMap(s=>Object.entries(s.frames).map(([name,r])=>[name,{w:r[2],h:r[3]}]))),surface=new Proxy({width:375,height:812,assets:{spr}},{get:(o,k)=>k in o?o[k]:()=>{}}),paint=new ScreenPaint(surface),lobby=new LobbyView(paint);
 // 隐藏成就必须有已导入的真实图集切片，且矩形没有越过PNG边界。
 const nephewSheet=ATLAS.sheets.find(s=>s.frames.nephew_flat);
 assert.ok(nephewSheet,'图集必须登记 nephew_flat');
 const nephewRect=nephewSheet.frames.nephew_flat,nephewPng=fs.readFileSync(path.join('cocos/assets/resources',nephewSheet.file+'.png'));
 assert.deepEqual(nephewPng.subarray(0,8),Buffer.from([137,80,78,71,13,10,26,10]));
 const [nx,ny,nw,nh]=nephewRect;
 assert.ok(nx>=0&&ny>=0&&nw>0&&nh>0&&nx+nw<=nephewPng.readUInt32BE(16)&&ny+nh<=nephewPng.readUInt32BE(20),'nephew_flat 必须是PNG内的有效切片');
 // 真实core压垮小舅子后，从分享预览入口记录最终绘图；不替换contain/image实现。
 const images=[],spriteNames=new Map(Object.entries(spr).map(([name,pic])=>[pic,name]));
 const shareSurface=new Proxy({width:375,height:812,assets:{spr},drawImage(pic){images.push(spriteNames.get(pic));}},{get:(o,k)=>k in o?o[k]:()=>{}}),shareView=new ShareView(new ScreenPaint(shareSurface));
 const {MAX_POTS}=load('cocos/assets/scripts/core/config');
 for(const level of [2,4])for(const crushed of [false,true]){
  const m=new Match({level,seed:1001}),nephew=m.S.agents.find(a=>a.key==='nephew');
  if(crushed)m.addPots(nephew,MAX_POTS,nephew.sn.x,nephew.sn.y);
  for(const reason of ['time','crushed']){
   const info=m.calculateResult(reason).shareInfo;assert.equal(info.nephewCrushed,crushed);
   assert.equal(info.kind,reason==='crushed'?'blame':level===4?'cert':'brag');
   images.length=0;shareView.draw(info,{x:0,y:0,w:320,h:600});
   if(crushed&&info.kind!=='cert')assert.deepEqual(images,['boss_chase','nephew_flat'],'小舅子隐藏成就分享卡必须绘制 nephew_flat');
   else {assert.ok(!images.includes('nephew_flat'),'普通战报/末关证书不应显示隐藏成就人物');assert.ok(images.includes(info.kind==='cert'?'ui_badge':'player_win'));}
   assert.ok(!images.includes('tester_flat'),'分享预览不应误用业务员躺平图');
  }
 }
 console.log('PASS nephew_flat图集/PNG切片有效；小舅子压垮输赢卡绘制本人，普通战报及末关证书优先级不变');
 for(const [width,height,goY,dayY,cardWidth] of [[375,812,655.203125,520.015625,101.609375],[375,667,527.40625,396.40625,101.609375],[360,780,623.203125,492.203125,95.28125]]){surface.width=width;surface.height=height;paint.actions=[];lobby.select(0);lobby.draw(0,{unlocked:1,best:{}},0,{top:0},true);const go=paint.actions.find(a=>a.action==='go'),day=paint.actions.find(a=>a.action==='pick:0');assert.ok(Math.abs(go.y-goY)<.1);assert.ok(Math.abs(day.y-dayY)<.1);assert.ok(Math.abs(day.w-cardWidth)<.1);}
 surface.width=375;surface.height=812;paint.actions=[];lobby.draw(0,{unlocked:1,best:{}},0,{top:44,capsule:{x:281,y:50,w:87,h:32}},true);const gear=paint.actions.find(a=>a.action==='settings');assert.ok(gear.x+gear.w<=281&&gear.y>=44);
 console.log('PASS 三种屏宽大厅去上班/日期矩形与原型DOM相差小于0.1px，齿轮避让假胶囊');
 console.log('PASS 原有38项音效参数与冻结原型完全相同，仅新增rankDown，41份既有mp3原字节、清账新增副本，默认audio微信分包配置');
})().catch(e=>{console.error(e);process.exitCode=1;});
