// 周四关键规则回归：命中窗口、会议、拾取、增益与地图边界。
const assert = require('node:assert/strict');
const { setup } = require('./game-harness.cjs');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }
// 统一摆到空过道，避免测试被随机巡逻和开局锅干扰。
function fixture() {
  const env = setup(), { ctx } = env, t = ctx.TEST;
  ctx.Math.random = () => 0.5;
  const s = t.init();
  s.agents.forEach((a, i) => { a.sn.segs = []; a.sn.x = 100 + i * 90; a.sn.y = 720; a.sn.angle = 0; });
  s.leaders.forEach((l) => { l.x = 640; l.y = 300; l.face = -Math.PI / 2; });
  return { ...env, t, s, p: s.player, boss: s.leaders[0], cashier: s.bots.find(a => a.key === 'cashier') };
}
test('周四八人、七人排名，出生点均在空地', () => {
  const { ctx, t, s } = fixture();
  assert(ctx.LEVELS.length >= 4); assert.equal(s.agents.length, 8); assert.equal(t.ranking().length, 7);
  for (const p of [ctx.OFFICE.player, ...ctx.OFFICE.spawns]) assert.equal(t.blocked(p.x, p.y), false);
  assert.equal(ctx.LEVELS[3].theme, 'autumn');
});
test('两次会议提前2.5秒预告，上午下午各一次', () => {
  const { t } = fixture(), list = t.buildSchedule(null), meetings = list.filter(i => i.act === 'pieMeeting');
  assert.equal(meetings.length, 2); assert(meetings[0].t < 40); assert(meetings[1].t > 40);
  for (const m of meetings) assert(list.some(i => i.t === m.t - 2.5 && i.text.includes('三分钟短会')));
});
test('老板讲话站定且不派锅，四张饼完整落在空地', () => {
  const { ctx, t, s, boss } = fixture();
  s.pace = { every: 1 }; boss.throwCd = 0; boss.state = 'aim'; boss.targets = [s.player];
  t.startPieMeeting(ctx.LEVELS[3].pieMeetings[0]);
  const xy = [boss.x, boss.y];
  for (let i = 0; i < 35; i++) { s.t += 0.1; t.updateLeader(boss, 0.1); }
  assert.deepEqual([boss.x, boss.y], xy); assert.equal(s.flying.length, 0); assert(boss.meeting);
  s.t += 0.2; t.updateLeader(boss, 0.2);
  assert.equal(boss.meeting, null); assert.equal(s.pies.length, 4);
  s.pies.forEach(p => { assert.equal(t.blocked(p.x, p.y), false); assert.equal(p.expires, s.t + 9); });
});
test('巡逻路线附近撒饼都能给足四张，饼之间不重叠', () => {
  const { ctx, t, s, boss } = fixture();
  for (const point of ctx.OFFICE.routes.boss) {
    boss.x = point.x; boss.y = point.y; s.pies = [];
    t.scatterPies(boss, { count: 4, life: 9 }); assert.equal(s.pies.length, 4);
    s.pies.forEach((p,i) => { assert(!t.blocked(p.x,p.y)); s.pies.slice(i+1).forEach(q=>assert(ctx.E.dist(p.x,p.y,q.x,q.y)>=55)); });
  }
});
test('所有角色吃饼立即+2锅，普通期限，十秒增益，两条飞锅弧线', () => {
  const { ctx, t, s, boss } = fixture();
  for (const a of s.agents) {
    const n = s.arcs.length; t.eatPie(a, { boss });
    assert.equal(a.sn.segs.length, 2); assert.equal(a.piesEaten, 1); assert.equal(a.hypeUntil, s.t + 10);
    assert(a.sn.segs.every(p => p.due === s.t + ctx.LEVELS[3].potLife));
    assert.equal(s.arcs.length - n, 2); assert.equal(t.aimRange(a), 200); assert.equal(t.aimCone(a), Math.PI / 8);
  }
});
test('鸡血速度倍率1.25，十秒后恢复，连续吃只刷新', () => {
  const { t, s, p, boss } = fixture(); t.eatPie(p, {boss}); t.updateAgent(p,0);
  // 手动玩家不输入会停下，因此用同事核对基础跑速。
  const a=s.bots[0];t.eatPie(a,{boss});a.thinkT=99;t.updateAgent(a,0);assert.equal(a.sn.speed,145*a.p.speed*1.25);
  s.t=5;t.eatPie(a,{boss});assert.equal(a.hypeUntil,15);s.t=15;t.updateAgent(a,0);
  assert.equal(t.aimRange(a),150);assert.equal(a.sn.speed,145*a.p.speed);
});
test('一张饼只吃一次；过期、出局者不吃；12锅不再继续捡', () => {
  const { t,s,p,boss }=fixture();const a=s.bots[0];a.sn.x=p.sn.x;a.sn.y=p.sn.y;
  s.pies=[{x:p.sn.x,y:p.sn.y,boss,expires:9}];t.updatePies();assert.equal(p.piesEaten+a.piesEaten,1);assert.equal(s.pies.length,0);
  s.pies=[{x:p.sn.x,y:p.sn.y,boss,expires:0}];t.updatePies();assert.equal(s.piesExpired,1);
  p.crushed=a.crushed=true;s.pies=[{x:p.sn.x,y:p.sn.y,boss,expires:9}];t.updatePies();assert.equal(s.pies.length,1);
});
test('出纳优先三秒内被甩中的人，排除护盾、过期及领导派锅', () => {
  const {t,s,p,cashier}=fixture();cashier.sn.x=300;p.sn.x=400;s.t=10;p.lastMateHitAt=8;
  assert.equal(t.followTarget(cashier,false),p);p.shield=1;assert.equal(t.followTarget(cashier,false),null);
  p.shield=0;s.t=11.01;assert.equal(t.followTarget(cashier,false),null);
  p.lastMateHitAt=-Infinity;t.potHit(p,{src:'leader',hot:false,label:'锅'});assert.equal(t.followTarget(cashier,false),null);
  t.landThrow({owner:s.bots[0],pot:t.newPot(s.t),bounces:0},p);p.shield=0;assert.equal(t.followTarget(cashier,false),p);
});
test('顺风低锅大多不抢，逆风多锅更愿意抢；小舅子也会抢', () => {
  const {ctx,t,s,p,boss}=fixture();s.pieBatch=1;s.pies=[{x:p.sn.x+100,y:p.sn.y,boss,expires:9}];
  ctx.Math.random=()=>0.5;assert.equal(t.desiredPie(p),null);
  p.pieBatch=0;p.sn.segs=Array.from({length:4},()=>t.newPot(s.t));assert(t.desiredPie(p));
  const n=s.bots.find(a=>a.key==='nephew');n.sn.x=p.sn.x;ctx.Math.random=()=>0.2;assert(t.desiredPie(n));
});
test('结算零张不显示，吃饼显示数量，存档仍为v3', () => {
  const {ctx,t,p,storage}=fixture();let html='';ctx.E.showPanel=(value)=>{html=value};
  t.finish('time');assert(!html.includes('今天吃了老板'));assert(storage.has('shuaiguo_v3'));assert(!storage.has('shuaiguo_v2'));
  p.piesEaten=3;t.finish('time');assert(html.includes('今天吃了老板 3 张饼'));
});
console.log(`${passed} tests passed`);
