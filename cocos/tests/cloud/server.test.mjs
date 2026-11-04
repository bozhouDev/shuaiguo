import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{memoryDB,load}=require('./mock-sdk.cjs');

test('云存档：上下文身份隔离、旧档比较、并发合并、数据库故障不覆盖',async()=>{
  const db=memoryDB(),save=load('save',db);
  const put=progress=>save({action:'put',openid:'victim',progress});
  assert.equal((await put({unlocked:2,best:{1:{stars:3,blames:3}},bossName:'旧',bossNameAt:1})).ok,true);
  const r=await put({unlocked:1,best:{1:{stars:3,debt:2.5,blames:2}},bossName:'新',bossNameAt:2,tutDone:true});
  assert.equal(r.data.best[1].debt,2.5);assert.equal(r.data.bossName,'新');
  await Promise.all([put({unlocked:3,best:{2:{stars:2,debt:1}},achievements:{a:true}}),put({unlocked:2,best:{1:{stars:3,debt:1}},achievements:{b:true}})]);
  const got=(await save({action:'get'})).data;assert.equal(got.unlocked,3);assert.equal(got.best[1].debt,1);assert.equal(got.best[2].debt,1);assert.deepEqual(got.achievements,{a:true,b:true});
  assert.equal(db.tables.get('saves').has('victim'),false);
  assert.deepEqual((await load('save',db,'user-B')({action:'get'})).data,{unlocked:1,best:{}});
  assert.equal((await put({unlocked:999,best:{}})).ok,false);
  db.breakRead(true);assert.equal((await put({unlocked:1,best:{}})).ok,false);db.breakRead(false);
  assert.equal((await save({action:'get'})).data.unlocked,3);
  assert.equal((await load('save',db,'')({action:'get'})).error,'unauthenticated');
});
test('config空集合不写数值；服务端配置过滤、版本号与认证',async()=>{
  const db=memoryDB(),config=load('config',db);
  assert.deepEqual(await config({}),{ok:true,data:{version:0,levels:{}}});assert.equal(db.tables.get('config').size,0);
  await db.collection('config').doc('current').set({data:{version:2,levels:{1:{duration:80,potLife:0,skyChance:999}}}});
  assert.deepEqual((await config({})).data,{version:2,levels:{1:{duration:80}}});
});
test('track批量上限、跨实例频率限制、重试幂等及字段白名单',async()=>{
  const db=memoryDB(),track=load('track',db),base=Date.now();
  const batch=n=>Array.from({length:n},(_,i)=>({id:'e'+i,type:'finish',level:1,at:base,debt:3,bossName:'不能上报',evil:{payload:1}}));
  assert.deepEqual((await track({events:batch(25)})).data,{accepted:20,duplicates:0,dropped:5});
  assert.deepEqual((await track({events:batch(250)})).data,{accepted:0,duplicates:20,dropped:230});
  assert.equal(db.tables.get('events').size,20);const row=[...db.tables.get('events').values()][0];assert.equal(row.bossName,undefined);assert.equal(row.evil,undefined);
  assert.equal((await track({events:batch(20)})).data.duplicates,20);
  for(let n=1;n<=5;n++)await load('track',db)({events:batch(20).map(v=>({...v,id:v.id+'_'+n}))});
  assert.equal(db.tables.get('events').size,120);assert.equal((await track({events:batch(20).map(v=>({...v,id:v.id+'_x'}))})).data.accepted,0);
  assert.equal((await load('track',db,'other')({events:batch(1)})).data.accepted,1);
});
test('perf单独入库、严格字段白名单、幂等和大小上限',async()=>{
 const db=memoryDB(),track=load('track',db);
 const event={id:'perf_1',type:'perf',level:5,at:Date.now(),v:1,reason:'finish',start:0,end:120,capEnabled:true,device:{brand:'Apple',model:'iPhone mock',system:'iOS mock',platform:'ios',sdkVersion:'3.0',benchmarkLevel:null,modelLevel:2,nickname:'不收集'},segments:[{kind:'period',start:0,end:30,frames:100,pots:20,interval:50,worst5:100,logic:.5,draw:5,drawCalls:null,graphics:50,sprites:60,labels:40,targetFps:60,dpr:2,width:786,height:1704,evil:'no'}],bossName:'不收集'};
 assert.equal((await track({events:[event]})).data.accepted,1);
 assert.equal(db.tables.get('events').size,0);assert.equal(db.tables.get('perf').size,1);
 const row=[...db.tables.get('perf').values()][0];assert.equal(row.openid,undefined);assert.equal(row.bossName,undefined);assert.equal(row.device.nickname,undefined);assert.equal(row.segments[0].evil,undefined);assert.equal(row.segments[0].drawCalls,null);
 assert.equal((await track({events:[event]})).data.duplicates,1);
 for(const change of [{id:'bad',device:{model:'x'.repeat(17000)}},{id:'bad',segments:Array(17).fill(event.segments[0])},{id:'bad',segments:[{...event.segments[0],interval:Infinity}]},{id:'bad',v:2}])assert.equal((await track({events:[{...event,...change}]})).data.accepted,0);
});
test('rank每关最好成绩、范围与星级校验、前50及榜外我的名次、匿名隔离',async()=>{
  const db=memoryDB(),rank=load('rank',db);
  const score={rank:1,stars:3,debt:5,blames:4,duration:70};
  assert.equal((await rank({action:'submit',level:1,score})).data.updated,true);
  assert.equal((await rank({action:'submit',level:1,score:{...score,debt:6}})).data.updated,false);
  for(const bad of [{stars:2},{rank:0},{rank:4},{duration:2},{duration:Infinity},{debt:100000},{debt:1},{debt:4.2},{blames:-1},{blames:1.5}])assert.equal((await rank({action:'submit',level:1,score:{...score,...bad}})).ok,false,JSON.stringify(bad));
  assert.equal((await rank({action:'submit',level:5,score:{...score,rank:2,duration:120,stars:2}})).ok,false);
  for(let i=0;i<55;i++)await load('rank',db,'other-'+i)({action:'submit',level:1,score:{...score,debt:0,blames:0}});
  const top=(await rank({action:'top',level:1})).data;assert.equal(top.top.length,50);assert.equal(top.myRank,56);assert.equal(top.top[0].position,1);assert.match(top.mine.name,/^打工人#[a-f0-9]{4}$/);assert.equal(JSON.stringify(top).includes('openid'),false);
  assert.equal((await rank({action:'submit',level:1,score:{...score,debt:0,blames:0}})).data.updated,true);
  assert.equal((await rank({action:'top',level:1})).data.myRank,1);
});
