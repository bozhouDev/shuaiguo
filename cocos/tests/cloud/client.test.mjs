import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);require('../register-cloud.cjs');
const {CloudServices,CLOUD_QUEUE_LIMIT}=require('../../assets/scripts/platform/CloudServices.ts');
const {WechatPlatform}=require('../../assets/scripts/platform/WechatPlatform.ts');
const {PlayerStore}=require('../../assets/scripts/view/PlayerStore.ts');
const {Match}=require('../../assets/scripts/core/match.ts');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
// 数据边界可控，合并/队列/白名单仍执行生产代码。
function fixture(){const disk=new Map(),calls=[];let progress={unlocked:1,best:{}},route=async(name,data)=>name==='config'?{ok:true,data:{version:0,levels:{}}}:name==='save'?{ok:true,data:data.progress||{unlocked:1,best:{}}}:{ok:true,data:{}};
  const platform={kind:'wechat',cloud:{init:async()=>true,call:async(name,data)=>{calls.push({name,data});return route(name,data);}},getStorage:k=>disk.get(k)||null,setStorage:(k,v)=>disk.set(k,v),setUserCloudStorage:async data=>{calls.push({name:'friend',data});return true;}};
  const store={read:()=>structuredClone(progress),save:p=>{progress=structuredClone(p);return true;}};
  return {disk,calls,platform,store,setRoute:f=>route=f};}

test('启动远端不阻塞缓存，白名单缓存次启动先用，本局配置保持不变',async()=>{
  const f=fixture();f.disk.set('shuaiguo_cloud_config',JSON.stringify({version:1,levels:{1:{duration:80}}}));
  let resolveConfig;f.setRoute(async(name,data)=>name==='config'?await new Promise(r=>resolveConfig=r):{ok:true,data:data.progress||{unlocked:1,best:{}}});
  const service=new CloudServices(f.platform,f.store),start=service.start();
  assert.equal(service.level(0).duration,80);const m=new Match({itemDrops:false,seed:1,levelParams:service.level(0)});
  await delay(0);resolveConfig({ok:true,data:{version:2,levels:{1:{duration:90,potLife:900}}}});await start;
  assert.equal(m.L.duration,80);assert.equal(service.level(0).duration,90);assert.equal(service.level(0).potLife,40);
  const next=new CloudServices(f.platform,f.store);assert.equal(next.level(0).duration,90);next.dispose();service.dispose();
});
test('持久队列失败保留、重启重发、发送时新事件保留、队列有界',async()=>{
  const f=fixture();f.setRoute(async()=>({ok:false,error:'offline'}));let s=new CloudServices(f.platform,f.store);
  await s.start();for(let i=0;i<230;i++)s.track('start',1,{tutorial:false});await s.flush();
  const queued=JSON.parse(f.disk.get('shuaiguo_cloud_events'));assert.equal(queued.length,CLOUD_QUEUE_LIMIT);s.dispose();
  let reply;f.setRoute(async(name,data)=>name==='track'?new Promise(r=>reply=r):{ok:false,error:'offline'});
  s=new CloudServices(f.platform,f.store);const started=s.start();await delay(0);s.track('share',1,{action:'send'});
  reply({ok:true,data:{accepted:20}});await delay(0);
  // 后续批次失败，第一批只删自己的ID；新增项仍留在持久队列。
  reply({ok:false,error:'offline'});await started;
  const after=JSON.parse(f.disk.get('shuaiguo_cloud_events'));assert.equal(after.some(e=>e.type==='share'),true);assert.equal(after.some(e=>e.id===queued[1].id),false);
  f.setRoute(async()=>({ok:true,data:{accepted:20}}));await s.flush();assert.deepEqual(JSON.parse(f.disk.get('shuaiguo_cloud_events')),[]);s.dispose();
});
test('云响应不会回滚等待中的改名/结算；防抖在途仍补传最新本地',async()=>{
  const f=fixture();let resolvePut;f.setRoute(async(name,data)=>name==='save'&&data.action==='put'?new Promise(r=>resolvePut=r):{ok:true,data:{unlocked:1,best:{}}});
  const s=new CloudServices(f.platform,f.store);await s.start();const first=s.syncSave();await delay(0);
  f.store.save({unlocked:3,best:{2:{stars:3,debt:1}},bossName:'新名',bossNameAt:20});s.progressChanged();await delay(450);
  resolvePut({ok:true,data:{unlocked:2,best:{1:{stars:3,debt:3}},bossName:'旧名',bossNameAt:10}});await first;
  f.setRoute(async(name,data)=>({ok:true,data:data.progress||{unlocked:1,best:{}}}));await delay(450);
  assert.equal(f.store.read().bossName,'新名');assert.equal(f.store.read().unlocked,3);assert.equal(f.store.read().best[1].debt,3);
  assert.equal(f.calls.filter(c=>c.name==='save'&&c.data.action==='put').length,2);s.dispose();
});
test('微信本地存储与新时间戳旧档兼容；好友KV只写最小总账和匿名数据',async()=>{
  const disk=new Map();globalThis.wx={getStorageSync:k=>disk.get(k),setStorageSync:(k,v)=>disk.set(k,v),removeStorageSync:k=>disk.delete(k)};
  const p=new WechatPlatform(),store=new PlayerStore(p);store.save({unlocked:2,best:{1:{stars:3,debt:4}},bossName:'称呼',bossNameAt:123});assert.equal(store.read().bossNameAt,123);p.dispose();delete globalThis.wx;
  const f=fixture(),s=new CloudServices(f.platform,f.store);await s.start();s.settled(1,{rank:1,stars:3,debt:2,blames:2,duration:70});await delay(0);s.settled(1,{rank:2,stars:2,debt:5,blames:4,duration:70});await delay(0);
  const kv=f.calls.filter(c=>c.name==='friend').at(-1).data;assert.deepEqual(kv,[{key:'sg_debt_v1_1',value:'{"v":1,"debt":2}'}]);s.dispose();
});
test('simulate不触发云：只接外围事件，真实core模拟不访问平台',()=>{
  const f=fixture(),s=new CloudServices(f.platform,f.store),m=new Match({itemDrops:false,seed:1,simulating:true});m.simulate(0,1,1);assert.equal(f.calls.length,0);assert.equal(f.disk.size,0);s.dispose();
});
test('离线继续使用缓存，网页不建立队列或访问任何云接口',async()=>{
  const f=fixture();f.disk.set('shuaiguo_cloud_config','{"version":1,"levels":{"1":{"duration":80}}}');f.setRoute(async()=>({ok:false,error:'offline'}));let s=new CloudServices(f.platform,f.store);await s.start();assert.equal(s.level(0).duration,80);s.dispose();
  const web=fixture();web.platform.kind='web';s=new CloudServices(web.platform,web.store);await s.start();s.track('start',1);s.progressChanged();s.settled(1,{stars:3,debt:0});await s.flush();assert.deepEqual(web.calls,[]);assert.equal(web.disk.size,0);s.dispose();
});
