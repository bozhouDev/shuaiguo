// 《这锅你来背-核心玩法》随机掉落道具：只写core状态，通过事件通知画面。
import type {Match} from './match';
import type {Agent, ItemState, ItemDrop, ItemKind} from './types';
import {Mulberry32} from './random';
import {ITEM_DROP_POINTS} from './levels';
import * as C from './config';

const ITEM_TIPS: Record<ItemKind,string> = {
  clear: '清锅：身上的锅全清空，飞来的锅还得躲',
  invincible: '无敌：5秒不接来锅、不怕撞领导；当面甩锅照样被抓',
  delay: '延时：身上每口锅多15秒，急件也算',
};
export const itemsLogic = {
  // 一次生成本局计划；只读取原流状态派生，不调用E.random/rand，模拟下一局自然有新种子。
  makeItems(this:Match):ItemState {
    const rng=new Mulberry32(this.E.rngState() ^ 0x4954454d);
    const plan:ItemDrop[]=[];
    for(const frac of C.ITEM_DROP_FRACS){
      // 刷新时刻按本关时长折算成整秒，再加抖动
      const at=Math.round(frac*this.L.duration)+(rng.next()*2-1)*C.ITEM_DROP_JITTER;
      const point=ITEM_DROP_POINTS[Math.floor(rng.next()*ITEM_DROP_POINTS.length)],roll=rng.next();
      const kind:ItemKind=roll<C.ITEM_CLEAR_CHANCE?'clear':roll<C.ITEM_CLEAR_CHANCE+C.ITEM_INVINCIBLE_CHANCE?'invincible':'delay';
      if(at+C.ITEM_LIFE<=this.L.duration)plan.push({...point,id:plan.length,kind,at,expires:at+C.ITEM_LIFE,phase:'preview'});
    }
    return {plan,next:0,drops:[],invincibleUntil:0,tips:{},stats:{picked:0,byKind:{clear:0,invincible:0,delay:0},expired:0}};
  },
  // 道具无敌独立于接锅护盾，不改变被抓现行/甩锅/反甩规则。
  itemInvincible(this:Match,a:Agent):boolean {return a===this.S.player && (this.S.items?.invincibleUntil ?? 0)>this.S.t;},
  // 显式生命周期：preview -> ground -> 拾取或过期移除。物理时间用于效果，上班时钟用于刷点。
  updateItems(this:Match):void {
    const state=this.S.items;if(!state||this.S.tut)return;
    const w=this.workT();
    while(state.next<state.plan.length&&w>=state.plan[state.next].at-C.ITEM_PREVIEW){state.drops.push({...state.plan[state.next++]});}
    state.drops=state.drops.filter(drop=>{
      if(w>=drop.expires){state.stats.expired++;return false;}
      if(w<drop.at)return true;
      drop.phase='ground';
      const p=this.S.player;
      if(p.crushed||this.potsOf(p)>=C.MAX_POTS||this.E.dist(p.sn.x,p.sn.y,drop.x,drop.y)>C.ITEM_PICK_RADIUS)return true;
      this.pickItem(drop);return false;
    });
  },
  // 未来广告来源可复用同一效果；当前只有updateItems的玩家触碰会调用。
  pickItem(this:Match,drop:ItemDrop):void {
    const state=this.S.items!,p=this.S.player;
    state.stats.picked++;state.stats.byKind[drop.kind]++;
    if(drop.kind==='clear'){
      const positions=p.sn.positions();
      p.sn.segs.forEach((pot,i)=>{const at=positions[i]||p.sn,fx=this.spawnFx('item_clear',at.x,at.y,34,C.ITEM_CLEAR_FX_TIME);fx.t=-i*C.ITEM_CLEAR_STAGGER;fx.label=pot.label;fx.hot=pot.hot;});
      p.sn.segs.length=0;
      this.floats.add('清空！',p.sn.x,p.sn.y-60,'#2F9E6B');this.E.sfx('revive');
    }else if(drop.kind==='invincible'){
      state.invincibleUntil=this.S.t+C.ITEM_INVINCIBLE_TIME;
      this.floats.add('无敌 5 秒',p.sn.x,p.sn.y-60,'#2F9E6B');this.E.sfx('buff');
    }else{
      for(const pot of p.sn.segs){pot.due=this.capDue(pot.due+C.ITEM_DELAY_TIME);pot.itemDelayAt=this.S.t;}
      this.floats.add('+15 秒',p.sn.x,p.sn.y-60,'#2F9E6B');this.E.sfx('buff');
    }
    if(!state.tips[drop.kind]){state.tips[drop.kind]=true;this.E.toast(ITEM_TIPS[drop.kind],3000);}
    this.emit('item_pick',{kind:drop.kind,picked:state.stats.picked});
  },
  // 只给自动玩家：280px内直线可达，并逐8px检查整段没有穿领导视野或碰撞圈。
  desiredItem(this:Match,a:Agent):ItemDrop|null {
    if(a!==this.S.player||!this.auto||!this.S.items||this.S.tut)return null;
    let best:ItemDrop|null=null,distance=C.ITEM_AI_RANGE;
    for(const drop of this.S.items.drops){
      if(drop.phase!=='ground'||drop.expires<=this.workT())continue;
      const d=this.E.dist(a.sn.x,a.sn.y,drop.x,drop.y);if(d>distance)continue;
      const steps=Math.max(1,Math.ceil(d/C.ITEM_PATH_STEP));let safe=true;
      for(let i=0;i<=steps&&safe;i++){
        const x=a.sn.x+(drop.x-a.sn.x)*i/steps,y=a.sn.y+(drop.y-a.sn.y)*i/steps;
        if(this.blocked(x,y)){safe=false;break;}
        for(const l of this.S.leaders){const ld=this.E.dist(l.x,l.y,x,y);if(ld<C.HEAD_R+28 || (ld<=this.visionRange(l)&&Math.abs(this.E.angDiff(l.face,Math.atan2(y-l.y,x-l.x)))<=this.visionCone(l)&&this.sightClear(l.x,l.y,x,y))){safe=false;break;}}
      }
      if(safe){best=drop;distance=d;}
    }
    return best;
  },
};
