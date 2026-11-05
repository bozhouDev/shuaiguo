// 清账画面契约：运行真实视图方法，只替换Cocos绘图设备；不冒充真机截图。
const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./wechat/view-harness.cjs');
const {RetainedWorld}=load('cocos/assets/scripts/view/RetainedWorld'),{HudView}=load('cocos/assets/scripts/view/HudView'),{MatchUi}=load('cocos/assets/scripts/view/MatchUi');
// 语义节点记录最终显示值和身份，不模拟GPU内部实现。
class Part {
 constructor(){this.node={active:true};this.children=new Map();}
 child(id){if(!this.children.has(id))this.children.set(id,new Part());return this.children.get(id);}
 show(on){this.node.active=on;return this;}
 at(...args){this.position=args;return this;}
 text(...args){this.copy=args;return this;}
 image(){return this;}ellipse(){return this;}path(){return this;}
}
function fixture(){const a={id:1,isPlayer:false,crushed:false,sn:{x:0,y:0,segs:[{due:51,label:'测试',itemDelayAt:50}],positions:()=>[{x:50,y:50}]}},pot=new Part(),m={S:{t:50,player:a},L:{duration:60},isClearing:()=>true,bellTime:()=>60};const world=Object.assign(Object.create(RetainedWorld.prototype),{match:m,tailAgents:new Map([[a,{sync(values,fn){values.forEach((v,i)=>fn(pot,v,i));}}]]),visible:()=>true,wok(){}});return {a,pot,m,world};}
test('清账所有人的锅显示到铃响的红色秒数，提前炸锅和延时跳字都不改变数字',()=>{
 const {a,pot,m,world}=fixture();world.tail(a,50);assert.equal(pot.child('due').node.active,true);assert.equal(pot.child('due').copy[0],'10');assert.equal(pot.child('due').copy[4],'#E8504A');
 a.isPlayer=true;m.S.t=50.4;world.tail(a,50.4);assert.equal(pot.child('due').copy[0],'10');assert.equal(pot.child('due').copy[2],-15,'清账中不播放延时数字向上跳');a.crushed=true;world.tail(a,50.4);assert.equal(pot.child('due').node.active,true,'压垮者保留的锅清账也要显示红秒');assert.equal(pot.child('due').copy[4],'#E8504A');
});
test('清账头顶倒计时同样显示铃响秒数并变红',()=>{
 const {a,m,world}=fixture(),above=new Part();Object.assign(m,{potsOf:()=>1,urgentLeft:()=>1,seenBy:()=>null});m.S.leaders=[];world.above=above;world.aimLines(50);const text=above.child('Due').child('text');assert.equal(text.copy[0],'10');assert.equal(text.copy[4],'#E8504A');
});
test('清账时钟字号放大且数字变红，375窄屏与胶囊避让不越界',()=>{
 for(const width of [320,375,560]){const texts=[],c=new Proxy({width,assets:{spr:{}}},{get:(o,k)=>k in o?o[k]:()=>{}}),p={c,width:(s,fs)=>s.length*fs*.55,text:(...a)=>texts.push(a),panel(){},image(){}};
 const player={blames:0,combo:0},m={S:{player,tut:null},L:{duration:60},mode:'play',potsOf:()=>0,ranking:()=>[player],workT:()=>45,carryOf:()=>0,clockAt:()=> '15:45',passRank:()=>3,isClearing:()=>true};
 const hud=new HudView(p);hud.draw(m,0,{top:44,capsule:{x:width-99,y:50,w:87,h:32}});const clock=texts.find(t=>t[0]==='15:45');assert.ok(clock[3]>(width<=420?14:15));assert.equal(clock[4],'#E8504A');for(const box of Object.values(hud.boxes))assert.ok(box.x>=0&&box.x+box.w<=width+.01);}
});
test('中央末五秒复用同一节点，横幅以下显示5到1，铃响/带教/结束隐藏且不另播音效',()=>{
 const nodes=new Part(),match={mode:'play',S:{t:55},L:{duration:60},workT:()=>match.S.t,isClearing:()=>true},ui=Object.assign(Object.create(MatchUi.prototype),{match,clearingNodes:nodes,surface:{width:375,height:667},hud:{bottom:84},closing:{notice:{hidden:false,warning:true}}});
 for(let i=5;i>=1;i--){match.S.t=60-i;ui.drawClearing();assert.equal(nodes.node.active,true);assert.equal(nodes.child('digit').copy[0],String(i));assert.equal(nodes.child('digit').copy[4],'#E8504A');assert.ok(nodes.child('digit').copy[2]>84+10+359*296/1204+48,'中央数字不能盖住横幅');}
 const digit=nodes.child('digit');ui.drawClearing();assert.equal(nodes.child('digit'),digit);match.S.t=60;ui.drawClearing();assert.equal(nodes.node.active,false);match.S.t=56;match.isClearing=()=>false;ui.drawClearing();assert.equal(nodes.node.active,false);match.isClearing=()=>true;match.mode='closing';ui.drawClearing();assert.equal(nodes.node.active,false);
});
test('清账飞行锅和同事甩出的锅也显示红色铃响秒数，离开清账后隐藏',()=>{
 const flying=new Part(),thrown=new Part(),empty={sync(){}},m={S:{t:50,flying:[{phase:'fly',x:10,y:20,a:0,label:'测试'}],throws:[{x:30,y:40,a:0,label:'测试',owner:{isPlayer:false}}],arcs:[],fx:[]},isClearing:()=>true,bellTime:()=>60};
 const world=Object.assign(Object.create(RetainedWorld.prototype),{match:m,effects:new Part(),flying:{sync(v,fn){v.forEach(x=>fn(flying,x));}},thrown:{sync(v,fn){v.forEach(x=>fn(thrown,x));}},arcs:empty,fx:empty,clearFx:empty,wok(){}});
 world.flight(50);for(const n of [flying,thrown]){assert.equal(n.child('due').node.active,true);assert.equal(n.child('due').copy[0],'10');assert.equal(n.child('due').copy[4],'#E8504A');}
 m.isClearing=()=>false;world.flight(50);for(const n of [flying,thrown])assert.equal(n.child('due').node.active,false);
});
test('网页BGM按清账副本播放且保持1倍；重新开局清除清账旧位置',()=>{
 const {AudioView}=load('cocos/assets/scripts/view/AudioView'),starts=[],gain=()=>({gain:{value:1,cancelScheduledValues(){},setValueAtTime(){},linearRampToValueAtTime(){}},connect(){},disconnect(){}}),context={currentTime:0,createGain:gain,createBufferSource(){const src={playbackRate:{value:1},connect(){},disconnect(){},stop(){},start(_t,offset){starts.push({clip:src.buffer.name,rate:src.playbackRate.value,offset});}};return src;},close(){return Promise.resolve();}};
 const audio=new AudioView({}, {kind:'web'}, {music:true,sfx:true});Object.assign(audio,{context,musicBus:gain(),unlocked:true});for(const name of ['work','clearing']){audio.clips.set('bgm_'+name,{name:'bgm_'+name});audio.buffers.set('bgm_'+name,{name,duration:30});}
 try{audio.bgm('clearing');context.currentTime=9;audio.bgm('work',true);audio.bgm('clearing');assert.deepEqual(starts.map(s=>s.clip),['clearing','work','clearing']);assert.equal(starts.at(-1).offset,0);assert.ok(starts.every(s=>s.rate===1));}finally{audio.destroy();}
});
test('结算删除总账公式，排名行只列真实背锅次数与甩出口数',()=>{
 const {ResultView}=load('cocos/assets/scripts/view/ResultView'),copies=[],c=new Proxy({},{get:(o,k)=>k in o?o[k]:()=>{}}),p={c,width:(s,n)=>s.length*n,paragraph(s){copies.push(s);return 15;},text(s){copies.push(s);},sliced(){},contain(){},center(){},button(){},image(){}};
 const view=new ResultView(p),a={isPlayer:true,blames:4,thrown:7};Object.assign(view,{hero(){},summary(_r,b){return b.y;},button(){},fit(){}});const m={S:{agents:[]},passRank:()=>3,shareOutcome:()=>({helps:[]}),debtOf:()=>4,fmtDebt:String};
 view.draw(m,{stars:1,rank:[a],shareInfo:{kind:'brag'},ads:{},lineInfo:null},{x:0,y:0,w:340,h:700});assert.ok(copies.includes('背锅 4 次 · 甩出 7 口'));assert.ok(!copies.some(s=>s.includes('总账 =')||s.includes('½')));
});
test('微信AudioView通过audio分包解析清账副本URL，原生保持1倍且销毁释放实例',async()=>{
 const {AudioView}=load('cocos/assets/scripts/view/AudioView'),{cc}=require('./wechat/view-harness.cjs'),previous=cc.assetManager,requests=[],plays=[],instances=[];
 cc.assetManager={loadBundle(_name,done){done(null,{getInfoWithPath(id){requests.push(id);return {uuid:id};},load(){throw Error('微信不能额外加载AudioSource');}});},utils:{getUrlWithUuid:id=>id+'.mp3'}};
 globalThis.wx={createInnerAudioContext(){const a={currentTime:0,play(){plays.push({src:a.src,rate:a.playbackRate});},pause(){},stop(){},destroy(){a.destroyed=true;},onEnded(){},onError(){}};instances.push(a);return a;}};
 const audio=new AudioView({}, {kind:'wechat'}, {music:true,sfx:true});try{audio.bgm('clearing',true);audio.unlock();await new Promise(r=>setImmediate(r));assert.ok(requests.includes('bgm_clearing'));assert.ok(plays.some(p=>p.src==='bgm_clearing.mp3'&&p.rate===1));}finally{audio.destroy();assert.ok(instances.every(a=>a.destroyed));cc.assetManager=previous;delete globalThis.wx;}
});
