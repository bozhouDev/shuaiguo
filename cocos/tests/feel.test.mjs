// 爽感只加归因、账目与事件；真实入口验证，不替换排名或到期算法。
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Match} from '../assets/scripts/core/match.ts';
import {verdict} from '../assets/scripts/core/verdict.ts';
// 关闭无关日程和自主移动，保留真实接锅、甩锅、到期及排序入口。
function fixture(options={}) {
 const events=[],m=new Match({level:1,seed:1001,itemDrops:false,onEvent:e=>events.push(e),...options});
 m.S.leaders=[];m.S.schedule=[];m.S.skyFirst=false;
 for(const a of m.S.agents){a.sn.segs=[];a.thinkT=Infinity;a.sn.speed=0;}
 return {m,p:m.S.player,b:m.S.bots[0],events};
}
// 让真实飞出对象直接命中目标；不代填归属、计数或反馈事件。
function hit(m,a,b,hot=false) {
 m.receivePot(a,m.newPot(m.S.t,hot));m.fireThrow(a,b);const f=m.S.throws.pop();m.landThrow(f,b);return f.pot;
}
test('甩出写最后甩锅人，反甩改为弹回者，直接派锅为null',()=>{
 const {m,p,b}=fixture();const pot=m.newPot(0);assert.equal(pot.lastThrower,null);m.receivePot(p,pot);m.fireThrow(p,b);const f=m.S.throws[0];assert.equal(f.pot.lastThrower,p);m.parry(b,f);assert.equal(f.pot.lastThrower,b);
 for(const src of ['leader','sky','burst','p0']){m.potHit(p,{src,label:'测试',hot:src==='p0'});assert.equal(p.sn.segs.at(-1).lastThrower,null);}
 m.addPots(p,1,0,0,{src:'bump',from:'经理',t:0});assert.equal(p.sn.segs.at(-1).lastThrower,null);
});
test('玩家两口锅同帧炸在同事身上逐口记账但只定格一次，同事转甩不记玩家',()=>{
 const {m,p,b,events}=fixture();const a=hit(m,p,b),c=hit(m,p,b,true);a.due=c.due=1;m.S.t=1;events.length=0;m.updateDue();
 assert.equal(p.kills[b.name],2);assert.equal(events.filter(e=>e.kind==='ownedBlame').length,2);assert.equal(events.filter(e=>e.kind==='ownedBoom').length,1);assert.equal(b.blames,4);
 const other=m.S.bots[1],pot=hit(m,p,b);m.fireThrow(b,other);const f=m.S.throws.pop();m.landThrow(f,other);pot.due=2;m.S.t=2;events.length=0;m.updateDue();assert.equal(events.filter(e=>e.kind==='ownedBoom').length,0);assert.equal(p.kills[other.name],undefined);
});
test('名次跨多人点名现在正下方或正上方，线内下滑及带教不喊',()=>{
 const {m,p,events}=fixture();m.S.agents.forEach((a,i)=>a.blames=i);p.blames=10;m.update(0);events.length=0;p.blames=0;m.update(0);
 assert.deepEqual(events.find(e=>e.kind==='rankCallout')?.args[0],{from:4,to:1,who:m.ranking()[1].name});
 events.length=0;p.blames=2.5;m.update(0);assert.equal(events.filter(e=>e.kind==='rankCallout').length,0);
 events.length=0;p.blames=10;m.update(0);assert.deepEqual(events.find(e=>e.kind==='rankCallout')?.args[0],{from:3,to:4,who:m.ranking()[2].name});
 const tut=fixture({level:0,tutorial:true});tut.p.blames=30;tut.m.update(0);assert.equal(tut.events.filter(e=>e.kind==='rankCallout').length,0);
});
test('清账起点线外铃响线内产生压哨结果与事件，反向及广告顶包没有',()=>{
 const {m,p,events}=fixture();m.S.agents.forEach((a,i)=>a.blames=i);p.blames=10;m.S.t=m.L.duration-15;m.updateClearing();assert.equal(m.S.clearingRank,4);
 p.blames=0;m.S.t=m.L.duration;m.S.over='time';m.startClosing();const r=m.calculateResult('time');assert.deepEqual(r.buzzer,{from:4,to:1});assert.equal(verdict(r,m).main,'最后 15 秒从第 4 翻到第 1');assert.equal(events.filter(e=>e.kind==='buzzer').length,1);m.calculateResult('time');assert.equal(events.filter(e=>e.kind==='buzzer').length,1);
 m.S.clearingRank=1;p.blames=10;assert.equal(m.calculateResult('time').buzzer,null);
 m.S.clearingRank=5;p.blames=0;m.S.rescued=true;assert.equal(m.calculateResult('time').buzzer,null);
});

