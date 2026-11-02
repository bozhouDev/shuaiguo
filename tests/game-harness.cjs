// 无浏览器逻辑验收：加载真实引擎与游戏，仅替换 DOM、音频和绘制入口。
const fs=require('fs'),vm=require('vm');
function setup(expose=true){
 const noop=()=>{}, elements=new Map(), storage=new Map();
 const el=()=>({style:{},classList:{add:noop,remove:noop,toggle:noop,contains:()=>false},addEventListener:noop,appendChild:noop,setAttribute:noop,getBoundingClientRect:()=>({top:0,left:0,width:375,height:812}),querySelector:()=>el(),querySelectorAll:()=>[],parentElement:{hidden:false,classList:{toggle:noop}},hidden:false});
 const ctx={console,URLSearchParams,Math:Object.create(Math),performance:{now:()=>0},setInterval:()=>0,setTimeout:()=>0,clearTimeout:noop,requestAnimationFrame:noop,navigator:{},location:{search:''},document:{getElementById:id=>{if(!elements.has(id))elements.set(id,el());return elements.get(id)},createElement:el,addEventListener:noop,querySelectorAll:()=>[],body:el()},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}};
 ctx.window=ctx;ctx.addEventListener=noop;vm.createContext(ctx);
 vm.runInContext(fs.readFileSync('js/engine.js','utf8'),ctx);
 for(const k of ['sfx','buzz','toast','bgm','showPanel','hidePanel','clearPraise','checkPraiseOcclusion','setText','loop'])ctx.E[k]=noop;
 ctx.E.createStage=()=>({ctx:{},c:el(),w:375,h:812});ctx.E.createInput=()=>({fire:0,keys:{}});ctx.E.loadAtlas=()=>({then(){return this}});
 vm.runInContext(fs.readFileSync('js/levels.js','utf8'),ctx);
 let game=fs.readFileSync('js/game.js','utf8');
 if(expose)game=game.replace('  /* ---------------- 启动 ---------------- */',`window.TEST = {init(idx=3){L=LEVELS[idx];S=makeState(false);mode='play';return S}, hyped, aimRange, aimCone, inAimFan, pickAim, followTarget, desiredPie, eatPie, updatePies, scatterPies, startPieMeeting, updatePieMeeting, updateAgent, buildSchedule, blocked, personSprite, setSim(v){simulating=v}, update, addPots, passNephewPot, avoidsNephew, updateLeader, updateDue, updateThrows, landThrow, fireThrow, think, potHit, newPot, ranking, pickTargets, starsOfRank, nephewGuardian, leaderAlert, seenBy, finish, shareCard, loadProgress, saveProgress, updateHud, startGame, pauseGame, showLobby, showIntro};\n  /* ---------------- 启动 ---------------- */`);
 vm.runInContext(game,ctx);return {ctx,storage,elements};
}
module.exports={setup};
