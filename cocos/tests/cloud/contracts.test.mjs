import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
require('../register-cloud.cjs');
const {isBetterBest,mergeProgress}=require('../../assets/scripts/core/progress.ts');
const {sanitizeConfig,levelForMatch}=require('../../assets/scripts/core/remote-config.ts');
const {Match}=require('../../assets/scripts/core/match.ts');
const {LEVELS}=require('../../assets/scripts/core/levels.ts');
const {WechatPlatform}=require('../../assets/scripts/platform/WechatPlatform.ts');
const {WebPlatform}=require('../../assets/scripts/platform/WebPlatform.ts');

test('存档比较与core一致：星优先，总账回退旧背锅，时间戳与成就合并',()=>{
  assert.equal(isBetterBest({stars:3,debt:2},{stars:2,debt:0}),true);
  assert.equal(isBetterBest({stars:3,debt:2.5},{stars:3,blames:3}),true);
  assert.equal(isBetterBest({stars:3,debt:3},{stars:3,blames:3}),false);
  const merged=mergeProgress({unlocked:3,best:{1:{stars:3,blames:2}},bossName:'旧名',bossNameAt:10,tutDone:true,achievements:{a:true}},
    {unlocked:2,best:{1:{stars:3,debt:1.5}},bossName:'新名',bossNameAt:20,achievements:{a:false,b:true}});
  assert.equal(merged.best[1].debt,1.5);assert.equal(merged.unlocked,3);assert.equal(merged.tutDone,true);
  assert.deepEqual(merged.achievements,{a:true,b:true});assert.equal(merged.bossName,'新名');assert.equal(merged.bossNameAt,20);
  assert.equal(mergeProgress({unlocked:1,best:{},bossName:'旧存档'}, {unlocked:1,best:{}}).bossName,'旧存档');
});
test('白名单与边界过滤，开局快照不受后来配置或调用者对象变化影响',()=>{
  const c=sanitizeConfig({version:1,levels:{1:{duration:80,potLife:0,skyChance:2,startPots:999,'ai.aggr':1.1},99:{duration:100}}});
  assert.deepEqual(c,{version:1,levels:{1:{duration:80,'ai.aggr':1.1}}});
  const lv=levelForMatch(0,c),m=new Match({itemDrops:false,seed:1,level:0,levelParams:lv});
  lv.duration=99;c.levels[1].duration=100;
  assert.equal(m.L.duration,80);assert.equal(m.L.ai.aggr,1.1);
  assert.equal(new Match({itemDrops:false,seed:1}).L.duration,LEVELS[0].duration);
});
test('性能比例沿现有配置返回，缺省关、范围合法且不进入Level',()=>{
 assert.equal(sanitizeConfig({version:1,levels:{},perfSampleRate:.25}).perfSampleRate,.25);
 for(const n of [-1,2,'1',Infinity])assert.equal(sanitizeConfig({version:1,levels:{},perfSampleRate:n}).perfSampleRate,undefined);
 assert.equal(levelForMatch(0,{version:1,levels:{},perfSampleRate:1}).perfSampleRate,undefined);
});
test('微信永不返回/抛错/断网全部限时降级，迟到回调不改变结果',async()=>{
  const wx={cloud:{init(){},callFunction(){}}};globalThis.wx=wx;
  const p=new WechatPlatform();assert.equal(await p.cloud.init(),true);
  assert.deepEqual(await p.cloud.call('config',{},10),{ok:false,error:'unavailable'});
  wx.cloud.callFunction=()=>{throw Error('offline');};assert.equal((await p.cloud.call('save',{},10)).ok,false);
  wx.cloud.callFunction=({fail})=>fail({});assert.equal((await p.cloud.call('save',{},10)).ok,false);
  wx.cloud.callFunction=({success})=>success({result:{ok:true,data:{version:1}}});
  assert.deepEqual(await p.cloud.call('config',{},10),{ok:true,data:{version:1}});
  p.dispose();delete globalThis.wx;
  assert.equal(await new WebPlatform().cloud.init(),false);
});
test('微信初始化缺失/抛错、Promise拒绝和销毁期间调用均降级',async()=>{
  delete globalThis.wx;let p=new WechatPlatform();assert.equal(await p.cloud.init(),false);p.dispose();
  globalThis.wx={cloud:{init(){throw Error('offline');}}};p=new WechatPlatform();assert.equal(await p.cloud.init(),false);p.dispose();
  globalThis.wx={cloud:{init(){},callFunction(){return Promise.reject(Error('offline'));}}};p=new WechatPlatform();await p.cloud.init();assert.equal((await p.cloud.call('config',{})).ok,false);
  globalThis.wx.cloud.callFunction=()=>{};const pending=p.cloud.call('config',{});p.dispose();assert.deepEqual(await pending,{ok:false,error:'unavailable'});delete globalThis.wx;
});
