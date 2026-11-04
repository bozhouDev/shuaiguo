import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const base=new URL('../../build-templates/wechatgame/openDataContext/',import.meta.url);
// 用微信相同的CommonJS入口执行源码；设备API由每个用例单独提供。
function load(name,extra={}) {const mod={exports:{}};vm.runInNewContext('(function(require,module,exports){'+readFileSync(new URL(name+'.js',base),'utf8')+'\n})',{...extra})(n=>load(n.replace('./',''),extra),mod,mod.exports);return mod.exports;}
const kv=(debt,v=1)=>[{key:'sg_debt_v1_1',value:JSON.stringify({v,debt})}];
test('好友榜只认有星写入的v1有限非负总账，同账按昵称和身份稳定排序',()=>{
 const logic=load('rank-logic');
 const rows=logic.rankRows([{openid:'z',nickname:'乙',KVDataList:kv(2)},{openid:'b',nickname:'甲',KVDataList:kv(2)},{openid:'a',nickname:'甲',KVDataList:kv(2)},{openid:'c',nickname:'零锅',KVDataList:kv(0)},{openid:'x',KVDataList:kv(-1)},{openid:'y',KVDataList:kv('1')},{openid:'v',KVDataList:kv(1,2)},{openid:'n',KVDataList:[]}],1,'a');
 assert.deepEqual(Array.from(rows,r=>r.id),['c','z','a','b']);
 assert.equal(rows[2].me,true);assert.equal(rows[1].me,false);
 assert.equal(logic.debtOf([{key:'sg_debt_v1_1',value:'broken'}],1),null);
});
test('昵称按Unicode和实际测量宽度截断，前三名金银铜，其他墨水蓝',()=>{
 const l=load('rank-logic'),measure=s=>Array.from(s).length*10;
 assert.equal(l.truncate('甲😀乙丙',30,measure),'甲😀…');assert.equal(l.truncate('甲乙',20,measure),'甲乙');assert.equal(l.truncate('甲',5,measure),'');
 assert.deepEqual([1,2,3,4].map(l.rankColor),['#C98A00','#9AA6C4','#A86030','#1F2A44']);
});
test('消息协议隔离引擎消息，校验关卡尺寸与滚动，拒绝未知版本和非有限值',()=>{
 const l=load('rank-logic');
 for(const bad of [null,{type:'engine'},{type:'sg-friend-rank',v:2,action:'hide'},{type:'sg-friend-rank',v:1,action:'show',level:6,width:300,height:400},{type:'sg-friend-rank',v:1,action:'scroll',delta:Infinity}])assert.equal(l.message(bad),null);
 assert.equal(l.message({type:'sg-friend-rank',v:1,action:'hide'}).action,'hide');
 assert.equal(l.message({type:'sg-friend-rank',v:1,action:'show',level:5,width:300,height:400}).level,5);
});

