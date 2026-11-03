import {Match} from '../core/match';
import {Progress} from '../core/types';
import {LEVELS} from '../core/levels';
import {ScreenPaint} from './ScreenPaint';
import {Box} from './UiPaint';
// 原型showIntro的956×1645坐标稿；文字和按钮独立节点，底图不压扁。
export class IntroView {
  scroll = 0; tabScroll = 0; strip: Box | null = null; height = 0;
  constructor(readonly p: ScreenPaint) {}
  // 切关自动滚到当前标签，三等分宽度，首尾不留白。
  select(i: number): void {const w=Math.min(560,this.p.c.width),nav=w*.90167,cw=nav*.326;this.tabScroll=Math.max(0,Math.min(cw*5+nav*.0105*4-nav,i*(cw+nav*.0105)-(nav-cw)/2));this.scroll=0;}
  // 纵向只在矮屏滚动；标签横滑单独处理。
  swipe(dx: number, dy: number, tabs: boolean): void {if(tabs){const w=Math.min(560,this.p.c.width)*.90167;this.tabScroll=Math.max(0,Math.min(w*.326*5+w*.0105*4-w,this.tabScroll-dx));}else this.scroll=Math.max(0,Math.min(Math.max(0,this.height-this.p.c.height),this.scroll-dy));}
  // 介绍页不推进后台生成的普通对局；所有百分比照原型CSS。
  draw(m: Match, prog: Progress): void {
    const p=this.p,c=p.c,w=Math.min(560,c.width),h=w*1645/956,x=(c.width-w)/2,y=(c.height<=650?0:Math.max(0,(c.height-h)/2))-this.scroll;this.height=h;
    c.fillStyle='#145599';c.fillRect(0,0,c.width,c.height);p.image('intro_plate',x,y,w,h);
    const nav={x:x+w*.05021,y:y+h*.05106,w:w*.90167,h:h*.08875};this.strip=nav;c.fillStyle='#FFFDF5';c.fillRect(nav.x,nav.y,nav.w,nav.h);
    c.save();c.beginPath();c.rect(nav.x,nav.y,nav.w,nav.h);c.clip();
    LEVELS.forEach((lv,i)=>{const tw=nav.w*.326,tx=nav.x+i*(tw+nav.w*.0105)-this.tabScroll;if(tx+tw<nav.x||tx>nav.x+nav.w)return;p.image(i===LEVELS.indexOf(m.L)?'intro_tab_gold':'intro_tab_blue',tx,nav.y,tw,nav.h);p.center(`第${lv.id}关`,tx,nav.y+nav.h*.27,tw,w*.0418,'#162B4A');p.center(prog.best[lv.id]?'★'.repeat(prog.best[lv.id].stars):'未通关',tx,nav.y+nav.h*.60,tw,w*.027,'#162B4A','body-700');p.hit(`intro-pick:${i}`,lv.name,{x:Math.max(tx,nav.x),y:nav.y,w:Math.min(tx+tw,nav.x+nav.w)-Math.max(tx,nav.x),h:nav.h});});c.restore();
    p.text(`第${m.L.id}关 · ${1+m.L.bots.length}人`,x+w*.152,y+h*.1635,w*.039,'#FFFFFF','body-900');p.text(m.L.name,x+w*.0605,y+h*.205,w*.07,'#080E32','body-900');p.paragraph(m.bossText(m.L.desc),{x:x+w*.0555,y:y+h*.276,w:w*.63,h:0},w*.0295,'#080E32','body-400',1.55);
    const basic=[`每口锅都有截止时间（${m.potLife()} 秒），甩来甩去不重置；到点在谁身上，谁背锅`,'左下角摇杆控制方向，右下角「甩」把最急的那口锅扔出去','老板面前的红色扇形是视野，在里面甩锅会被抓现行：锅不走，还要背锅'];
    const rows=m.L.news||basic.map(text=>({text,icon:''}));
    rows.slice(0,3).forEach((row,i)=>{const ry=y+h*[.3575,.4465,.5315][i],rw=w*.63;if(row.icon){c.fillStyle='#FDFAF3';c.fillRect(x+w*.076,y+h*[.3561,.4451,.5301][i],w*.17,h*.0728);p.contain(row.icon,{x:x+w*.10,y:ry,w:w*.12,h:h*.064});}const fs=w*.033,lines=p.wrap([{text:m.bossText(row.text).replace('{life}',String(m.potLife())),color:'#080E32'}],rw,fs,'body-900');p.lines(lines,x+w*.293,ry+(h*.07-lines.length*fs*1.48)/2,fs,'body-900',fs*1.48);});
    if(m.L.news){c.fillStyle='#FDFAF3';c.fillRect(x+w*.19,y+h*.341,w*.05,h*.016);c.fillStyle='#EBDBC8';c.fillRect(x+w*.19,y+h*(.341+.016*.56),w*.05,h*.016*.07);}
    if(m.passRank()===2){const b={x:x+w*.28,y:y+h*.63,w:w*.675,h:h*.10};c.fillStyle='#FFFDF5';c.fillRect(b.x,b.y,b.w,b.h);c.strokeStyle='#1F2A44';c.lineWidth=2;c.strokeRect(b.x,b.y,b.w,b.h);p.text('18:00 前两名下班，过关就是三星',b.x+w*.02,b.y+h*.008,w*.029,'#1F2A44','body-900');p.paragraph('小舅子占 1 个名额\n把他压垮，空出 1 个',{x:b.x+w*.02,y:b.y+h*.04,w:b.w-w*.04,h:0},w*.03,'#1F2A44','body-900',1.45);}
    else{p.text('18:00 按总账排名（炸了的锅 + 身上锅 ×½，少的在前）：',x+w*.295,y+h*.6375,w*.0315,'#080E32','body-900');[.2965,.526,.736].forEach((xx,i)=>p.center(String(i+1),x+w*xx,y+h*.6765,w*.067,w*.044,['#A06A0A','#526276','#7C3618'][i]));}
    const best=prog.best[m.L.id];if(best)p.center(`最好成绩 ${'★'.repeat(best.stars)}${best.debt!=null?' · 总账 '+m.fmtDebt(best.debt):best.blames!=null?' · 背锅 '+best.blames+' 次':''}`,x+w*.09,y+h*.732,w*.82,w*.02,'#526276','body-700');
    for(const [action,label,top,height,fs] of [['start','开始上班 ▶',.754,.086,.0725],['lobby','回大厅',.8565,.066,.055]] as const){const b={x:x+w*.066,y:y+h*top,w:w*.87,h:h*height};p.center(label,b.x,b.y+(b.h-w*fs*1.2)/2,b.w,w*fs,'#080E32');p.hit(action,label,b);}
    if(m.L.tutorial&&prog.tutDone){const b={x:x+w*.066,y:y+h*.93,w:w*.87,h:h*.025};p.center('重看教学',b.x,b.y,b.w,w*.025,'#33466B');p.hit('tut','重看教学',b);}
  }
}
