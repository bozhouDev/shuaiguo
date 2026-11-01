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

  /* ---------------- 界面浮层 ---------------- */
  // 显示一个卡片浮层；handlers 按 data-act 绑定按钮回调
  E.showPanel = function (html, handlers) {
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
  E.muted = false;
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
      case 'win': [523, 659, 784, 1046].forEach((f, i) => tone(f, f, 0.16, 'triangle', 0.08, i * 0.12)); break;
      case 'lose': [392, 330, 262, 196].forEach((f, i) => tone(f, f * 0.98, 0.2, 'square', 0.06, i * 0.15)); break;
      case 'tick': tone(1200, 1200, 0.03, 'sine', 0.03); break;
      case 'whoosh': tone(700, 260, 0.12, 'sine', 0.07); break;            // 锅甩出去
      case 'parry': tone(1400, 1400, 0.05, 'square', 0.07); tone(900, 1800, 0.12, 'triangle', 0.08, 0.04); break; // 反甩
      case 'miss': tone(300, 200, 0.12, 'sine', 0.05); break;              // 甩空，锅弹回来
      default: break;
    }
  };

  window.E = E;
})();
