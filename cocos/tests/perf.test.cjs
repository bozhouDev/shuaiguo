// 采样口径与release门禁；只替换引擎/单调时钟，不把Node桩当手机性能。
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const ts=require('/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources/resources/3d/engine/node_modules/typescript');
test('性能采样保留原始慢帧、真实提交统计与改字次数，关闭后恢复全部hook',async()=>{
 class Label{get string(){return this.text||'';}set string(v){this.text=v;}updateRenderData(){}updateRenderer(){}}
 class Graphics{clear(){}}
 class Sprite{}
 const listeners=new Map(),director={on(k,f,t){listeners.set(f,()=>f.call(t));},off(k,f){listeners.delete(f);},emit(){for(const f of listeners.values())f();},listenerCount(){return listeners.size;},root:{device:{numDrawCalls:27}}};
 const cc={Label,Graphics,Sprite,director,Director:{EVENT_AFTER_DRAW:'draw'}};
 const mod={exports:{}};new Function('require','exports',ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname,'../assets/scripts/view/PerfProbe.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(()=>cc,mod.exports);
 const {PerfProbe}=mod.exports,proto={render(){this.ui?.draw();},tick(){this.render();},async start(){this.render();},destroy(){}},world=Object.assign(Object.create(proto),{ready:true});
 const g={node:{activeInHierarchy:true},impl:{getRenderDataList:()=>[{vertexStart:123}]}},l=new Label();l.node={activeInHierarchy:true};
 const app={world,screen:'play',parent:{getComponentsInChildren:Type=>Type===Graphics?[g]:Type===Label?[l]:[]},render(){},async createWorld(){await world.start();},async startGame(){world.destroy();await this.createWorld();}};
 const originalRender=app.render,originalProto=proto.tick,descriptor=Object.getOwnPropertyDescriptor(Label.prototype,'string');
 let now=10;const performance=global.performance;global.performance={now:()=>now};
 const probe=new PerfProbe(app,proto,false);
 try{director.emit('draw');now=110;l.string='1';l.string='1';world.tick();director.emit('draw');
  assert.equal(probe.frames[0].interval,100);assert.equal(probe.frames[0].drawCalls,27);assert.equal(probe.frames[0].vertices,123);assert.equal(probe.frames[0].changedLabels,1);
  for(let i=0;i<39;i++){now+=10;director.emit('draw');}const s=probe.summary();assert.equal(s.frames,40);assert.equal(s.interval,12.25);assert.equal(s.worst5,55);
  delete director.root.device;now+=10;g.impl=null;director.emit('draw');assert.equal(probe.frames.at(-1).drawCalls,null);assert.equal(probe.frames.at(-1).vertices,null);
  await app.startGame();now+=50;director.emit('draw');assert.equal(probe.starts.length,1);assert.ok(probe.starts[0].firstSubmitted>=50);
  probe.reset();assert.equal(probe.frames.length,0);
  world.ui=new class{draw(){now+=5;}};director.emit('draw');probe.reset();now+=10;director.emit('draw');world.ui.draw();now+=10;director.emit('draw');assert.equal(probe.frames.at(-1).draw,5,'暂停时独立HUD绘制也应计时');probe.reset();now+=10;director.emit('draw');world.render();now+=10;director.emit('draw');assert.equal(probe.frames.at(-1).draw,5,'嵌套HUD不能重复计时');
 }finally{probe.destroy();global.performance=performance;}
 assert.equal(director.listenerCount('draw'),0);assert.equal(app.render,originalRender);assert.equal(proto.tick,originalProto);assert.deepEqual(Object.getOwnPropertyDescriptor(Label.prototype,'string'),descriptor);
});
test('release不能创建采样器，既有debug动作也不能绕过门禁',()=>{
 const {load}=require('./wechat/view-harness.cjs'),{AppView}=load('cocos/assets/scripts/view/AppView');
 const app=Object.assign(Object.create(AppView.prototype),{debugEnabled:false,debug:{performance:false},screen:'lobby',panel:'debug'});
 app.setPerformance(true);app.debugAction('performance');assert.equal(app.perf,undefined);assert.equal(app.debug.performance,false);
});
test('相同描边颜色第二帧不再触发Label排字，变色仍更新',()=>{
 const {cc,load}=require('./wechat/view-harness.cjs');
 cc.Color=class{constructor(value='#000000'){this.value=value;this.a=255;}equals(other){return this.value===other.value&&this.a===other.a;}};
 let writes=0;Object.defineProperty(cc.Label.prototype,'outlineColor',{configurable:true,get(){return this.ink;},set(value){this.ink=value;writes++;}});
 const {DrawSurface}=load('cocos/assets/scripts/view/DrawSurface'),c=new DrawSurface(new cc.Node(),{title:{},body400:{},body700:{},body900:{}});
 const frame=ink=>{c.begin();c.strokeStyle=ink;c.strokeText('你',10,20);c.fillText('你',10,20);c.end();};
 try{frame('#1F2A44');frame('#1F2A44');assert.equal(writes,1,'同值描边不应重新排字');frame('#E8504A');assert.equal(writes,2,'真实变色必须保留');}
 finally{delete cc.Label.prototype.outlineColor;}
});
test('静止介绍页只画一次；存档变化和toast动画仍会重画',()=>{
 const {load,cc}=require('./wechat/view-harness.cjs'),{AppView}=load('cocos/assets/scripts/view/AppView');let draws=0;cc.game.frameRate=60;
 const app=Object.assign(Object.create(AppView.prototype),{ready:true,real:0,screen:'intro',panel:'',store:{revision:0},messages:{toastAt:-Infinity,toastUntil:-Infinity},reduced:()=>true,render(){draws++;},lastFrameKey:''});
 for(let i=0;i<10;i++)app.update(1/60);assert.equal(draws,1,'静止介绍页不能每帧重画');assert.equal(cc.game.frameRate,15,'静止页面不能持续60次GPU提交');app.store.revision++;app.update(1/60);assert.equal(draws,2,'云端进度变化要能更新');app.messages.toastAt=app.real;app.messages.toastUntil=app.real+1;for(let i=0;i<5;i++)app.update(1/60);assert.equal(draws,7,'toast入场不能被冻结');assert.equal(cc.game.frameRate,60,'toast动画要保持60帧');
});
test('暂停世界最多整理两帧，UI动画仍单独更新，后台完全停止重画',()=>{
 const {load}=require('./wechat/view-harness.cjs'),{WorldView}=load('cocos/assets/scripts/view/WorldView');let draws=0,uiDraws=0,key='still';
 const world=Object.assign(Object.create(WorldView.prototype),{ready:true,paused:true,hidden:false,pauseFrames:0,lastPauseUI:'',realOrigin:0,params:{get:()=>null},ui:{pausedVisualKey:()=>key,draw(){uiDraws++;}},controls:{fireCenter:()=>({x:0,y:0})},reducedMotion:()=>false,render(){draws++;}});
 for(let i=0;i<10;i++)world.update(1/60);assert.equal(draws,2,'暂停不能反复重画整个世界');const before=uiDraws;key=null;world.update(1/60);assert.equal(uiDraws,before+1,'仍须播放未结束的UI动画');world.hidden=true;world.update(1/60);assert.equal(uiDraws,before+1,'后台不能做UI重画');
});
test('菜单低帧返回对局的长dt仍按原来33ms上限推进，不补跑玩法',()=>{
 const {cc,load}=require('./wechat/view-harness.cjs'),{WorldView}=load('cocos/assets/scripts/view/WorldView'),steps=[];
 cc.game.frameRate=15;const world=Object.assign(Object.create(WorldView.prototype),{ready:true,paused:false,hidden:false,frozen:false,realOrigin:0,tick(dt){steps.push(dt);}});
 world.update(1/15);world.update(.5);assert.deepEqual(steps,[.033,.033]);
});
test('介绍页节点池一次移交，新对局仍读新种子/进度且重建玩法，离场最终释放',async()=>{
 const {cc,load}=require('./wechat/view-harness.cjs');cc.Input.EventType={TOUCH_START:'start',TOUCH_MOVE:'move',TOUCH_END:'end',TOUCH_CANCEL:'cancel',KEY_DOWN:'down',KEY_UP:'up'};
 const {WorldView}=load('cocos/assets/scripts/view/WorldView'),{Match}=load('cocos/assets/scripts/core/match'),{QueryParams}=load('cocos/assets/scripts/platform/Platform');
 let subscribed=0;const platform={kind:'web',debugEnabled:()=>true,getStorage:()=>null,topAvoidance:()=>({top:0}),onLifecycle(){subscribed++;return ()=>subscribed--;}};
 const parent=new cc.Node(),assets={spr:{},title:{},body400:{},body700:{},body900:{}};
 const options=seed=>({platform,params:new QueryParams('?auto=1&seed='+seed),level:4,tutorial:false,progress:{unlocked:5,best:{},tutDone:true},assets,onEvent(){},onAction(){},blocked:()=>false,onHidden(){}});
 const first=new WorldView(parent,()=>{},true,options(1001));await first.start();const oldMatch=first.match,root=first.root,surfaces=first.surfaces;
 assert.equal(typeof first.takeVisuals,'function','需要一次性移交显示池入口');const warm=first.takeVisuals();assert.throws(()=>first.takeVisuals());first.destroy();assert.ok(!root.destroyed);assert.equal(subscribed,0);
 const nextOptions=options(2002);nextOptions.progress.bossName='王总';const next=new WorldView(parent,()=>{},true,nextOptions,warm);await next.start();
 try{assert.equal(next.root,root);assert.deepEqual(next.surfaces,surfaces);assert.notEqual(next.match,oldMatch);assert.equal(next.match.bossName(),'王总');const oracle=new Match({level:4,seed:2002,auto:true,tutorial:false,progress:nextOptions.progress});assert.equal(next.match.E.rngState(),oracle.E.rngState());assert.equal(next.steps,0);
  const shape=m=>({t:m.S.t,rng:m.E.rngState(),agents:m.S.agents.map(a=>({x:a.sn.x,y:a.sn.y,pots:a.sn.segs,blames:a.blames})),leaders:m.S.leaders.map(l=>({x:l.x,y:l.y,state:l.state}))});assert.deepEqual(shape(next.match),shape(oracle));assert.equal(subscribed,1);
 }finally{next.destroy();}assert.equal(root.destroyed,true);assert.equal(subscribed,0);
});
