import {Match} from '../core/match';
import {BUFFS} from '../core/config';
import {ScreenPaint} from './ScreenPaint';
import {Box} from './UiPaint';
export type Result = ReturnType<Match['calculateResult']>;
// finish的纯显示部分：总账、排名与推荐完全读取core结果，不在画面重算胜负。
export class ResultView {
  constructor(readonly p: ScreenPaint) {}
  // 返回内容高度；外围组织器以Mask实现原型max-height滚动卡片。
  draw(m: Match, r: Result, b: Box): number {
    const p=this.p,c=p.c,x=b.x+20,w=b.w-40;let y=b.y+72;
    p.heading(r.crushed?'被锅压垮了':r.stars?'准点下班！':'这次得加班了','trophy',b);
    // 数字始终70px黄字描边（失败时也是黄数字），星星跟在名次说明同一行。
    if(r.crushed){p.center('被压垮',x,y,w,44,'#E8504A','body-900');y+=58;}
    else {const fs=r.stars?52:44,digit=String(r.myRank),dw=p.width(digit,70,'body-900'),side=p.width('第',fs,'body-900'),total=side*2+dw+8,start=x+(w-total)/2;
      p.text('第',start,y+70-fs,fs,r.stars?'#1F2A44':'#E8504A','body-900');c.font='70px body-900';c.strokeStyle='#1F2A44';c.lineWidth=6;c.strokeText(digit,start+side+4+dw/2,y+42+3);c.fillStyle='#1F2A44';c.fillText(digit,start+side+4+dw/2,y+42+3);c.strokeText(digit,start+side+4+dw/2,y+42);c.fillStyle='#FFD84D';c.fillText(digit,start+side+4+dw/2,y+42);p.text('名',start+side+dw+8,y+70-fs,fs,r.stars?'#1F2A44':'#E8504A','body-900');if(r.stars)p.rays({x:start,y:y+4,w:total,h:70});y+=75;}
    const summary=`/ ${r.rank.length}人 · ${r.title}`,summaryWidth=p.width(summary,18,'body-700'),starWidth=[0,1,2].reduce((n,i)=>{const pic=c.assets.spr[i<r.stars?'ui_star':'ui_star_empty']||{w:96,h:93};return n+20*pic.w/pic.h;},6),recordWidth=r.isBest?55:0,total=summaryWidth+8+starWidth+recordWidth;
    // inline内容超出正文宽时才换行，避免把小字和星星永久拆成两行。
    const wrap=total>w,sx=wrap?x+(w-summaryWidth)/2:x+(w-total)/2;p.text(summary,sx,y,18,'#5E6A84','body-700');const starY=wrap?y+26:y+2,starX=wrap?x+(w-starWidth-recordWidth)/2:sx+summaryWidth+8;p.stars(r.stars,starX,starY);if(r.isBest){const xx=starX+starWidth+6;c.fillStyle='#E8504A';c.fillRect(xx,starY,49,17);p.text('新纪录',xx+5,starY+2,12,'#FFFFFF','body-700');}y+=wrap?53:31;
    y+=p.paragraph('总账 = 炸了的锅 + 身上还背着的锅 × ½',{x,y,w,h:0},13,'#5E6A84','body-700');y+=6;
    const nephew=m.S.agents.find(a=>a.key==='nephew');
    const row=(position:string,name:string,detail:string,value:string,me:boolean,cut=false,crushed=false)=>{const h=r.stars?60:52;c.fillStyle=me?'#FFD84D':'#FFFDF6';c.fillRect(x,y,w,h);c.strokeStyle='#D3DBE8';c.lineWidth=2;c.strokeRect(x,y,w,h);p.text(position,x+12,y+10,19,'#1F2A44','body-700');p.text(name,x+48,y+8,19,'#1F2A44','body-700');p.text(detail,x+48,y+33,12,'#5E6A84','body-400');if(crushed)p.text('被压垮',x+w-62,y+12,14,'#E8504A','body-700');else{p.contain('ui_wok',{x:x+w-88,y:y+16,w:30,h:22});p.center(value,x+w-54,y+14,44,19,'#1F2A44','body-700');}y+=h;if(cut){c.setLineDash([5,4]);c.strokeStyle='#E8504A';c.lineWidth=3;c.beginPath();c.moveTo(x,y);c.lineTo(x+w,y);c.stroke();c.setLineDash([]);}};
    if(nephew&&m.L.nephewRanked!==true)row('—',`${m.bossName()}小舅子`,`不参与排名 · ${nephew.crushed?'被压垮':'第一个下班'}`,'0',false);
    r.rank.forEach((a,i)=>{if(!r.stars&&i>=m.passRank()&&!a.isPlayer)return;if(!r.stars&&a.isPlayer&&i>m.passRank()){p.center(`… 中间还有 ${i-m.passRank()} 人`,x,y+3,w,12,'#5E6A84','body-700');y+=22;}row(String(i+1),a.isPlayer?'你':a.key==='nephew'?`${m.bossName()}小舅子`:a.name,`炸了 ${a.blames} · 身上 ${m.potsOf(a)} 口`,m.fmtDebt(m.debtOf(a)),a.isPlayer,i===m.passRank()-1&&r.rank.length>m.passRank(),a.crushed||a.isPlayer&&r.crushed);});
    y+=6;for(const text of [r.nephewReport,r.pieReport,r.epilogue])if(text){y+=p.paragraph(text,{x,y,w,h:0},13,'#5E6A84');y+=4;}
    if(r.diag){const d=r.diag,buff=BUFFS[d.buff],text=d.html.replace(/<\/?b>/g,'');const hh=Math.max(56,p.wrap([{text,color:'#1F2A44'}],w-66,13.5,'body-700').length*19.575+12);c.fillStyle='#FFFDF6';c.fillRect(x,y,w,hh);c.strokeStyle='#1F2A44';c.lineWidth=3;c.strokeRect(x,y,w,hh+52);p.contain(d.img,{x:x+8,y:y+6,w:44,h:44});const runs=d.html.split(/(<b>.*?<\/b>)/g).filter(Boolean).map(text=>({text:text.replace(/<\/?b>/g,''),color:text.startsWith('<b>')?'#E8504A':'#1F2A44'}));p.lines(p.wrap(runs,w-68,13.5,'body-700'),x+60,y+7,13.5,'body-700',19.575);y+=hh;c.setLineDash([5,4]);c.strokeStyle='#1F2A44';c.lineWidth=2;c.beginPath();c.moveTo(x,y);c.lineTo(x+w,y);c.stroke();c.setLineDash([]);c.fillStyle='#FFF3C2';c.fillRect(x+2,y,w-4,50);p.contain(buff.img,{x:x+8,y:y+10,w:32,h:32});p.text(`推荐：${buff.name}`,x+48,y+7,15,'#1F2A44','body-900');p.text(buff.desc,x+48,y+29,12,'#5E6A84','body-700');y+=58;}
    const button=(action:string,label:string,style:'main'|'ghost'|'ad'|'share'|'link',h=style==='link'?32:style==='main'?68:56)=>{y+=10;p.button(action,label,{x,y,w,h},style,style==='share'?'share':undefined);y+=h;};
    button(r.shareInfo.kind==='blame'?'share-blame':'share',{blame:'这锅甩给微信好友',brag:'晒战绩给好友',cert:'领证书，发朋友圈'}[r.shareInfo.kind]!,'share',44);
    if(r.ads.revive)button('revive','甩掉 6 口锅，接着熬','ad');if(r.ads.rescue)button('rescue','找人顶锅：背锅 -3','ad');
    if(r.stars&&r.next)button('next',`下一关：${r.next.name.split('·').pop()!.trim()}`,'main');if(!r.stars)button('buff',`带上「${BUFFS[r.diag!.buff].name}」重来`,'main');
    button('retry',r.stars?'再来一局':'直接重来',r.stars&&!r.next?'main':'ghost');button('menu','返回首页',r.stars&&!r.next?'ghost':'link');return y-b.y+22;
  }
}