test('台词逐人顺序轮换，十秒内第三次针对我，同事互甩静默且不额外抽随机数',()=>{
 const {m,p,b,events}=fixture();const speech=[];
 for(const t of [0,11,22,33]){m.S.t=t;hit(m,p,b);speech.push(events.filter(e=>e.kind==='mateSpeech').at(-1).args[0].text);b.sn.segs=[];}
 assert.deepEqual(speech,['这不归财务管！','我先记一笔','又是我？','这不归财务管！']);
 const other=m.S.bots[1];events.length=0;hit(m,b,other);assert.equal(events.filter(e=>e.kind==='mateSpeech').length,0);
 for(const t of [50,51,52]){m.S.t=t;hit(m,p,b);}assert.equal(events.filter(e=>e.kind==='mateSpeech').at(-1).args[0].text,'你是不是针对我');
 // 普通命中链无须抽随机，预建锅后把RNG调用设为失败，确保台词无随机挑选。
 b.sn.segs=[];m.receivePot(p,m.newPot(53));m.fireThrow(p,b);const f=m.S.throws.pop();m.E.random=()=>{throw Error('额外抽随机数');};m.landThrow(f,b);
});
test('报仇五秒内回甩逐次记数，第三次可喊冤冤相报，边界及过期不触发',()=>{
 const {m,p,b,events}=fixture();
 for(let i=0;i<3;i++){m.S.t=i*12;hit(m,b,p);assert.equal(b.grudgeUntil,m.S.t+5);m.S.t+=4.9;hit(m,p,b);p.sn.segs=[];b.sn.segs=[];}
 assert.deepEqual(events.filter(e=>e.kind==='revenge').map(e=>e.args[0].count),[1,2,3]);
 m.S.t=40;hit(m,b,p);m.S.t=45;hit(m,p,b);m.S.t=46;hit(m,p,b);assert.equal(p.revengeCount,3);
});
test('普通与急件被同事甩中到期发替换飘字，玩家自甩与直接派锅不改',()=>{
 const {m,p,b,events}=fixture();for(const hot of [false,true]){const pot=hit(m,b,p,hot);pot.due=m.S.t;m.updateDue();const feedback=events.filter(e=>e.kind==='mateBlame').at(-1);assert.equal(feedback.args[0].text,`背锅 +${hot?3:1} · 会计甩的`);}
 events.length=0;const pot=m.newPot(0);pot.due=0;m.receivePot(p,pot);m.updateDue();assert.equal(events.filter(e=>e.kind==='mateBlame').length,0);
});
test('只统计身上到期的玩家锅，小舅子身上到点算回玩家、不放庆祝也不计受害者，空中锅不算受害者',()=>{
 const {m,p,events}=fixture({level:4}),n=m.S.agents.find(a=>a.key==='nephew');const pot=hit(m,p,n);events.length=0;pot.due=0;m.updateDue();assert.equal(n.blames,0);assert.equal(p.blames,1);assert.equal(p.kills[n.name]??0,0);assert.equal(events.filter(e=>e.kind==='ownedBlame'||e.kind==='ownedBoom').length,0);
 events.length=0;const b=m.S.bots[0];m.receivePot(p,m.newPot(0));m.fireThrow(p,b);m.S.throws[0].pot.due=0;m.updateDue();assert.equal(events.filter(e=>e.kind==='ownedBoom').length,0);
});
test('压垮后不发名次喊话，名次观察不修改tips名额',()=>{
 const {m,p,events}=fixture();const before=JSON.stringify(m.S.tipsShown);p.blames=50;m.S.over='crushed';m.reportRank();assert.equal(events.filter(e=>e.kind==='rankCallout').length,0);assert.equal(JSON.stringify(m.S.tipsShown),before);
});
test('战报三行有数据才出现，害你最多包含铃响同事来源，并列取最早达到最终数者',async()=>{
 const {battleLines}=await import('../assets/scripts/core/verdict.ts');const {m,p}=fixture();assert.deepEqual(battleLines(m),[]);
 p.kills={会计:2,新来的:2};p.killOrder={会计:4,新来的:3};p.closestThrow={seconds:1.24,clock:'17:59'};
 p.blameLog=[{src:'mate',from:'会计',n:1},{src:'mate',from:'新来的',n:1},{src:'bell',orig:{src:'mate',from:'新来的'},n:1},{src:'mate',from:'会计',n:1},{src:'leader',from:'老板',n:3}];
 assert.deepEqual(battleLines(m),['最大受害者：新来的（炸在他身上 2 口）','害你最多：新来的（甩你 2 口）','最险一口：17:59 剩 1.2 秒甩出去的那口']);
 p.closestThrow.seconds=3;assert.equal(battleLines(m).length,2);p.kills={};p.blameLog=[];assert.deepEqual(battleLines(m),[]);
});
test('最险一口记录成功命中时剩余秒数，较晚的宽裕命中和甩空不覆盖',()=>{
 const {m,p,b}=fixture();m.S.t=10;const pot=m.newPot(10);pot.due=12;m.receivePot(p,pot);m.fireThrow(p,b);const f=m.S.throws.pop();m.S.t=10.76;m.landThrow(f,b);assert.deepEqual(p.closestThrow,{seconds:1.2400000000000002,clock:m.clockAt(m.workT())});
 m.S.t=11;hit(m,p,b);assert.equal(p.closestThrow.seconds,1.2400000000000002);const close=m.newPot(11);close.due=11.1;m.receivePot(p,close);m.fireThrow(p,b);m.missThrow(m.S.throws.pop());assert.equal(p.closestThrow.seconds,1.2400000000000002);
});
test('同帧命中后到期的最险记录保留原值，四舍五入为零时不显示负零',async()=>{
 const {battleLines}=await import('../assets/scripts/core/verdict.ts'),{m,p}=fixture();p.closestThrow={seconds:-1/60,clock:'17:02'};const before={...p.closestThrow};
 assert.deepEqual(battleLines(m),['最险一口：17:02 剩 0.0 秒甩出去的那口']);assert.deepEqual(p.closestThrow,before);
});
