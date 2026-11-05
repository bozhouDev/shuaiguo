// 真实画面组织器配假Match，直接证明只缩放喂core的dt与真实时间展示窗口。
const {test}=require('node:test'),assert=require('node:assert/strict');
const {load,cc}=require('./wechat/view-harness.cjs');
const {WorldView}=load('cocos/assets/scripts/view/WorldView'),{MatchUi}=load('cocos/assets/scripts/view/MatchUi');
// 只用假Match记录画面喂入的dt，事件分发与窗口计算仍走真实WorldView。
function world(){const seen=[],events=[],uiEvents=[];const w=Object.assign(Object.create(WorldView.prototype),{real:0,clock:0,steps:0,events:[],alive:true,options:{onEvent:e=>events.push(e),onHidden(){}},painter:{event(){},advance(){},draw(){}},controls:{draw(){},clear(){}},ui:{event:e=>uiEvents.push(e)},render(){}});w.match={mode:'play',S:{player:{crushed:true},over:null},inp:{},update:dt=>seen.push(dt),updateClosing:dt=>seen.push(dt),updateBanners(){},updateClosingNotice(){}};return {w,seen,events,uiEvents};}
test('自己的锅炸后只缩放core dt，真实0.2秒到点恢复，重叠取更慢与更晚',()=>{const {w,seen}=world();w.events.push({kind:'ownedBoom',args:[]});w.flush();w.tick(.1);assert.equal(seen[0],.015);w.events.push({kind:'buzzer',args:[{from:5,to:3}]});w.flush();w.tick(.1);assert.equal(seen[1],.015);w.tick(.51);assert.ok(Math.abs(seen[2]-.085)<1e-10);w.tick(.1);assert.equal(seen[3],.1);});
test('压哨横幅至少展示真实0.6秒才外发finish；暂停后台清掉时窗',()=>{const {w,events}=world();w.events.push({kind:'buzzer',args:[{from:5,to:3}]},{kind:'finish',args:[{}]});w.flush();assert.ok(!events.some(e=>e.kind==='finish'));w.tick(.59);assert.ok(!events.some(e=>e.kind==='finish'));w.tick(.02);assert.equal(events.filter(e=>e.kind==='finish').length,1);w.events.push({kind:'ownedBoom',args:[]});w.flush();w.hide();assert.equal(w.slowUntil,0);});
test('名次横幅升名次绿、掉出线红，连续事件替换且0.8秒结束',()=>{const ui=Object.assign(Object.create(MatchUi.prototype),{real:2,messages:{event(){}},closing:{notice:{hidden:true}},hud:{}});ui.event({kind:'rankCallout',args:[{from:4,to:3,who:'会计'}]});assert.equal(ui.callout.text,'超了会计，第 3！');assert.equal(ui.callout.color,'#2F9E6B');assert.equal(ui.callout.until,2.8);ui.real=2.1;ui.event({kind:'rankCallout',args:[{from:3,to:4,who:'老油条'}]});assert.equal(ui.callout.text,'被老油条挤到第 4，要加班了');assert.equal(ui.callout.color,'#E8504A');assert.ok(Math.abs(ui.callout.until-2.9)<1e-10);});
test('定格到点恢复，收尾也只缩放core dt，音效沿既有总线各补一次',()=>{const {w,seen,events}=world();w.events.push({kind:'ownedBoom',args:[],t:0},{kind:'revenge',args:[{id:1,count:1}],t:0});w.flush();assert.deepEqual(events.filter(e=>e.kind==='sfx').map(e=>e.args[0]),['boom','praise','parry']);w.tick(.2);assert.ok(Math.abs(seen[0]-.03)<1e-10);w.tick(.1);assert.equal(seen[1],.1);w.match.mode='closing';w.events.push({kind:'buzzer',args:[{from:5,to:3}],t:0});w.flush();w.tick(.3);assert.ok(Math.abs(seen[2]-.06)<1e-10);w.tick(.3);assert.ok(Math.abs(seen[3]-.06)<1e-10);w.tick(.1);assert.equal(seen[4],.1);});
test('画笔替换旧背锅字，自己的锅保留归属与1.4秒寿命，同事短句1.2秒到点清除',()=>{
 const module=load('cocos/assets/scripts/view/RetainedWorld'),Original=module.RetainedWorld;let drawn=[],spoken;
 const layer={at(){}},retained={ground:layer,tails:layer,actors:layer,above:layer,effects:layer,speech:layer,camera(){},vision(){},tail(){},beginActors(){},aimLines(){},flight(){},hints(){},speeches(f,_x,_y,_w,_h,s){drawn=f.map(v=>({...v}));spoken=new Map(s);}};
 module.RetainedWorld=class{constructor(){return retained;}};
 try{const {createWorldPainter}=load('cocos/assets/scripts/view/WorldPainter'),a={id:1,sn:{x:200,y:300}},m={L:{theme:'office'},S:{player:{sn:{x:200,y:300}},agents:[],leaders:[],tea:0}},surface={width:375,height:812,root:new cc.Node()},p=createWorldPainter(m,surface,surface,surface,surface,{matchTexture:{},spr:{}},true);m.S.agents=[a];
 p.event('floats',['会计 背锅 +1',200,260,'#5E6A84']);p.event('ownedBlame',[{id:1,n:1,original:'会计 背锅 +1'}]);p.event('mateSpeech',[{id:1,text:'又是我？'}]);p.draw(0);assert.equal(drawn.length,1);assert.equal(drawn[0].text,'背锅 +1');assert.equal(drawn[0].owned,true);assert.equal(drawn[0].life,1.4);assert.equal(spoken.get(1).text,'又是我？');
 p.advance(1.2);p.draw(1.2);assert.equal(spoken.size,0);assert.equal(drawn.length,1);p.advance(.21);p.draw(1.41);assert.equal(drawn.length,0);
 p.event('floats',['背锅 +3：急件炸了',200,260]);p.event('mateBlame',[{original:'背锅 +3：急件炸了',text:'背锅 +3 · 会计甩的',x:200,y:260}]);p.draw(2);assert.deepEqual(drawn.map(f=>f.text),['背锅 +3 · 会计甩的']);
 }finally{module.RetainedWorld=Original;}
});
test('名次变化同步触发右上角名次跳动，线内下降也更新但不创建喊话',()=>{
 const ui=Object.assign(Object.create(MatchUi.prototype),{real:2,messages:{event(){}},closing:{notice:{hidden:true}},hud:{pulseAt:-Infinity}});
 ui.event({kind:'rankChange',args:[{from:1,to:2,who:'会计'}]});assert.equal(ui.hud.pulseAt,2);assert.equal(ui.callout,undefined);
});
test('清账和铃响期间新横幅避开原倒计时板，常规状态仍贴HUD下沿',()=>{
 for(const width of [320,375,560])for(const hidden of [false,true]){
  const rects=[],parts=new Map(),node={show(){return this;},child(id){if(!parts.has(id))parts.set(id,{show(){return this;},rect(...v){if(id==='paper')rects.push(v);},text(){},image(){}});return parts.get(id);}};
  const ui=Object.assign(Object.create(MatchUi.prototype),{calloutNodes:node,callout:{text:'压哨下班',color:'#2F9E6B',until:1,clock:true},surface:{width},hud:{bottom:84},closing:{notice:{hidden}}});
  ui.drawCallout(0);const [x,y,w,h]=rects[0];assert.ok(x>=0&&x+w<=width);
  if(hidden)assert.equal(y,94);else assert.ok(y>=94+Math.min(390,width-16)*296/1204+8,'新横幅不能盖住倒计时板');assert.equal(h,38);
 }
});
test('急件已有爆炸声时不再补第二声，仍补praise，普通锅补一次爆炸声',()=>{
 const {w,events}=world();w.events.push({kind:'ownedBoom',t:0,args:[]},{kind:'sfx',t:0,args:['boom',{vol:.5}]});w.flush();const booms=events.filter(e=>e.kind==='sfx'&&e.args[0]==='boom');assert.equal(booms.length,1);assert.deepEqual(booms[0].args,['boom',{vol:.5}]);assert.equal(events.filter(e=>e.kind==='sfx'&&e.args[0]==='praise').length,1);
});
test('第一帧喊话避让刚出现的群消息与提示，缓存帧沿用已排好的矩形',()=>{
 let y=0,draws=0;const parts=new Map(),node={node:{},show(){return this;},child(id){if(!parts.has(id))parts.set(id,{show(){return this;},rect(...v){if(id==='paper')y=v[1];},text(){},image(){}});return parts.get(id);}};
 const messages={hintOn:true,msgOn:true,hintChange:-Infinity,msgChange:-Infinity,toastAt:-Infinity,toastUntil:-Infinity,draw(){draws++;this.hintBox={y:114,h:80};this.msgBox={y:204,h:70};},drawToast(){}};
 const ui=Object.assign(Object.create(MatchUi.prototype),{calloutNodes:node,callout:{text:'超了会计，第 3！',color:'#2F9E6B',until:20},surface:{width:375,height:812,begin(){},end(){},insertLayer(){}},hudNodes:{node:{}},hud:{bottom:84,pulseAt:-Infinity,draw(){}},match:{S:{tut:null}},avoidance:()=>({top:0}),messages,closing:{notice:{hidden:true},draw(){}},tutorial:{draw(){}},p:{}});
 ui.draw(10,{},true);assert.ok(y>=282,'首帧须使用本次消息排版后的下沿');ui.draw(10.1,{},true);assert.equal(draws,1,'稳定消息不重新排版');assert.ok(y>=282);
});
test('真实急件命中到期的core事件交给画面，只外发一声爆炸并保留原音量',()=>{
 const {Match}=load('cocos/assets/scripts/core/match'),{w,events}=world(),queue=[];
 const m=new Match({level:1,seed:1001,itemDrops:false,onEvent:e=>queue.push(e)}),p=m.S.player,b=m.S.bots[0];m.S.leaders=[];for(const a of m.S.agents)a.sn.segs=[];
 m.receivePot(p,m.newPot(0,true));m.fireThrow(p,b);const f=m.S.throws.pop();m.landThrow(f,b);queue.length=0;f.pot.due=0;m.updateDue();w.match=m;w.events=queue;w.flush();
 assert.deepEqual(events.filter(e=>e.kind==='sfx'&&e.args[0]==='boom').map(e=>e.args),[['boom',{vol:.5}]]);assert.equal(events.filter(e=>e.kind==='sfx'&&e.args[0]==='praise').length,1);
});
test('praise音效实际播放现有表扬采样，不能只有事件名却静音',()=>{
 const {AudioView}=load('cocos/assets/scripts/view/AudioView'),audio=new AudioView({}, {kind:'web'}, {sfx:true,music:false});let plays=0;
 const source={connect(){},disconnect(){},stop(){},start(){plays++;},playbackRate:{value:1}},gain={gain:{value:1},connect(){},disconnect(){}};
 Object.assign(audio,{unlocked:true,context:{currentTime:1,createBufferSource:()=>source,createGain:()=>gain,close:()=>Promise.resolve()},buffers:new Map([['sfx_rank_up',{}]])});
 try{audio.sfx('praise');assert.equal(plays,1);assert.equal(audio.played.praise,1);}finally{audio.destroy();}
});
