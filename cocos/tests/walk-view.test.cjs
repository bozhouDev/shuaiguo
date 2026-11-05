// 经真实画面组织器的 draw 入口检查选帧；仅替换最终常驻节点输出，不导出测试专用接口。
const {test}=require('node:test'),assert=require('node:assert/strict');
const {load,cc}=require('./wechat/view-harness.cjs');
const retainedModule=load('cocos/assets/scripts/view/RetainedWorld');
const {createWorldPainter}=load('cocos/assets/scripts/view/WorldPainter');

// 每个夹具独立持有角色、资源和画笔，记录交给常驻层的真实姿势。
function rig({base='player',diagonal=true,leader=false,missing}={}) {
 const poses=[],a=leader?{cfg:{sprite:base},x:300,y:400,state:'walk',wait:0}:{id:1,key:base,p:{sprite:base},isPlayer:base==='player',sn:{x:300,y:400},stun:0,angry:0,teaT:0};
 const m={mode:'play',L:{theme:'office'},S:{player:leader?{sn:{x:300,y:400}}:a,agents:leader?[]:[a],leaders:leader?[a]:[],tea:0},potsOf:()=>0,raging:()=>false};
 const spr={};
 for(const dir of ['d','u','s',...(diagonal?['dr','ur']:[])])for(let i=0;i<4;i++)spr[`${base}_walk_${dir}${i}`]={};
 for(const pose of ['normal','panic','crushed','phone','hit','flat','tea','win','aim','idle','chase'])spr[`${base}_${pose}`]={};
 if(missing)delete spr[missing];
 const layer={at(){}},retained={ground:layer,tails:layer,actors:layer,above:layer,effects:layer,speech:layer,camera(){},vision(){},tail(){},beginActors(){},aimLines(){},flight(){},hints(){},speeches(){},person(_a,pose){poses.push(pose);},leader(_a,pose){poses.push(pose);},destroy(){}};
 const original=retainedModule.RetainedWorld;
 retainedModule.RetainedWorld=class{constructor(){return retained;}};
 let painter;
 try {const surface={width:375,height:812,root:new cc.Node()};painter=createWorldPainter(m,surface,surface,surface,surface,{matchTexture:{},spr},true);}
 finally {retainedModule.RetainedWorld=original;}
 const pos=leader?a:a.sn;
 painter.draw(0);
 return {a,m,spr,painter,poses,
  // 位移模拟速度，连续渲染；不让核心模拟参与，以独立验证表现层。
  move(degrees,steps=1,length=4){for(let i=0;i<steps;i++){pos.x+=Math.cos(degrees*Math.PI/180)*length;pos.y+=Math.sin(degrees*Math.PI/180)*length;painter.draw(0);}return poses.at(-1);},
  stop(){painter.draw(0);painter.draw(0);return poses.at(-1);}
 };
}
// 去掉步伐编号，只比较方向和镜像；编号另由停步用例验证。
function facing(pose){return [pose.name.replace(/\d$/,''),pose.flip];}

test('主角连续经过八方向时选对帧和镜像，停下保持朝向及第4帧',()=>{
 const r=rig();
 const expected=[[0,'s',false],[45,'dr',false],[90,'d',false],[135,'dr',true],[180,'s',true],[225,'ur',true],[270,'u',false],[315,'ur',false]];
 for(const [angle,dir,flip] of expected){assert.deepEqual(facing(r.move(angle,20)),[`player_walk_${dir}`,flip]);assert.deepEqual(r.stop(),{name:`player_walk_${dir}3`,flip,dir,walking:false});}
});

test('八条扇区边界双向正负5度反复抖动均不换图，越界超过10度才换',()=>{
 for(let sector=0;sector<8;sector++)for(const sign of [-1,1]){
  const r=rig(),center=sector*45,initial=facing(r.move(center,20));
  for(let i=0;i<8;i++)for(const delta of [17.5,27.5])assert.deepEqual(facing(r.move(center+sign*delta,20)),initial);
  assert.deepEqual(facing(r.move(center+sign*32.4,20)),initial,'距原中心不足32.5度应保持');
  assert.notDeepEqual(facing(r.move(center+sign*32.6,20)),initial,'越过边界10度后应切换');
 }
});

test('上下扇区不沿用左右镜像，跨正负180度边界仍稳定',()=>{
 const r=rig();r.move(180,20);assert.deepEqual(facing(r.move(-179,20)),['player_walk_s',true]);
 assert.deepEqual(facing(r.move(90,20)),['player_walk_d',false]);
 r.move(225,20);assert.deepEqual(facing(r.move(270,20)),['player_walk_u',false]);
});

test('同事和领导缺斜向素材时保留旧四向的方向与翻转序列',()=>{
 for(const [base,leader] of [['pm',false],['boss',true],['player',false]]){
  const r=rig({base,leader,diagonal:false});
  const expected=[[0,'s',false],[45,'s',false],[90,'d',false],[135,'d',false],[180,'s',true],[225,'s',true],[270,'u',true],[315,'u',true]];
  for(const [angle,dir,flip] of expected)assert.deepEqual(facing(r.move(angle,20)),[`${base}_walk_${dir}`,flip]);
 }
});

test('斜向帧不齐时整个角色退回四向，不播放缺帧或跳到normal',()=>{
 const r=rig({missing:'player_walk_ur2'});
 assert.deepEqual(facing(r.move(0,20)),['player_walk_s',false]);
 for(let i=0;i<40;i++)assert.match(r.move(315).name,/^player_walk_s[0-3]$/);
});

test('压垮、慌张、打电话与领导追逐等特殊姿势继续优先于走路',()=>{
 const r=rig();r.move(45,20);r.a.stun=1;assert.equal(r.move(45).name,'player_panic');
 r.a.stun=0;r.m.mode='over';r.m.potsOf=()=>12;assert.equal(r.move(45).name,'player_crushed');
 r.m.mode='closing';r.m.S.closing={t:100,passed:true};assert.equal(r.move(45).name,'player_win');
 const n=rig({base:'nephew',diagonal:false});assert.equal(n.stop().name,'nephew_phone');n.a.crushed=true;assert.equal(n.stop().name,'nephew_crushed');
 const b=rig({base:'boss',leader:true,diagonal:false});b.m.raging=()=>true;assert.equal(b.move(45).name,'boss_chase');
 b.a.state='aim';assert.equal(b.move(45).name,'boss_aim');b.a.meeting=true;assert.equal(b.move(45).name,'boss_idle');
});

test('步距仍每13px推进，首次移动直接定向，瞬移和停步不写核心字段',()=>{
 const r=rig(),before=Object.keys(r.a),snake=Object.keys(r.a.sn);
 assert.equal(r.move(315,1,4).name,'player_walk_ur0');
 assert.equal(r.move(315,1,10).name,'player_walk_ur1');
 const heading=facing(r.poses.at(-1));r.move(180,1,100);assert.deepEqual(facing(r.stop()),heading);
 assert.deepEqual(Object.keys(r.a),before);assert.deepEqual(Object.keys(r.a.sn),snake);
});
