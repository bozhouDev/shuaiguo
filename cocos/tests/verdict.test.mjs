// 结算分档走真实排名与纯文案入口，夹具只定义本局账目和真实记录。
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Match} from '../assets/scripts/core/match.ts';

// 四人榜第三名为下班线，玩家甩得少；差距全部是清账后的整数背锅。
function fixture(gap=1,level=0){
 const m=new Match({seed:1001,level,itemDrops:false,progress:{unlocked:5,best:{},tutDone:true}});
 m.S.agents.forEach((a,i)=>{a.sn.segs=[];a.blames=a.isPlayer?5+gap:i===1?1:i===2?3:5;a.thrown=a.isPlayer?2:8;});
 m.S.player.blameLog=[];m.S.rankTrail=[];m.S.t=m.L.duration;
 return m;
}
// 动态加载确保未实现前广告资格仍能单独跑红，文案缺模块明确报错。
async function copy(m,reason='time'){return (await import('../assets/scripts/core/verdict.ts')).verdict(m.calculateResult(reason),m);}

test('顶锅真算：减三能进线显示，仍落榜及已使用不显示',()=>{
 const m=fixture(4);assert.equal(m.calculateResult('time').ads.rescue,false);
 m.S.player.blames=7;assert.equal(m.calculateResult('time').ads.rescue,true);
 m.S.rescued=true;assert.equal(m.calculateResult('time').ads.rescue,false);
});
test('假想重排沿用平分/压垮/小舅子规则，逐字段不改原状态',async()=>{
 const {hypotheticalRank}=await import('../assets/scripts/core/verdict.ts');
 const m=fixture(1),before=structuredClone(m.S);
 assert.deepEqual(hypotheticalRank(m,1),{rank:4,gap:0});
 assert.deepEqual(hypotheticalRank(m,2),{rank:3,gap:1});
 assert.deepEqual(structuredClone(m.S),before);
 const fri=fixture(1,4);fri.S.agents.forEach(a=>{a.blames=a.isPlayer?2:1;a.thrown=a.isPlayer?20:1;});
 assert.equal(hypotheticalRank(fri,1).rank,2);assert.equal(fri.calculateResult('time').ads.rescue,true);
 fri.S.player.blames=10;assert.equal(fri.calculateResult('time').ads.rescue,false);
});
test('打平：甩出数不同写真实数，相等不写手快副句',async()=>{
 const m=fixture(0),a=m.ranking()[2];let v=await copy(m);
 assert.equal(v.main,`和第 3 名${a.name}背锅一样多`);assert.equal(v.sub,'他甩出去 8 口，你 2 口，手快的留下');assert.equal(v.retryLabel,'再来一局，就差那一口');
 m.S.player.thrown=8;v=await copy(m);assert.equal(v.sub,'');
});
test('差一：最后真实日志时刻，减一能进线才写假想名次',async()=>{
 const m=fixture(1),p=m.S.player;p.blameLog=[{t:40,clock:m.clockAt(40),n:1,src:'mate',from:'老周'}];
 let v=await copy(m);assert.equal(v.main,'离下班线就差 1 口');assert.equal(v.sub,'');
 p.thrown=20;v=await copy(m);assert.equal(v.sub,`${p.blameLog[0].clock} 老周甩你的那口，甩出去你就是第 3 名`);
 for(const [src,from,phrase]of [['caught','老板','被抓现行那次不算'],['protect','老板娘','当着老板娘甩小舅子那次不算']]){p.blameLog=[{t:40,clock:m.clockAt(40),n:1,src,from}];assert.equal((await copy(m)).sub,`${m.clockAt(40)} ${phrase}，你就是第 3 名`);}
});
test('差二到三：多口事件优先，假想仍落榜写真实gap，清账统计次之',async()=>{
 const m=fixture(3),p=m.S.player;p.blameLog=[{t:30,clock:m.clockAt(30),n:2,src:'protect',from:'老板'}];
 let v=await copy(m);assert.equal(v.main,`差 3 口。${m.ranking()[2].name} 5 次，你 8 次`);assert.equal(v.sub,`${m.clockAt(30)} 当着老板甩小舅子 +2 太狠，不然就差 1 口`);assert.equal(v.retryLabel,'再打一次');
 p.blameLog=[{t:30,clock:m.clockAt(30),n:3,src:'p0',from:''}];p.thrown=20;assert.match((await copy(m)).sub,/不然就过了$/);
 p.blameLog=[];p.bellPots=2;p.clearingThrown=4;assert.equal((await copy(m)).sub,'最后 15 秒你还甩出去 4 口，手里那 2 口没来得及');
});
test('差四以上：多口事件、后半程最后在线名次、全场最多依次取首个',async()=>{
 const m=fixture(4),p=m.S.player;p.blameLog=[{t:30,clock:m.clockAt(30),n:3,src:'p0',from:''}];
 let v=await copy(m);assert.equal(v.main,'今天差得有点多');assert.equal(v.sub,`${m.clockAt(30)} 急件炸在你手里 +3 太狠`);assert.equal(v.retryLabel,'再来');
 p.blameLog=[];m.S.rankTrail=Array.from({length:m.L.duration+1},(_,i)=>i===35?2:4);assert.equal((await copy(m)).sub,`${m.clockAt(35)} 你还排第 2`);
 m.S.rankTrail=[];p.thrown=8;assert.equal((await copy(m)).sub,'你甩出去 8 口，全场最多，就是背得也多');
 p.thrown=0;assert.equal((await copy(m)).sub,'');
});
test('撞领导事件按同次id聚合，时间取撞击，铃响orig仍能追源',async()=>{
 const m=fixture(2),p=m.S.player;p.thrown=20;
 p.blameLog=[0,1,2].map(i=>({t:59+i/10,clock:m.clockAt(59),n:1,src:'bell',from:'老板',orig:{src:'bump',from:'老板'},origin:{src:'bump',from:'老板',t:20,id:7}}));
 assert.equal((await copy(m)).sub,`${m.clockAt(20)} 撞上老板 +3 太狠，不然就过了`);
});
test('压垮主句读常量，前十秒名次按t0寻址，越界/线外不写副句',async()=>{
 const {MAX_POTS}=await import('../assets/scripts/core/config.ts'),m=fixture();m.S.t0=100;m.S.t=140;m.S.rankTrail=Array(31).fill(2);
 let v=await copy(m,'crushed');assert.equal(v.main,`堆到 ${MAX_POTS} 口，压垮了`);assert.equal(v.sub,'压垮前 10 秒你还排第 2');assert.equal(v.retryLabel,'再熬一天');
 m.S.rankTrail[30]=4;assert.equal((await copy(m,'crushed')).sub,'');m.S.rankTrail=[];assert.equal((await copy(m,'crushed')).sub,'');
});
test('过关：正差值绿字，打平按甩得多说明，不写副句',async()=>{
 const m=fixture(-2);let v=await copy(m);assert.equal(v.main,'领先加班线 2 口');assert.equal(v.color,'#2F9E6B');assert.equal(v.sub,'');
 m.S.player.blames=5;m.S.player.thrown=20;v=await copy(m);assert.equal(v.main,'和第 4 名背锅一样多，靠甩得多留下来的');
});
test('假想减三打平仍输不显示顶锅，周五小舅子占名额且不按普通同事重排',async()=>{
 const m=fixture(3);assert.equal(m.calculateResult('time').ads.rescue,false,'减三打平但甩得少仍第四');m.S.player.thrown=20;assert.equal(m.calculateResult('time').ads.rescue,true);
 const fri=fixture(0,4);fri.S.agents.forEach((a,i)=>{a.blames=a.isPlayer?5:a.key==='nephew'?100:i===1?1:9;a.thrown=a.isPlayer?20:0;});
 const {hypotheticalRank}=await import('../assets/scripts/core/verdict.ts');assert.equal(hypotheticalRank(fri,3).rank,3);assert.equal(fri.calculateResult('time').ads.rescue,false);
 fri.S.player.blames=4;assert.equal(hypotheticalRank(fri,3).rank,2);assert.equal(fri.calculateResult('time').ads.rescue,true);
});
test('真实对局副句时钟能回查来源记录或对应整秒轨迹，文案生成逐字段不改S',async()=>{
 const {verdict}=await import('../assets/scripts/core/verdict.ts');
 for(let level=0;level<5;level++)for(const seed of [1001,1002,1003]){
  const m=new Match({level,seed,itemDrops:false,simulating:true,auto:true});while(!m.S.over)m.update(1/30);
  const r=m.calculateResult(m.S.over);const require=(await import('node:module')).createRequire(import.meta.url),{state}=require('../../tests/golden/extra.cjs');
  const before=state(m),v=verdict(r,m);assert.deepEqual(state(m),before);
  const clock=v.sub.match(/^\d\d:\d\d/)?.[0];if(clock){const times=m.S.player.blameLog.flatMap(log=>[log.clock,...(log.origin?[m.clockAt(log.origin.t-m.S.t0)]:[])]).concat(m.S.rankTrail.map((_,second)=>m.clockAt(second)));assert.ok(times.includes(clock),`${level}/${seed}/${v.sub}`);}
 }
});
test('差一取最后一条日志，重复碰撞聚合不能把中间的抓现行误当成最后事件',async()=>{
 const m=fixture(1),p=m.S.player;p.thrown=20;const origin={src:'bump',from:'老板',id:1,t:10};
 p.blameLog=[{t:55,clock:m.clockAt(55),n:1,src:'bump',from:'老板',origin},{t:56,clock:m.clockAt(56),n:1,src:'caught',from:'经理'},{t:59,clock:m.clockAt(59),n:1,src:'bump',from:'老板',origin}];
 assert.equal((await copy(m)).sub,`${m.clockAt(10)} 撞上老板派的那口，甩出去你就是第 3 名`);
});
test('晚段压垮复活拨钟后，保留的碰撞锅仍引用撞击时实际显示的时钟',async()=>{
 const m=new Match({level:1,seed:1001,itemDrops:false}),p=m.S.player,l=m.S.leaders[0];
 m.S.schedule=[];m.S.skyFirst=false;m.S.agents.forEach(a=>{a.sn.segs=[];a.thinkT=Infinity;});
 m.S.t=m.L.duration-5;const collidedClock=m.clockAt(m.workT());Object.assign(l,{x:p.sn.x,y:p.sn.y,wait:Infinity,throwCd:Infinity});m.updateLeader(l,0);
 m.addPots(p,9,0,0);m.update(0);assert.equal(m.S.over,'crushed');m.revive();assert.equal(m.workT(),m.L.duration-15);
 const bumps=p.sn.segs.filter(pot=>pot.origin.src==='bump');assert.equal(bumps.length,3);m.S.t+=1;bumps.forEach(pot=>pot.due=m.S.t);m.updateDue();
 const v=await copy(m);assert.ok(v.sub.startsWith(collidedClock+' '),`${collidedClock} / ${v.sub}`);
 p.sn.segs=[];p.thrown=100;m.S.bots.forEach(a=>a.blames=2);assert.ok((await copy(m)).sub.startsWith(collidedClock+' '),'差1末条来源同样保留复活前实际时钟');
});
