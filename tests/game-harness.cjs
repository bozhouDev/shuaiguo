// 无浏览器逻辑验收：加载真实引擎与游戏，仅替换 DOM、音频和绘制入口。
const fs=require('fs'),vm=require('vm');
function setup(expose=true, options={}){
 const noop=()=>{}, elements=new Map(), storage=new Map();
 const el=()=>({style:{},classList:{add:noop,remove:noop,toggle:noop,contains:()=>false},addEventListener:noop,appendChild:noop,setAttribute:noop,getBoundingClientRect:()=>({top:0,left:0,width:375,height:812}),querySelector:()=>el(),querySelectorAll:()=>[],parentElement:{hidden:false,classList:{toggle:noop}},hidden:false});
 const ctx={console,URLSearchParams,Math:Object.create(Math),performance:{now:()=>0},setInterval:()=>0,setTimeout:()=>0,clearTimeout:noop,requestAnimationFrame:noop,navigator:{},location:{search:''},document:{getElementById:id=>{if(!elements.has(id))elements.set(id,el());return elements.get(id)},createElement:el,addEventListener:noop,querySelectorAll:()=>[],body:el()},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}};
 ctx.window=ctx;ctx.addEventListener=noop;vm.createContext(ctx);
 const read=name=>fs.readFileSync(require('path').join(options.sourceDir || 'js',name),'utf8');
 vm.runInContext(read('engine.js'),ctx);
 for(const k of ['sfx','buzz','toast','bgm','showPanel','hidePanel','clearPraise','checkPraiseOcclusion','setText','loop'])ctx.E[k]=noop;
 ctx.E.createStage=()=>({ctx:{},c:el(),w:375,h:812});ctx.E.createInput=()=>({fire:0,keys:{}});ctx.E.loadAtlas=()=>({then(){return this}});
 // 只包装调用意图；音频、DOM 仍用原来的测试替身，不在正式代码放录制钩子。
 const events=[];
 ctx.recordEvent=(kind,args)=>events.push({t:ctx.SG_DEBUG?.state()?.t || 0,kind,args:JSON.parse(JSON.stringify(args))});
 if(options.events){
   for(const k of ['sfx','toast','buzz']){const original=ctx.E[k];ctx.E[k]=(...args)=>{ctx.recordEvent(k,args);return original(...args)};}
   const add=ctx.E.Floats.prototype.add;
   ctx.E.Floats.prototype.add=function(...args){ctx.recordEvent('floats',args);return add.apply(this,args)};
 }
 vm.runInContext(read('levels.js'),ctx);
 let game=read('game.js');
 if(options.events)game=game.replace('  /* ---------------- 启动 ---------------- */',`
  // 录像口径：表扬贴纸由画面层另行验收，不记录 praise / checkPraiseRank / E.praise。
  for (const [name, original, assign] of [
    ['showMsg', showMsg, f => { showMsg = f; }],
    ['showHint', showHint, f => { showHint = f; }],
    ['spawnFx', spawnFx, f => { spawnFx = f; }],
  ]) assign(function (...args) { recordEvent(name, args); return original(...args); });
  /* ---------------- 启动 ---------------- */`);
 if(expose)game=game.replace('  /* ---------------- 启动 ---------------- */',`window.TEST = {init(idx=3,recording=false){L=LEVELS[idx];auto=recording;simulating=recording;S=null;S=makeState(false);mode='play';return S}, hyped, aimRange, aimCone, inAimFan, pickAim, followTarget, desiredPie, eatPie, updatePies, scatterPies, startPieMeeting, updatePieMeeting, updateAgent, buildSchedule, blocked, personSprite, setSim(v){simulating=v}, update, addPots, passNephewPot, avoidsNephew, updateLeader, updateDue, updateThrows, landThrow, fireThrow, think, potHit, newPot, ranking, pickTargets, starsOfRank, nephewGuardian, leaderAlert, seenBy, finish, shareCard, loadProgress, saveProgress, updateHud, startGame, pauseGame, showLobby, showIntro};\n  /* ---------------- 启动 ---------------- */`);
 // 固定步长录像沿用 simulate 的 auto / simulating，仍走 makeState(false) 与真实 update。
 vm.runInContext(game,ctx);return {ctx,storage,elements,events};
}
module.exports={setup};
