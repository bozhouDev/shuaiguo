/* =========================================================
 * 打工蛇原型 · 公共引擎
 * 三款原型共用：画布、摇杆输入、蛇身轨迹、飘字、浮层、模拟广告
 * ========================================================= */
(function () {
  'use strict';
  const E = {};

  /* ---------------- 小工具 ---------------- */
  // 区间随机数
  E.rand = (a, b) => a + Math.random() * (b - a);
  // 从数组里随机取一个
  E.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  // 两点距离
  E.dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  // 数值夹在 [a, b] 之间
  E.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // 求从角度 a 转到角度 b 的最短差值（-π ~ π）
  E.angDiff = function (a, b) {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  };
  // 洗牌，返回新数组
  E.shuffle = function (arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  E.EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  E.DISPLAY_FONT = '"ZCOOL KuaiLe","PingFang SC","Microsoft YaHei",sans-serif';

  /* ---------------- 画布 ---------------- */
  // 创建铺满屏幕的画布，按设备像素比缩放，保证高清屏不糊
  E.createStage = function () {
    const c = document.getElementById('stage');
    const ctx = c.getContext('2d');
    const st = { c, ctx, w: 0, h: 0, onResize: null };
    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      st.w = window.innerWidth;
      st.h = window.innerHeight;
      c.width = Math.round(st.w * dpr);
      c.height = Math.round(st.h * dpr);
      c.style.width = st.w + 'px';
      c.style.height = st.h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (st.onResize) st.onResize();
    }
    window.addEventListener('resize', resize);
    resize();
    return st;
  };

  /* ---------------- 输入：固定摇杆 + 甩锅键 + 键盘 ---------------- */
  E.STICK_R = 52;          // 摇杆底座半径
  E.STICK_POS = { rx: 0.24, ry: 0.8 }; // 摇杆中心在屏幕上的比例位置（左下）

  // 摇杆中心：按屏幕比例放，但离边缘至少留出底座 + 安全边距
  E.stickCenter = function () {
    const w = window.innerWidth, h = window.innerHeight, m = E.STICK_R + 28;
    return { x: E.clamp(w * E.STICK_POS.rx, m, w / 2), y: E.clamp(h * E.STICK_POS.ry, h / 2, h - m) };
  };

  // 摇杆固定在左下角：手指按在画面任意位置，方向 = 手指相对摇杆中心的方向；是否移动由游戏决定
  // fireBtn：甩锅按钮（DOM 元素），按下时 inp.fire 计数 +1，由游戏每帧消费
  E.createInput = function (el, fireBtn) {
    const inp = { down: false, id: null, x: 0, y: 0, angle: null, mag: 0, keys: {}, fire: 0 }; // mag：摇杆推了多远（0~1）
    // 根据手指位置更新方向和摇杆头位置
    const aim = (e) => {
      const c = E.stickCenter();
      const dx = e.clientX - c.x, dy = e.clientY - c.y, d = Math.hypot(dx, dy);
      if (d > 6) inp.angle = Math.atan2(dy, dx);
      inp.mag = Math.min(1, d / E.STICK_R);
      const k = d > E.STICK_R ? E.STICK_R / d : 1;   // 摇杆头不超出底座
      inp.x = c.x + dx * k; inp.y = c.y + dy * k;
    };
    el.addEventListener('pointerdown', (e) => {
      if (inp.down) return;           // 只认第一根手指当摇杆，另一只手按甩锅键
      inp.down = true; inp.id = e.pointerId;
      aim(e);
      try { el.setPointerCapture(e.pointerId); } catch (_) { /* 部分环境不支持，忽略 */ }
    });
    el.addEventListener('pointermove', (e) => { if (inp.down && e.pointerId === inp.id) aim(e); });
    const up = (e) => { if (e.pointerId === inp.id) { inp.down = false; inp.id = null; } };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    // 甩锅键：用 pointerdown 而不是 click，减少延迟，并且不影响另一根手指的摇杆
    if (fireBtn) {
      fireBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); inp.fire++; });
      fireBtn.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    window.addEventListener('keydown', (e) => {
      // 编辑大厅称呼时，让输入框正常处理空格、方向键和输入法。
      if (e.target instanceof Element && e.target.matches('input, textarea, [contenteditable]')) return;
      const k = e.key.toLowerCase();
      // 空格 / J 甩锅（按住不连发）
      if ((k === ' ' || k === 'j') && !e.repeat) inp.fire++;
      inp.keys[k] = true;
      if (e.key === ' ' || e.key.startsWith('Arrow')) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { inp.keys[e.key.toLowerCase()] = false; });
    return inp;
  };

  // 读取键盘方向键/WASD，有按键时覆盖摇杆方向（方便电脑上试玩）；返回是否按着方向键
  E.pollKeys = function (inp) {
    const k = inp.keys;
    let x = 0, y = 0;
    if (k['arrowleft'] || k['a']) x -= 1;
    if (k['arrowright'] || k['d']) x += 1;
    if (k['arrowup'] || k['w']) y -= 1;
    if (k['arrowdown'] || k['s']) y += 1;
    if (x || y) inp.angle = Math.atan2(y, x);
    return !!(x || y);
  };

  // 绘制固定摇杆：没按时淡淡显示位置，按住时摇杆头跟着手指
  E.drawStick = function (ctx, inp) {
    const c = E.stickCenter();
    ctx.save();
    ctx.globalAlpha = inp.down ? 0.32 : 0.16;
    ctx.fillStyle = '#1F2A44';
    ctx.beginPath(); ctx.arc(c.x, c.y, E.STICK_R, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = inp.down ? 0.75 : 0.35;
    ctx.fillStyle = '#FFFDF5';
    ctx.beginPath(); ctx.arc(inp.down ? inp.x : c.x, inp.down ? inp.y : c.y, 22, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  /* ---------------- 蛇：连续移动 + 轨迹跟随 ---------------- */
  E.Snake = class {
    // x,y 初始位置；o.speed 速度(px/s)；o.turn 转向速度(rad/s)；o.spacing 每节间距
    constructor(x, y, o) {
      this.x = x; this.y = y;
      this.angle = -Math.PI / 2;
      this.speed = o.speed;
      this.turn = o.turn || 5;
      this.spacing = o.spacing || 20;
      this.segs = [];            // 每节身体的数据，由各游戏自行定义
      this.trail = [{ x, y }];   // 蛇头走过的轨迹点（新的在前）
    }
    // 每帧：朝目标角度转向 → 前进 → 记录轨迹
    update(dt, target) {
      if (target != null) {
        const d = E.angDiff(this.angle, target);
        const m = this.turn * dt;
        this.angle += E.clamp(d, -m, m);
      }
      this.x += Math.cos(this.angle) * this.speed * dt;
      this.y += Math.sin(this.angle) * this.speed * dt;
      this.record();
    }
    // 记录轨迹点（每隔约 3px 记一次），并裁掉用不到的旧轨迹
    record() {
      const last = this.trail[0];
      if (E.dist(this.x, this.y, last.x, last.y) >= 3) this.trail.unshift({ x: this.x, y: this.y });
      const keep = Math.ceil(((this.segs.length + 2) * this.spacing) / 3 * 1.6) + 30;
      if (this.trail.length > keep) this.trail.length = keep;
    }
    // 沿轨迹往回量距离，算出每节身体的位置
    positions() {
      const out = [];
      const tr = this.trail;
      let px = this.x, py = this.y, acc = 0, i = 0;
      while (out.length < this.segs.length) {
        if (i >= tr.length) { out.push({ x: px, y: py }); continue; } // 轨迹不够长：叠在末端
        const q = tr[i];
        const d = E.dist(px, py, q.x, q.y);
        if (acc + d >= this.spacing) {
          const r = (this.spacing - acc) / d;
          px += (q.x - px) * r;
          py += (q.y - py) * r;
          out.push({ x: px, y: py });
          acc = 0;
        } else {
          acc += d; px = q.x; py = q.y; i++;
        }
      }
      return out;
    }
    // 撞到矩形边界时反弹，返回是否撞墙
    bounce(x0, y0, x1, y1) {
      let hit = false;
      if (this.x < x0) { this.x = x0; this.angle = Math.PI - this.angle; hit = true; }
      if (this.x > x1) { this.x = x1; this.angle = Math.PI - this.angle; hit = true; }
      if (this.y < y0) { this.y = y0; this.angle = -this.angle; hit = true; }
      if (this.y > y1) { this.y = y1; this.angle = -this.angle; hit = true; }
      return hit;
    }
  };

  /* ---------------- 绘制辅助 ---------------- */
  // 画 emoji（占位素材）
  E.emoji = function (ctx, ch, x, y, size) {
    ctx.font = `${size}px ${E.EMOJI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ch, x, y + size * 0.06);
  };
  // 画带白色描边的标题字
  E.label = function (ctx, s, x, y, size, fill, stroke) {
    ctx.font = `${size}px ${E.DISPLAY_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, size / 5);
    ctx.strokeStyle = stroke || '#FFFDF5';
    ctx.strokeText(s, x, y);
    ctx.fillStyle = fill || '#1F2A44';
    ctx.fillText(s, x, y);
  };
  // 圆角矩形路径
  E.rr = function (ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };
  // 目标在屏幕外时，在屏幕边缘画方向提示
  // icon：{ sprite } 画该素材裁出的像素头像，或字符串画 emoji；color 圆圈和箭头颜色；badge 右上角小徽标素材（可选）
  E.edgeHint = function (ctx, st, sx, sy, icon, color, badge) {
    const m = 36, top = 70, R = 21;
    if (sx > 0 && sx < st.w && sy > top && sy < st.h) return;
    const cx = st.w / 2, cy = (st.h + top) / 2;
    const a = Math.atan2(sy - cy, sx - cx);
    const hx = st.w / 2 - m, hy = (st.h - top) / 2 - m;
    const t = Math.min(hx / Math.max(1e-6, Math.abs(Math.cos(a))), hy / Math.max(1e-6, Math.abs(Math.sin(a))));
    const x = cx + Math.cos(a) * t, y = cy + Math.sin(a) * t;
    ctx.save();
    ctx.fillStyle = color;
    ctx.translate(x, y);
    // 指向箭头 + 状态色圆圈
    ctx.save();
    ctx.rotate(a);
    ctx.beginPath(); ctx.moveTo(R + 11, 0); ctx.lineTo(R - 2, -9); ctx.lineTo(R - 2, 9); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
    const head = typeof icon === 'string' ? null : E.headCrop(icon.sprite);
    if (head) {
      // 像素头像：浅色底 + 圆形裁切，不做平滑保留像素感
      ctx.fillStyle = '#FFF8E7';
      ctx.beginPath(); ctx.arc(0, 0, R - 3, 0, Math.PI * 2); ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.imageSmoothingEnabled = false;
      const d = (R - 3) * 2.15;            // 头像略大于圆，裁掉边角留白
      ctx.drawImage(head.canvas, head.sx, head.sy, head.size, head.size, -d / 2, -d / 2 + 2, d, d);
      ctx.restore();
    }
    ctx.restore();
    if (!head) E.emoji(ctx, typeof icon === 'string' ? icon : '❓', x, y, 18);
    // 右上角小徽标（如冲你来时的怒气）
    if (badge) E.drawSprite(ctx, badge, x + R * 0.75, y - R * 0.75, 20);
  };

  // 从全身像素图裁出头像区域（缓存）：取上部较窄的一段算头的水平中心，裁一个正方形
  const headCache = {};
  E.headCrop = function (name) {
    if (headCache[name] !== undefined) return headCache[name];
    const s = E.spr[name];
    if (!s) return null;                    // 素材还没加载好，下次再算
    const c = s.canvas, W = c.width, H = c.height;
    let sumX = 0, n = 0;
    try {
      const data = c.getContext('2d').getImageData(0, 0, W, Math.round(H * 0.3)).data;
      for (let i = 3; i < data.length; i += 4) if (data[i] > 128) { sumX += ((i - 3) / 4) % W; n++; }
    } catch (e) { /* 读不到像素（跨域等）就用图片中心 */ }
    const size = Math.min(W, Math.round(H * 0.46));   // 头大约占全身上部 45%
    const hx = n ? sumX / n : W / 2;
    const sx = Math.max(0, Math.min(W - size, Math.round(hx - size / 2)));
    headCache[name] = { canvas: c, sx, sy: 0, size };
    return headCache[name];
  };

  /* ---------------- 飘字特效 ---------------- */
  E.Floats = class {
    constructor() { this.list = []; }
    // 新增一条飘字
    add(text, x, y, color) { this.list.push({ text, x, y, color: color || '#1F2A44', life: 1.1 }); }
    // 推进：上浮并淡出
    update(dt) {
      for (const f of this.list) { f.life -= dt; f.y -= 38 * dt; }
      this.list = this.list.filter((f) => f.life > 0);
    }
    // 绘制，camX/camY 为相机偏移
    draw(ctx, camX, camY) {
      for (const f of this.list) {
        ctx.globalAlpha = Math.min(1, f.life * 2);
        E.label(ctx, f.text, f.x - camX, f.y - camY, 17, f.color);
      }
      ctx.globalAlpha = 1;
    }
  };

  /* ---------------- 表现反馈：2px 像素贴纸 ---------------- */
  const C = {
    K: '#1F2A44', // 墨水蓝描边
    E: '#0F1628', // 最深的边
    W: '#FFF8E6', // 奶油白
    w: '#C9D5E8', // 手掌暗部（浅蓝灰）
    Y: '#FFD84D', // 便利贴黄
    y: '#F0C000', // 深黄
    O: '#FD6D2C', // 亮橙
    G: '#2F9E6B', // 绿
    g: '#7ED6A2', // 亮绿
    S: '#3A3A44', // 锅身
    s: '#5A5A66', // 锅内
    R: '#E8504A', // 红
  };

  // 四角星（闪烁装饰）
  const SPARK = [
    '....K....',
    '...KYK...',
    '...KYK...',
    '.KKYWYKK.',
    'KYYWWWYYK',
    '.KKYWYKK.',
    '...KYK...',
    '...KYK...',
    '....K....',
  ];

  // 三种反馈：文案、图标、优先级、停留时长、副标题两侧短线的颜色
  const KINDS = {
    calm:   { title: '稳住了！', sub: '零背锅',   icon: 'thumb',  pri: 1, hold: 900,  dash: '#8FA3D1' },
    parry:  { title: '漂亮！',   sub: '反弹成功', icon: 'bounce', pri: 2, hold: 900,  dash: '#7ED6A2' },
    rankup: { title: '好样的！', sub: '冲进前三', icon: 'rankup', pri: 3, hold: 1200, dash: '#FFD84D' },
  };

  const FONT = '"Noto Sans SC", "PingFang SC", "Hiragino Sans GB", sans-serif';
  const layer = document.getElementById('praise');
  let current = null; // 当前贴纸，退出动画期间仍参与优先级判断

  /* ---------------- 工具：掩码与膨胀 ---------------- */
  // 在 w×h 的格子上，把掩码 m 往外扩 r 格（方形邻域），返回新掩码
  function dilate(m, w, h, r) {
    const out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!m[y * w + x]) continue;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        // 去掉四个角，轮廓更圆润一点（像素贴纸的阶梯角）
        if (r > 1 && Math.abs(dx) === r && Math.abs(dy) === r) continue;
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < w && ny < h) out[ny * w + nx] = 1;
      }
    }
    return out;
  }
  // 小画布：按两倍像素绘制装饰星星。
  function pixelCanvas(map, block) {
    const w = Math.max(...map.map((r) => r.length)), h = map.length;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    map.forEach((row, y) => [...row].forEach((ch, x) => { if (C[ch]) { ctx.fillStyle = C[ch]; ctx.fillRect(x, y, 1, 1); } }));
    cv.style.width = w * block + 'px'; cv.style.height = h * block + 'px';
    return cv;
  }

  /* ---------------- 方案一：像素贴纸 ---------------- */
  // 把「图标 + 像素化标题 + 副标题底板」合成在一张低分辨率画布上，
  // 再对整体轮廓做两次膨胀，得到墨水蓝内描边 → 奶油白贴纸边 → 最外细边。
  const stickerCache = new Map();
  function buildSticker(kind, block) {
    const key = kind + block;
    if (stickerCache.has(key)) return stickerCache.get(key);
    const k = KINDS[kind];
    // 标题字高（格）：字先在 G px 下画，再按格放大，得到像素字。粗像素格子大但笔画糊，细像素更好认
    // 字数少的标题（漂亮！）字号放大，让三种标题宽度接近，复杂字也更好认
    const tmp = document.createElement('canvas').getContext('2d');
    tmp.font = `900 100px ${FONT}`;
    const per100 = tmp.measureText(k.title).width / 100;
    const G = Math.min(32, Math.floor(108 / per100));
    const sprite = E.spr['ui_praise_' + k.icon];
    const iw = 42, ih = 42;
    const PAD = 5;           // 留给描边的格数

    // 1) 量字宽（格）
    tmp.font = `900 ${G}px ${FONT}`;
    const tw = Math.ceil(tmp.measureText(k.title).width);
    // 副标题按真实分辨率量，换算成格
    tmp.font = `900 18px ${FONT}`;
    const subW = Math.ceil((tmp.measureText(k.sub).width + k.sub.length * 2) / block);

    // 2) 版面（单位：格）
    const titleX = PAD + iw - 1, titleY = PAD;             // 图标贴着标题，像参考图
    const plateH = Math.ceil(30 / block);                   // 底板约 30px 高
    const plateW = Math.max(subW + Math.ceil(80 / block), Math.round(tw * 0.72)); // 两侧留给短线，至少占标题宽的七成
    const W = Math.max(titleX + tw, PAD + iw + 4 + plateW) + PAD + 1;
    const plateX = Math.round(titleX + tw / 2 - plateW / 2);
    const plateY = titleY + G - 1;
    // 图标竖直居中于「标题 + 底板」，太高时往下撑开画布，保证描边不被裁掉
    const iconX = PAD, iconY = Math.max(PAD - 1, Math.round(titleY + (G + plateH) / 2 - ih / 2) - 1);
    const H = Math.max(plateY + plateH, iconY + ih) + PAD + 1;

    // 3) 标题像素化：白字画进透明画布，按透明度阈值取掩码
    const tcv = document.createElement('canvas'); tcv.width = W; tcv.height = H;
    const tctx = tcv.getContext('2d');
    tctx.font = `900 ${G}px ${FONT}`; tctx.textBaseline = 'top'; tctx.fillStyle = '#fff';
    tctx.fillText(k.title, titleX, titleY + 1);
    const td = tctx.getImageData(0, 0, W, H).data;
    const tm = new Uint8Array(W * H);
    let top = H, bot = 0;
    for (let i = 0; i < W * H; i++) if (td[i * 4 + 3] > 120) { tm[i] = 1; const y = (i / W) | 0; top = Math.min(top, y); bot = Math.max(bot, y); }

    // 4) 合成
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const union = new Uint8Array(W * H);
    // 底板：深蓝底 + 顶部亮边 + 底部暗边，四角缺一格
    for (let y = plateY; y < plateY + plateH; y++) for (let x = plateX; x < plateX + plateW; x++) {
      const corner = (y === plateY || y === plateY + plateH - 1) && (x === plateX || x === plateX + plateW - 1);
      if (corner) continue;
      union[y * W + x] = 1;
      ctx.fillStyle = y === plateY ? '#3D63B0' : y === plateY + plateH - 1 ? '#1E2C52' : '#2A3B66';
      ctx.fillRect(x, y, 1, 1);
    }
    // 底板两侧短线
    // 底板两侧短线：贴着副标题两边，像参考图「— 零背锅 —」
    const dashY = plateY + Math.floor(plateH / 2), dashLen = Math.ceil(14 / block);
    const cx = plateX + plateW / 2, half = Math.ceil(subW / 2) + Math.ceil(8 / block);
    ctx.fillStyle = k.dash;
    ctx.fillRect(Math.round(cx - half - dashLen), dashY, dashLen, Math.max(1, Math.round(3 / block)));
    ctx.fillRect(Math.round(cx + half), dashY, dashLen, Math.max(1, Math.round(3 / block)));

    // 标题：内描边（墨水蓝 1 格，压在底板上）
    const tRing = dilate(tm, W, H, 1);
    for (let i = 0; i < W * H; i++) if (tRing[i] && !tm[i]) { union[i] = 1; ctx.fillStyle = C.K; ctx.fillRect(i % W, (i / W) | 0, 1, 1); }
    // 标题填色：顶边高光、上半亮黄、下半深黄、底边橙（硬切，不做渐变）
    const mid = top + (bot - top) * 0.52;
    for (let i = 0; i < W * H; i++) {
      if (!tm[i]) continue;
      const x = i % W, y = (i / W) | 0;
      union[i] = 1;
      const upEmpty = y === 0 || !tm[i - W], dnEmpty = y === H - 1 || !tm[i + W];
      ctx.fillStyle = upEmpty ? '#FFF3B0' : dnEmpty ? '#F09A00' : y < mid ? '#FFDC3A' : '#FFC21A';
      ctx.fillRect(x, y, 1, 1);
    }
    // 图标压在最上面
    // 正式图先缩成 21×21 真像素，再放大两倍到低分辨率画布，关闭平滑。
    if (sprite) {
      const tiny = document.createElement('canvas'); tiny.width = tiny.height = 21;
      const tc = tiny.getContext('2d'); tc.imageSmoothingEnabled = false;
      const ratio = Math.min(21 / sprite.w, 21 / sprite.h);
      const sw = Math.round(sprite.w * ratio), sh = Math.round(sprite.h * ratio);
      tc.drawImage(sprite.canvas, Math.floor((21 - sw) / 2), Math.floor((21 - sh) / 2), sw, sh);
      const pixels = tc.getImageData(0, 0, 21, 21);
      for (let i = 3; i < pixels.data.length; i += 4) pixels.data[i] = pixels.data[i] > 120 ? 255 : 0;
      tc.putImageData(pixels, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(tiny, iconX, iconY, iw, ih);
      for (let y = 0; y < ih; y++) for (let x = 0; x < iw; x++) {
        if (pixels.data[(Math.floor(y / 2) * 21 + Math.floor(x / 2)) * 4 + 3]) union[(iconY + y) * W + iconX + x] = 1;
      }
    }

    // 5) 整体贴纸边：奶油白 2 格 + 墨水蓝 1 格，画在最底层
    const ring2 = dilate(union, W, H, 2), ring3 = dilate(ring2, W, H, 1);
    ctx.globalCompositeOperation = 'destination-over';
    for (let i = 0; i < W * H; i++) if (ring2[i] && !union[i]) { ctx.fillStyle = C.W; ctx.fillRect(i % W, (i / W) | 0, 1, 1); }
    for (let i = 0; i < W * H; i++) if (ring3[i] && !ring2[i]) { ctx.fillStyle = C.E; ctx.fillRect(i % W, (i / W) | 0, 1, 1); }
    ctx.globalCompositeOperation = 'source-over';

    const out = {
      url: cv.toDataURL(), w: W * block, h: H * block,
      subX: (plateX + plateW / 2) * block, subY: (plateY + plateH / 2) * block + 1,
      // 装饰星星的位置（相对整块，单位 px）
      sparks: [
        { x: iconX * block - 6, y: (iconY - 2) * block, s: 1 },
        { x: (iconX - 3) * block, y: (iconY + ih * 0.7) * block, s: 0.6 },
        { x: (titleX + tw + 2) * block, y: (plateY + 2) * block, s: 0.9 },
        { x: (titleX + tw - 4) * block, y: (titleY - 2) * block, s: 0.6 },
      ],
    };
    stickerCache.set(key, out);
    return out;
  }

  // 方案一的 DOM：一张贴纸图 + 副标题文字 + 四颗闪烁星
  function renderPixel(kind) {
    const k = KINDS[kind], b = 2, st = buildSticker(kind, b);
    const inner = document.createElement('div');
    inner.className = 'praise-inner';
    inner.style.width = st.w + 'px'; inner.style.height = st.h + 'px';
    const img = new Image(); img.src = st.url; img.className = 'sticker';
    img.style.cssText = `width:${st.w}px;height:${st.h}px;image-rendering:pixelated;display:block`;
    inner.appendChild(img);
    const sub = document.createElement('div');
    sub.className = 'praise-sub'; sub.textContent = k.sub;
    sub.style.left = st.subX + 'px'; sub.style.top = st.subY + 'px';
    sub.style.fontSize = '18px';
    inner.appendChild(sub);
    st.sparks.forEach((p, i) => {
      const cv = pixelCanvas(SPARK, Math.max(1, Math.round(b * p.s)));
      const s = new Image(); s.src = cv.toDataURL(); s.style.width = cv.style.width; s.style.height = cv.style.height;
      s.className = 'praise-spark';
      s.style.left = p.x + 'px'; s.style.top = p.y + 'px';
      s.style.animationDelay = (i * 120) + 'ms';
      inner.appendChild(s);
    });
    return inner;
  }


  // 所有时长都用真实毫秒；退出动画期间仍保留优先级，防止低级贴纸抢入。
  const PRAISE_TIME = { pop: 220, nodDelay: 260, nod: 260, out: 360, interrupt: 120, reduce: 160 };
  const praiseItems = new Set(), praiseTemplates = new Map();
  let praiseReady = null;
  // 字体与精灵就绪后一次预合成三种贴纸，并提前解码图片。
  E.preparePraise = function () {
    if (!praiseReady) praiseReady = document.fonts.load(`900 32px ${FONT}`, '稳住了！漂亮！好样的！零背锅反弹成功冲进前三').then(async () => {
      for (const kind of Object.keys(KINDS)) {
        if (!E.spr['ui_praise_' + KINDS[kind].icon]) throw new Error('缺少贴纸图标：' + kind);
        const template = renderPixel(kind);
        await Promise.all([...template.querySelectorAll('img')].map(img => img.decode()));
        praiseTemplates.set(kind, template);
      }
    }).catch(error => { console.warn('表现贴纸预热失败', error); });
    return praiseReady;
  };
  // 撤销动画和定时器，包括已被顶掉但还在淡出的贴纸。
  function removePraise(item) {
    clearTimeout(item.timer);
    item.el.getAnimations({ subtree: true }).forEach(animation => animation.cancel());
    item.el.remove(); praiseItems.delete(item);
    if (current === item) current = null;
  }
  E.clearPraise = function () { [...praiseItems].forEach(removePraise); };
  // 上浮收起；打断时从当前姿态淡出，不突然跳回完整大小。
  function dismissPraise(item, interrupted) {
    clearTimeout(item.timer);
    const inner = item.el.firstChild, style = getComputedStyle(inner);
    const from = { opacity: style.opacity, transform: style.transform };
    inner.getAnimations().forEach(animation => animation.cancel());
    const duration = item.reduce ? PRAISE_TIME.reduce : interrupted ? PRAISE_TIME.interrupt : PRAISE_TIME.out;
    const out = inner.animate([from, { opacity: 0, transform: item.reduce ? 'none' : `translateY(${interrupted ? -10 : -28}px)` }],
      { duration, easing: 'cubic-bezier(.5,0,.9,.6)', fill: 'forwards' });
    out.onfinish = () => removePraise(item);
  }
  // 固定弹出时的位置；给出入场放大、轻跳、退场上浮及四角星预留空间。
  function praisePosition(sticker, avoidY) {
    const scale = Math.min(1, (innerWidth - 24) / ((sticker.w + 18) * 1.06));
    const half = (sticker.h + 20) * scale * 1.06 / 2;
    let y = innerHeight * (avoidY >= innerHeight * .16 && avoidY <= innerHeight * .46 ? .62 : .30);
    const occupied = [...document.querySelectorAll('#closingNotice, #msg, #hint')].filter(el => {
      const style = getComputedStyle(el);
      return !el.hidden && style.display !== 'none' && style.visibility !== 'hidden' && +style.opacity > 0;
    }).map(el => el.getBoundingClientRect());
    // 主角也算占位：头顶到脚下大约 avoidY-50 ~ avoidY+40，备选位置同样不能盖住他
    if (avoidY != null && isFinite(avoidY)) occupied.push({ top: avoidY - 50, bottom: avoidY + 40 });
    const safe = candidate => candidate - half - 28 >= 12 && candidate + half <= innerHeight - 12 &&
      occupied.every(rect => candidate + half < rect.top - 8 || candidate - half - 28 > rect.bottom + 8);
    if (!safe(y)) {
      const candidates = [innerHeight * .62, innerHeight * .30, ...occupied.flatMap(r => [r.bottom + half + 37, r.top - half - 9])];
      y = candidates.filter(safe).sort((a, b) => Math.abs(a - y) - Math.abs(b - y))[0];
    }
    return y == null ? null : { y, scale };
  }
  // 后到的群消息或教学横幅优先保留；发生遮挡时移除贴纸，不在播放途中改位置。
  E.checkPraiseOcclusion = function () {
    if (!current) return;
    const r = current.el.getBoundingClientRect();
    for (const banner of document.querySelectorAll('#closingNotice, #msg, #hint')) {
      const style = getComputedStyle(banner);
      if (banner.hidden || style.display === 'none' || style.visibility === 'hidden' || +style.opacity <= 0) continue;
      const b = banner.getBoundingClientRect();
      if (r.left < b.right && r.right > b.left && r.top - 28 < b.bottom + 8 && r.bottom > b.top - 8) {
        E.clearPraise(); return;
      }
    }
  };
  // 不排队：只有更高级能打断；没有足够空间时安静跳过。
  E.praise = function (kind, opts = {}) {
    const k = KINDS[kind], template = praiseTemplates.get(kind);
    if (!k || !template || (current && k.pri <= KINDS[current.kind].pri)) return false;
    const pos = praisePosition(buildSticker(kind, 2), opts.avoidY);
    if (!pos) return false;
    if (current) dismissPraise(current, true);
    const el = document.createElement('div'); el.className = 'praise-item'; el.dataset.kind = kind;
    el.style.top = pos.y + 'px'; el.style.transform = `translate(-50%, -50%) scale(${pos.scale})`;
    const inner = template.cloneNode(true); el.append(inner); layer.append(el);
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const item = { kind, el, reduce }; current = item; praiseItems.add(item);
    const popDuration = reduce ? PRAISE_TIME.reduce : PRAISE_TIME.pop;
    inner.animate(reduce ? [{ opacity: 0 }, { opacity: 1 }] : [
      { opacity: 0, transform: 'translateY(6px) scale(.72)' },
      { opacity: 1, transform: 'translateY(0) scale(1.06)', offset: .6 },
      { opacity: 1, transform: 'translateY(0) scale(1)' }
    ], { duration: popDuration, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' });
    if (!reduce) inner.animate([
      { transform: 'translateY(0)' }, { transform: 'translateY(-3px)', offset: .3 }, { transform: 'translateY(0)' }
    ], { duration: PRAISE_TIME.nod, delay: popDuration + PRAISE_TIME.nodDelay, composite: 'add' });
    item.timer = setTimeout(() => dismissPraise(item, false), popDuration + k.hold);
    if (kind === 'rankup') { E.sfx('rankup'); E.buzz(30); }
    return true;
  };

  /* ---------------- 界面浮层 ---------------- */
  // 显示一个卡片浮层；handlers 按 data-act 绑定按钮回调
  E.showPanel = function (html, handlers) {
    E.clearPraise();
    const ui = document.getElementById('ui');
    ui.innerHTML = `<div class="card">${html}</div>`;
    ui.hidden = false;
    ui.onclick = (e) => {
      const b = e.target.closest('[data-act]');
      if (b && handlers && handlers[b.dataset.act]) handlers[b.dataset.act](b);
    };
  };
  // 关闭浮层
  E.hidePanel = function () {
    const ui = document.getElementById('ui');
    ui.hidden = true;
    ui.innerHTML = '';
  };
  // 底部轻提示
  let toastTimer = 0;
  E.toast = function (msg, ms) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('on'), ms || 1600);
  };
  // 模拟激励视频广告：正式版替换为 wx.createRewardedVideoAd，看完才发奖励
  E.fakeAd = function (cb) {
    let ad = document.getElementById('ad');
    if (!ad) { ad = document.createElement('div'); ad.id = 'ad'; document.body.appendChild(ad); }
    ad.hidden = false;
    let n = 3;
    const tick = () => {
      if (n <= 0) { ad.hidden = true; cb(); return; }
      ad.innerHTML = `<div><p>激励视频广告位</p><b>${n}</b><small>正式版在这里播放 15～30 秒广告，看完才发奖励</small></div>`;
      n--;
      setTimeout(tick, 650);
    };
    tick();
  };
  // 原型里的分享按钮：提示正式版会生成分享卡片
  E.fakeShare = function () { E.toast('正式版：生成战绩卡片，分享到群/朋友圈', 2000); };

  /* ---------------- 主循环 ---------------- */
  // 每帧调用 fn(dt, 秒级时间)，dt 上限 33ms，防止切后台回来时跳帧
  E.loop = function (fn) {
    let last = performance.now();
    const f = (now) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      fn(dt, now / 1000);
      requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  };

  // 设置 HUD 文本（内容不变时不触碰 DOM）
  const hudCache = {};
  E.setText = function (id, text) {
    if (hudCache[id] === text) return;
    hudCache[id] = text;
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  /* ---------------- SVG 精灵 ---------------- */
  // 已加载的精灵：name -> { canvas, w, h }（w/h 为 SVG 原始尺寸）
  E.spr = {};
  const SPR_SCALE = 3; // 预渲染倍率：SVG 先画到离屏画布，避免每帧光栅化 SVG

  // 批量加载素材并缓存到离屏画布。ext 为 'svg'（默认，按 3 倍预渲染）或 'png'（像素图，原尺寸缓存）
  E.loadSprites = function (names, base, ext) {
    const type = ext || 'svg';
    const scale = type === 'svg' ? SPR_SCALE : 1;
    return Promise.all(names.map((name) => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth || 128, h = img.naturalHeight || 128;
        const c = document.createElement('canvas');
        c.width = w * scale; c.height = h * scale;
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        E.spr[name] = { canvas: c, w, h };
        resolve();
      };
      img.onerror = () => { console.warn('素材加载失败：', name); resolve(); };
      img.src = `${base || 'assets/'}${name}.${type}`;
    })));
  };

  // 加载图集（window.ATLAS，由 assets_pixel/pack_atlas.py 生成）：每张图集下载一次，再切成单张缓存到 E.spr
  // 网页上请求数从一百多个降到十来个；某张图集加载失败时，里面的图之后会按单张文件补加载
  E.loadAtlas = function (atlas, base) {
    const sheets = (atlas && atlas.sheets) || [];
    return Promise.all(sheets.map((sh) => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        for (const name in sh.frames) {
          const [x, y, w, h] = sh.frames[name];
          const c = document.createElement('canvas');
          c.width = w; c.height = h;
          c.getContext('2d').drawImage(img, x, y, w, h, 0, 0, w, h);
          E.spr[name] = { canvas: c, w, h };
        }
        resolve();
      };
      img.onerror = () => { console.warn('图集加载失败：', sh.file); resolve(); };
      img.src = `${base}${sh.file}`;
    })));
  };

  // 界面里 <img> 用的像素图地址：已从图集切好的直接转成 data URL（不再发请求），否则退回单张文件
  const urlCache = {};
  E.pxUrl = function (name) {
    if (urlCache[name]) return urlCache[name];
    const s = E.spr[name];
    if (!s) return `assets/px/${name}.png`;
    urlCache[name] = s.canvas.toDataURL('image/png');
    return urlCache[name];
  };

  // 把页面里写死的 <img data-px="名字"> 换成图集里的图（HUD 图标等静态元素用）
  E.fillPxImages = function (root) {
    for (const img of (root || document).querySelectorAll('img[data-px]')) img.src = E.pxUrl(img.dataset.px);
  };

  // 以 (cx, cy) 为中心画精灵，宽度 w，高度按比例；可选旋转、翻转、透明度
  // opt.h：改为按高度 h 定尺寸（全身角色用，宽度按比例），此时 w 参数被忽略
  E.drawSprite = function (ctx, name, cx, cy, w, opt) {
    const s = E.spr[name];
    if (!s) return;
    const o = opt || {};
    if (o.h) w = (o.h * s.w) / s.h;
    const h = (w * s.h) / s.w;
    ctx.save();
    if (o.alpha != null) ctx.globalAlpha = o.alpha;
    ctx.imageSmoothingQuality = 'high';
    ctx.translate(cx, cy);
    if (o.rot) ctx.rotate(o.rot);
    if (o.flip) ctx.scale(-1, 1);
    if (o.sy) ctx.scale(1, o.sy);
    ctx.drawImage(s.canvas, -w / 2, -h / 2, w, h);
    ctx.restore();
  };

  // 画站在地上的角色：脚底落在 (x, footY)，高度 h；返回画出的宽高，方便摆名字和徽标
  E.drawStanding = function (ctx, name, x, footY, h, opt) {
    const s = E.spr[name];
    if (!s) return { w: 0, h: 0 };
    const w = (h * s.w) / s.h;
    E.drawSprite(ctx, name, x, footY - h / 2, w, opt);
    return { w, h };
  };

  /* ---------------- 碰撞：圆 vs 矩形 ---------------- */
  // 把圆形物体 o（有 x,y）推出矩形 rect，返回是否发生碰撞
  E.pushOut = function (o, r, rect) {
    const nx = E.clamp(o.x, rect.x, rect.x + rect.w);
    const ny = E.clamp(o.y, rect.y, rect.y + rect.h);
    const dx = o.x - nx, dy = o.y - ny;
    const d = Math.hypot(dx, dy);
    if (d >= r) return false;
    if (d < 0.001) {
      // 圆心在矩形内部：从最近的边推出去
      const l = o.x - rect.x, rr = rect.x + rect.w - o.x, t = o.y - rect.y, b = rect.y + rect.h - o.y;
      const m = Math.min(l, rr, t, b);
      if (m === l) o.x = rect.x - r; else if (m === rr) o.x = rect.x + rect.w + r;
      else if (m === t) o.y = rect.y - r; else o.y = rect.y + rect.h + r;
      return true;
    }
    o.x = nx + (dx / d) * r;
    o.y = ny + (dy / d) * r;
    return true;
  };
  // 对所有障碍物做推出，返回是否撞到任何一个
  E.collide = function (o, r, rects) {
    let hit = false;
    for (const k of rects) if (E.pushOut(o, r, k)) hit = true;
    return hit;
  };

  /* ---------------- 音效（WebAudio 合成，免素材） ---------------- */
  let actx = null;
  E.muted = false; // 由下方「设置」按存档覆盖
  // 首次用户交互时初始化音频（浏览器要求）
  E.unlockAudio = function () {
    if (actx) return;
    try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) { actx = null; }
  };
  // 播放一个简单音调：频率从 f0 滑到 f1
  function tone(f0, f1, dur, type, vol, delay) {
    if (!actx || E.muted) return;
    const t0 = actx.currentTime + (delay || 0);
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
    g.gain.setValueAtTime(vol || 0.08, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(actx.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  // 预设音效
  E.sfx = function (name) {
    switch (name) {
      case 'hit': tone(220, 90, 0.18, 'square', 0.09); break;              // 被锅砸中
      case 'throw': tone(300, 900, 0.14, 'triangle', 0.1); break;          // 甩锅成功
      case 'combo': tone(600, 1200, 0.1, 'triangle', 0.08); tone(900, 1600, 0.1, 'triangle', 0.07, 0.08); break;
      case 'back': tone(500, 120, 0.3, 'sawtooth', 0.07); break;           // 锅被甩回来
      case 'boss': tone(440, 440, 0.12, 'square', 0.07); tone(330, 330, 0.18, 'square', 0.07, 0.14); break;
      case 'warn': tone(880, 880, 0.06, 'sine', 0.05); break;              // 派锅预警
      case 'rankup': [523, 659, 784].forEach((f, i) => tone(f, f, 0.09, 'triangle', 0.07, i * 0.08)); break; // 冲进前三
      case 'win': [523, 659, 784, 1046].forEach((f, i) => tone(f, f, 0.16, 'triangle', 0.08, i * 0.12)); break;
      case 'lose': [392, 330, 262, 196].forEach((f, i) => tone(f, f * 0.98, 0.2, 'square', 0.06, i * 0.15)); break;
      case 'tick': tone(1200, 1200, 0.03, 'sine', 0.03); break;
      // 最后三秒双响短促方波，沿用音效总开关。
      case 'tickUrgent': tone(1500, 1200, 0.06, 'square', 0.04); tone(1500, 1200, 0.06, 'square', 0.04, 0.1); break;
      case 'bell': tone(1046, 1046, 0.32, 'sine', 0.08); tone(1568, 1568, 0.24, 'sine', 0.04, 0.08); break; // 下班铃
      case 'whoosh': tone(700, 260, 0.12, 'sine', 0.07); break;            // 锅甩出去
      case 'parry': tone(1400, 1400, 0.05, 'square', 0.07); tone(900, 1800, 0.12, 'triangle', 0.08, 0.04); break; // 反甩
      case 'miss': tone(300, 200, 0.12, 'sine', 0.05); break;              // 甩空，锅弹回来
      default: break;
    }
  };

  /* ---------------- 设置：音乐 / 音效 / 震动（存本地） ---------------- */
  const SET_KEY = 'shuaiguo_settings';
  E.settings = { music: true, sfx: true, vibrate: true };
  try { Object.assign(E.settings, JSON.parse(localStorage.getItem(SET_KEY)) || {}); } catch (_) { /* 存储不可用就用默认值 */ }
  E.muted = !E.settings.sfx;
  // 改一项设置并保存；音效开关同步到 E.muted（所有 sfx 都看它）
  E.setSetting = function (key, on) {
    E.settings[key] = !!on;
    if (key === 'sfx') E.muted = !on;
    try { localStorage.setItem(SET_KEY, JSON.stringify(E.settings)); } catch (_) { /* 忽略 */ }
  };
  // 震动反馈（只有安卓等支持 navigator.vibrate 的浏览器有效；iOS 网页不支持，静默忽略）
  E.buzz = function (ms) {
    // 没开、浏览器不支持、或用户还没碰过页面（如调试模拟对局）时不震，免得控制台报错
    if (!E.settings.vibrate || !navigator.vibrate || (navigator.userActivation && !navigator.userActivation.hasBeenActive)) return;
    try { navigator.vibrate(ms || 30); } catch (_) { /* 忽略 */ }
  };

  /* ---------------- 背景音乐：WebAudio 合成的 8-bit 循环小调 ---------------- */
  // 32 步一循环（八分音符），0 = 休止；旋律用方波、低音用三角波，音量压得很低，不盖过音效
  const BPM = 138, STEP = 60 / BPM / 2;
  const MEL = [76, 79, 84, 79, 81, 79, 76, 74, 76, 79, 84, 86, 84, 81, 79, 0,
               77, 81, 84, 81, 79, 76, 74, 72, 74, 76, 79, 76, 74, 72, 71, 0];
  const BASS = [48, 0, 55, 0, 48, 0, 55, 0, 45, 0, 52, 0, 45, 0, 52, 0,
                41, 0, 48, 0, 41, 0, 48, 0, 43, 0, 50, 0, 43, 0, 47, 0];
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  let bgmWant = false, bgmStep = 0, bgmNext = 0;
  // 排一个音：t 开始时间，len 时长
  function bgmNote(n, t, len, type, vol) {
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.setValueAtTime(midi(n), t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g); g.connect(actx.destination);
    o.start(t); o.stop(t + len + 0.02);
  }
  // 调度器：每 100ms 往前排 0.3 秒的音；不想播 / 关了音乐 / 页面在后台时什么都不排
  setInterval(() => {
    if (!actx || !bgmWant || !E.settings.music || document.hidden) { bgmNext = 0; return; }
    if (bgmNext < actx.currentTime) bgmNext = actx.currentTime + 0.05;
    while (bgmNext < actx.currentTime + 0.3) {
      const i = bgmStep % MEL.length;
      if (MEL[i]) bgmNote(MEL[i], bgmNext, STEP * 0.9, 'square', 0.022);
      if (BASS[i]) bgmNote(BASS[i], bgmNext, STEP * 1.8, 'triangle', 0.05);
      bgmStep++; bgmNext += STEP;
    }
  }, 100);
  // 游戏告诉音乐该不该响（大厅、对局中响；暂停、结算不响）
  E.bgm = function (on) { bgmWant = !!on; };

  window.E = E;
})();