// 每个用例持有独立设备、计时器、绘制记录，不访问真实微信或网络。
function fixture() {
 const calls=[],text=[],fills=[],tasks=new Map(),avatars=[];let serial=0,draws=0;
 const ctx={setTransform(){},clearRect(){text.length=0;fills.length=0;draws++;},fillRect(...args){fills.push([this.fillStyle,...args]);},fillText(s){text.push(s);},measureText:s=>({width:Array.from(s).length*7}),drawImage(){fills.push(['avatar']);}};
 const wx={};for(const method of ['getFriendCloudStorage','getUserCloudStorage','getUserInfo'])wx[method]=options=>calls.push({method,options});
 wx.createImage=()=>{const image={};avatars.push(image);return image;};
 const timers={setTimeout(fn){const id=++serial;tasks.set(id,fn);return id;},clearTimeout(id){tasks.delete(id);}};
 const {createRankContext}=load('rank-renderer');const rank=createRankContext(wx,{width:640,height:960,getContext:()=>ctx},timers);
 const send=(action,data={})=>rank.receive({type:'sg-friend-rank',v:1,action,...data});
 const respond=(id,rows=[],mine=0)=>{
  for(const c of calls)if(!c.done&&(c.method==='getUserInfo'||c.options.keyList[0]==='sg_debt_v1_'+id)){
   c.done=true;c.options.success(c.method==='getUserInfo'?{data:[{openId:'self',nickName:'自己',avatarUrl:'self.png'}]}:c.method==='getUserCloudStorage'?{KVDataList:mine===null?[]:[{key:'sg_debt_v1_'+id,value:JSON.stringify({v:1,debt:mine})}]}:{data:rows});
  }
 };
 return {calls,text,fills,tasks,avatars,send,respond,draws:()=>draws};
}
const turn=()=>new Promise(r=>setImmediate(r));
const user=(i,id=1)=>({openid:'u'+i,nickname:'同事'+i,avatarUrl:'https://avatar/'+i,KVDataList:[{key:'sg_debt_v1_'+id,value:JSON.stringify({v:1,debt:i+1})}]});
test('切关缓存不重复拉，长榜单滚动夹紧，只绘制可见行，本人按身份黄底',async()=>{
 const f=fixture();f.send('show',{level:1,width:300,height:116});assert.ok(f.text.includes('正在翻同事的账…'));
 f.respond(1,Array.from({length:20},(_,i)=>user(i)));await turn();assert.ok(f.text.includes('自己'));assert.ok(f.fills.some(v=>v[0]==='#FFD84D'));assert.ok(f.text.includes('0'));assert.equal(f.tasks.size,0);
 f.send('scroll',{delta:99999});assert.ok(f.text.includes('同事19'));assert.ok(!f.text.includes('自己'));assert.ok(f.text.length<=8);
 f.send('scroll',{delta:-99999});assert.ok(f.text.includes('自己'));
 f.send('show',{level:2,width:300,height:116});f.respond(2,[],null);await turn();assert.ok(f.text.includes('还没有同事打过这一关'));
 f.send('show',{level:1,width:300,height:116});assert.equal(f.calls.filter(c=>c.method==='getFriendCloudStorage').length,2);assert.equal(f.calls.filter(c=>c.method==='getUserInfo').length,1);
 f.send('hide');
});
test('切关迟到和隐藏后的网络/头像回调不重画，失败头像保持方块',async()=>{
 const f=fixture();f.send('show',{level:1,width:300,height:116});f.send('show',{level:2,width:300,height:116});f.respond(2,[],null);await turn();const before=f.draws();
 f.respond(1,[user(1)]);await turn();assert.equal(f.draws(),before);assert.ok(f.text.includes('还没有同事打过这一关'));
 f.send('show',{level:1,width:300,height:116});assert.ok(f.avatars.length>0);const image=f.avatars[0];image.onerror();assert.ok(f.fills.some(v=>v[0]==='#9AA6C4'));
 f.send('hide');const hidden=f.draws();image.onload();f.send('scroll',{delta:10});assert.equal(f.draws(),hidden);assert.equal(f.tasks.size,0);
});
test('隐私拒绝/平台失败显示文案，重新进入可重试；超时清理请求且不抛异常',async()=>{
 const f=fixture();f.send('show',{level:1,width:300,height:116});for(const c of f.calls)c.options.fail();await turn();assert.ok(f.text.includes('好友榜没拿到，稍后再来'));assert.equal(f.tasks.size,0);
 f.send('hide');f.send('show',{level:1,width:300,height:116});assert.equal(f.calls.length,6);for(const fn of Array.from(f.tasks.values()))fn();await turn();assert.equal(f.tasks.size,0);assert.ok(f.text.includes('好友榜没拿到，稍后再来'));f.send('hide');
});
test('有星结算失效本关，旧请求不能覆盖新缓存，错误协议不访问设备',async()=>{
 const f=fixture();f.send('scroll',{delta:10});f.send('show',{level:8,width:300,height:116});assert.equal(f.calls.length,0);
 f.send('show',{level:1,width:300,height:116});f.respond(1,[],null);await turn();assert.ok(f.text.includes('还没有同事打过这一关'));
 f.send('invalidate',{level:1});assert.equal(f.calls.filter(c=>c.method==='getFriendCloudStorage').length,2);f.respond(1,[],2);await turn();assert.ok(f.text.includes('自己'));assert.ok(f.text.includes('2'));assert.equal(f.tasks.size,0);f.send('hide');
});

