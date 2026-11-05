import {Match} from '../core/match';
import {verdict,battleLines} from '../core/verdict';
import {BUFFS} from '../core/config';
import {ScreenPaint} from './ScreenPaint';
import {Box} from './UiPaint';
export type Result = ReturnType<Match['calculateResult']>;
const INK = '#1F2A44', MUTED = '#5E6A84', ALARM = '#E8504A'; // 颜色按 DESIGN §3：红 = 对你不利，绿 = 对你有利

// DESIGN §7与结算设计图：只读取core结算，所有文字和操作仍为真实节点。
export class ResultView {
  constructor(readonly p: ScreenPaint) {}
  // 返回完整内容高度，沿用AppView的固定Mask和滚动，不按矮屏裁掉操作。
  draw(m: Match, r: Result, b: Box): number {
    const p = this.p, x = b.x + 18, w = b.w - 36;
    this.hero(r, b);
    let y = this.summary(r, {x, y: b.y + 206, w, h: 0});
    const copy = verdict(r, m);
    if (copy.main) y += p.paragraph(copy.main, {x, y: y + 2, w, h: 0}, 16, copy.color, 'body-900') + 6;
    if (copy.sub) y += p.paragraph(copy.sub, {x, y, w, h: 0}, 13, INK, 'body-700') + 6;
    // 真账文案由core纯函数生成，没有数据就不占一行。
    for(const text of battleLines(m))y+=p.paragraph(text,{x,y,w,h:0},13,INK,'body-700')+4;
    // 失败页主操作紧跟判词，先给玩家立即重来的入口，再展示完整榜单与复盘。
    if (!r.stars) {
      this.button('retry', copy.retryLabel, {x, y: y + 9, w, h: 52}, true, false, false); y += 61;
      if (r.diag) {this.button('buff', `带上「${BUFFS[r.diag.buff].name}」重来`, {x, y: y + 9, w, h: 42}, false, true, false); y += 51;}
      y += 8;
    }
    y = this.ranking(m, r, {x, y, w, h: 0}) + 8;
    // 证书和辅助记录不影响星级，周五仍按真实shareOutcome决定证书类型。
    const outcome = m.shareOutcome(r.shareInfo);
    if(r.buzzer){p.text('压哨',x+w-44,y,18,'#2F9E6B','body-900');y+=24;}
    for (const text of [outcome.certificate, outcome.helps.join(' · '), r.nephewReport, r.pieReport, r.epilogue]) {
      if (text) y += p.paragraph(text, {x, y, w, h: 0}, 13, MUTED, 'body-700') + 4;
    }
    if (r.diag) y = this.diagnosis(r, {x, y, w, h: 0});
    // 所有点击action沿用原接口，广告前缀与标题共同量宽，不压字。
    const button = (action: string, label: string, main = false, ad = false, plane = false) => {
      y += 9;
      this.button(action, label, {x, y, w, h: main ? 52 : 42}, main, ad, plane);
      y += main ? 52 : 42;
    };
    button(r.shareInfo.kind === 'blame' ? 'share-blame' : 'share',
      {blame: '这锅甩给微信好友', brag: '晒战绩给好友', cert: '领证书，发朋友圈'}[r.shareInfo.kind]!, false, false, true);
    if (r.ads.revive) button('revive', '甩掉 6 口锅，接着熬', false, true);
    if (r.ads.rescue) button('rescue', '顶锅 -3，刚好够', false, true);
    if (r.stars && r.next) button('next', `下一关：${r.next.name.split('·').pop()!.trim()}`, true);
    if (r.stars) button('retry', copy.retryLabel, !r.next);
    y += 8; p.button('menu', '返回首页', {x, y, w, h: 30}, 'link'); y += 34;
    // 花草随内容滚动，位于所有点击框之后，不挡底部文字链接。
    p.image('ui_result_grass_left', b.x + 6, y, 102, 40);
    p.image('ui_result_grass_right', b.x + b.w - 110, y, 104, 40);
    return y - b.y + 44;
  }

