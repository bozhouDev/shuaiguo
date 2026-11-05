import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);require('../register-cloud.cjs');
const {WechatPackages}=require('../../assets/scripts/platform/WechatPackages.ts');
const {WechatAudio}=require('../../assets/scripts/platform/WechatAudio.ts');
const {sharePixelsToFile}=require('../../assets/scripts/platform/WechatShareImage.ts');
// 原生实例只记录设备播放操作；池管理、互斥和淡入淡出均使用真实实现。
function audioFixture(){const instances=[],plays=[];globalThis.wx={createInnerAudioContext(){const a={volume:1,currentTime:0,play(){plays.push({url:a.src,rate:a.playbackRate,volume:a.volume,start:a.startTime});a.playing=true;},pause(){a.playing=false;},stop(){a.playing=false;},destroy(){a.destroyed=true;},onEnded(fn){a.ended=fn;},onError(fn){a.error=fn;}};instances.push(a);return a;}};return {instances,plays};}
test('原生音效池六路，倍速/音量/静音键保留，满池复用，错误释放并销毁全部',()=>{
 const f=audioFixture(),audio=new WechatAudio();try{for(let i=0;i<20;i++)audio.sfx('combo.mp3',.4,1+i*.04);assert.equal(f.instances.length,6);assert.equal(f.plays.length,20);assert.equal(f.plays.at(-1).rate,1.76);assert.equal(f.plays.at(-1).volume,.4);assert.ok(f.instances.every(a=>a.obeyMuteSwitch===true));f.instances[0].error();audio.sfx('hit.mp3',.5,9);assert.equal(f.plays.at(-1).rate,2);assert.equal(f.instances.length,6);
 }finally{audio.dispose();assert.ok(f.instances.every(a=>a.destroyed));delete globalThis.wx;}
});
test('BGM后台/广告/来电交错只最后一把锁释放才恢复；停止状态不被onShow误恢复',()=>{
 const f=audioFixture(),audio=new WechatAudio();try{audio.bgm('work','work.mp3',true);let bg=f.instances[0];bg.currentTime=12;audio.blocked('ad',true);assert.equal(bg.playing,false);audio.blocked('interruption',true);audio.blocked('background',true);audio.blocked('ad',false);audio.blocked('background',false);assert.equal(bg.playing,false);audio.blocked('interruption',false);assert.equal(bg.playing,true);assert.equal(f.plays.at(-1).url,'work.mp3');audio.blocked('background',true);audio.bgm(null);const before=f.plays.length;audio.blocked('background',false);assert.equal(f.plays.length,before);audio.bgm('work','work.mp3');assert.equal(f.plays.at(-1).start,12);audio.bgm('work','work.mp3',true);assert.equal(f.plays.at(-1).start,0);for(let i=0;i<30;i++)audio.bgm(i%2?'work':'rush',i%2?'work.mp3':'rush.mp3');assert.ok(f.instances.length<=2);
 }finally{audio.dispose();delete globalThis.wx;}
});
// 清账副本已预渲染加速，原生播放保持1倍，新局必须清掉上一局清账位置。
test('清账BGM副本不二次加速；新局和广告恢复不沿用上一局清账位置',()=>{
 const f=audioFixture(),audio=new WechatAudio();try{audio.bgm('clearing','clearing.mp3');f.instances[0].currentTime=9;audio.bgm('work','work.mp3',true);audio.bgm('clearing','clearing.mp3');assert.equal(f.plays.at(-1).start,0);assert.equal(f.plays.at(-1).rate,1);audio.blocked('ad',true);audio.blocked('ad',false);assert.equal(f.plays.at(-1).url,'clearing.mp3');assert.ok(f.instances.length<=2);}finally{audio.dispose();delete globalThis.wx;}
});
test('原生音效在广告/中断期间不播放，API缺失静默',()=>{
 const f=audioFixture(),audio=new WechatAudio();try{audio.blocked('ad',true);assert.equal(audio.sfx('a',1,1),false);assert.equal(f.plays.length,0);audio.blocked('ad',false);assert.equal(audio.sfx('a',1,1),true);}finally{audio.dispose();delete globalThis.wx;}const missing=new WechatAudio();assert.equal(missing.sfx('a',1,1),false);missing.dispose();
});
test('RenderTexture像素翻行导出PNG；画布/像素/导出失败会抛给分享固定图降级',()=>{
 let actual,options;globalThis.wx={createCanvas:()=>({getContext:()=>({createImageData:()=>({data:new Uint8ClampedArray(16)}),putImageData:i=>actual=[...i.data]}),toTempFilePathSync:o=>{options=o;return 'wxfile://share.png';}})};
 try{const input=Uint8Array.from([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16]);assert.equal(sharePixelsToFile(input,2,2),'wxfile://share.png');assert.deepEqual(actual,[9,10,11,12,13,14,15,16,1,2,3,4,5,6,7,8]);assert.equal(options.fileType,'png');assert.equal(options.destWidth,2);assert.throws(()=>sharePixelsToFile(new Uint8Array(),2,2));globalThis.wx.createCanvas=()=>{throw Error();};assert.throws(()=>sharePixelsToFile(input,2,2));}finally{delete globalThis.wx;}
});
test('分包原生进度、下载失败自动重试一次、Cocos注册失败重试、成功缓存',async()=>{
 let calls=0,registers=0;const progress=[];globalThis.wx={loadSubpackage(o){calls++;queueMicrotask(()=>calls===1?o.fail():o.success());return {onProgressUpdate(fn){fn({progress:42});}};}};const p=new WechatPackages(async()=>{registers++;});try{await p.load('resources',(n,v)=>progress.push([n,v]));assert.equal(calls,2);assert.equal(registers,1);assert.ok(progress.some(x=>x[1]===42));await p.load('resources');assert.equal(calls,2);}finally{p.dispose();}
 let c=0;const q=new WechatPackages(async()=>{if(++c===1)throw Error();});try{await q.load('audio');assert.equal(c,2);}finally{q.dispose();delete globalThis.wx;}
});
test('分包连续失败给手动重试机会；销毁结算等待，迟到进度不更新UI',async()=>{
 let calls=0,late;globalThis.wx={loadSubpackage(o){calls++;queueMicrotask(o.fail);return {onProgressUpdate(){}};}};const p=new WechatPackages(async()=>{});try{await assert.rejects(p.load('audio'));assert.equal(calls,2);globalThis.wx.loadSubpackage=o=>{queueMicrotask(o.success);return {};};await p.load('audio');}finally{p.dispose();}
 const values=[],q=new WechatPackages(async()=>{});globalThis.wx.loadSubpackage=()=>({onProgressUpdate(fn){late=fn;}});const pending=q.load('resources',(n,v)=>values.push(v));q.dispose();await assert.rejects(pending);late({progress:100});assert.deepEqual(values,[0]);delete globalThis.wx;
});
test('分包注册漏回调也有30秒界限，销毁取消注册等待',async t=>{
 globalThis.wx={loadSubpackage(o){queueMicrotask(o.success);return {};}};const p=new WechatPackages(()=>new Promise(()=>{}));t.mock.timers.enable({apis:['setTimeout']});try{const result=p.load('audio');const check=assert.rejects(result);await Promise.resolve();await Promise.resolve();t.mock.timers.tick(30000);for(let i=0;i<8;i++)await Promise.resolve();t.mock.timers.tick(30000);await check;}finally{p.dispose();t.mock.timers.reset();delete globalThis.wx;}
});
