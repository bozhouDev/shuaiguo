import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);require('../register-cloud.cjs');
const {WechatPlatform}=require('../../assets/scripts/platform/WechatPlatform.ts');
const {PlayerStore}=require('../../assets/scripts/view/PlayerStore.ts');
const turn=()=>new Promise(r=>setImmediate(r));
// 只mock设备API：所有存档、广告和坐标判断执行生产实现；mock-only不是广告位ID。
function fixture(extra={},id='mock-only'){
 const events={},sent=[],buzz=[],disk=new Map();let destroyed=0,loads=0,shows=0;
 const ad={load:async()=>{loads++;},show:async()=>{shows++;},onClose:f=>events.close=f,offClose:f=>{if(events.close===f)delete events.close;},onError:f=>events.error=f,offError:f=>{if(events.error===f)delete events.error;},destroy:()=>destroyed++};
 globalThis.wx={getStorageSync:k=>disk.get(k),setStorageSync:(k,v)=>disk.set(k,v),removeStorageSync:k=>disk.delete(k),createRewardedVideoAd:()=>ad,
  showShareMenu:o=>sent.push(o),onShareAppMessage:f=>events.friend=f,offShareAppMessage(){},onShareTimeline:f=>events.timeline=f,offShareTimeline(){},shareAppMessage:o=>sent.push(o),
  onHide:f=>events.hide=f,offHide:f=>{if(events.hide===f)delete events.hide;},onShow:f=>events.show=f,offShow:f=>{if(events.show===f)delete events.show;},onAudioInterruptionBegin:f=>events.begin=f,offAudioInterruptionBegin(){},onAudioInterruptionEnd:f=>events.end=f,offAudioInterruptionEnd(){},
  vibrateShort:o=>buzz.push(o.type),vibrateLong:()=>buzz.push('long'),...extra};
 const p=new WechatPlatform(id);return {p,events,sent,buzz,disk,ad,get loads(){return loads;},get shows(){return shows;},get destroyed(){return destroyed;},done(){p.dispose();delete globalThis.wx;}};
}
test('存储保留JSON字节/键名，读异常空档，普通写失败静默、改名和清档仍可报告失败',()=>{
 const f=fixture();try{const s=new PlayerStore(f.p),old={unlocked:3,best:{1:{stars:2,blames:4}},bossName:'王总'};s.save(old);assert.equal(f.disk.get('shuaiguo_v3'),JSON.stringify(old));assert.deepEqual(s.read(),old);s.set('music',false);assert.equal(JSON.parse(f.disk.get('shuaiguo_settings')).music,false);
 globalThis.wx.getStorageSync=()=>{throw Error();};assert.deepEqual(s.read(),{unlocked:1,best:{}});globalThis.wx.setStorageSync=()=>{throw Error();};assert.equal(s.save(old),false);assert.doesNotThrow(()=>s.set('sfx',false));globalThis.wx.removeStorageSync=()=>{throw Error();};assert.equal(s.clear(),false);
 }finally{f.done();}
});
test('空广告配置不创建实例、不发奖；创建/load/show/onError/关闭缺字段均无奖励',async()=>{
 for(const stage of ['empty','create','load','show','error','early','missing']){
  const f=fixture({},stage==='empty'?'':'mock-only');try{
   if(stage==='create')globalThis.wx.createRewardedVideoAd=()=>{throw Error();};if(stage==='load')f.ad.load=async()=>{throw Error();};if(stage==='show')f.ad.show=async()=>{throw Error();};
   const result=f.p.showRewardedAd();await turn();if(stage==='error')f.events.error({errCode:1});if(stage==='early')f.events.close({isEnded:false});if(stage==='missing')f.events.close();
   assert.equal(await result,false,stage);if(stage==='empty')assert.equal(f.loads,0);
  }finally{f.done();}
 }
});
test('广告仅完整结束发奖，重复点击拒绝、show完成不算奖励，销毁拒绝迟到结果',async()=>{
 const f=fixture();try{const focus=[];f.p.onAudioFocus((reason,on)=>focus.push([reason,on]));let settled=false;const first=f.p.showRewardedAd().then(ok=>{settled=true;return ok;});assert.equal(await f.p.showRewardedAd(),false);await turn();assert.equal(settled,false);assert.equal(f.loads,1);assert.equal(f.shows,1);f.events.close({isEnded:true});assert.equal(await first,true);assert.deepEqual(focus,[['ad',true],['ad',false]]);
 const second=f.p.showRewardedAd();await turn();const late=f.events.close;f.p.dispose();late({isEnded:true});assert.equal(await second,false);assert.equal(f.destroyed,1);
 }finally{f.done();}
});
test('生命周期和音频中断原样通知，销毁解除监听；环境只允许develop/trial',()=>{
 const f=fixture();try{const calls=[];f.p.onLifecycle({hide:()=>calls.push('hide'),show:()=>calls.push('show')});f.p.onAudioFocus((r,on)=>calls.push([r,on]));f.events.hide();f.events.show();f.events.begin();f.events.end();assert.deepEqual(calls,['hide','show',['interruption',true],['interruption',false]]);for(const env of ['develop','trial','release','unknown']){globalThis.wx.getAccountInfoSync=()=>({miniProgram:{envVersion:env}});assert.equal(f.p.debugEnabled(),['develop','trial'].includes(env));}globalThis.wx.getAccountInfoSync=()=>{throw Error();};assert.equal(f.p.debugEnabled(),false);f.p.dispose();assert.equal(f.events.hide,undefined);
 }finally{f.done();}
});
test('震动30/35/40轻、60中、80重、200长；非正数不震',()=>{
 const f=fixture();try{for(const ms of [30,35,40,60,80,200,0,-1,NaN])f.p.vibrate(ms);assert.deepEqual(f.buzz,['light','light','light','medium','heavy','long']);}finally{f.done();}
});
test('胶囊与安全区按375/windowWidth转换，DPR不参与，API异常保守占位',()=>{
 // 胶囊来自原作者公开的历史实测，安全区top按对应状态栏构造；另含两组边界夹具。
 const cases=require('./device-fixtures.json');
 for(const row of cases){const f=fixture({getWindowInfo:()=>({windowWidth:row.w,windowHeight:812,pixelRatio:3,safeArea:{top:row.top}}),getMenuButtonBoundingClientRect:()=>row.c});try{const actual=f.p.topAvoidance(),s=375/row.w;assert.deepEqual(actual,{top:row.top*s,capsule:{x:row.c.left*s,y:row.c.top*s,w:row.c.width*s,h:row.c.height*s}});}finally{f.done();}}
 const f=fixture({getWindowInfo:()=>{throw Error();}});try{assert.deepEqual(f.p.topAvoidance(),{top:44,capsule:{x:281,y:50,w:87,h:32}});}finally{f.done();}
});
test('菜单好友+朋友圈默认内容；导图失败回默认图、迟到分享不会发给新对局',async()=>{
 const f=fixture();try{assert.deepEqual(f.sent[0].menus,['shareAppMessage','shareTimeline']);assert.equal(f.events.friend().title,'这锅你来背');assert.equal(f.events.timeline().imageUrl,'share-default.png');f.p.share({title:'我第 1 名准点下班',image:async()=>{throw Error();}});await turn();assert.equal(f.sent.at(-1).imageUrl,'share-default.png');assert.equal(f.sent.at(-1).title,'我第 1 名准点下班');let finish;let valid=true;f.p.share({title:'旧局',image:()=>new Promise(r=>finish=r),valid:()=>valid});valid=false;finish('temp.png');await turn();assert.equal(f.sent.some(x=>x.title==='旧局'),false);
 }finally{f.done();}
});
test('广告SDK漏回调超时不发奖，迟到load不会展示；正常结束后同实例可再次使用',async t=>{
 const f=fixture();t.mock.timers.enable({apis:['setTimeout']});try{let loaded;f.ad.load=()=>new Promise(r=>loaded=r);const first=f.p.showRewardedAd();t.mock.timers.tick(120000);assert.equal(await first,false);loaded();await Promise.resolve();assert.equal(f.shows,0);assert.equal(f.destroyed,1);}finally{f.done();t.mock.timers.reset();}
 const next=fixture();try{for(let i=0;i<2;i++){const p=next.p.showRewardedAd();await turn();next.events.close({isEnded:true});assert.equal(await p,true);}assert.equal(next.destroyed,0);assert.equal(next.shows,2);}finally{next.done();}
});
