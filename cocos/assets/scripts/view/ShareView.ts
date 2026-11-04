import {ScreenPaint} from './ScreenPaint';
import {Box} from './UiPaint';
import {Result} from './ResultView';
// 原型shareCard/showSharePreview：5:4配图用同一批原型精灵与原文案代码节点组成。
export class ShareView {
  constructor(readonly p: ScreenPaint) {}
  // 原型的标题优先级：末关证书大于隐藏成就；分享不发奖励。
  title(info: Result['shareInfo']): string {if(info.nephewCrushed&&info.kind!=='cert')return info.nephewReport;if(info.kind==='blame')return info.crushed?'我被锅压垮了，剩下这口急件你来背':`我背了 ${info.blames} 次锅被留下加班，这口锅甩给你了`;if(info.kind==='brag')return `我${info.day}第 ${info.rank} 名准点下班，你能活到几点？`;return info.revived||info.rescued?'我拿到了「关系户」证书，领导罩着就是不一样':'「凭本事下班」证书到手，一个广告都没看';}
  // 真正外发的微信标题使用固定老板称呼；保留原型两段附加报告，预览仍按原文显示。
  wechatTitle(info:Result['shareInfo'],piesEaten:number):string {
    const safe={...info,nephewReport:info.nephewReport?(info.nephewCrushed?'今天我把老板小舅子压垮了':'老板小舅子今天背锅 0 次，第一个下班'):''};
    let title=this.title(safe);if(safe.nephewReport&&!info.nephewCrushed)title+='\n'+safe.nephewReport;
    if(info.pieReport)title+=`\n今天吃了老板 ${piesEaten} 张饼`;return title;
  }
  // 配图内部按原型220×176像素画，外层任意等比缩放。
  picture(info: Result['shareInfo'], b: Box): void {
    const p=this.p,c=p.c;c.save();c.translate(b.x,b.y);c.scale(b.w/220,b.h/176);
    c.fillStyle=info.kind==='blame'?'#BCCBDD':info.kind==='brag'?'#26324F':'#FFF8E6';c.fillRect(0,0,220,176);
    if(info.nephewCrushed&&info.kind!=='cert'){p.contain('boss_chase',{x:2,y:4,w:48,h:50});p.contain('nephew_flat',{x:160,y:4,w:56,h:46});p.center('隐藏成就',0,50,220,11,'#FFD84D');p.center('把小舅子压垮了 · 爽完赶紧跑',0,116,220,10.5,'#C4D6F2','body-700');}
    else if(info.kind==='blame'){c.fillStyle='#B2C2D6';for(let i=0;i<220;i+=16)c.fillRect(i,0,1,176);for(let i=0;i<176;i+=16)c.fillRect(0,i,220,1);c.fillStyle='#E8504A';c.fillRect(6,6,124,22);p.contain('ui_clock',{x:12,y:9,w:14,h:14});p.text('18:00 前甩掉',30,10,12,'#FFFFFF','body-900');p.contain('player_win',{x:6,y:74,w:72,h:96});p.contain('wok_flying',{x:76,y:34,w:64,h:50});p.box({x:98,y:30,w:36,h:22},'#FFD84D',4,false);p.text('急件',102,34,13,'#1F2A44','body-900');c.strokeStyle='#E8504A';c.lineWidth=3;c.setLineDash([5,4]);c.strokeRect(162,94,50,72);c.setLineDash([]);p.center('?',162,112,50,34,'#E8504A','title');}
    else if(info.kind==='brag'){p.contain('boss_idle',{x:2,y:4,w:48,h:50});p.contain('player_win',{x:170,y:4,w:46,h:46});p.center(info.day,0,38,220,11,'#FFD84D');p.box({x:43,y:60,w:134,h:48},'#FFD84D',6,false);p.center(`第 ${info.rank} 名`,43,68,134,30);p.stars(info.stars,80,115,18,3);p.center(`${info.total} 人里背锅 ${info.blames} 次 · ${info.title}`,0,143,220,10.5,'#C4D6F2','body-700');}
    else {const help=[info.revived&&'复活 1 次',info.rescued&&'顶包 1 次'].filter(Boolean),relationship=help.length>0,ink=relationship?'#8C7AB0':'#B08A3E';c.fillStyle=relationship?'#F3EEF8':'#FFF8E6';c.fillRect(0,0,220,176);c.strokeStyle=ink;c.lineWidth=1.7;for(const inset of [1,4])c.strokeRect(inset,inset,220-inset*2,176-inset*2);p.contain('ui_badge',{x:96,y:38,w:28,h:28});p.center(relationship?'关系户下班证书':'凭本事下班证书',4,66,212,15);this.certificateLine([{text:'兹证明 ',red:false},{text:'本打工人',red:true},{text:` 在${info.day}`,red:false}],92);this.certificateLine(relationship?[{text:`经领导特别关照（${help.join('、')}）`,red:false}]:[{text:'未靠任何关系，背锅仅 ',red:false},{text:String(info.blames),red:true},{text:' 次',red:false}],107);p.center(relationship?'成功下班':'准点下班',4,122,212,10,'#3A4660','body-700');c.strokeStyle=relationship?'#8C7AB0':'#E8504A';c.lineWidth=2;c.beginPath();c.arc(195,24,19,0,Math.PI*2);c.stroke();p.center(relationship?'领导':'纯手艺',177,12,36,9,relationship?'#8C7AB0':'#E8504A');p.center(relationship?'罩的':'认证',177,23,36,9,relationship?'#8C7AB0':'#E8504A');}
    c.restore();
  }
  // 证书正文的署名和背锅数字沿用原型红色强调。
  private certificateLine(runs:{text:string;red:boolean}[],y:number):void {let x=(220-runs.reduce((n,r)=>n+this.p.width(r.text,10,'body-700'),0))/2;for(const r of runs){this.p.text(r.text,x,y,10,r.red?'#E8504A':'#3A4660','body-700');x+=this.p.width(r.text,10,'body-700');}}
  // 微信P5可将picture专用节点交给RenderTexture相机导出5:4图片，本卡不调用真实分享API。
  draw(info: Result['shareInfo'], b: Box): number {const p=this.p,c=p.c;p.heading('分享预览','share',b,'share-close');p.center('好友在群里会看到这张卡片',b.x+20,b.y+72,b.w-40,15,'#5E6A84','body-700');let y=b.y+103;const x=b.x+b.w-20-262;c.fillStyle='#EDEDED';c.fillRect(x,y,262,289);c.fillStyle='#FFFFFF';c.fillRect(x+12,y+12,238,265);let title=this.title(info);if(info.nephewReport&&!info.nephewCrushed)title+='\n'+info.nephewReport;if(info.pieReport)title+='\n'+info.pieReport;const all=p.wrap([{text:title,color:'#111111'}],220,14,'body-400'),lines=all.slice(0,2);if(all.length>2){let text=lines[1].map(r=>r.text).join('');while(p.width(text+'…',14,'body-400')>220)text=Array.from(text).slice(0,-1).join('');lines[1]=[{text:text+'…',color:'#111111'}];}p.lines(lines,x+21,y+20,14,'body-400',19.6);this.picture(info,{x:x+21,y:y+65,w:220,h:176});p.text('小游戏 · 这锅你来背',x+21,y+249,11,'#999999','body-400');y+=299;p.button('send','发给好友',{x:b.x+20,y,w:b.w-40,h:58});y+=70;p.button('share-close','取消',{x:b.x+20,y,w:b.w-40,h:32},'link');return y-b.y+52;}
}
