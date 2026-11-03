// 不启动编辑器的外围契约：原型存档兼容、广告完整等待/取消和采样表/Bundle字节。
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const ts=require('/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources/resources/3d/engine/node_modules/typescript');
const cache=new Map();
// WebAudio边界桩只记录实际排音参数，不替画面/玩法作结论。
const scheduled=[],oscillators=[];
class Param {value=1;setValueAtTime(v,t){this.value=v;return this;}linearRampToValueAtTime(v,t){this.value=v;return this;}exponentialRampToValueAtTime(v,t){this.value=v;return this;}cancelScheduledValues(){return this;}}
class Context {currentTime=1;state='running';destination={};createGain(){return {gain:new Param(),connect(){},disconnect(){}};}createBufferSource(){const s={playbackRate:new Param(),connect(){},disconnect(){},start(t,offset){scheduled.push({t,offset,rate:s.playbackRate.value,loop:s.loop});},stop(){}};return s;}createOscillator(){const o={frequency:new Param(),connect(){},start(t){oscillators.push({t,f:o.frequency.value,type:o.type});},stop(){}};return o;}resume(){this.state='running';return Promise.resolve();}suspend(){this.state='suspended';return Promise.resolve();}close(){this.state='closed';return Promise.resolve();}}
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
 const source=fs.readFileSync('js/engine.js','utf8'),raw=source.slice(source.indexOf('  const SFX = {')+'  const SFX = '.length,source.indexOf('  const lastPlay')).trim().replace(/;$/,'');const oracle=vm.runInNewContext('('+raw+')'),{SFX}=load('cocos/assets/scripts/view/audio-data');assert.deepEqual(JSON.parse(JSON.stringify(SFX)),JSON.parse(JSON.stringify(oracle)));assert.equal(SFX.rankDown,undefined);const names=fs.readdirSync('assets/audio').filter(n=>n.endsWith('.mp3'));assert.equal(names.length,41);for(const name of names)assert.deepEqual(fs.readFileSync('cocos/assets/audio/'+name),fs.readFileSync('assets/audio/'+name));assert.equal(fs.readdirSync('cocos/assets/audio').filter(n=>n.endsWith('.mp3')).length,41);const bundle=JSON.parse(fs.readFileSync('cocos/assets/audio.meta'));assert.equal(bundle.userData.bundleName,'audio');assert.equal(bundle.userData.bundleConfigID,'default');const config=JSON.parse(fs.readFileSync('cocos/settings/v2/packages/builder.json'));assert.equal(config.bundleConfig.custom.default.configs.miniGame.overwriteSettings.wechatgame.compressionType,'subpackage');
 // 同名去重、双响音高、总线、暂停恢复位置和缺采样兜底。
 const previousWindow=global.window;global.window={AudioContext:Context};
 try {const {AudioView}=load('cocos/assets/scripts/view/AudioView'),settings={music:true,sfx:true,vibrate:true},audio=new AudioView({}, {kind:'web'},settings);audio.unlock();
  assert.equal(audio.sfxBus.gain.value,1);assert.equal(audio.musicBus.gain.value,.32);
  audio.buffers.set('sfx_tick',{duration:1});audio.sfx('tickUrgent');audio.sfx('tickUrgent');assert.equal(scheduled.length,2);assert.deepEqual(scheduled.map(x=>[x.t,x.rate]),[[1,1.35],[1.1,1.5120000000000002]]);
  settings.sfx=false;audio.sfx('hit');assert.equal(scheduled.length,2);settings.sfx=true;
  audio.sfx('hit');assert.ok(oscillators.length>0,'缺采样应按原型synth兜底，首次交互加载期间也不能吞音');
  audio.buffers.set('bgm_work',{duration:100});audio.clips.set('bgm_work',{});audio.bgm('work',true);assert.equal(scheduled.at(-1).offset,0);audio.context.currentTime=7;audio.bgm(false);audio.bgm('work');assert.equal(scheduled.at(-1).offset,6);audio.bgm(false);audio.bgm('work',true);assert.equal(scheduled.at(-1).offset,0);
  audio.hidden(true);assert.equal(audio.context.state,'suspended');audio.hidden(false);assert.equal(audio.context.state,'running');
  audio.bgm(false);audio.want='lobby';audio.loads.set('bgm_lobby',Promise.resolve(null));audio.failed.add('bgm_lobby');let before=oscillators.length;audio.synthMusic();assert.ok(oscillators.length>before);audio.hidden(true);before=oscillators.length;audio.synthMusic();assert.equal(oscillators.length,before);
  audio.destroy();
 }finally{global.window=previousWindow;}
 console.log('PASS WebAudio总线/50ms去重/双响音高/静音/缺采样兜底/BGM续播与从头/后台暂停');
 // 真正的App动作入口必须结束当前教学，不能重建一局。
 const {AppView}=load('cocos/assets/scripts/view/AppView'),{Match}=load('cocos/assets/scripts/core/match');
 const m=new Match({level:0,seed:1001,tutorial:true});for(let i=0;i<6;i++)m.tutNext();assert.equal(m.coachLocked(),true);
 let restarts=0;const host={ready:true,panel:'',world:{match:m,clearInput(){},flush(){}},audio:{unlock(){},sfx(){}},render(){},startGame(){restarts++;}};
 AppView.prototype.action.call(host,'start');assert.equal(restarts,0);assert.equal(m.S.tut,null);assert.equal(m.workT(),0);assert.equal(m.loadProgress().tutDone,true);
 console.log('PASS 教学末步使用原有对局正式上班，不重建/不重新进入教学');
 const {WechatPlatform}=load('cocos/assets/scripts/platform/WechatPlatform');const failedMatch=new Match({level:1,seed:1001,auto:true}),result=failedMatch.calculateResult('crushed');let message='';const adHost={result,world:{match:failedMatch},alive:true,serial:1,panel:'result',platform:new WechatPlatform(),open(name){this.panel=name;},toast(text){message=text;},render(){}};await AppView.prototype.ad.call(adHost,'revive');assert.equal(adHost.panel,'result');assert.equal(message,'广告不可用');assert.equal(failedMatch.S.revived,false);assert.equal(adHost.result,result);
 console.log('PASS 微信广告不可用保留结算与次数，不发复活奖励');
 const sounds=[];AppView.prototype.action.call({...host,panel:'boss',audio:{unlock(){},sfx(n){sounds.push(n);}},closePanel(){this.panel='';}},'cancel');assert.deepEqual(sounds,['click']);
 console.log('PASS 老板名称取消按钮音效与原型一致');

 // 真实字体与图集尺寸计算大厅，对照浏览器采得的CSS矩形；不替代栅格截图。
 const {ScreenPaint}=load('cocos/assets/scripts/view/ScreenPaint'),{LobbyView}=load('cocos/assets/scripts/view/LobbyView'),{ATLAS}=load('cocos/assets/scripts/view/atlas-data');
 const spr=Object.fromEntries(ATLAS.sheets.flatMap(s=>Object.entries(s.frames).map(([name,r])=>[name,{w:r[2],h:r[3]}]))),surface=new Proxy({width:375,height:812,assets:{spr}},{get:(o,k)=>k in o?o[k]:()=>{}}),paint=new ScreenPaint(surface),lobby=new LobbyView(paint);
 for(const [width,height,goY,dayY,cardWidth] of [[375,812,655.203125,520.015625,101.609375],[375,667,527.40625,396.40625,101.609375],[360,780,623.203125,492.203125,95.28125]]){surface.width=width;surface.height=height;paint.actions=[];lobby.select(0);lobby.draw(0,{unlocked:1,best:{}},0,{top:0},true);const go=paint.actions.find(a=>a.action==='go'),day=paint.actions.find(a=>a.action==='pick:0');assert.ok(Math.abs(go.y-goY)<.1);assert.ok(Math.abs(day.y-dayY)<.1);assert.ok(Math.abs(day.w-cardWidth)<.1);}
 surface.width=375;surface.height=812;paint.actions=[];lobby.draw(0,{unlocked:1,best:{}},0,{top:44,capsule:{x:281,y:50,w:87,h:32}},true);const gear=paint.actions.find(a=>a.action==='settings');assert.ok(gear.x+gear.w<=281&&gear.y>=44);
 console.log('PASS 三种屏宽大厅去上班/日期矩形与原型DOM相差小于0.1px，齿轮避让假胶囊');
 console.log('PASS 38项音效参数与冻结原型完全相同，rankDown未登记，41份mp3原字节，默认audio微信分包配置');
})().catch(e=>{console.error(e);process.exitCode=1;});