const require=createRequire(import.meta.url),{load:loadTS,cc}=require('./view-harness.cjs');
const {ScreenPaint}=loadTS('cocos/assets/scripts/view/ScreenPaint'),{FriendRankView}=loadTS('cocos/assets/scripts/view/FriendRankView'),{LobbyView}=loadTS('cocos/assets/scripts/view/LobbyView'),{AppView}=loadTS('cocos/assets/scripts/view/AppView'),{UI_METRICS}=loadTS('cocos/assets/scripts/view/ui-metrics');
// 真实ScreenPaint计算文字宽度和命中框，记录最终画笔设备输出。
function paint(w,h) {const text=[];const surface=new Proxy({width:w,height:h,assets:{spr:{}},fillText(t){text.push(t);}}, {get:(o,k)=>k in o?o[k]:()=>{}});return {p:new ScreenPaint(surface),text};}
test('三屏大厅三入口不相交，排行五日/关闭/去上班均在屏内，网页提示和字体字宽齐全',()=>{
 for(const [w,h]of [[375,812],[375,667],[360,780]]) {
  const {p,text}=paint(w,h);new LobbyView(p).draw(0,{unlocked:1,best:{}},0,{top:0},true);
  const links=p.actions.filter(a=>['boss-name','rank','rules'].includes(a.action));assert.equal(links.length,3);
  for(let i=0;i<links.length;i++){assert.ok(links[i].x>=0&&links[i].x+links[i].w<=w);if(i)assert.ok(links[i-1].x+links[i-1].w<links[i].x);assert.ok(p.width(links[i].label,16,'body-900')+26<links[i].w);}
  p.actions=[];const rank=new FriendRankView(p,new cc.Node(),false);rank.selected=4;rank.draw({top:24,capsule:{x:270,y:24,w:87,h:32}});
  assert.equal(p.actions.filter(a=>a.action.startsWith('rank-pick:')).length,5);assert.ok(text.includes('好友排行只能在微信里看'));assert.ok(!text.includes('全服'));
  for(const a of p.actions)assert.ok(a.x>=0&&a.y>=0&&a.x+a.w<=w&&a.y+a.h<=h,a.action);
  assert.ok(rank.list.h>250);assert.ok(rank.list.y+rank.list.h<p.actions.find(a=>a.action==='rank-go').y);
  for(const font of ['title','body-700','body-900'])for(const ch of Array.from('排行谁背锅最少关闭周一周二周三周四周五总账越少甩得越好好友排行只能在微信里看好友榜暂时看不了去上班'))assert.ok(ch in UI_METRICS[font],font+'缺字'+ch);
 }
});
test('真实主域桥只发送数字，重复绘制不重发；隐藏停用节点，销毁释放；API缺失可降级',()=>{
 const previous=globalThis.wx,old=cc.SubContextView;
 cc.SubContextView=class{};const sent=[];globalThis.wx={getOpenDataContext:()=>({postMessage:m=>sent.push(m)})};
 try{const {p}=paint(375,812),rank=new FriendRankView(p,new cc.Node(),true);rank.draw({top:0});const n=rank.node;assert.equal(n.active,true);assert.equal(n.components[1].fps,15);rank.draw({top:0});assert.equal(sent.filter(m=>m.action==='show').length,1);rank.scroll(58);rank.selected=4;rank.draw({top:0});assert.equal(sent.at(-1).level,5);rank.hide();assert.equal(n.active,false);assert.equal(sent.at(-1).action,'hide');const count=sent.length;rank.scroll(20);assert.equal(sent.length,count);rank.draw({top:0});assert.equal(sent.at(-1).action,'show');rank.destroy();assert.equal(n.destroyed,true);
  for(const m of sent){assert.equal(load('rank-logic').message(m)!==null,true);assert.deepEqual(Object.keys(m).filter(k=>!['type','v','action','level','width','height','delta'].includes(k)),[]);}
  globalThis.wx={};const fallback=new FriendRankView(p,new cc.Node(),true);fallback.draw({top:0});fallback.draw({top:0});assert.equal(fallback.available,false);fallback.destroy();
 }finally{globalThis.wx=previous;cc.SubContextView=old;}
});
test('真实App默认随大厅选关，未解锁日可看，去上班进所选介绍，关闭保留大厅原选择',()=>{
 const {p}=paint(375,812),rank=new FriendRankView(p,new cc.Node(),false),host=Object.assign(Object.create(AppView.prototype),{rank,ready:true,screen:'lobby',selected:1,panel:'',debug:{resetTaps(){}},audio:{unlock(){},sfx(){}},removeEdit(){},render(){},showLobby(){this.screen='lobby';},showIntro(){this.screen='intro';}});
 host.action('rank');assert.equal(rank.selected,1);assert.equal(host.screen,'rank');host.action('rank-pick:4');assert.equal(rank.selected,4);assert.equal(host.selected,1);host.action('rank-close');assert.equal(host.selected,1);
 host.action('rank');host.action('rank-pick:4');host.action('rank-go');assert.equal(host.selected,4);assert.equal(host.screen,'intro');
});
test('真实App只在列表起拖时转发位移，长拖不误点关卡，后台停止共享画布刷新',()=>{
 const deltas=[],rank={contains:(x,y)=>x>=20&&x<=350&&y>=200&&y<=600,scroll:d=>deltas.push(d),hide(){this.hidden=true;}},host=Object.assign(Object.create(AppView.prototype),{rank,ready:true,screen:'rank',panel:'',surface:{height:812},audio:{unlock(){},hidden(){}},render(){},debug:{resetTaps(){}},cloud:{background(){}},actions:[{x:20,y:200,w:330,h:400,action:'rank-go'}],action(){throw new Error('拖动不得触发按钮');}});
 const e=(x,y)=>({getID:()=>1,getUILocation:()=>({x,y:812-y})});host.down(e(100,400));host.move(e(100,300));host.up(e(100,300));assert.deepEqual(deltas,[100]);
 host.down(e(100,100));host.move(e(100,50));host.up(e(100,50));assert.deepEqual(deltas,[100]);host.hide();assert.equal(rank.hidden,true);assert.equal(host.touch,null);
});
test('好友KV写入确认成功才通知榜单失效，失败不发成功通知且全服上传仍关闭',async()=>{
 const {CloudServices}=loadTS('cocos/assets/scripts/platform/CloudServices'),sent=[],notices=[];let done;
 const platform={kind:'wechat',getStorage:()=>null,setStorage(){},setUserCloudStorage(data){sent.push(data);return new Promise(r=>done=r);},cloud:{call(){throw Error('不应上传全服榜');}}};
 const cloud=new CloudServices(platform,{read:()=>({unlocked:1,best:{}}),save:()=>true},ids=>notices.push(ids));
 try{cloud.settled(1,{rank:1,stars:3,debt:2,blames:1,duration:80});assert.equal(notices.length,0);done(true);await turn();assert.deepEqual(notices,[[1]]);assert.equal(sent[0][0].value,'{"v":1,"debt":2}');cloud.settled(1,{rank:1,stars:3,debt:1,blames:1,duration:80});done(false);await turn();assert.equal(notices.length,1);assert.equal(CloudServices.GLOBAL_RANK,false);}finally{cloud.dispose();}
});