  // 顶部三态共用版式；失败态用暗红彩带白字，不出现庆祝奖杯或放射线。
  private hero(r: Result, b: Box): void {
    const p = this.p, failed = !r.stars, sky = r.crushed ? 'storm' : failed ? 'overcast' : 'clear';
    p.image(`ui_result_sky_${sky}`, b.x + 8, b.y + 8, b.w - 16, 96);
    p.contain('ui_result_' + (r.crushed ? 'crushed' : failed ? 'overtime' : 'trophy'),
      // 顶端留 12px：弹窗遮罩从卡片内沿开始裁，贴着 b.y 画会把奖杯把手/闹钟铃切掉（微信巡检实测）。
      {x: b.x + 28, y: b.y + 12, w: b.w - 56, h: 62});
    // 彩带只拉中段，折带按相同比例保留，奖杯底座轻叠在彩带后。
    const ribbon = p.c.assets.spr['ui_result_' + (failed ? 'ribbon_red' : 'ribbon')];
    if (ribbon) {
      const sx = [0, 110, ribbon.w - 110, ribbon.w], dx = [b.x + 5, b.x + 93, b.x + b.w - 93, b.x + b.w - 5];
      for (let i = 0; i < 3; i++) p.c.drawImage(ribbon, sx[i], 0, sx[i + 1] - sx[i], ribbon.h, dx[i], b.y + 65, dx[i + 1] - dx[i], 64);
    }
    const title = r.crushed ? '被锅压垮了' : failed ? '这次得加班了' : '准点下班！';
    // 标题对准彩带正面（不含下沿阴影）的中线；全角"！"右侧留白大，整行右移 1/4 字宽让字形视觉居中。
    const bang = title.endsWith('！') ? 6 : 0;
    this.fit(title, {x: b.x + 56 + bang, y: b.y + 77, w: b.w - 112, h: 28}, 26, failed ? '#FFFFFF' : INK);
    const y = b.y + 128;
    if (r.crushed) {this.fit('被压垮', {x: b.x + 50, y: y + 7, w: b.w - 100, h: 48}, 40, ALARM); return;}
    const digit = String(r.myRank), fs = 42, dw = p.width(digit, 60, 'body-900'), side = p.width('第', fs, 'body-900'), total = side * 2 + dw + 8, start = b.x + (b.w - total) / 2;
    if (!failed) {
      p.image('ui_result_rays_left', start - 40, y + 6, 24, 40);
      p.image('ui_result_rays_right', start + total + 16, y + 6, 24, 40);
    }
    p.text('第', start, y + 15, fs, failed ? ALARM : INK, 'body-900');
    p.text(digit, start + side + 4, y, 60, '#FFD84D', 'body-900', false, INK);
    p.text('名', start + side + dw + 8, y + 15, fs, failed ? ALARM : INK, 'body-900');
  }

  // 名次说明、三颗实/空星与纪录标签保持同一行，窄屏以真实字宽等比缩字号。
  private summary(r: Result, b: Box): number {
    const p = this.p, text = `/ ${r.rank.length}人 · ${r.title}`, unit = [0, 1, 2].reduce((n, i) => {
      const pic = p.c.assets.spr[i < r.stars ? 'ui_star' : 'ui_star_empty'] || {w: 96, h: 93}; return n + pic.w / pic.h;
    }, 0), total = p.width(text, 16, 'body-700') + unit * 19 + 6 + 8 + (r.isBest ? 54 : 0), scale = Math.min(1, b.w / total);
    const start = b.x + (b.w - total * scale) / 2, sw = p.width(text, 16 * scale, 'body-700');
    p.text(text, start, b.y + 1, 16 * scale, MUTED, 'body-700');
    const starX = start + sw + 8 * scale;
    p.stars(r.stars, starX, b.y, 19 * scale, 3 * scale);
    if (r.isBest) {
      const xx = starX + (unit * 19 + 6 + 6) * scale;
      p.c.fillStyle = ALARM; p.c.fillRect(xx, b.y, 48 * scale, 20 * scale);
      p.center('新纪录', xx, b.y + 3 * scale, 48 * scale, 13 * scale, '#FFFFFF', 'body-900');
    }
    return b.y + 28;
  }

