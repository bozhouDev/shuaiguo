import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{load,cc,textures}=require('./view-harness.cjs');
const {AppView}=load('cocos/assets/scripts/view/AppView'),{WechatPlatform}=load('cocos/assets/scripts/platform/WechatPlatform'),{AudioView}=load('cocos/assets/scripts/view/AudioView'),{WechatShareCapture}=load('cocos/assets/scripts/view/WechatShareCapture'),{Match}=load('cocos/assets/scripts/core/match');
const turn=()=>new Promise(r=>setImmediate(r));
// 只替换设备画笔和无关外围状态，不复制App的广告/后台/分享实现。
function appHost(platform){return Object.assign(Object.create(AppView.prototype),{rank:{hide(){}},alive:true,ready:true,serial:2,real:0,platform,screen:'play',panel:'',params:new URLSearchParams(),debug:{resetTaps(){}},audio:{hidden(){},bgm(){},unlock(){},sfx(){}},praise:{clear(){}},cloud:{track(){},background(){},foreground(){}},removeEdit(){},render(){},messages:{event(){}},heights:{},paint:{},scroll:0});}
test('真实App/World wx后台暂停不自动继续，清输入并上传队列；前台首帧不补跑',()=>{
 const events={};globalThis.wx={onHide:f=>events.hide=f,onShow:f=>events.show=f};const platform=new WechatPlatform(),app=appHost(platform),m=new Match({itemDrops:false,seed:1});let background=0,foreground=0,clears=0;app.cloud.background=()=>background++;app.cloud.foreground=()=>foreground++;
 const {WorldView}=load('cocos/assets/scripts/view/WorldView');const world=Object.assign(Object.create(WorldView.prototype),{match:m,controls:{clear(){clears++;}},options:{onHidden:h=>app.audio.hidden(h)}});app.world=world;app.world.clearInput=()=>{clears++;};const off=platform.onLifecycle({hide:()=>{app.hide();world.hide();},show:()=>{app.show();world.show();}});
 try{events.hide();assert.equal(app.panel,'pause');assert.equal(world.paused,true);assert.equal(world.hidden,true);assert.ok(clears>=2);assert.equal(background,1);events.show();assert.equal(foreground,1);assert.equal(app.panel,'pause');assert.equal(world.paused,true);assert.equal(world.hidden,false);assert.equal(world.skipFrame,true);}finally{off();platform.dispose();delete globalThis.wx;}
});
test('真实App奖励调用受结算/实例/场景约束，三个用途分别成功、失败及切局迟到不奖',async()=>{
 for(const action of ['revive','rescue','buff'])for(const ok of [false,true]){
  let resolve,rewards=0;const app=appHost({kind:'wechat',showRewardedAd:()=>new Promise(r=>resolve=r)}),m={L:{id:1},revive(){rewards++;},rescue(){rewards++;}};app.result={diag:{buff:'trip'},ads:{rescue:true}};app.world={match:m,clearInput(){},flush(){},ui:{closing:{}}};app.startGame=async(_t,buff)=>{assert.equal(buff,'trip');rewards++;};
  const pending=app.ad(action);resolve(ok);await pending;assert.equal(rewards,ok?1:0,action);if(!ok)assert.equal(app.panel,'result');
 }
 let complete,rewards=0;const app=appHost({kind:'wechat',showRewardedAd:()=>new Promise(r=>complete=r)}),m={L:{id:1},revive(){rewards++;}};app.world={match:m,clearInput(){}};app.result={};const pending=app.ad('revive');app.serial++;complete(true);await pending;assert.equal(rewards,0);
});
test('分享真实App标题固定老板称呼，预览仍保留自定义文案，无奖励或进度写入',()=>{
 let request;const app=appHost({kind:'wechat',share:r=>request=r});app.panel='share';app.result={shareInfo:{kind:'brag',day:'周三',rank:1,nephewCrushed:true,nephewReport:'今天我把王总小舅子压垮了'}};app.world={match:{L:{id:3},S:{player:{piesEaten:2}}},clearInput(){}};app.capture={capture:async()=>''};app.action('send');assert.equal(request.title,'今天我把老板小舅子压垮了');assert.equal(app.result.shareInfo.nephewReport,'今天我把王总小舅子压垮了');const {ShareView}=load('cocos/assets/scripts/view/ShareView');assert.equal(new ShareView({}).wechatTitle({kind:'blame',crushed:true,nephewCrushed:false,nephewReport:'王总小舅子今天背锅 0 次，第一个下班',pieReport:'今天吃了王总 2 张饼'},2),'我被锅压垮了，剩下这口急件你来背\n老板小舅子今天背锅 0 次，第一个下班\n今天吃了老板 2 张饼');assert.equal(request.valid(),true);app.serial++;assert.equal(request.valid(),false);
});
test('真实AudioView微信只解析Bundle URL不加载41个AudioClip，连甩/双响倍速和设置开关生效',async()=>{
 const instances=[],plays=[];globalThis.wx={createInnerAudioContext(){const a={currentTime:0,play(){plays.push({src:a.src,rate:a.playbackRate});},pause(){},stop(){},destroy(){a.destroyed=true;},onEnded(){},onError(){}};instances.push(a);return a;}};
 const bundle={getInfoWithPath:id=>({uuid:id}),load(){throw Error('微信不应预载AudioClip播放器');}};cc.assetManager.loadBundle=(_n,cb)=>cb(null,bundle);cc.assetManager.utils={getUrlWithUuid:(id)=>'subpackages/audio/'+id+'.mp3'};
 const platform=new WechatPlatform(),settings={music:true,sfx:true},audio=new AudioView(new cc.Node(),platform,settings);
 try{audio.bgm('work',true);audio.unlock();await turn();audio.sfx('combo',{rate:1.4});audio.sfx('tickUrgent');await new Promise(r=>setTimeout(r,120));assert.ok(plays.some(x=>x.src.endsWith('sfx_combo.mp3')&&x.rate===1.4));assert.deepEqual(plays.filter(x=>x.src.endsWith('sfx_tick.mp3')).map(x=>x.rate),[1.35,1.5120000000000002]);assert.ok(instances.length<=8);settings.sfx=false;const before=plays.length;audio.sfx('whoosh');await turn();assert.equal(plays.length,before);assert.equal(audio.context,null);
 }finally{audio.destroy();platform.dispose();assert.ok(instances.every(x=>x.destroyed));delete globalThis.wx;}
});
test('真实离屏分享生成5:4 RenderTexture，2帧后导出并释放；读取失败和取消同样释放',async()=>{
 globalThis.wx={createCanvas:()=>({getContext:()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}}),toTempFilePathSync:()=> 'wxfile://result.png'})};
 const scene=new cc.Node('Scene'),assets={spr:{}},info={kind:'blame',crushed:true},capture=new WechatShareCapture();
 try{let pending=capture.capture(scene,assets,info),tex=textures.at(-1);assert.equal(tex.width,500);assert.equal(tex.height,400);cc.director.emit('draw');cc.director.emit('draw');assert.equal(await pending,'wxfile://result.png');assert.ok(tex.destroyed);assert.equal(cc.director.listenerCount('draw'),0);
 pending=capture.capture(scene,assets,info);tex=textures.at(-1);tex.readPixels=()=>null;cc.director.emit('draw');cc.director.emit('draw');await assert.rejects(pending);assert.ok(tex.destroyed);
 pending=capture.capture(scene,assets,info);tex=textures.at(-1);tex.readPixels=()=>new Uint8Array(500*400*4);cc.director.emit('draw');cc.director.emit('draw');await assert.rejects(pending);assert.ok(tex.destroyed);
 pending=capture.capture(scene,assets,info);tex=textures.at(-1);capture.dispose();await assert.rejects(pending);assert.ok(tex.destroyed);assert.equal(cc.director.listenerCount('draw'),0);
 }finally{capture.dispose();delete globalThis.wx;}
});
test('微信启动分包失败保留加载卡，点击可重试，资源失败同样回到可重试状态',async()=>{
 const {WechatPackages}=load('cocos/assets/scripts/platform/WechatPackages');let fail=true;globalThis.wx={loadSubpackage(o){queueMicrotask(()=>fail?o.fail():o.success());return {};}};const app=appHost({kind:'wechat'}),labels=[{string:''},{string:''}];Object.assign(app,{ready:false,screen:'loading',packages:new WechatPackages(async()=>{}),assets:{load:async()=>{}},loading:{active:true,getComponentsInChildren:()=>labels},store:{read:()=>({unlocked:1,best:{}})},showLobby(){this.screen='lobby';},exposeDebug(){}});app.cloud.start=async()=>{};
 try{await app.start();assert.equal(app.ready,false);assert.equal(app.loading.active,true);assert.equal(labels[1].string,'请点击重试');fail=false;app.down({});await turn();assert.equal(app.ready,true);assert.equal(app.screen,'lobby');assert.equal(app.loading.active,false);
 app.ready=false;app.loading.active=true;app.assets.load=async()=>{throw Error();};await app.start();assert.equal(app.loadingError,true);assert.equal(app.loading.active,true);
 }finally{app.packages.dispose();delete globalThis.wx;}
});
test('wx.onHide接真实CloudServices：持久事件队列发送后按ID清除',async()=>{
 const callbacks={},calls=[],disk=new Map();globalThis.wx={getStorageSync:k=>disk.get(k),setStorageSync:(k,v)=>disk.set(k,v),onHide:f=>callbacks.hide=f,cloud:{init(){},callFunction({name,data,success}){calls.push({name,data});queueMicrotask(()=>success({result:{ok:true,data:name==='save'?(data.progress||{unlocked:1,best:{}}):name==='config'?{version:0,levels:{}}:{accepted:1}}}));}}};
 const p=new WechatPlatform(),{PlayerStore}=load('cocos/assets/scripts/view/PlayerStore'),{CloudServices}=load('cocos/assets/scripts/platform/CloudServices'),service=new CloudServices(p,new PlayerStore(p)),app=appHost(p);app.cloud=service;app.screen='lobby';const off=p.onLifecycle({hide:()=>app.hide(),show:()=>app.show()});
 try{await service.start();service.track('share',1,{action:'send'});assert.equal(JSON.parse(disk.get('shuaiguo_cloud_events')).length,1);callbacks.hide();await turn();assert.ok(calls.some(x=>x.name==='track'&&x.data.events[0].type==='share'));assert.deepEqual(JSON.parse(disk.get('shuaiguo_cloud_events')),[]);}finally{off();service.dispose();p.dispose();delete globalThis.wx;}
});
test('真实震动设置关闭时不调用wx；真实安全区换算后的HUD矩形避开胶囊',()=>{
 const vibrates=[],cases=require('./device-fixtures.json');const {DrawSurface}=load('cocos/assets/scripts/view/DrawSurface'),{UiPaint}=load('cocos/assets/scripts/view/UiPaint'),{HudView}=load('cocos/assets/scripts/view/HudView');
 for(const row of cases){globalThis.wx={getWindowInfo:()=>({windowWidth:row.w,safeArea:{top:row.top}}),getMenuButtonBoundingClientRect:()=>row.c,vibrateShort:()=>vibrates.push(1)};const p=new WechatPlatform();try{const app=appHost(p);app.store={settings:{vibrate:false}};app.buzz(40);assert.equal(vibrates.length,0);const c=new DrawSurface(new cc.Node(),{spr:{}}),hud=new HudView(new UiPaint(c)),m=new Match({itemDrops:false,seed:1}),avoid=p.topAvoidance();c.begin();hud.draw(m,0,avoid);c.end();for(const box of Object.values(hud.boxes)){const cap=avoid.capsule;assert.ok(box.x+box.w<=cap.x||box.x>=cap.x+cap.w||box.y+box.h<=cap.y||box.y>=cap.y+cap.h);}}finally{p.dispose();delete globalThis.wx;}}
});
