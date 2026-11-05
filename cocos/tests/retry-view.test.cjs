// 重来走真实App/World方法，替换加载和绘图设备，不复制流程或玩法。
const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./wechat/view-harness.cjs');
const {AppView}=load('cocos/assets/scripts/view/AppView'),{WorldView}=load('cocos/assets/scripts/view/WorldView'),{Match}=load('cocos/assets/scripts/core/match'),{LEVELS}=load('cocos/assets/scripts/core/levels');
function host(){return Object.assign(Object.create(AppView.prototype),{alive:true,ready:true,serial:1,real:0,selected:0,screen:'play',panel:'result',params:new URLSearchParams(),rank:{hide(){}},audio:{unlock(){},bgm(){},sfx(){}},cloud:{track(){}},store:{read:()=>({unlocked:5,best:{},tutDone:true})},finishPerformance(){},startPerformance(){},closePanel(){this.panel='';},render(){},frameKey:()=>null,frameRate(){},reduced:()=>true,messages:{toastUntil:0}});}
test('只有结算重来携带上局线内同事；压垮/过关/小舅子/异关不携带，暂停重开无提示',()=>{
 for(const kind of ['fail','crushed','pass','nephew','other','pause']){
  const app=host(),m=new Match({seed:1001,itemDrops:false});m.S.agents.forEach((a,i)=>{a.sn.segs=[];a.blames=a.isPlayer?10:i;});let r=m.calculateResult('time');
  if(kind==='crushed')r=m.calculateResult('crushed');if(kind==='pass'){m.S.player.blames=0;r=m.calculateResult('time');}if(kind==='nephew')r.lineInfo={...r.lineInfo,name:'小舅子',rank:99};if(kind==='other')app.selected=1;if(kind==='pause')app.panel='pause';
  app.world={match:m};app.result=r;let args;app.startGame=(...v)=>args=v;app.action('retry');
  if(kind==='pause')assert.equal(args[2],undefined);else {assert.ok(args[2]);if(kind==='fail')assert.deepEqual(args[2].rival,{key:r.rank[2].key,name:r.rank[2].name});else assert.equal(args[2].rival,undefined);}
 }
});
test('结算重来直接开局且tutDone后不进带教，一秒内core零推进、提示后才挂三秒标记',async()=>{
 const app=host();let tutorial,steps=0,marked;const m=new Match({seed:1001,itemDrops:false});
 app.createWorld=async(t)=>{tutorial=t;app.serial++;app.world={ready:true,match:m,clearInput(){},ui:{pausedVisualKey:()=>null},update(){steps++;m.update(.02);},tick(){steps++;},markRetryRival(target){marked=target;}};};
 const rival={key:'pm',name:'小李'};await app.startGame(false,null,{rival});assert.equal(app.screen,'play');assert.equal(tutorial,false);assert.equal(app.world.paused,true);
 const snapshot=structuredClone(m.S);app.update(.5);assert.equal(steps,0);assert.deepEqual(structuredClone(m.S),snapshot);assert.equal(marked,undefined);
 app.update(.5);assert.equal(steps,0);assert.deepEqual(marked,rival);assert.equal(app.world.paused,false);app.update(.02);assert.equal(steps,1);
 await app.startGame(false,'trip');assert.equal(app.retryIntro,undefined,'增益重来不带一秒提示');
});
test('新局按key优先、名字兜底找同事，找不到不画，标记时间从正式开局起三秒',()=>{
 const m=new Match({seed:1001,itemDrops:false}),nodes={},w=Object.assign(Object.create(WorldView.prototype),{match:m,painter:{nodes},render(){}}),b=m.S.bots[0];
 w.markRetryRival({key:b.key,name:'改过的名字'});assert.equal(nodes.retryRival,b);assert.equal(nodes.retryRivalUntil,3);
 w.markRetryRival({key:'不存在',name:m.S.bots[1].name});assert.equal(nodes.retryRival,m.S.bots[1]);
 w.markRetryRival({key:'不存在',name:'不存在'});assert.equal(nodes.retryRival,undefined);
});
test('重来提示中切后台仍可从暂停继续，余下提示冻结core且不会卡在暂停页',async()=>{
 const app=host(),m=new Match({seed:1001,itemDrops:false});let steps=0;
 Object.assign(app,{debug:{resetTaps(){}},praise:{clear(){}},removeEdit(){}});app.audio.hidden=()=>{};app.cloud.background=()=>{};app.cloud.foreground=()=>{};
 app.createWorld=async()=>{app.serial++;app.world={ready:true,match:m,clearInput(){},ui:{pausedVisualKey:()=>null},update(){steps++;},markRetryRival(){}};};
 await app.startGame(false,null,{});app.hide();assert.equal(app.panel,'pause');app.show();app.action('resume');assert.equal(app.panel,'','提示不能阻止后台暂停页的继续按钮');
 app.update(.5);assert.equal(steps,0);app.update(.5);assert.equal(steps,0);app.update(.01);assert.equal(steps,1);
});
