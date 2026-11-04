const {test}=require('node:test'),assert=require('node:assert/strict');
const {load,cc}=require('./wechat/view-harness.cjs');
// 引擎边界保留事件上下文，实际采样/分段/App收尾/持久队列代码均真实执行。
function fixture(){
 const callbacks=new Map();cc.director={root:{device:{numDrawCalls:42}},on(k,f,t){callbacks.set(f,()=>f.call(t));},off(k,f){callbacks.delete(f);},emit(){for(const f of callbacks.values())f();}};
 cc.view.getDevicePixelRatio=()=>2;cc.game.canvas={width:750,height:1624};cc.game.frameRate=60;
 const world={ready:true,match:{S:{t:0,agents:[1,2],flying:[1],throws:[1]},mode:'play',potsOf:()=>3}};
 let scans=0;const app={world,screen:'play',panel:'',parent:{getComponentsInChildren(){scans++;return [{node:{activeInHierarchy:true}}];}}};
 return {app,world,callbacks,scans:()=>scans};
}
test('大厅动画持续60帧，介绍/稳定结算/排行15帧，入场和toast60帧',()=>{
 const {AppView}=load('cocos/assets/scripts/view/AppView');
 const app=Object.assign(Object.create(AppView.prototype),{ready:true,real:20,screen:'lobby',panel:'',store:{revision:0},messages:{toastAt:-Infinity,toastUntil:-Infinity},lobby:{frameKey:()=>''},rank:{frameKey:()=>''},reduced:()=>false,render(){}});
 cc.game.frameRate=15;app.update(1/60);assert.equal(cc.game.frameRate,60);
 for(const screen of ['intro','rank']){app.screen=screen;app.update(1/60);assert.equal(cc.game.frameRate,15);}
 app.screen='play';app.panel='result';app.panelAt=app.real;app.update(1/60);assert.equal(cc.game.frameRate,60);
 app.real+=1;app.update(1/60);assert.equal(cc.game.frameRate,15);
 app.messages.toastAt=app.real;app.messages.toastUntil=app.real+1;app.update(1/60);assert.equal(cc.game.frameRate,60);
});
test('自动采样开局10秒、30秒段和实际最后10秒，暂停剔除、只段末扫描且释放',()=>{
 const f=fixture(),{PerfTelemetry}=load('cocos/assets/scripts/view/PerfTelemetry');
 const clock=global.performance;let now=1;global.performance={now:()=>now};
 const p=new PerfTelemetry(f.app,f.world,{model:'mock'},true);
 try{
  for(let i=1;i<=7200;i++){
   f.world.match.S.t=i/60;now+=i%100===0?100:16;p.logic=.2;p.draw=2;cc.director.emit();
   if(i===600){f.app.panel='pause';now+=10000;cc.director.emit();f.app.panel='';}
   if(i===100)assert.equal(f.scans(),0,'不能每帧遍历节点');
  }
  const out=p.finish('finish');assert.equal(p.finish('finish'),null);assert.equal(f.callbacks.size,0);assert.equal(f.world.perf,undefined);
  const first=out.segments.find(s=>s.kind==='first'),periods=out.segments.filter(s=>s.kind==='period'),last=out.segments.find(s=>s.kind==='last');
  assert.equal(first.start,0);assert.equal(first.end,10);assert.equal(periods.length,4);assert.equal(periods[3].end,120);assert.equal(last.start,110);assert.equal(last.end,120);
  assert.equal(first.pots,8);assert.equal(first.drawCalls,42);assert.equal(first.dpr,2);assert.equal(first.width,750);assert.equal(first.graphics,1);assert.ok(Math.abs(first.logic-.2)<1e-10);assert.equal(first.draw,2);
  assert.ok(first.interval<20,'暂停10000ms不得进入慢帧');assert.ok(first.worst5>first.interval);assert.ok(f.scans()<=3*out.segments.length);assert.equal(p.tail.length,0);
 }finally{p.finish('destroy');global.performance=clock;}
});
test('提前退出尾段贴近实际终点、不可用draw call保留null，设备字段不读昵称',()=>{
 const f=fixture(),{PerfTelemetry}=load('cocos/assets/scripts/view/PerfTelemetry');delete cc.director.root.device;
 const clock=global.performance;let now=1;global.performance={now:()=>now};
 const p=new PerfTelemetry(f.app,f.world,{},false);
 try{for(let i=1;i<=90;i++){f.world.match.S.t=i/10;now+=100;cc.director.emit();}const out=p.finish('background');assert.equal(out.end,9);assert.equal(out.segments.at(-1).start,0);assert.equal(out.segments.at(-1).drawCalls,null);}
 finally{p.finish('destroy');global.performance=clock;}
});
test('App后台收尾先把perf放入真实持久队列；重复退出不再上报',()=>{
 const f=fixture(),disk=new Map();global.wx={getDeviceInfo:()=>({brand:'mock',model:'test',nickname:'私密'}),getAppBaseInfo:()=>({SDKVersion:'3.0'}),getDeviceBenchmarkInfo:({success})=>success({benchmarkLevel:30,modelLevel:2}),getAccountInfoSync:()=>({miniProgram:{envVersion:'trial'}})};
 const {WechatPlatform}=load('cocos/assets/scripts/platform/WechatPlatform'),platform=new WechatPlatform();
 const {CloudServices}=load('cocos/assets/scripts/platform/CloudServices'),{AppView}=load('cocos/assets/scripts/view/AppView');platform.getStorage=k=>disk.get(k)||null;platform.setStorage=(k,v)=>disk.set(k,v);
 const cloud=new CloudServices(platform,{read:()=>({unlocked:1,best:{}}),save:()=>true});
 const app=Object.assign(Object.create(AppView.prototype),f.app,{platform,cloud});f.world.match.L={id:5};
 try{app.startPerformance();assert.ok(app.telemetry);app.finishPerformance('background');app.finishPerformance('exit');const q=JSON.parse(disk.get('shuaiguo_cloud_events'));assert.equal(q.length,1);assert.equal(q[0].type,'perf');assert.equal(q[0].reason,'background');assert.equal(q[0].device.modelLevel,2);assert.equal(q[0].device.nickname,undefined);assert.equal(f.callbacks.size,0);}
 finally{cloud.dispose();platform.dispose();delete global.wx;}
});
test('网页不采样，正式版默认关闭；远程比例可开关，开发体验版默认开启',()=>{
 const {CloudServices}=load('cocos/assets/scripts/platform/CloudServices');
 for(const [kind,debug,rate,want] of [['web',true,1,false],['wechat',false,undefined,false],['wechat',false,0,false],['wechat',false,1,true],['wechat',true,0,true]]){
  const s=new CloudServices({kind,debugEnabled:()=>debug,getStorage:()=>JSON.stringify({version:1,levels:{},perfSampleRate:rate})},{read:()=>({unlocked:1,best:{}}),save(){}});
  assert.equal(s.performanceEnabled(),want);s.dispose();
 }
});
test('后台恢复仍沿用同局抽样和设备快照，关闭浮层不影响自动采样',()=>{
 const f=fixture(),{AppView}=load('cocos/assets/scripts/view/AppView');let decisions=0,devices=0,records=0;
 const app=Object.assign(Object.create(AppView.prototype),f.app,{debugEnabled:true,debug:{},platform:{kind:'wechat',performanceDevice(){devices++;return {};},resolutionCapped:()=>true},cloud:{performanceEnabled(){decisions++;return true;},track(){records++;},background(){}}});f.world.match.L={id:5};
 app.startPerformance();const first=app.telemetry;app.setPerformance(false);assert.equal(app.telemetry,first);app.finishPerformance('background');app.startPerformance();app.finishPerformance('exit');assert.equal(decisions,1);assert.equal(devices,1);assert.equal(records,2);assert.equal(f.callbacks.size,0);
});
test('导出JSON汇总区分机型、关卡和段，并保留缺失值与重复记录去重',async()=>{
 const {parseExport,summarize,table}=await import('../tools/perf-summary.mjs');
 const row={id:'a',type:'perf',v:1,level:5,device:{brand:'mock',model:'phone'},capEnabled:true,segments:[{kind:'first',start:0,end:10,frames:100,interval:20,worst5:40,logic:1,draw:2,drawCalls:null,dpr:2}]};
 const groups=summarize(parseExport(JSON.stringify([row,row,{...row,id:'b',segments:[{...row.segments[0],frames:200,interval:50}]}])));
 assert.equal(groups.length,1);assert.equal(groups[0].runs,2);assert.equal(groups[0].metrics.interval,40);assert.equal(groups[0].metrics.drawCalls,undefined);assert.ok(table(groups).includes('N/A'));
});
