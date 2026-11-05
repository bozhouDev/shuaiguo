import {Node} from 'cc';
import {Match} from '../core/match';
import {Agent,Leader} from '../core/types';
import {DUE_DANGER,DUE_WARN,POT_ALARM,AIM_RANGE,AIM_TIME,ITEM_BLINK,ITEM_DELAY_FX_TIME,ITEM_DELAY_TIME} from '../core/config';
import {WorldAssets} from './WorldAssets';
import {stickCenter} from './SpriteTools';
import {HEADS} from './visual-data';
import {MatchAtlas,MatchNode,MatchCollection} from './MatchNodes';
// 原型的交错遮挡作为语义层保留，逐层取代WorldPainter的动态DrawSurface。
export class RetainedWorld {
  readonly atlas:MatchAtlas;readonly ground:MatchNode;readonly above:MatchNode;readonly effects:MatchNode;readonly speech:MatchNode;readonly edges:MatchNode;readonly stick:MatchNode;readonly tails:MatchNode;readonly actors:MatchNode;private sectorKeys=new WeakMap<MatchNode,string>();private iconNames=new WeakMap<MatchNode,string>();private nameWidths=new Map<Leader,{name:string;metrics:Record<string,number>;width:number}>();private actorNodes=new Map<object,MatchNode>();private actorOrder=0;private tailAgents=new Map<Agent,MatchCollection<object>>();
  constructor(readonly match:Match,readonly assets:WorldAssets,root:Node){
    this.atlas=new MatchAtlas(assets.matchTexture,assets,root);this.ground=new MatchNode(root,'GroundWarningsAndVision',this.atlas);this.tails=new MatchNode(root,'PotTails',this.atlas);this.actors=new MatchNode(root,'PeopleByY',this.atlas);this.above=new MatchNode(root,'DueAndAimLines',this.atlas);this.effects=new MatchNode(root,'FlyingAndEffects',this.atlas);this.speech=new MatchNode(root,'SpeechAndFloats',this.atlas);this.edges=new MatchNode(root,'EdgeHints',this.atlas);this.stick=new MatchNode(root,'Joystick',this.atlas);
    for(const a of [...match.S.agents,...match.S.leaders])this.actorNodes.set(a,this.actors.child(('id' in a?'person-'+a.id:'leader-'+a.cfg.sprite)));
    for(const a of match.S.agents)this.tailAgents.set(a,new MatchCollection(this.tails.child('agent-'+a.id),'pot'));
  }
  retryRival?:Agent; retryRivalUntil=0;
  private viewport={x:0,y:0,w:375,h:812};
  // 200逻辑像素边带覆盖人物、名牌、光圈和烟的完整范围；屏外提示单独保留。
  camera(x:number,y:number,w:number,h:number):void {this.viewport={x,y,w,h};}
  private visible(x:number,y:number,margin=200):boolean {const v=this.viewport,sx=x+v.x,sy=y+v.y;return sx>=-margin&&sy>=-margin&&sx<=v.w+margin&&sy<=v.h+margin;}
  // 锅和标签是一个常驻容器；普通/飞锅的标签偏移、旋转及字号逐值沿用原型。
  wok(n:MatchNode,x:number,y:number,label:string,size:number,rot=0,alpha=1,flying=false,a=0):void {
    n.show(true);n.child('hotHalo').show(false);n.child('hotPot').show(false);size*=.8;const left=flying&&Math.cos(a)<0,rotation=flying?(left?a-(Math.PI+.45):a+.45):rot,w=size*(flying?1.35:1.25),pic=this.atlas.pictures[flying?'wok_flying':'wok'];
    n.at(x,y,rotation);n.child('image').image(flying?'wok_flying':'wok',0,0,w,{flip:left,alpha});
    const text=n.child('label');text.show(!!label);if(!label)return;
    const fs=Math.round(size*(label.length>2?.13:.18)),h=w*pic.h/pic.w;
    const anchor=n.child('labelAnchor').at(flying?(left?-1:1)*w*.06:w*.044,flying?-w*.05:h*.097,flying?(left?.1:-.1):-.1);
    // 标签必须是独立transform的子节点，不能随锅的镜像翻字。
    if(text.node.parent!==anchor.node)anchor.node.addChild(text.node);
    text.text(label.length>4?label.slice(0,4):label,0,1,fs,'#1F2A44','','title',alpha);
  }
  // 所有锅尾仍先于所有人物。锅尾内部继续“光圈/烟→锅→倒计时”的逐锅顺序。
  tail(a:Agent,time:number):void {
    const m=this.match,pos=a.sn.positions(),size=a.isPlayer?38:32,pots=a.sn.segs.slice().reverse();
    this.tailAgents.get(a)!.sync(pots,(node,value,index)=>{
      const i=a.sn.segs.length-1-index,pot=value as Agent['sn']['segs'][number],q=pos[i];if(!q){node.show(false);return;}
      node.show(this.visible(q.x,q.y));if(!node.node.active)return;node.at(q.x,q.y);const clearing=m.isClearing(),left=clearing?m.bellTime()-m.S.t:pot.due-m.S.t,danger=clearing||pot.hot||left<DUE_DANGER,on=!a.crushed&&(danger||left<DUE_WARN);
      const halo=node.child('halo').show(on);if(on){const r=(pot.hot?26:20)+Math.sin(time*(danger?16:7)+i)*3;halo.ellipse(0,0,r,r,danger?'rgba(232,80,74,.45)':'rgba(255,200,40,.45)');}
      for(let k=0;k<2;k++){const smoke=node.child('smoke-'+k).show(on&&danger);if(on&&danger){const ph=(time*1.6+k*.5+i*.3)%1;smoke.ellipse(k?6:-5,-14-ph*26,4+ph*6,4+ph*6,'rgba(94,106,132,'+(.5*(1-ph))+')');}}
      this.wok(node.child('pot'),0,0,a.isPlayer||pot.hot?pot.label:'',pot.hot?size*1.15:size,a.crushed?.3:Math.sin(time*6+i+a.id)*.12,a.crushed?.6:1);
      // 延时后0.8秒从旧数字跳到新数字，结束后恢复原来的告急显示条件。
      const age=pot.itemDelayAt===undefined?Infinity:m.S.t-pot.itemDelayAt,jumping=!clearing&&age>=0&&age<ITEM_DELAY_FX_TIME;
      const due=node.child('due').show(clearing||!a.crushed&&a.isPlayer&&(jumping||left<DUE_WARN)&&Math.hypot(q.x-a.sn.x,q.y-a.sn.y)>24);
      if(due.node.active){const k=jumping?age/ITEM_DELAY_FX_TIME:1,value=left-(jumping?ITEM_DELAY_TIME*(1-k):0);due.text(String(Math.max(0,Math.ceil(value))),15,-15-(jumping?Math.sin(k*Math.PI)*14:0),13,clearing?'#E8504A':jumping?'#2F9E6B':'#FFFDF5',clearing||jumping?'#FFFDF5':danger?'#E8504A':'#C98A00');}

    });
  }
  // 视野依照原型画在锅尾/人物下面；扇形真实改变才更新常驻顶点，绝不改core。
  vision(time:number):void {
    const m=this.match,P=m.S.player,me=P.sn,eye=P.crushed?null:m.seenBy(P),g=this.ground;
    this.pieNodes??=new MatchCollection(g.child('Pies'),'pie');this.pieNodes.sync(m.S.pies,(n,p)=>{n.image('pie',p.x,p.y,40,{alpha:p.expires-m.S.t<2?.6+.4*Math.sin(time*10):1});});
    // 道具箱/硬边光柱都留在常驻实体池，不使用Graphics逐帧重画。
    this.itemNodes??=new MatchCollection(g.child('ItemDrops'),'item');
    this.itemNodes.sync(m.S.items?.drops??[],(n,item)=>{
      n.at(item.x,item.y);const preview=item.phase==='preview',left=item.expires-m.workT(),alpha=!preview&&left<ITEM_BLINK?(Math.sin(time*14)>0?1:.2):1;
      n.child('box').show(!preview);if(!preview)n.child('box').image('item_'+item.kind,0,0,40,{alpha});
      const beam=n.child('beam').show(preview);if(preview){beam.child('outer').rect(-14,-100,28,100,'#2F9E6B',.25);beam.child('inner').rect(-5,-100,10,100,'#FFFDF5',.7);beam.child('base').ellipse(0,0,24,9,'#2F9E6B',1,0,Math.PI*2,3);}
    });
    const ring=g.child('CoachRing').show(!!m.S.tut?.ring);if(m.S.tut?.ring){const r=m.S.tut.ring,k=Math.sin(time*5)*4,fy=r.y+20;ring.child('border').ellipse(r.x,fy,34+k,14+k*.4,'#1F2A44',1,0,Math.PI*2,7);ring.child('yellow').ellipse(r.x,fy,34+k,14+k*.4,'#FFD84D',1,0,Math.PI*2,4);ring.child('text').text('走到这',r.x,fy-34-k,13,'#1F2A44','#FFD84D');}
    this.warnNodes??=new MatchCollection(g.child('Warnings'),'warn');this.warnNodes.sync(m.S.flying.filter(f=>f.phase==='warn'),(n,f)=>{const k=1-f.t/Math.max(.01,f.warn0);n.child('circle').ellipse(f.x,f.y,14+k*20,14+k*20,'#E8504A',1,0,Math.PI*2,4);n.child('bang').text('!',f.x,f.y,24,'#E8504A');});
    for(const l of m.S.leaders){const on=eye===l,mad=m.raging(l),n=g.child('vision-'+l.cfg.sprite),r=m.visionRange(l),cone=m.visionCone(l);this.sector(n,l.x,l.y,r,l.face-cone,l.face+cone,`rgba(232,80,74,${on?.24:mad?.2:.12})`,`rgba(232,80,74,${on||mad?.8:.35})`,mad?3:2);}
    const aim=g.child('PlayerAim').show(!P.crushed&&m.potsOf(P)>0);if(aim.node.active){const b=P.aimTgt,ready=m.canFire(P),col=eye?'232,80,74':!ready?'94,106,132':b?'47,158,107':'255,253,245';this.sector(aim,me.x,me.y,m.aimRange(P),me.angle-m.aimCone(P),me.angle+m.aimCone(P),`rgba(${col},${b&&ready?.3:.24})`,`rgba(${col},.9)`,3);const target=aim.child('target').show(!!b),tag=aim.child('text').show(!!b&&ready&&!eye);if(b){target.ellipse(b.sn.x,b.sn.y,30+Math.sin(time*10)*3,30+Math.sin(time*10)*3,ready?'rgba(47,158,107,.95)':'rgba(94,106,132,.7)',1,0,Math.PI*2,4);if(tag.node.active)tag.text('甩他!',b.sn.x,b.sn.y-58,13,'#FFFDF5','#2F9E6B');}}
    let incoming=Infinity,inWin=false;for(const f of m.S.throws)if(f.owner!==P){const t=m.incomingTTI(f,P);if(t<incoming){incoming=t;inWin=t<=m.parryWin(f);}}
    const danger=g.child('Incoming').show(incoming<.6);if(danger.node.active){danger.child('ring').ellipse(me.x,me.y,26+incoming*60,26+incoming*60,'#E8504A',1,0,Math.PI*2,inWin?5:3);const label=danger.child('text').show(inWin);if(inWin)label.text('按甩!',me.x,me.y-62,16,'#FFFDF5','#E8504A');}
  }
  private itemNodes?:MatchCollection<NonNullable<Match['S']['items']>['drops'][number]>;
  private pieNodes?:MatchCollection<Match['S']['pies'][number]>;private warnNodes?:MatchCollection<Match['S']['flying'][number]>;
  // 扇形边线包含径向边，维持旧DrawSurface.closePath效果；所有点存在同一个常驻Sprite网格内。
  sector(n:MatchNode,x:number,y:number,r:number,start:number,end:number,fill:string,stroke:string,width:number):void {
    const cone=(end-start)/2,fan=n.child('Fan').at(x,y,(start+end)/2);fan.child('fill').ellipse(0,0,r,r,fill,1,-cone,cone);const line=fan.child('outline'),key=[r,cone,width].join(':');
    if(this.sectorKeys.get(fan)===key&&line.retainMesh()){line.tint(stroke);return;}const count=Math.max(8,Math.ceil(cone*2*r/4)),points=[0,0];for(let i=0;i<=count;i++){const a=-cone+cone*2*i/count;points.push(Math.cos(a)*r,Math.sin(a)*r);}line.path(points,stroke,width,1,true);this.sectorKeys.set(fan,key);
  }
  // 头顶倒计时与“在看”、领导瞄准线在人物之后，不能被提到飞锅之上。
  aimLines(time:number):void {
    const m=this.match,P=m.S.player,n=this.above,eye=P.crushed?null:m.seenBy(P),clearing=m.isClearing(),left=clearing?m.bellTime()-m.S.t:m.urgentLeft(P),tag=n.child('Due').show(!P.crushed&&m.potsOf(P)>0&&(clearing||left<DUE_WARN));
    if(tag.node.active){tag.child('clock').image('ui_clock',P.sn.x+20,P.sn.y-46,14);tag.child('text').text(String(Math.max(0,Math.ceil(left))),P.sn.x+36,P.sn.y-46,13,clearing?'#E8504A':'#FFFDF5',clearing?'#FFFDF5':left<DUE_DANGER?'#E8504A':'#C98A00');}
    const watching=n.child('Watching').show(!!eye&&m.potsOf(P)>0);if(eye&&watching.node.active)watching.text(eye.name+'在看！',P.sn.x+Math.cos(P.sn.angle)*AIM_RANGE*.6,P.sn.y+Math.sin(P.sn.angle)*AIM_RANGE*.6,14,'#FFFDF5','#E8504A');
    for(const l of m.S.leaders){const group=n.child('Aim-'+l.cfg.sprite).show(l.state==='aim');if(l.state!=='aim')continue;for(const a of m.S.agents){const target=group.child('to-'+a.id).show(l.targets.includes(a));if(!target.node.active)continue;const k=1-l.aimT/(l.cfg.aimTime??AIM_TIME);target.child('line').at(0,0).path([l.x,l.y-20,a.sn.x,a.sn.y],'#E8504A',3,.5+.5*Math.sin(time*20),false,[10,8]);target.child('target').ellipse(a.sn.x,a.sn.y,34-k*12,34-k*12,'#E8504A',1,0,Math.PI*2,3);}}
  }
  // 每帧只排序人物容器，角色内部“影子→身体→状态→名牌”顺序保持原型。
  beginActors():void {this.actorOrder=0;}
  person(a:Agent,spr:{name:string;flip?:boolean;dir?:string;walking?:boolean},time:number):void {
    const m=this.match,n=this.actorNodes.get(a)!,pots=m.potsOf(a),h=a.isPlayer?70:64,top=20-h,hunting=!a.isPlayer&&!a.crushed&&a.target===m.S.player&&pots>0;
    n.order(this.actorOrder++);n.show(this.visible(a.sn.x,a.sn.y));if(!n.node.active)return;n.at(a.sn.x,a.sn.y);
    const hype=n.child('hype').show(!a.crushed&&m.hyped(a));if(hype.node.active)hype.image('fx_hype',0,20-h/2,72+Math.sin(time*9)*3);
    // 金色护圈和头顶秒数不复用接锅护盾，提示时间直接读取core物理时钟。
    const inv=n.child('itemInvincible').show(!a.crushed&&m.itemInvincible(a));
    if(inv.node.active){inv.child('ring').ellipse(0,20-h/2,30+Math.sin(time*9)*2,42,'#FFD84D',1,0,Math.PI*2,3);inv.child('seconds').text('无敌 '+Math.ceil(m.S.items!.invincibleUntil-m.S.t)+'秒',0,top-26,13,'#FFD84D','#1F2A44');}
    const hunt=n.child('hunt').show(!a.crushed&&hunting);if(hunt.node.active)hunt.ellipse(0,0,32,32,'rgba(232,80,74,.2)');
    n.child('shadow').ellipse(0,20,a.crushed?30:a.isPlayer?24:20,(a.crushed?30:a.isPlayer?24:20)*.34,a.isPlayer&&!a.crushed?'rgba(255,216,77,.7)':'rgba(31,42,68,.22)');
    const pic=this.atlas.pictures[spr.name],body=n.child('body');
    if(a.crushed){body.image(spr.name,0,20-(74*pic.h/pic.w)/2,74,{alpha:.9});}
    else {const bob=spr.walking?0:Math.sin(time*6+a.id)*1.2;body.image(spr.name,0,20+bob-h/2,h*pic.w/pic.h,{flip:spr.flip});}
    const dizzy=n.child('dizzy').show(!a.crushed&&a.stun>0);if(dizzy.node.active)dizzy.image('fx_dizzy',0,top-12,30,{angle:time*5});
    const anger=n.child('anger').show(!a.crushed&&(hunting||!a.isPlayer&&a.angry>0));if(anger.node.active)anger.image('fx_anger',20,top+6+Math.sin(time*12)*2,18);
    const sweat=n.child('sweat').show(!a.crushed&&(pots>=POT_ALARM-1||!!m.S.rushHour&&!a.isPlayer));if(sweat.node.active)sweat.image('fx_sweat',-22,top+10+(time*24)%6,16);
    const tears=n.child('tears').show(!a.crushed&&a.cry>0&&(spr.dir==='d'||spr.dir==='s'));if(tears.node.active)tears.image('fx_tears',spr.dir==='s'?(spr.flip?-1:1)*h*.1:0,top+h*(spr.dir==='s'?.38:.4),h*(spr.dir==='s'?.26:.42));
    const flat=n.child('flat').show(a.crushed);if(flat.node.active)flat.text('被压垮',0,-14,12,'#5E6A84');
    const tea=n.child('tea').show(!a.crushed&&!a.isPlayer&&a.teaT>0);if(tea.node.active)tea.text('泡茶中…',0,top-8,12,'#2F9E6B');
    // 红色标记沿用常驻文字部件；只移动容器、切显隐，不逐帧重画。
    const rival=n.child('retryRival').show(a===this.retryRival&&m.S.t<this.retryRivalUntil);
    if(rival.node.active)rival.text('上局就是他',0,top-40,13,'#E8504A','#FFFDF5');
    // 仇是最近甩中过你的同事，和冒火独立；多个同事可同时显示。
    const grudge=n.child('grudge').show(!a.isPlayer&&!a.crushed&&m.S.t<(a.grudgeUntil||0));if(grudge.node.active){grudge.child('paper').rect(20,top-28,22,22,'#E8504A');grudge.child('text').text('仇',31,top-17,13,'#FFFDF5','','body-900');}
    n.child('name').text(a.isPlayer?'你':a.name,0,32,a.isPlayer?13:12,a.crushed?'#5E6A84':'#1F2A44',a.isPlayer?'#FFD84D':'#FFFDF5');
    const badge=n.child('badge').show(!a.crushed&&!a.isPlayer&&pots>0);if(badge.node.active){badge.child('icon').image('ui_wok',-32,top+2,16);badge.child('number').text(String(pots),-18,top+2,12,pots>=POT_ALARM?'#E8504A':'#1F2A44');}
  }
  // 名牌留在领导容器中，后面Y更大的身体仍可遮住名牌，不将全部文字提到最上层。
  leader(l:Leader,spr:{name:string;flip?:boolean},time:number):void {
    const m=this.match,n=this.actorNodes.get(l)!,chase=l.state==='chase'||m.raging(l),h=l.cfg.h,pic=this.atlas.pictures[spr.name];n.order(this.actorOrder++);n.show(this.visible(l.x,l.y));if(!n.node.active)return;n.at(l.x,l.y);
    n.child('danger').ellipse(0,0,46,46,chase?'#E8504A':'rgba(232,80,74,.5)',1,0,Math.PI*2,chase?4:2,[7,6]);
    n.child('shadow').ellipse(0,28,26,26*.34,'rgba(31,42,68,.22)');
    n.child('body').image(spr.name,l.state==='aim'?Math.sin(time*30)*1.2:0,28-h/2,h*pic.w/pic.h,{flip:spr.flip});
    let measured=this.nameWidths.get(l);if(!measured||measured.name!==l.name||measured.metrics!==this.measure){measured={name:l.name,metrics:this.measure,width:Math.ceil(Array.from(l.name).reduce((sum,ch)=>sum+(this.measure[ch]??1),0)*16)+16};this.nameWidths.set(l,measured);}const width=measured.width;
    n.child('namePaper').rect(-width/2,33,width,28,'#FFFDF5');n.child('nameBorder').at(0,0).path([-width/2,33,width/2,33,width/2,61,-width/2,61],'#1F2A44',2,1,true);
    n.child('name').text(l.name,0,47,16,'#E8504A','','bold title');
    const angry=n.child('anger').show(chase),bang=n.child('bang').show(chase);if(chase){angry.image('fx_anger',24,28-h+8+Math.sin(time*12)*2,22);bang.text('！',-26,28-h-4,26,'#E8504A');}
    const inspect=n.child('inspect').show((l.inspectUntil||0)>m.S.t);if(inspect.node.active)inspect.text('查岗',0,28-h-14,18,'#E8504A');
  }
  measure:Record<string,number>={};
  private clearFx?:MatchCollection<Match['S']['fx'][number]>;
  private flying?:MatchCollection<Match['S']['flying'][number]>;private thrown?:MatchCollection<Match['S']['throws'][number]>;private arcs?:MatchCollection<Match['S']['arcs'][number]>;private fx?:MatchCollection<Match['S']['fx'][number]>;
  // 飞锅、烟圈、爆炸保留自己的生命周期；形状/文本/锅图按原调用顺序留在同一实体容器内。
  flight(time:number):void {
    const m=this.match,g=this.effects;
    this.flying??=new MatchCollection(g.child('Flying'),'flying');this.flying.sync(m.S.flying,(n,f)=>{
      const fly=f.phase==='fly',drop=f.phase==='drop',sky=f.phase==='sky',hot=!fly&&!drop&&!sky&&f.hot;
      n.child('shadow').show(fly||sky);n.child('skyRing').show(sky);n.child('pot').show(fly||drop||sky||!!hot);n.child('skyText').show(sky);
      const pot=n.child('pot');
      if(fly){n.child('shadow').ellipse(f.x,f.y+22,16,5,'rgba(31,42,68,.2)');if(f.hot)this.hot(pot,f.x,f.y,time);else this.wok(pot,f.x,f.y,f.label,44,0,1,true,f.a);}
      else if(drop){this.wok(pot,f.x,f.y,f.label,44,f.spin,Math.max(0,f.t/.5));}
      else if(sky){const k=1-f.t/f.warn0;n.child('shadow').ellipse(f.x,f.y+18,10+18*k,4+6*k,`rgba(31,42,68,${.15+.3*k})`);n.child('skyRing').ellipse(f.x,f.y,40-14*k,40-14*k,'#E8504A',1,0,Math.PI*2,3,[6,5]);this.wok(pot,f.x,f.y-280*(1-k)*(1-k),f.label,44,k*6);n.child('skyText').show(k<.7);if(k<.7)n.child('skyText').text('天降锅！',f.x,f.y-70,15,'#FFFDF5','#E8504A');}
      else if(hot)this.hot(pot,f.x,f.y,time);
      this.flightDue(n,f.x,f.y,fly||drop||sky||!!hot);
    });
    this.thrown??=new MatchCollection(g.child('Thrown'),'throw');this.thrown.sync(m.S.throws,(n,f)=>{n.child('trail').path([f.x-Math.cos(f.a)*46,f.y-Math.sin(f.a)*46,f.x,f.y],f.owner.isPlayer?'rgba(47,158,107,.55)':'rgba(232,80,74,.45)',6,1,false,[],true);if(f.hot)this.hot(n.child('pot'),f.x,f.y,time);else this.wok(n.child('pot'),f.x,f.y,f.label,40,0,1,true,f.a);this.flightDue(n,f.x,f.y,true);});
    this.arcs??=new MatchCollection(g.child('Arcs'),'arc');this.arcs.sync(m.S.arcs,(n,a)=>{n.show(a.t>=0);if(a.t<0)return;const k=Math.min(1,a.t/a.dur),to=a.to();this.wok(n,a.x0+(to.x-a.x0)*k,a.y0+(to.y-a.y0)*k-Math.sin(Math.PI*k)*50,a.label,34,k*8);});
    this.fx??=new MatchCollection(g.child('Explosions'),'fx');this.fx.sync(m.S.fx.filter(e=>e.name!=='item_clear'),(n,e)=>{const k=e.t/e.dur,at=e.follow?{x:e.follow.sn.x+e.dx!,y:e.follow.sn.y+e.dy!}:e;
      if(e.name==='pot_explosion'){const sheet=this.assets.spr['pot-cartoon-pow-bd83d9f0'];if(sheet){const frame=Math.min(32,Math.floor(e.t*30)),pic=this.assets.crop(sheet,frame%6*184,Math.floor(frame/6)*144,184,144);n.picture(pic.frame,at.x,at.y,e.size,e.size*144/184);return;}n.image('fx_impact',at.x,at.y,e.size*.5,{alpha:1-k});return;}
      const sc=k<.25?.5+k*2.6:1.15-(k-.25)*.3;n.image(e.name,at.x,at.y,e.size*sc,{alpha:k<.6?1:1-(k-.6)/.4,angle:k*.5});
    });
    // 清锅与通用爆炸分池，回收时不会留下旧锅标签或旧爆炸网格。
    this.clearFx??=new MatchCollection(g.child('ItemClear'),'clear');
    this.clearFx.sync(m.S.fx.filter(e=>e.name==='item_clear'),(n,e)=>{n.show(e.t>=0);if(e.t<0)return;const k=e.t/e.dur;this.wok(n,e.x+Math.sin(e.x)*k*65,e.y-k*110,e.label||'',e.size,k*5,1-k);});
  }
  // 清账飞锅也用铃响剩余秒，标签和锅身各自复用本实体节点。
  private flightDue(n:MatchNode,x:number,y:number,visible:boolean):void {const due=n.child('due').show(visible&&this.match.isClearing());if(due.node.active)due.text(String(Math.max(0,Math.ceil(this.match.bellTime()-this.match.S.t))),x+15,y-15,13,'#E8504A','#FFFDF5');}
  // 热锅光圈与实体锅分开，呼吸仅改常驻顶点；在对象池换用途时明确隐藏光圈。
  private hot(n:MatchNode,x:number,y:number,time:number):void {const r=26+Math.sin(time*14)*3;n.at(0,0);n.child('hotHalo').ellipse(x,y,r,r,'rgba(232,80,74,.35)');this.wok(n.child('hotPot'),x,y,'急件',42,Math.sin(time*10)*.2);n.child('image').show(false);n.child('label').show(false);}
  private floatNodes?:MatchCollection<{text:string;x:number;y:number;color:string;life:number;size?:number;font?:string;owned?:boolean}>;
  // 群聊气泡和飘字仍在爆炸之后、边缘提示之前；不把core状态搬进view。
  speeches(floats:{text:string;x:number;y:number;color:string;life:number;size?:number;font?:string;owned?:boolean}[],camX:number,camY:number,width:number,height:number,mateSpeeches?:ReadonlyMap<number,{text:string;life:number}>):void {
    const m=this.match;
    for(const o of [...m.S.leaders,...m.S.agents]){
      const ox='sn'in o?o.sn.x:o.x,oy='sn'in o?o.sn.y:o.y,show=('sn'in o?!o.crushed:!!o.meeting)||(o.pieSayUntil||0)>m.S.t;
      const active=show&&('sn'in o?!o.crushed&&(o.pieSayUntil||0)>m.S.t:true)&&ox>=camX-30&&ox<=camX+width+30&&oy>=camY&&oy<=camY+height,n=this.speech.child(('sn'in o?'person-'+o.id:'leader-'+o.cfg.sprite)).show(active);if(!active)continue;
      const text=o.pieSay||'',lines=text.length>13?[text.slice(0,13),text.slice(13)]:[text],w=Math.min(13,text.length)*12+16,h=lines.length*17+12,x=Math.min(camX+width-w/2-6,Math.max(camX+w/2+6,ox)),y=Math.max(camY+78+h,oy-('sn'in o?68:116));
      n.child('border').rect(x-w/2-2,y-h-2,w+4,h+4,'#1F2A44');n.child('paper').rect(x-w/2,y-h,w,h,'#FFFDF5');n.child('tip').mesh({xy:[x-5,y,x,y+7,x+5,y],indices:[0,1,2]},'#FFFDF5');
      for(let i=0;i<2;i++){const line=n.child('line-'+i).show(i<lines.length);if(i<lines.length)line.text(lines[i],x,y-h+14+i*17,12,'#1F2A44','rgba(0,0,0,0)');}
    }
    // 同事短句独立于群聊气泡，替换内容后继续复用同一个头顶节点。
    for(const a of m.S.agents){const info=mateSpeeches?.get(a.id),n=this.speech.child('mateSpeech-'+a.id).show(!!info&&!a.crushed&&this.visible(a.sn.x,a.sn.y));if(info&&n.node.active)n.text(info.text,a.sn.x,a.sn.y-104,13,'#5E6A84','#FFFDF5','body-700');}
    this.floatNodes??=new MatchCollection(this.speech.child('Floats'),'float');this.floatNodes.sync(floats,(n,f)=>{const sx=f.x-camX,sy=f.y-camY;n.show(sx>=-300&&sy>=-100&&sx<=width+300&&sy<=height+100);if(!n.node.active)return;
      // 主字与归属小字各有常驻部件，不以拼接文字挤掉明确字号。
      const owned=n.child('owned').show(!!f.owned),ordinary=n.child('ordinary').show(!f.owned),alpha=Math.min(1,f.life*2);
      if(f.owned){owned.child('main').text(f.text,f.x,f.y,22,f.color,'#FFFDF5','body-900',alpha);owned.child('owner').text('你甩的',f.x+77,f.y,13,'#FFD84D','#1F2A44','body-700',alpha);}
      else ordinary.nativeText(f.text,f.x,f.y,f.size||17,f.color,alpha);
    });
  }
  // 圆形头像直接裁成可合批的UV网格，不使用每个头像三次stencil提交。
  private clippedIcon(n:MatchNode,name:string,whole:boolean):void {
    const key=name+':'+whole;if(this.iconNames.get(n)===key&&n.retainMesh())return;
    const pic=this.atlas.pictures[name],head=HEADS[name],size=whole?Math.max(pic.w,pic.h):head[1],d=18*(whole?1.6:2.15),w=whole?d*pic.w/size:d,h=whole?d*pic.h/size:d,offset=whole?0:2;
    const rect=pic.frame.rect,cropX=whole?0:head[0],cropW=whole?pic.w:size,cropH=whole?pic.h:size;
    let points=Array.from({length:64},(_,i)=>[Math.cos(i*Math.PI/32)*18,Math.sin(i*Math.PI/32)*18]);
    // 凸多边形与原图矩形求交，头像下移2px时顶部留白同原Mask，不越界取到隔壁帧。
    for(const [axis,edge,sign] of [[0,-w/2,1],[0,w/2,-1],[1,-h/2+offset,1],[1,h/2+offset,-1]]){const output:number[][]=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],inside=(v:number[])=>sign*(v[axis]-edge)>=0,aa=inside(a),bb=inside(b);if(aa)output.push(a);if(aa!==bb){const t=(edge-a[axis])/(b[axis]-a[axis]);output.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}}points=output;}
    const xy=points.flat(),uv=points.flatMap(([x,y])=>[(rect.x+cropX+(x/w+.5)*cropW)/4096,(rect.y+((y-offset)/h+.5)*cropH)/4096]),indices:number[]=[];for(let i=1;i<points.length-1;i++)indices.push(0,i,i+1);n.mesh({xy,uv,indices},'#FFFFFF',1,pic.frame);this.iconNames.set(n,key);
  }
  // 屏外目标各有常驻提示；次序仍为领导、同事、急件、最近的饼。
  hints(camX:number,camY:number,width:number,height:number):void {
    const m=this.match,P=m.S.player;
    for(const l of m.S.leaders)this.edge(this.edges.child('leader-'+l.cfg.sprite),l.x-camX,l.y-camY,l.cfg.sprite+'_idle','#E8504A',false,width,height);
    for(const b of m.S.bots){const n=this.edges.child('bot-'+b.id).show(!b.crushed);if(b.crushed)continue;const hunt=b.target===P&&m.potsOf(b)>0;this.edge(n,b.sn.x-camX,b.sn.y-camY,b.p.sprite+'_normal',hunt?'#E8504A':m.canThrowTo(P,b)?'#2F9E6B':'#9AA6C4',false,width,height,hunt);}
    for(const b of m.S.bots){const n=this.edges.child('hot-'+b.id).show(!b.crushed&&m.holdsHot(b));if(n.node.active)this.edge(n,b.sn.x-camX,b.sn.y-camY,'wok','#E8504A',true,width,height);}
    const pie=m.S.pies.reduce<Match['S']['pies'][number]|null>((best,p)=>!best||Math.hypot(P.sn.x-p.x,P.sn.y-p.y)<Math.hypot(P.sn.x-best.x,P.sn.y-best.y)?p:best,null),n=this.edges.child('pie').show(!!pie);if(pie)this.edge(n,pie.x-camX,pie.y-camY,'pie','#FFD84D',true,width,height);
    const {x,y}=stickCenter(width,height),inp=m.inp;
    this.stick.child('base').ellipse(x,y,52,52,'#1F2A44',inp.down?.32:.16);this.stick.child('thumb').ellipse(inp.down?inp.x:x,inp.down?inp.y:y,22,22,'#FFFDF5',inp.down?.75:.35);
  }
  private edge(n:MatchNode,sx:number,sy:number,name:string,ink:string,whole:boolean,width:number,height:number,angry=false):void {
    if(sx>0&&sx<width&&sy>70&&sy<height){n.show(false);return;}n.show(true);const cx=width/2,cy=(height+70)/2,a=Math.atan2(sy-cy,sx-cx),t=Math.min((width/2-36)/Math.max(1e-6,Math.abs(Math.cos(a))),((height-70)/2-36)/Math.max(1e-6,Math.abs(Math.sin(a)))),x=cx+Math.cos(a)*t,y=cy+Math.sin(a)*t;n.at(x,y);
    const arrow=n.child('arrow').at(0,0,a);if(!arrow.retainMesh())arrow.mesh({xy:[32,0,19,-9,19,9],indices:[0,1,2]},ink);else arrow.tint(ink);n.child('circle').ellipse(0,0,21,21,ink);n.child('paper').ellipse(0,0,18,18,'#FFF8E7');this.clippedIcon(n.child('icon'),name,whole);const badge=n.child('badge').show(angry);if(angry)badge.image('fx_anger',21*.75,-21*.75,20);
  }
  // 生命周期跟World走；介绍页移交只保留静态地面，不遗留旧对象引用或旧字体帧。
  destroy():void {this.ground.node.removeFromParent();this.ground.destroy();this.above.node.removeFromParent();this.above.destroy();this.tails.node.removeFromParent();this.tails.destroy();this.actors.node.removeFromParent();this.actors.destroy();for(const n of [this.effects,this.speech,this.edges,this.stick]){n.node.removeFromParent();n.destroy();}this.atlas.destroy();}
}
