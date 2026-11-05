// 道具规则走真实Match；不替换碰撞、收锅、时钟或随机算法。
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Match} from '../assets/scripts/core/match.ts';
import {LEVELS} from '../assets/scripts/core/levels.ts';
import {ITEM_DROP_FRACS,ITEM_LIFE} from '../assets/scripts/core/config.ts';
const make = (options={}) => new Match({level:4,seed:1001,itemDrops:true,...options});
// 真实拾取入口：夹具只放道具，不直接调用效果函数。
function pick(m,kind){const {x,y}=m.S.player.sn;m.S.items.drops.push({id:99,kind,x,y,at:m.workT(),expires:m.workT()+12,phase:'ground'});m.updateItems();}
test('清锅立即清掉普通与急件，不记背锅和甩出，空中锅继续飞',()=>{
 const m=make(),p=m.S.player;m.receivePot(p,m.newPot(0));m.receivePot(p,m.newPot(0,true));m.launchPot(0,0,p,0,false,'leader');
 const before={blames:p.blames,thrown:p.thrown,launched:p.launched,booms:m.S.booms};pick(m,'clear');
 assert.equal(p.sn.segs.length,0);assert.equal(m.S.flying.length,1);assert.deepEqual({blames:p.blames,thrown:p.thrown,launched:p.launched,booms:m.S.booms},before);
});
test('延时给身上每口锅加15秒含急件，不改空中锅',()=>{
 const m=make(),p=m.S.player;m.receivePot(p,m.newPot(0));m.receivePot(p,m.newPot(0,true));const due=p.sn.segs.map(v=>v.due);pick(m,'delay');assert.deepEqual(p.sn.segs.map(v=>v.due),due.map(v=>v+15));
});
test('无敌拦下所有飞来的锅（含散会），同事甩来的锅弹回同事身上',()=>{
 const m=make(),p=m.S.player;pick(m,'invincible');
 for(const src of ['sky','leader']){m.launchPot(p.sn.x,p.sn.y,p,0,false,src);m.potHit(p,m.S.flying.at(-1));}
 const bot=m.S.bots[0];m.receivePot(bot,m.newPot(0));const botPots=bot.sn.segs.length;m.fireThrow(bot,p);const f=m.S.throws.at(-1);assert.ok(f);m.landThrow(f,p);
 assert.equal(p.sn.segs.length,0);assert.equal(p.blames,0);assert.equal(p.hitsBy.sky+p.hitsBy.leader+p.hitsBy.mate,0);assert.equal(bot.thrown,0);
 assert.equal(bot.sn.segs.length,botPots); // 弹回甩锅的人，锅不能凭空消失
 m.potHit(p,{src:'burst',label:'返工',hot:false});assert.equal(p.sn.segs.length,0); // 泊舟定：无敌时任何锅都不接
 m.S.t=5;assert.equal(m.itemInvincible(p),false);
});
test('无敌碰领导不加锅，不挡自己甩锅、反甩和抓现行',()=>{
 const m=make(),p=m.S.player,l=m.S.leaders[0];pick(m,'invincible');Object.assign(l,{x:p.sn.x,y:p.sn.y,wait:99});m.updateLeader(l,0);assert.equal(p.sn.segs.length,0);assert.equal(p.hitsBy.bump,0);
 Object.assign(l,{x:p.sn.x-100,y:p.sn.y,face:0});m.receivePot(p,m.newPot(0));m.fireThrow(p);assert.equal(p.caught,1);assert.equal(p.blames,1);assert.equal(p.sn.segs.length,1);
 m.S.leaders=[];p.cool=0;p.stun=0;m.fireThrow(p,m.S.bots[0]);assert.equal(p.sn.segs.length,0);
 const f=m.S.throws[0];f.owner=m.S.bots[0];m.parry(p,f);assert.equal(p.parries,1);
});
test('重复无敌刷新5秒而非叠加，证书仍凭本事',()=>{
 const m=make();pick(m,'invincible');m.S.t=3;pick(m,'invincible');assert.equal(m.S.items.invincibleUntil,8);assert.equal(m.shareOutcome({kind:'cert'}).certificate,'凭本事下班证书');
});
test('预告1秒后落地，12秒过期且同事和领导不能捡，每种提示一局一次',()=>{
 const events=[],m=make({onEvent:e=>events.push(e)}),state=m.S.items,first=state.plan[0];m.S.t=first.at-1;m.updateItems();assert.equal(state.drops[0].phase,'preview');
 const d=state.drops[0];Object.assign(m.S.bots[0].sn,{x:d.x,y:d.y});m.S.t=first.at;m.updateItems();assert.equal(d.phase,'ground');assert.equal(state.stats.picked,0);
 m.S.t=first.at+12;m.updateItems();assert.equal(state.drops.length,0);assert.equal(state.stats.expired,1);
 pick(m,'clear');pick(m,'clear');assert.equal(events.filter(e=>e.kind==='toast'&&String(e.args[0]).includes('身上的锅')).length,1);assert.equal(state.stats.byKind.clear,2);
});
test('周一带教不刷，正式上班按关卡时长折算，结束前不足留地时长不刷',()=>{
 const m=make({level:0,tutorial:true});m.S.t=200;m.updateItems();assert.equal(m.S.items.drops.length,0);m.startWork();const t0=m.S.t0;assert.deepEqual(m.S.items.plan.map(d=>d.at),ITEM_DROP_FRACS.map(f=>Math.round(f*LEVELS[0].duration)).filter(at=>at+ITEM_LIFE<=LEVELS[0].duration));m.S.t=t0+m.S.items.plan[0].at;m.updateItems();assert.equal(m.S.items.drops[0].phase,'ground');
});
test('开关两侧生成道具不消耗原随机流，关闭时完整对局仍与旧统计一致',()=>{
 const a=make({itemDrops:false}),b=make();assert.equal(a.E.rngState(),b.E.rngState());
 const before=b.E.rngState();b.S.t=24;b.updateItems();b.S.t=25;b.updateItems();assert.equal(b.E.rngState(),before);
 assert.deepEqual(Array.from({length:100},()=>a.E.random()),Array.from({length:100},()=>b.E.random()));assert.equal(a.S.items,undefined);
 const c=make();assert.deepEqual(c.S.items.plan,make().S.items.plan);
});
test('自动玩家只捡距离内且路径不穿视野的道具，同事不追道具',()=>{
 const m=make({auto:true}),p=m.S.player;m.S.leaders=[];Object.assign(p.sn,{x:640,y:720});m.S.items.drops=[{id:99,kind:'delay',x:640,y:820,at:0,expires:12,phase:'ground'}];
 assert.equal(m.desiredItem(p),m.S.items.drops[0]);assert.equal(m.desiredItem(m.S.bots[0]),null);
 const l=make().S.leaders[0];Object.assign(l,{x:540,y:770,face:0});m.S.leaders=[l];assert.equal(m.desiredItem(p),null);
 m.S.leaders=[];m.S.items.drops[0].y=1320;assert.equal(m.desiredItem(p),null);
});
test('同帧踩上无敌道具再碰领导，先拾取且不加锅',()=>{
 const m=make(),p=m.S.player,l=m.S.leaders[0];m.S.t=1;p.sn.speed=0;
 m.S.items.drops=[{id:99,kind:'invincible',x:p.sn.x,y:p.sn.y,at:0,expires:12,phase:'ground'}];Object.assign(l,{x:p.sn.x,y:p.sn.y,wait:99});
 m.update(0);assert.equal(p.sn.segs.length,0);assert.equal(m.S.items.stats.picked,1);
});
test('八个道具点都有完整碰撞余量且可从玩家出生点到达',async()=>{
 const {ITEM_DROP_POINTS,OFFICE}=await import('../assets/scripts/core/levels.ts');const m=make();
 assert.equal(ITEM_DROP_POINTS.length,8);
 for(const point of ITEM_DROP_POINTS){assert.equal(m.blocked(point.x,point.y),false,JSON.stringify(point));const path=m.findPath(OFFICE.player.x,OFFICE.player.y,point.x,point.y);assert.deepEqual(path.at(-1),point);}
});
test('simulate缺省关道具，显式开启记录汇总，结束和异常均恢复活动局',()=>{
 const m=make(),state=m.S;assert.equal(m.simulate(0,2,1001).items,undefined);const a=m.simulate(0,2,1001,true),b=m.simulate(0,2,1001,true);assert.deepEqual(a,b);assert.equal(a.items.picked,Object.values(a.items.byKind).reduce((s,n)=>s+n,0));assert.equal(m.S,state);assert.equal(m.itemDrops,true);
 const random=m.E.random;m.E.random=()=>{throw Error('模拟异常');};assert.throws(()=>m.simulate(0,1,1001,false),/模拟异常/);m.E.random=random;assert.equal(m.S,state);assert.equal(m.itemDrops,true);
});
test('自然碰撞入口里无敌消掉来锅，过期后恢复收锅，仍可按键反甩',()=>{
 const m=make({auto:false}),p=m.S.player;pick(m,'invincible');
 m.launchSky(p);m.S.flying[0].t=0;m.updateFlying(0);assert.equal(m.S.flying.length,0);assert.equal(p.sn.segs.length,0);
 m.launchPot(p.sn.x,p.sn.y,p,0,true,'leader');m.updateFlying(0);assert.equal(m.S.flying.length,0);assert.equal(p.sn.segs.length,0);
 const b=m.S.bots[0];m.S.leaders=[];m.receivePot(b,m.newPot(m.S.t));m.fireThrow(b,p);let f=m.S.throws.at(-1);Object.assign(f,{x:p.sn.x,y:p.sn.y});m.updateThrows(0);assert.equal(m.S.throws.length,0);assert.equal(p.sn.segs.length,0);
 b.cool=0;m.receivePot(b,m.newPot(m.S.t));m.fireThrow(b,p);f=m.S.throws.at(-1);Object.assign(f,{x:p.sn.x-30,y:p.sn.y,a:0});m.pressFire(p);assert.equal(p.parries,1);
 m.S.t=5;m.launchSky(p);m.S.flying.at(-1).t=0;m.updateFlying(0);assert.equal(p.sn.segs.length,1);
});
