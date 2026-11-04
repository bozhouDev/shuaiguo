import {Layers, Node, SubContextView, UITransform} from 'cc';
import {TopAvoidance} from '../platform/Platform';
import {wechatAPI} from '../platform/wechat-api';
import {ScreenPaint} from './ScreenPaint';
import {Box} from './UiPaint';
import {LEVELS} from '../core/levels';

// 只画方案B的外壳；好友资料不进入主域，网页也不伪造好友成绩。
export class FriendRankView {
  list: Box = {x:0,y:0,w:0,h:0};
  selected=0;
  private node?: Node;
  private context?: {postMessage(message: unknown): void};
  private sent='';
  private visible=false;
  private available=true;
  constructor(readonly p:ScreenPaint,readonly parent:Node,readonly wechat:boolean) {}
  // 保留安全区/胶囊空间；三种窄屏均固定顶部和底部，列表占用中间剩余高度。
  draw(avoid:TopAvoidance,active=true):void {
    const p=this.p,c=p.c,W=c.width,H=c.height,x=16,w=W-32,top=Math.max(avoid.top+10,avoid.capsule?avoid.capsule.y+avoid.capsule.h+10:0),buttonY=H-82;
    c.fillStyle='#BCCBDD';c.fillRect(0,0,W,H);
    p.panel({x,y:top,w,h:118});p.contain('ui_crown',{x:x+14,y:top+15,w:27,h:27});p.text('谁背锅最少',x+48,top+17,24,'#FFF6D8','title');
    p.text('关闭',x+w-49,top+22,14,'#FFF6D8','body-700');p.hit('rank-close','关闭',{x:x+w-60,y:top+6,w:54,h:44});
    const gap=5,tw=(w-24-gap*4)/5;
    LEVELS.forEach((lv,i)=>{const b={x:x+12+i*(tw+gap),y:top+66,w:tw,h:38};p.box(b,i===this.selected?'#FFD84D':'#FFFDF5',4,false);p.center(lv.name.split('·')[0].trim(),b.x,b.y+10,b.w,16);p.hit('rank-pick:'+i,lv.name,b);});
    p.text('总账越少，甩得越好',x+8,top+135,14,'#5E6A84','body-700');p.text('总账',x+w-44,top+135,14,'#1F2A44','body-700');
    const card={x,y:top+160,w,h:buttonY-(top+160)-18};p.box(card,'#FFFDF5',6);
    this.list={x:x+8,y:card.y+8,w:w-16,h:card.h-16};
    if(!this.wechat||!this.available)p.center(this.wechat?'好友榜暂时看不了':'好友排行只能在微信里看',this.list.x,this.list.y+this.list.h/2-8,this.list.w,14,'#5E6A84','body-700');
    p.button('rank-go','去上班',{x,y:buttonY,w,h:58});
    if(this.wechat&&this.available&&active){this.show();if(this.node)p.c.insertLayer(this.node);}else this.hide();
  }
  // Cocos设计分辨率运行时只读：保留默认640×960，通过节点缩放和子域反向坐标映射铺满列表。
  private show():void {
    const b=this.list;
    try {
      if(!this.node){this.context=wechatAPI().getOpenDataContext?.();if(!this.context)throw new Error('unavailable');const n=new Node('FriendRankList');n.layer=Layers.Enum.UI_2D;n.active=false;const t=n.addComponent(UITransform);t.setContentSize(640,960);this.parent.addChild(n);const component=n.addComponent(SubContextView);component.fps=15;this.node=n;}
      const signature=[this.selected,b.x,b.y,b.w,b.h].join(':');
      // 3.8.8即使坐标没变也会发TRANSFORM_CHANGED；只在布局变化时重算引擎viewport。
      if(!this.visible||signature!==this.sent){this.node.setPosition(b.x+b.w/2,-b.y-b.h/2);this.node.setScale(b.w/640,b.h/960,1);this.node.active=true;this.post('show',{level:LEVELS[this.selected].id,width:b.w,height:b.h});this.sent=signature;}this.visible=true;
    }catch{this.available=false;this.hide();}
  }
  // 只发送版本化的数字协议，不附带本地存档或老板称呼。
  private post(action:string,data:Record<string,number>={}):void {this.context?.postMessage({type:'sg-friend-rank',v:1,action,...data});}
  // 主域仅转发触摸位移；边界和每关滚动位置由开放数据域管理。
  scroll(delta:number):void {if(this.visible)this.post('scroll',{delta});}
  // 命中区域与绘制共用，拖动按钮/日期时不会带动榜单。
  contains(x:number,y:number):boolean {const b=this.list;return x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h;}
  // 有星结算只失效本关，不向开放数据域发送成绩或身份。
  invalidate(level:number):void {try{this.post('invalidate',{level});}catch{/* 微信接口不可用时保留主流程。 */}}
  // 隐藏节点停止SubContextView的贴图上传；子域无requestAnimationFrame或轮询。
  hide():void {if(this.visible){try{this.post('hide');}catch{/* 隐藏始终完成。 */}}this.visible=false;if(this.node)this.node.active=false;}
  // 节点销毁由SubContextView释放贴图和共享画布引用。
  destroy():void {this.hide();this.node?.destroy();this.node=undefined;this.context=undefined;}
}
