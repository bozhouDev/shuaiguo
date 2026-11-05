// 清账走真实对局更新；只摆放角色和锅，不替换到期、归责或派锅实现。
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Match} from '../assets/scripts/core/match.ts';
import {LEVELS} from '../assets/scripts/core/levels.ts';
import * as C from '../assets/scripts/core/config.ts';

// 关闭额外日程与自主移动，保留指定领导供派锅和碰撞断言使用。
function fixture(options={}) {
  const events=[], m=new Match({level:4,seed:1001,itemDrops:true,onEvent:e=>events.push(e),...options});
  m.S.schedule=[]; m.S.skyFirst=false;
  for(const a of m.S.agents){a.sn.segs=[];a.thinkT=Infinity;}
  for(const l of m.S.leaders){l.x=900;l.y=40;l.wait=Infinity;l.throwCd=Infinity;}
  return {m,events,p:m.S.player};
}
// 确认清账时间不受周一带教的物理时间影响。
test('五关正式最后15秒进入清账，起点封顶所有身上和甩出的锅',()=>{
  assert.equal(C.CLEARING,15);
  for(let level=0;level<LEVELS.length;level++){
    const {m,p}=fixture({level});m.S.leaders=[];
    m.S.t0=200;m.S.t=200+m.L.duration-15-0.01;
    const pot=m.newPot(m.S.t);pot.due=1000;m.receivePot(p,pot);
    const early=m.newPot(m.S.t);early.due=m.S.t+1;m.receivePot(p,early);
    const b=m.S.bots[0],thrown=m.newPot(m.S.t);thrown.due=1000;m.receivePot(b,thrown);m.fireThrow(b,p);
    m.update(0);assert.equal(pot.due,1000,'起点前不封顶');
    m.update(0.01);assert.equal(pot.due,m.S.t0+m.L.duration);
    assert.ok(early.due<m.S.t0+m.L.duration,'更早的到期不推迟');
    assert.equal(m.S.throws[0].pot.due,m.S.t0+m.L.duration);
  }
});
test('清账群消息整局一次，周一带教不触发且正式时钟从零起',()=>{
  const {m,events}=fixture({level:0,tutorial:true});m.S.t=200;m.update(0);
  assert.equal(events.filter(e=>e.kind==='showMsg'&&String(e.args[0]).includes('一律追责')).length,0);
  m.startWork();m.S.schedule=[];m.S.skyFirst=false;m.S.t+=m.L.duration-15;m.update(0);m.update(0);
  const msgs=events.filter(e=>e.kind==='showMsg'&&String(e.args[0]).includes('一律追责'));
  assert.equal(msgs.length,1);assert.equal(msgs[0].args[0],`【全员群】行政：${m.clockAt(m.L.duration-15)} 了，手里的锅下班前一律追责`);
});
test('清账取消瞄准与发火、冻结派锅冷却，天降与随机事件停派，查岗照走',()=>{
  const {m,p}=fixture(),l=m.S.leaders[0];m.S.t=m.L.duration-15;
  Object.assign(l,{state:'aim',aimT:0,targets:[p],throwCd:0,rageUntil:m.S.t+20,wait:0});
  m.update(0);assert.equal(m.S.flying.length,0);assert.equal(l.throwCd,0);assert.equal(m.raging(l),false);
  m.updateLeader(l,1);assert.equal(m.S.flying.length,0);assert.equal(l.throwCd,0);
  m.launchSky(p,l);m.startEvent('printer');m.startEvent('p0');m.startIncident({kind:'rage',t:0});
  assert.equal(m.S.flying.length,0);assert.equal(m.raging(l),false);
  m.startIncident({kind:'inspect',t:0});const old=[l.x,l.y];m.updateLeader(l,.1);
  assert.notDeepEqual([l.x,l.y],old);assert.ok(l.inspectUntil>m.S.t);
});
test('清账内延时、急件落地、撞领导、开局补锅及弹回均封顶到铃响',()=>{
  const {m,p}=fixture();m.S.t=m.L.duration-2;m.update(0);
  const pot=m.newPot(m.S.t,true);m.receivePot(p,pot);
  const early=m.newPot(m.S.t);early.due=m.S.t+.5;m.receivePot(p,early);
  m.pickItem({kind:'delay'});assert.equal(pot.due,m.L.duration);
  assert.equal(early.due,m.L.duration,'延时仍按原效果加15秒，最后封顶；不额外禁止延长较早到期的锅');
  m.potHit(p,{src:'leader',hot:true,label:'急件'});assert.equal(p.sn.segs.at(-1).due,m.L.duration);
  const l=m.S.leaders[0];Object.assign(l,{x:p.sn.x,y:p.sn.y});const count=m.potsOf(p);m.updateLeader(l,0);
  assert.equal(m.potsOf(p),count+C.LEADER_HIT_POTS);assert.ok(p.sn.segs.every(v=>v.due<=m.L.duration));
  m.giveStartPots(m.S.bots[0].sn,m.S.t);assert.ok(m.S.bots[0].sn.segs.every(v=>v.due<=m.L.duration));
  m.S.leaders=[];m.fireThrow(p,m.S.bots[0]);const f=m.S.throws.at(-1);m.parry(m.S.bots[0],f);m.missThrow(f);
  assert.equal(f.pot.due,m.L.duration);
});
test('铃响前按普通和急件逐口追责，身上和空中全清零，小舅子归最后发送者',()=>{
  const {m,p}=fixture();m.S.leaders=[];m.S.t=m.L.duration-0.005;
  for(const a of m.S.agents){m.receivePot(a,m.newPot(m.S.t));m.receivePot(a,m.newPot(m.S.t,true));}
  const n=m.S.agents.find(a=>a.key==='nephew'),b=m.S.bots[0];
  n.sn.segs.forEach(pot=>{pot.nephewSender=b;pot.passAt=Infinity;});
  const initial=new Map(m.S.agents.map(a=>[a,a.blames]));
  m.fireThrow(p,b);m.S.throws[0].x=480;m.S.throws[0].y=300;
  // 领导未命中的锅没有在榜责任人，铃响时清掉，不能栽到目标身上。
  m.launchPot(20,20,p,10,true,'leader');
  m.update(1/60);assert.equal(m.S.over,'time');
  for(const a of m.S.agents){assert.equal(m.potsOf(a),0);assert.equal(m.debtOf(a),a.blames);assert.equal(a.blames-initial.get(a),a===n?0:(1+C.P0_BLAME)*(a===b?2:1));}
  assert.equal(m.S.throws.length,0);assert.equal(m.S.flying.length,0);assert.ok(Number.isInteger(m.calculateResult('time').lineInfo.gap));
});
test('铃响也清掉已压垮角色遗留的锅，空中锅按当前甩出者追责',()=>{
  const {m,p}=fixture();m.S.leaders=[];m.S.t=m.L.duration-.005;const b=m.S.bots[0];
  b.crushed=true;b.crushedAt=1;m.receivePot(b,m.newPot(m.S.t,true));
  m.receivePot(p,m.newPot(m.S.t));m.fireThrow(p,b);const f=m.S.throws[0];m.parry(b,f);f.x=480;f.y=300;
  m.update(1/60);assert.equal(m.potsOf(b),0);assert.equal(b.blames,C.P0_BLAME+1);assert.equal(p.blames,0);assert.equal(m.S.throws.length,0);
});
test('清账内玩家甩、同事互甩、小舅子塞锅与反甩照常发生',()=>{
  const {m,p}=fixture();m.S.leaders=[];m.S.t=m.L.duration-5;m.update(0);
  const b=m.S.bots[0],c=m.S.bots[1],n=m.S.agents.find(a=>a.key==='nephew');
  for(const a of [p,b,c,n]){a.sn.x=480;a.sn.y=720;}
  m.receivePot(p,m.newPot(m.S.t));m.pressFire(p);assert.equal(p.launched,1);
  m.receivePot(b,m.newPot(m.S.t));assert.equal(m.fireThrow(b,c),true);m.parry(c,m.S.throws.at(-1));assert.equal(c.parries,1);
  m.receivePot(n,m.newPot(m.S.t),p);n.sn.segs[0].passAt=m.S.t;m.passNephewPot(n);assert.equal(n.launched,1);
});
test('周一下午茶是停派唯一例外，仍给4口并封顶，后续普通派锅不恢复',()=>{
  const {m,p}=fixture({level:0});m.S.t=m.L.finale.t;m.update(0);const l=m.S.leaders[0];
  const before=m.potsOf(p);m.startFinale(m.L.finale);assert.equal(m.potsOf(p)-before,m.L.finale.pots);assert.ok(p.sn.segs.every(v=>v.due<=m.L.duration));
  l.throwCd=0;m.updateLeader(l,1);assert.equal(m.S.flying.length,0);
});
test('每关散会、随机事件及预告、发火和画饼均在清账起点前，查岗和周一收尾按例外',()=>{
  for(let level=0;level<LEVELS.length;level++){
    const m=new Match({level,seed:1001,itemDrops:false}),end=m.L.duration-15;
    for(const b of m.L.bursts)assert.ok(b.t<end);
    if(m.L.events?.n)assert.ok(m.L.events.window[1]+2<end);
    for(const inc of m.L.incidents||[])if(inc.kind==='rage')assert.ok(inc.t+C.RAGE_TIME<end);
    for(const meeting of m.L.pieMeetings||[])assert.ok(meeting.t+meeting.duration<end);
    for(const it of m.S.schedule)if(it.act!=='incident'||it.inc.kind!=='inspect')assert.ok(it.t<end);
    assert.ok(C.SKY_FIRST+C.SKY_TIME<end);
  }
});
test('天降预警不会跨入清账，临界派锅回到普通瞄准而不改变冷却节奏',()=>{
  const {m,p}=fixture({level:1}),l=m.S.leaders[0];m.L=JSON.parse(JSON.stringify(m.L));m.L.skyChance=1;
  m.S.t=m.L.duration-15-C.SKY_TIME+.01;m.S.pace=m.L.pace[0];Object.assign(l,{x:640,y:300,throwCd:0});
  m.updateLeader(l,0);assert.equal(m.S.flying.filter(f=>f.src==='sky').length,0);
  assert.equal(l.state,'aim');assert.ok(l.throwCd>0);
});
test('最后10秒横幅与末5秒大字共用滴答，每秒重复刷新只响一次',()=>{
  const {m,events}=fixture();m.S.t=m.L.duration-15;m.update(0);events.length=0;
  for(let left=10;left>0;left--){m.S.t=m.L.duration-left; m.updateClosingNotice();m.updateClosingNotice();}
  const ticks=events.filter(e=>e.kind==='sfx'&&['tick','tickUrgent'].includes(e.args[0]));assert.equal(ticks.length,10);
});
