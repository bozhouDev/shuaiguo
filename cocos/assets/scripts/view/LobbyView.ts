import {LEVELS} from '../core/levels';
import {Progress} from '../core/types';
import {TopAvoidance} from '../platform/Platform';
import {ScreenPaint} from './ScreenPaint';
import {LOBBY_LINES} from './ui-data';
import {Box} from './UiPaint';
// showLobby/pokeHero/updateLobby：按CSS的flex/min-content算尺寸，随机不碰玩法流。
export class LobbyView {
  heroUntil=0;line=-1;scroll=0;strip:Box|null=null;
  private days:{x:number;w:number}[]=[];private max=0;
  constructor(readonly p:ScreenPaint){}
  // 日期按钮保留内容最小宽度；空星原图比实星稍宽，照原型按图片高度排。
  private calendar(prog:Progress):void {
    const W=this.p.c.width,H=this.p.c.height,w=Math.min(360,Math.min(W,H*.666)-32),narrow=W<=360,size=narrow?18:H<=720?20:22,star=narrow?20:22,gap=narrow?8:10;
    let x=0;this.days=LEVELS.map(lv=>{const stars=prog.best[lv.id]?.stars||0,sw=[0,1,2].reduce((n,i)=>{const pic=(this.p.c.assets.spr[i<stars?'ui_star':'ui_star_empty']||{w:96,h:91});return n+star*pic.w/pic.h;},8),cw=Math.max(w*.26,sw+24,this.p.width(lv.name.split('·')[0].trim(),size,'body-900')+24+(narrow?3:4)+(narrow?20:24)*90/96),d={x,w:cw};x+=cw+gap;return d;});this.max=Math.max(0,x-gap-w);
  }
  // 首尾停在边缘，中间关自动居中；吸附使用同一组卡片中心。
  select(index:number,prog:Progress={unlocked:1,best:{}}):void {this.calendar(prog);const w=Math.min(360,Math.min(this.p.c.width,this.p.c.height*.666)-32),d=this.days[index];this.scroll=Math.max(0,Math.min(this.max,d.x+d.w/2-w/2));}
  // 同一句不连续出现，1.6真实秒后自动恢复。
  poke(real:number):void {let i:number;do{i=Math.floor(Math.random()*LOBBY_LINES.length);}while(i===this.line);this.line=i;this.heroUntil=real+1.6;}
  // 横滑后就近吸附卡片中心，边缘夹紧，不触发选关。
  swipe(delta:number,snap=false):void {this.scroll=Math.max(0,Math.min(this.max,this.scroll-delta));if(snap){const w=this.strip!.w-32;this.scroll=this.days.map(d=>Math.max(0,Math.min(this.max,d.x+d.w/2-w/2))).sort((a,b)=>Math.abs(a-this.scroll)-Math.abs(b-this.scroll))[0];}}
  // 大厅主布局：真实CSS像素，底部菜单固定，人物区分配剩余高度。
  draw(index:number,prog:Progress,real:number,avoid:TopAvoidance,reduce:boolean):void {
    const p=this.p,c=p.c,W=c.width,H=c.height,short=H<=720,narrow=W<=360;
    c.fillStyle='#C9D3DD';c.fillRect(0,0,W,H);const bg=c.assets.spr.lobby_bg;if(bg){const s=W/H>=2/3?H/bg.h:Math.max(W/bg.w,H/bg.h);p.image('lobby_bg',(W-bg.w*s)/2,0,bg.w*s,bg.h*s);}
    const col=Math.min(W,H*.666),left=(W-col)/2+16,width=col-32,mw=Math.min(360,width),mx=(W-mw)/2,top=avoid.top+10;
    const stars=LEVELS.reduce((n,lv)=>n+(prog.best[lv.id]?.stars||0),0),badgeText=`工牌 ${stars}/15`,badgeWidth=39+p.width(badgeText,15)+17;
    p.panel({x:left,y:top,w:badgeWidth,h:27.34});p.image('ui_badge',left+9,top+6,13,15);p.text(badgeText,left+27,top+5,15,'#FFF6D8');p.image('ui_star',left+badgeWidth-26,top+5,17,17);
    const gx=avoid.capsule&&top<avoid.capsule.y+avoid.capsule.h&&top+27.34>avoid.capsule.y?Math.min(left+width-39.25,avoid.capsule.x-47):left+width-39.25;
    p.panel({x:gx,y:top,w:39.25,h:27.34});p.icon('gear',gx+11,top+5,17.25,'#FFF6D8');p.hit('settings','设置',{x:gx,y:top,w:39.25,h:27.34});
    const fs=narrow?46:short?Math.max(52,Math.min(70,W*.15)):Math.max(60,Math.min(88,W*.19)),ty=top+27.34+H*(short?.015:.035),tw=p.width('这锅你来背',fs)+fs*.02*6,tx=(W-tw)/2;
    for(const shadow of [true,false]){c.font=`${fs}px title`;c.strokeStyle='#1F2A44';c.lineWidth=7;c.strokeText('这锅你来背',W/2,ty+fs*.5+(shadow?6:0));c.fillStyle=shadow?'#1F2A44':'#FFD84D';c.fillText('这锅你来背',W/2,ty+fs*.5+(shadow?6:0));}p.rays({x:tx,y:ty,w:tw,h:fs});
    const subfs=short?15:17,sub='今天这锅，反正不是我的',sw=p.width(sub,subfs,'body-900')+sub.length*subfs*.06+48,sy=ty+fs+(short?8:12),sh=subfs*1.4+21.2;
    p.box({x:(W-sw)/2,y:sy,w:sw,h:sh},'#FFF8E6',8);p.tracked(sub,(W-sw)/2+24,sy+10,subfs,subfs*.06,'#1F2A44','body-900');
    const gap=short?8:10,subHeight=54,goHeight=short?61.6:76.8,bottom=H-16,goY=bottom-subHeight-gap-goHeight,nameY=goY-gap-21,dayHeight=narrow?80:short?84:84.2,daysH=dayHeight+42,stripY=nameY-gap-2-daysH,dayY=stripY+34;
    const floorTop=sy+sh,floorH=Math.max(short?170:200,stripY+16-floorTop),crewH=Math.min(290,floorH),crewY=floorTop+(floorH-crewH)/2,crewW=Math.min(340,width),crewX=(W-crewW)/2,heroH=Math.max(120,Math.min(168,H*.2)),heroFoot=crewY+crewH*.96,heroY=heroFoot-heroH;
    const bob=(delay=0)=>reduce?0:((real-delay)%1.2+1.2)%1.2>=.6?-3:0;
    const pose=real<this.heroUntil?'player_win':'player_normal',hero=c.assets.spr[pose]||{w:139,h:230},heroW=heroH*hero.w/hero.h;
    c.fillStyle='rgba(255,216,77,.55)';c.beginPath();c.ellipse(W/2,heroFoot-2,heroW*.43,9,0,0,Math.PI*2);c.fill();c.strokeStyle='rgba(201,138,0,.7)';c.lineWidth=2;c.stroke();
    const mh=Math.max(84,Math.min(108,H*.13));
    for(const [name,right] of [['intern_walk_s1',false],['veteran_walk_s1',true]] as const){const pic=c.assets.spr[name]||{w:152,h:230},ww=mh*pic.w/pic.h,xx=right?crewX+crewW*.94-ww:crewX+crewW*.06,yy=crewY+crewH*.86-mh;c.fillStyle='rgba(31,42,68,.18)';c.beginPath();c.ellipse(xx+ww/2,yy+mh+1,ww*.45,6,0,0,Math.PI*2);c.fill();c.save();if(right){c.translate(xx+ww,0);c.scale(-1,1);p.image(name,0,yy+bob(.3),ww,mh);}else p.image(name,xx,yy+bob(.3),ww,mh);c.restore();for(let i=0;i<2;i++){c.save();c.globalAlpha=.7;c.translate(right?xx-16:xx+ww+8,yy+mh*.52+i*8);c.rotate((i?1:-1)*(right?-1:1)*.6);c.fillStyle='#1F2A44';c.fillRect(0,0,4,9);c.restore();}}
    p.image(pose,(W-heroW)/2,heroY+bob(),heroW,heroH);p.hit('hero','主角',{x:(W-heroW)/2,y:heroY,w:heroW,h:heroH});
    c.save();c.translate(W/2,crewY+crewH*.02);if(short)c.scale(.8,.8);
    for(const [i,xx,yy,rot] of [[0,-105.6,26,-.244],[1,-24,0,0],[2,62,26,.244]]){c.save();const pic=c.assets.spr.wok||{w:96,h:72},ww=44*pic.w/pic.h;c.translate(xx+ww/2,yy+22+(reduce?0:((real-i*.4)%1.2+1.2)%1.2>=.6?-5:0));c.rotate(rot);if(i===2)c.scale(-1,1);p.image('wok',-ww/2,-22,ww,44);c.restore();}
    for(let i=0;i<4;i++){c.save();c.globalAlpha=reduce?1:((real-i*.5)%1+1)%1>=.5?.25:1;c.translate([-129.6,-45.6,40.6,124.6][i],[48,14,14,48][i]);c.rotate([-.873,-.436,.436,.873][i]);c.fillStyle='#C98A00';c.fillRect(-2,-2,9,18);c.fillStyle='#FFD84D';c.fillRect(0,0,5,14);c.restore();}c.restore();
    if(real<this.heroUntil){const text=LOBBY_LINES[this.line],bw=p.width(text,17)+24,yy=heroY-33;c.fillStyle='#1F2A44';c.fillRect((W-bw)/2+3,yy+3,bw,31);c.fillRect((W-bw)/2,yy,bw,31);c.fillStyle='#FFFFFF';c.fillRect((W-bw)/2+2,yy+2,bw-4,27);p.center(text,(W-bw)/2,yy+5,bw,17,'#1F2A44','title');c.fillStyle='#1F2A44';c.beginPath();c.moveTo(W/2-6,yy+31);c.lineTo(W/2+6,yy+31);c.lineTo(W/2,yy+37);c.fill();}
    this.calendar(prog);this.scroll=Math.min(this.scroll,this.max);this.strip={x:mx-16,y:stripY,w:mw+32,h:daysH};c.save();c.beginPath();c.rect(this.strip.x,this.strip.y,this.strip.w,this.strip.h);c.clip();
    LEVELS.forEach((lv,i)=>{const d=this.days[i],xx=mx+d.x-this.scroll,on=i===index;if(xx+d.w<mx-16||xx>mx+mw+16)return;const b={x:xx,y:dayY,w:d.w,h:dayHeight};p.box(b,on?'#26324F':'#FFF8E6',on?10:8);if(on){p.goldFrame(b);p.box({x:xx+(d.w-48)/2,y:dayY-22,w:48,h:26},'#FFD84D',5,false);p.center('当前',xx,dayY-17,d.w,13);for(let k=0;k<3;k++){c.save();c.globalAlpha=reduce?1:((real-k*.5)%1+1)%1>=.5?.25:1;c.translate(i===0?xx-(k===1?24:20):xx+d.w+(k===1?24:20),dayY+dayHeight*[.14,.46,.78][k]);c.rotate((k-1)*(i===0?-1:1)*.61);c.fillStyle='#C98A00';c.fillRect(-2,-2,15,9);c.fillStyle='#FFD84D';c.fillRect(0,0,11,5);c.restore();}}
      const size=narrow?18:short?20:22,ih=narrow?20:24,iw=ih*90/96,day=lv.name.split('·')[0].trim(),ww=iw+(narrow?3:4)+p.width(day,size,'body-900'),start=xx+(d.w-ww)/2;p.image('ui_calendar',start,dayY+14,iw,ih);p.text(day,start+iw+(narrow?3:4),dayY+14,size,on?'#FFF6D8':'#1F2A44','body-900');p.stars(prog.best[lv.id]?.stars||0,xx+(d.w-(narrow?71.3:77.6))/2,dayY+dayHeight-34,narrow?20:22,4);p.hit(`pick:${i}`,lv.name,b);});c.restore();
    const name=`第 ${index+1} 关 · ${LEVELS[index].name}`,nw=p.width(name,15,'body-900'),line=(mw-nw-20)/2;c.fillStyle='rgba(31,42,68,.55)';c.fillRect(mx,nameY+10,line,3);c.fillRect(mx+mw-line,nameY+10,line,3);p.center(name,mx,nameY,mw,15);
    p.box({x:mx,y:goY,w:mw,h:goHeight},'#FFD84D',8);p.tracked('去上班',W/2-(p.width('去上班',short?28:34,'body-900')+(short?28:34)*.14*2)/2,goY+(goHeight-(short?28:34)*1.2)/2-2,short?28:34,(short?28:34)*.14,'#1F2A44','body-900');p.image('ui_badge',mx+22,goY+goHeight/2-24,44*(c.assets.spr.ui_badge?.w||1)/(c.assets.spr.ui_badge?.h||1),44);c.fillStyle='#1F2A44';c.beginPath();c.moveTo(mx+mw-43,goY+goHeight/2-14);c.lineTo(mx+mw-26,goY+goHeight/2-2);c.lineTo(mx+mw-43,goY+goHeight/2+10);c.fill();p.hit('go','去上班',{x:mx,y:goY,w:mw,h:goHeight});
    for(const [i,action,label,img] of [[0,'boss-name','老板名称','ui_crown'],[1,'rules','玩法','ui_book']] as const){const b={x:mx+i*(mw+12)/2,y:bottom-subHeight,w:(mw-12)/2,h:subHeight};p.box(b);const iw=24*(c.assets.spr[img]?.w||1)/(c.assets.spr[img]?.h||1),ww=iw+8+p.width(label,20,'body-900'),xx=b.x+(b.w-ww)/2;p.image(img,xx,b.y+13,iw,24);p.text(label,xx+iw+8,b.y+14,20,'#1F2A44','body-900');p.hit(action,label,b);}
  }
}
