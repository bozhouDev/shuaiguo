import type {Match} from '../core/match';
// 微信还原核对的纯数据/计时层：不依赖cc、平台、DOM或真实定时器；不改玩法。
export type TourKind = 'lobby'|'rules'|'boss'|'intro'|'tutorial'|'match'|'pause'|'settings'|'result'|'revive'|'share'|'praise'|'rank';
export type TourResult = 'three'|'two'|'one'|'fail'|'crush'|'revived'|'rescued';
export interface TourStep {kind:TourKind;name:string;hold:number;seed:number;level?:number;step?:number;seconds?:number;result?:TourResult;praise?:'calm'|'parry'|'rankup';buff?:'trip'|'gold'|'news'|'legs';bottom?:boolean}
const KINDS:TourKind[]=['lobby','rules','boss','intro','tutorial','match','pause','settings','result','revive','share','praise','rank'];
// 原型P4-1截图：空存档，seed1001；结算数值见prepareTourResult，教学直接进第1/3步。
const ALL:Partial<TourStep>[] = [
  {kind:'lobby',name:'lobby-default',level:1},{kind:'lobby',name:'lobby-level-5',level:5},
  {kind:'rules',name:'rules',level:1},{kind:'boss',name:'boss-name',level:1},
  ...[1,2,3,4,5].map(level=>({kind:'intro' as const,name:`intro-${level}`,level})),
  {kind:'tutorial',name:'tutorial-1',level:1,step:1},{kind:'tutorial',name:'tutorial-3',level:1,step:3},
  {kind:'match',name:'match-wednesday-60s',level:3,seconds:60},{kind:'match',name:'match-friday-150s',level:5,seconds:150},
  {kind:'pause',name:'pause',level:1},{kind:'settings',name:'settings',level:1},
  {kind:'result',name:'result-3star',level:1,result:'three'},{kind:'result',name:'result-1star',level:1,result:'one'},
  {kind:'result',name:'result-2star',level:1,result:'two'},
  {kind:'result',name:'result-failed',level:2,result:'fail'},{kind:'result',name:'result-crushed',level:2,result:'crush'},
  {kind:'result',name:'result-friday-cert',level:5,result:'three'},
  {kind:'result',name:'result-revived',level:2,result:'revived'},
  {kind:'result',name:'result-rescued',level:2,result:'rescued'},
  {kind:'result',name:'result-friday-helped-cert',level:5,result:'rescued'},
  ...(['trip','gold','news','legs'] as const).map(buff=>({kind:'result' as const,name:`result-buff-${buff}`,level:2,result:'fail' as const,buff,bottom:true})),
  {kind:'result',name:'result-failed-bottom',level:2,result:'fail',bottom:true},
  {kind:'result',name:'result-crushed-bottom',level:2,result:'crush',bottom:true},
  {kind:'result',name:'result-friday-cert-bottom',level:5,result:'three',bottom:true},
  {kind:'revive',name:'revived',level:2},{kind:'share',name:'share',level:5},
  ...(['calm','parry','rankup'] as const).map(praise=>({kind:'praise' as const,name:`praise-${praise}`,level:1,praise})),
  {kind:'rank',name:'friend-rank',level:1},
];
// 门禁先于全局读取；release/未知环境即便设置了有副作用的getter，也完全不可达。
export function readTour(enabled:boolean,read:()=>unknown):TourStep[] {
  if(!enabled)return [];
  const value=read();if(value===undefined||value===null)return [];
  const input=value==='all'?ALL:value;
  if(!Array.isArray(input))throw Error('巡检只接受all或步骤列表');
  return input.map((raw:Partial<TourStep>)=>{
    if(!raw||!KINDS.includes(raw.kind!))throw Error('未知巡检画面');
    const s={...raw,kind:raw.kind!,name:raw.name||raw.kind+(raw.level?'-'+raw.level:''),hold:raw.hold??4,seed:raw.seed??1001};
    if(!Number.isFinite(s.hold)||s.hold<=0||!Number.isInteger(s.seed)||s.seed<0||s.seed>0xffffffff)throw Error('巡检停留时间/种子非法');
    if(s.level!==undefined&&(!Number.isInteger(s.level)||s.level<1||s.level>5))throw Error('巡检关卡非法');
    if(s.kind==='tutorial'&&s.step!==1&&s.step!==3)throw Error('巡检教学只支持第1/3步');
    if(s.kind==='match'&&(!Number.isFinite(s.seconds)||s.seconds!<0||s.seconds!>180))throw Error('巡检对局秒数非法');
    if(s.kind==='result'&&!['three','two','one','fail','crush','revived','rescued'].includes(s.result!))throw Error('巡检结算类型非法');
    if(s.buff!==undefined&&!['trip','gold','news','legs'].includes(s.buff))throw Error('巡检增益非法');
    if(s.bottom!==undefined&&(typeof s.bottom!=='boolean'||s.kind!=='result'))throw Error('巡检滚动只支持结算');
    if(s.kind==='praise'&&!['calm','parry','rankup'].includes(s.praise!))throw Error('巡检贴纸类型非法');
    return s;
  });
}
// 只由App每帧推进；等待页面就绪期间不计hold，不用setTimeout，不重入/跨步补时。
export class TourRunner {
  done=false;private stopped=false;private waiting=false;private started=false;private index=0;private elapsed=0;
  constructor(readonly steps:TourStep[],private readonly show:(step:TourStep)=>void|Promise<void>,private readonly log:(...values:unknown[])=>void) {}
  // 首步异步完成、页面绘制就绪后才打日志，供外部截图按日志定位。
  async start():Promise<void> {if(this.started||this.stopped)return;this.started=true;if(!this.steps.length){this.finish();return;}await this.enter();}
  // 每次最多切一页，慢资源不会把后续页面的停留时间吃掉。
  async advance(dt:number):Promise<void> {
    if(!this.started||this.stopped||this.waiting||this.done||!Number.isFinite(dt)||dt<=0)return;
    this.elapsed+=dt;if(this.elapsed+1e-9<this.steps[this.index].hold)return;
    if(++this.index>=this.steps.length){this.finish();return;}await this.enter();
  }
  // 销毁后的迟到Promise不打步骤/完成日志，也不会再推进。
  stop():void {this.stopped=true;}
  private async enter():Promise<void> {this.waiting=true;this.elapsed=0;try{await this.show(this.steps[this.index]);if(!this.stopped)this.log('[SG TOUR]',this.index+1,this.steps[this.index].name);}catch(error){this.stop();throw error;}finally{this.waiting=false;}}
  private finish():void {this.done=true;this.log('[SG TOUR] done');}
}
// 与verify-peripheral.mjs的最终夹具相同；只是调试局的数据，结算仍由真实core计算。
export function prepareTourResult(m:Match,type:TourResult):void {
  for(const [i,a]of m.S.agents.entries()){a.sn.segs=[];a.blames=i+1;a.crushed=false;}
  const p=m.S.player;p.blames=type==='one'?3.5:type==='two'?2.5:type==='fail'?99:0;
  if(type==='crush')p.sn.segs=Array.from({length:12},()=>({due:50,label:'周报',hot:false}));
  // 通过真实辅助入口制造后续结算，不伪造星级或广告资格；不改变正式对局。
  if(type==='revived'){p.sn.segs=Array.from({length:12},()=>({due:50,label:'周报',hot:false}));m.revive();}
  if(type==='rescued'){p.blames=3;m.rescue();}
}