  // 表格行只决定展示，不改变排序/过关线；失败保留前三名及玩家的真实名次。
  private ranking(m: Match, r: Result, b: Box): number {
    const p = this.p, c = p.c, x = b.x + 5, w = b.w - 10;
    let y = b.y + 5;
    const row = (position: string, name: string, detail: string, value: string, me: boolean, cut = false, crushed = false) => {
      if (me) p.sliced('ui_result_frame_gold', {x: x - 5, y: y - 2, w: w + 10, h: 54});
      p.text(position, x + 12, y + 15, 21, INK, 'body-900');
      // 长老板称呼留完整文字，缩小本行字号，不侵入右侧总账列。
      const nameWidth = w - 138, size = Math.min(20, nameWidth / p.width(name, 1, 'body-900'));
      p.text(name, x + 44, y + 4, size, INK, 'body-900');
      p.text(detail, x + 44, y + 29, Math.min(12, nameWidth / p.width(detail, 1, 'body-700')), MUTED, 'body-700');
      if (crushed) this.fit('被压垮', {x: x + w - 76, y: y + 17, w: 70, h: 20}, 15, ALARM);
      else {p.contain('ui_wok', {x: x + w - 88, y: y + 11, w: 34, h: 28}); this.fit(value, {x: x + w - 52, y: y + 15, w: 46, h: 26}, 22, INK);}
      y += 50;
      c.setLineDash(cut ? [5, 4] : []); c.strokeStyle = cut ? ALARM : '#AFA99D'; c.lineWidth = cut ? 2 : 1;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + w, y); c.stroke(); c.setLineDash([]);
    };
    // 外框先画，行高亮再覆盖；框的中心是奶油色，不能最后盖住表格内容。
    const nephew = m.S.agents.find(a => a.key === 'nephew'), extra = nephew && m.L.nephewRanked !== true;
    const visible = r.rank.filter((a, i) => r.stars || i < m.passRank() || a.isPlayer);
    const omitted = !r.stars && r.rank.findIndex(a => a.isPlayer) > m.passRank();
    p.sliced('ui_result_frame_table', {...b, h: (visible.length + (extra ? 1 : 0)) * 50 + (omitted ? 22 : 0) + 10});
    if (extra) row('—', `${m.bossName()}小舅子`, `不参与排名 · ${nephew.crushed ? '被压垮' : '第一个下班'}`, '0', false);
    r.rank.forEach((a, i) => {
      if (!r.stars && i >= m.passRank() && !a.isPlayer) return;
      if (!r.stars && a.isPlayer && i > m.passRank()) {p.center(`… 中间还有 ${i - m.passRank()} 人`, x, y + 3, w, 12, MUTED, 'body-700'); y += 22;}
      row(String(i + 1), a.isPlayer ? '你' : a.key === 'nephew' ? `${m.bossName()}小舅子` : a.name,
        `背锅 ${a.blames} 次 · 甩出 ${a.thrown} 口`, m.fmtDebt(m.debtOf(a)), a.isPlayer,
        i === m.passRank() - 1 && r.rank.length > m.passRank(), a.crushed || a.isPlayer && r.crushed);
    });
    return y + 5;
  }

  // 复盘保留红色重点与推荐道具，全文换行并计入滚动高度。
  private diagnosis(r: Result, b: Box): number {
    const p = this.p, d = r.diag!, buff = BUFFS[d.buff];
    const runs = d.html.split(/(<b>.*?<\/b>)/g).filter(Boolean).map(text => ({text: text.replace(/<\/?b>/g, ''), color: text.startsWith('<b>') ? ALARM : INK}));
    const lines = p.wrap(runs, b.w - 62, 13, 'body-700'), height = Math.max(54, lines.length * 19 + 14);
    p.box({...b, h: height + 58}, '#FFFDF5', 4, false);
    p.contain(d.img, {x: b.x + 8, y: b.y + 8, w: 40, h: 40});
    p.lines(lines, b.x + 54, b.y + 8, 13, 'body-700', 19);
    const y = b.y + height;
    p.contain(buff.img, {x: b.x + 8, y: y + 9, w: 32, h: 32});
    p.text(`推荐：${buff.name}`, b.x + 48, y + 5, 15, INK, 'body-900');
    p.paragraph(buff.desc, {x: b.x + 48, y: y + 27, w: b.w - 56, h: 0}, 11, MUTED, 'body-700');
    return y + 66;
  }

  // 像素九宫格按钮共享原action，只有主操作用黄色；纸飞机为阶段一PNG。
  private button(action: string, label: string, b: Box, main: boolean, ad: boolean, plane: boolean): void {
    const p = this.p, prefix = ad ? '广告 · ' : '', iconWidth = plane ? 27 : 0;
    p.box({...b, x: b.x + 2, y: b.y + 3}, '#0F1628', 4, false);
    p.sliced(main ? 'ui_result_button_gold' : 'ui_result_button_blue', b);
    const max = main ? 22 : 18, units = p.width(label, 1, 'body-900') + p.width(prefix, .8, 'body-900');
    const size = Math.min(max, (b.w - 28 - iconWidth) / units), pw = p.width(prefix, size * .8, 'body-900');
    const x = b.x + (b.w - units * size - iconWidth) / 2, y = b.y + (b.h - size * 1.2) / 2;
    if (plane) p.contain('ui_result_plane', {x, y: b.y + 10, w: 22, h: 22});
    if (prefix) p.text(prefix, x + iconWidth, y + size * .15, size * .8, ALARM, 'body-900');
    p.text(label, x + iconWidth + pw, y, size, INK, 'body-900'); p.hit(action, label, b);
  }

  // 动态文案按可用宽度缩字号；不改标题或总账数值。
  private fit(text: string, b: Box, max: number, color: string): void {
    this.p.center(text, b.x, b.y, b.w, Math.min(max, b.w / this.p.width(text, 1, 'body-900')), color, 'body-900');
  }
}
