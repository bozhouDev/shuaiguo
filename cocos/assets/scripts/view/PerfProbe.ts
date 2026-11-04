import {Director, Graphics, Label, Layers, Node, Sprite, UITransform, director, game, view} from 'cc';

export interface PerfFrame {at:number; interval:number; logic:number; draw:number; drawCalls:number|null; graphics:number; sprites:number; labels:number; changedLabels:number; vertices:number|null; labelLayout:number; graphicClears:number}
// 调试采样器也由Node/浏览器基准工具复用；只在debugEnabled且主动打开时构造。
// Cocos的私有实现只用于只读统计，版本不兼容时返回null，绝不把缺失数据报成0。
export class PerfProbe {
  readonly version='p7-3-v1';
  frames:PerfFrame[]=[]; starts:Record<string,number>[]=[];
  private undo:(()=>void)[]=[];
  private last=0; private logic=0; private draw=0; private changed=new Set<Label>(); private layout=0; private clears=0;
  private overlay?:Node; private text?:Label; private nextText=0;
  // 仪器连接外围实例及真实World原型；不复制玩法，不改dt和随机数。
  constructor(private app:any,worldPrototype:any,visible=true) {
    const probe=this;
    this.wrapDraw(app,'render');this.wrapDraw(worldPrototype,'render');this.attachUI();
    this.wrap(worldPrototype,'tick',function(original,args){const t=performance.now(),d=probe.draw;try{return original(...args);}finally{probe.logic+=performance.now()-t-(probe.draw-d);}});
    // begin/end包住整个点击；首帧GPU提交在EVENT_AFTER_DRAW补齐。
    this.wrap(app,'startGame',async function(original,args){const t=performance.now(),entry:Record<string,number>={clickedAt:t};probe.pendingStart=entry;try{return await original(...args);}finally{entry.startGame=performance.now()-t;probe.starts.push(entry);if(probe.starts.length>20)probe.starts.shift();}});
    this.wrap(app,'createWorld',async function(original,args){const t=performance.now();try{return await original(...args);}finally{if(probe.pendingStart)probe.pendingStart.createWorld=performance.now()-t;}});
    this.wrap(worldPrototype,'destroy',function(original,args){const t=performance.now();try{return original(...args);}finally{if(probe.pendingStart)probe.pendingStart.destroyWorld=performance.now()-t;}});
    this.wrap(worldPrototype,'start',async function(original,args){const t=performance.now(),d=probe.draw;try{return await original(...args);}finally{if(probe.pendingStart){probe.pendingStart.worldStart=performance.now()-t;probe.pendingStart.initialDraw=probe.draw-d;}}});
    const descriptor=Object.getOwnPropertyDescriptor(Label.prototype,'string')!;
    Object.defineProperty(Label.prototype,'string',{...descriptor,set(value:string){if(this!==probe.text&&descriptor.get!.call(this)!==value)probe.changed.add(this);descriptor.set!.call(this,value);}});
    this.undo.push(()=>Object.defineProperty(Label.prototype,'string',descriptor));
    for(const method of ['updateRenderData','updateRenderer'])this.wrap(Label.prototype,method,function(original,args){const t=performance.now();try{return original(...args);}finally{probe.layout+=performance.now()-t;}});
    this.wrap(Graphics.prototype,'clear',function(original,args){probe.clears++;return original(...args);});
    if(visible)this.makeOverlay();
    director.on(Director.EVENT_AFTER_DRAW,this.afterDraw,this);
  }
  private drawing=0; private uiPrototypes=new WeakSet<object>(); private pendingStart?:Record<string,number>;
  // 暂停期间HUD可独立播放动画；也要计入绘制，嵌套World.render时不重复计时。
  private attachUI():void {const prototype=this.app.world?.ui?.constructor.prototype;if(prototype&&!this.uiPrototypes.has(prototype)){this.uiPrototypes.add(prototype);this.wrapDraw(prototype,'draw');}}
  private wrapDraw(target:any,key:string):void {const probe=this;this.wrap(target,key,(original,args)=>{const t=performance.now(),outer=probe.drawing++===0;try{return original(...args);}finally{probe.drawing--;if(outer)probe.draw+=performance.now()-t;}});}
  // 保留原有this与返回值，关闭时恢复原方法/属性，不能留下采样监听。
  private wrap(target:any,key:string,body:(original:(...args:any[])=>any,args:any[])=>any):void {
    if(typeof target[key]!=='function')return;
    const descriptor=Object.getOwnPropertyDescriptor(target,key),original=target[key];
    target[key]=function(...args:any[]){return body((...values:any[])=>original.apply(this,values),args);};
    this.undo.push(()=>{if(descriptor)Object.defineProperty(target,key,descriptor);else delete target[key];});
  }
  // 浮层独立于产品DrawSurface，使用系统字，不扩充正式字体/素材；每250ms才更新文字。
  private makeOverlay():void {
    const n=this.overlay=new Node('DebugPerformance');n.layer=Layers.Enum.UI_2D;this.app.parent.addChild(n);
    const g=n.addComponent(Graphics);g.fillColor.set(15,22,40,235);g.rect(0,-137,355,137);g.fill();
    const textNode=new Node('Metrics');textNode.layer=Layers.Enum.UI_2D;n.addChild(textNode);textNode.setPosition(7,-6);
    const tr=textNode.addComponent(UITransform);tr.setAnchorPoint(0,1);tr.setContentSize(342,126);
    const l=this.text=textNode.addComponent(Label);l.useSystemFont=true;l.fontSize=11;l.lineHeight=16;l.horizontalAlign=Label.HorizontalAlign.LEFT;l.verticalAlign=Label.VerticalAlign.TOP;l.enableWrapText=false;
  }
  // 在真实提交之后读取本帧draw call；不使用Graphics节点数冒充draw call。
  private afterDraw():void {
    this.attachUI();
    const now=performance.now(),root=this.app.parent,gs=root.getComponentsInChildren(Graphics).filter((c:Graphics)=>c.node.activeInHierarchy),ss=root.getComponentsInChildren(Sprite).filter((c:Sprite)=>c.node.activeInHierarchy),ls=root.getComponentsInChildren(Label).filter((c:Label)=>c.node.activeInHierarchy);
    const own=this.overlay?1:0;let vertices:number|null=0;
    for(const g of gs){if(g.node===this.overlay)continue;const impl=(g as any).impl;if(!impl?.getRenderDataList){vertices=null;break;}for(const data of impl.getRenderDataList())vertices!+=data.vertexStart;}
    const calls=(director.root as any)?.device?.numDrawCalls;
    if(this.last){this.frames.push({at:now,interval:now-this.last,logic:this.logic,draw:this.draw,drawCalls:typeof calls==='number'?calls:null,graphics:gs.length-own,sprites:ss.length,labels:ls.length-own,changedLabels:this.changed.size,vertices,labelLayout:this.layout,graphicClears:this.clears});if(this.frames.length>1800)this.frames.shift();}
    if(this.pendingStart&&this.app.screen==='play'&&this.app.world?.ready){this.pendingStart.firstSubmitted=now-this.pendingStart.clickedAt;this.pendingStart.firstLabelLayout=this.layout;this.pendingStart=undefined;}
    this.last=now;this.logic=this.draw=this.layout=this.clears=0;this.changed.clear();
    if(this.overlay){const size=view.getVisibleSize();this.overlay.setPosition(-size.width/2+10,size.height/2-145);this.overlay.setSiblingIndex(root.children.length-1);if(now>=this.nextText){this.nextText=now+250;const s=this.summary(2000),current=this.frames.at(-1),f=(v:unknown)=>typeof v==='number'?v.toFixed(2):'N/A';this.text!.string=`性能 · 第${this.app.world?.match.L.id??'-'}关 · 近2秒\n帧间隔 ${f(s.interval)} / 最差5% ${f(s.worst5)} ms\n逻辑 ${f(s.logic)} · 绘制 ${f(s.draw)} ms\ndraw call ${current?.drawCalls??'N/A'} · 顶点 ${current?.vertices??'N/A'}\nGraphics ${current?.graphics??0} / Sprite ${current?.sprites??0} / Label ${current?.labels??0}\n本帧改字 ${current?.changedLabels??0} · 排字 ${f(s.labelLayout)} ms\n目标 ${game.frameRate} FPS · DPR ${view.getDevicePixelRatio()}`;}}
  }
  // 最差5%为最慢ceil(n*.05)帧的均值；原始interval从未被玩法的33ms上限截断。
  summary(windowMs=2000):Record<string,number|null> {
    const end=this.frames.at(-1)?.at??0,frames=this.frames.filter(f=>f.at>=end-windowMs),result:Record<string,number|null>={frames:frames.length};
    for(const key of ['interval','logic','draw','drawCalls','graphics','sprites','labels','changedLabels','vertices','labelLayout','graphicClears'] as const){const values=frames.map(f=>f[key]);result[key]=values.length&&values.every(v=>v!==null)?(values as number[]).reduce((a,b)=>a+b,0)/values.length:null;}
    const slow=frames.map(f=>f.interval).sort((a,b)=>b-a).slice(0,Math.max(1,Math.ceil(frames.length*.05)));result.worst5=slow.length?slow.reduce((a,b)=>a+b,0)/slow.length:null;return result;
  }
  // 重置仅清仪器缓冲，当前对局和节点池保持原状。
  reset():void {this.frames=[];this.last=0;this.logic=this.draw=this.layout=this.clears=0;this.changed.clear();}
  // 释放本采样器创建的节点与hook，保留用户场景/其他监听。
  destroy():void {director.off(Director.EVENT_AFTER_DRAW,this.afterDraw,this);for(const undo of this.undo.reverse())undo();this.overlay?.destroy();this.frames=[];}
}
