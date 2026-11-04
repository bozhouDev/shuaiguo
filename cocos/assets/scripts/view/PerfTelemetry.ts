import {Director, Graphics, Label, Sprite, director, game, view} from 'cc';
import type {AppView} from './AppView';
import type {WorldView} from './WorldView';
interface Frame {t:number;interval:number;logic:number;draw:number;calls:number|null}
// 自动采样与调试浮层分离：每帧只计时/累加，节点树仅在段末遍历，不建任何节点。
export class PerfTelemetry {
  logic=0;draw=0;
  private last=0;private lastT:number;
  private first:Frame[]=[];private period:Frame[]=[];
  private tail:(Frame|undefined)[]=new Array(2048);private tailIndex=0;
  private segments:{data:Record<string,unknown>;frames:Frame[]}[]=[];private periodStart:number;private firstDone=false;private closed=false;
  private readonly start:number;
  constructor(private app:AppView,private world:WorldView,private device:Record<string,unknown>,private capped:boolean){
    this.start=this.lastT=this.periodStart=world.match.S.t;world.perf=this;
    director.on(Director.EVENT_AFTER_DRAW,this.afterDraw,this);
  }
  // 暂停/教学冻结/后台不计入对局；恢复时重新设间隔基点，不把等待算成慢帧。
  private afterDraw():void {
    const m=this.world.match,t=m.S.t,now=performance.now();
    if(this.app.screen!=='play'||this.app.panel||m.mode!=='play'||t<=this.lastT){this.last=0;this.logic=this.draw=0;return;}
    if(this.last){
      const calls=(director.root as any)?.device?.numDrawCalls;
      const frame:Frame={t,interval:now-this.last,logic:this.logic,draw:this.draw,calls:typeof calls==='number'?calls:null};
      // 有界缓冲：30秒段最多4096帧，最后10秒环形最多2048帧；无逐帧shift或排序。
      if(this.period.length<4096)this.period.push(frame);
      if(!this.firstDone&&t<=this.start+10&&this.first.length<2048)this.first.push(frame);
      this.tail[this.tailIndex++%2048]=frame;
      if(!this.firstDone&&t>=this.start+10){this.segment('first',this.start,Math.min(t,this.start+10),this.first);this.first=[];this.firstDone=true;}
      if(t>=this.periodStart+30){this.segment('period',this.periodStart,t,this.period);this.period=[];this.periodStart=t;}
    }
    this.last=now;this.lastT=t;this.logic=this.draw=0;
  }
  // 最差5%是最慢ceil(n*.05)帧的均值；节点/锅数/FPS/DPR/尺寸采用段末快照。
  private segment(kind:string,start:number,end:number,frames:Frame[]):void {
    if(!frames.length||this.segments.length>=14)return;
    const canvas=game.canvas;
    const count=(type:typeof Graphics|typeof Sprite|typeof Label)=>this.app.parent.getComponentsInChildren(type as typeof Graphics).reduce((n,c)=>n+(c.node.activeInHierarchy?1:0),0);
    const m=this.world.match,pots=m.S.agents.reduce((n,a)=>n+m.potsOf(a),0)+m.S.flying.length+m.S.throws.length;
    this.segments.push({frames,data:{kind,start,end,frames:frames.length,pots,graphics:count(Graphics),sprites:count(Sprite),labels:count(Label),targetFps:Number(game.frameRate),dpr:view.getDevicePixelRatio(),width:canvas?.width??0,height:canvas?.height??0}});
  }
  // 排序和统计在本段对局结束后完成，避免30秒边界排序制造新的慢帧。
  private summarize({data,frames}:{data:Record<string,unknown>;frames:Frame[]}):Record<string,unknown>{
    const avg=(key:'interval'|'logic'|'draw')=>frames.reduce((n,f)=>n+f[key],0)/frames.length;
    const slow=frames.map(f=>f.interval).sort((a,b)=>b-a).slice(0,Math.ceil(frames.length*.05));
    return {...data,interval:avg('interval'),worst5:slow.reduce((a,b)=>a+b,0)/slow.length,logic:avg('logic'),draw:avg('draw'),drawCalls:frames.every(f=>f.calls!==null)?frames.reduce((n,f)=>n+f.calls!,0)/frames.length:null};
  }
  // 结算/压垮/离场/后台只交付一次；尾段使用实际终点前10秒，提前退出也有first与last。
  finish(reason:string):Record<string,unknown>|null {
    if(this.closed)return null;this.closed=true;
    director.off(Director.EVENT_AFTER_DRAW,this.afterDraw,this);this.world.perf=undefined;
    const end=this.world.match.S.t;
    if(!this.firstDone)this.segment('first',this.start,end,this.first);
    this.segment('period',this.periodStart,end,this.period);
    const tail=this.tail.filter((f):f is Frame=>!!f&&f.t>Math.max(this.start,end-10)).sort((a,b)=>a.t-b.t);
    this.segment('last',Math.max(this.start,end-10),end,tail);
    const out={v:1,reason,start:this.start,end,capEnabled:this.capped,device:{...this.device},segments:this.segments.map(s=>this.summarize(s))};
    this.first=[];this.period=[];this.tail=[];this.segments=[];
    return out;
  }
}
