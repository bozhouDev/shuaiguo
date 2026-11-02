// 周五契约：排名名额、查账目标、视野和护短，不依赖随机对局结果。
const assert = require('node:assert/strict');
const { setup } = require('./game-harness.cjs');
const {ctx} = setup(), t = ctx.TEST;
assert.equal(ctx.LEVELS.length, 5);
const s = t.init(4), p = s.player, n = s.bots.find(a=>a.key==='nephew');
const wife = s.leaders.find(l=>l.type==='wife'), boss = s.leaders[0];
assert.equal(ctx.LEVELS[4].passRank,2);
s.agents.forEach((a,i)=>{a.blames=i; a.sn.segs=[];});
assert.equal(t.ranking()[0],n); assert.equal(t.ranking()[1],p);
assert.equal(t.starsOfRank(2),3); assert.equal(t.starsOfRank(3),0);
assert.equal(t.pickTargets(wife)[0],p);
p.blames=99; assert.equal(t.pickTargets(wife)[0],s.bots[0]);
n.crushed=true;n.crushedAt=1;assert.equal(t.ranking().at(-1),n);
p.blames=0;assert.equal(t.ranking()[0],p);assert.equal(t.starsOfRank(2),3);
// 小舅子在两位亲属视野重叠处，按姐姐更重的惩罚；经理不护短。
n.crushed=false;wife.x=boss.x=400;wife.y=boss.y=720;wife.face=boss.face=0;
n.sn.x=500;n.sn.y=720;assert.equal(t.nephewGuardian(n),wife);
const before=p.blames;t.landThrow({owner:p,pot:t.newPot(s.t),bounces:0},n);assert.equal(p.blames,before+3);
wife.face=Math.PI;assert.equal(t.nephewGuardian(n),boss);
const b=p.blames;t.landThrow({owner:p,pot:t.newPot(s.t),bounces:0},n);assert.equal(p.blames,b+2);
boss.face=Math.PI;assert.equal(t.nephewGuardian(n),null);
// 25 度在老板视野内，但已在老板娘的 22.5 度半角外。
wife.face=boss.face=0;n.sn.x=400+100*Math.cos(25*Math.PI/180);n.sn.y=720+100*Math.sin(25*Math.PI/180);
assert.equal(t.seenBy(n,'wife'),null);assert.equal(t.seenBy(n,'boss'),boss);
t.leaderAlert(p,n);assert.equal(wife.state,'chase');assert.equal(wife.chase,p);
console.log('周五排名、目标、视野、护短、追责契约通过');
// 最后一关即使压垮小舅子也必须发证书，且不改证书原文案。
for (const helped of [false,true]) {
 const card=t.shareCard({kind:'cert',nephewCrushed:true,revived:helped,rescued:false,blames:0,day:'周五'});
 assert(card.pic.includes(helped?'关系户下班证书':'凭本事下班证书'));
}
// 旧关星级保持 3/2/1；老板娘的预警短于老板，路线节点可通行。
for(let i=0;i<4;i++){t.init(i);assert.deepEqual([1,2,3,4].map(t.starsOfRank),[3,2,1,0]);}
const fresh=t.init(4), fw=fresh.leaders.find(l=>l.type==='wife');
for(const point of ctx.OFFICE.routes.wife)assert.equal(t.blocked(point.x,point.y),false);
fresh.agents.forEach((a,i)=>{a.blames=i;a.sn.segs=[]});fresh.pace={every:5};fw.throwCd=0;t.updateLeader(fw,0);
assert.equal(fw.aimT,.6);assert.equal(fw.pieSay,'账做得这么干净？我查查');
fresh.player.crushed=true;assert.notEqual(t.pickTargets(fw)[0],fresh.player);
// 真实结算与广告回调：前二三星、第三失败、顶包重算可领关系户证书。
let html='', handlers={};ctx.E.showPanel=(h,f)=>{html=h;handlers=f};ctx.E.fakeAd=cb=>cb();
fresh.player.crushed=false;fresh.agents.forEach((a,i)=>{a.blames=a.key==='nephew'?0:i+5;a.sn.segs=[]});fresh.player.blames=1;
t.finish('time');assert.equal((html.match(/alt="★"/g)||[]).length,3);assert(html.includes('我们是大小周，明天照常上班'));assert(html.includes('领证书'));
fresh.player.blames=7;t.finish('time');assert(html.includes('data-act="rescue"'));handlers.rescue();assert(fresh.rescued);assert.equal(fresh.player.blames,4);assert(html.includes('领证书'));
fresh.player.sn.segs=Array.from({length:12},()=>t.newPot(fresh.t));t.finish('crushed');assert(html.includes('data-act="revive"'));handlers.revive();assert(fresh.revived);assert.equal(fresh.player.sn.segs.length,6);assert.equal(fresh.over,null);
console.log('周五星级、路线、预警、证书及广告回归通过');
