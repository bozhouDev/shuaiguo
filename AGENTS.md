# 这锅你来背 · 给 AI 助手的项目说明

办公室题材的反向贪吃蛇小游戏：锅有截止时间，到点在谁身上谁背锅，18:00 按背锅次数排名。
游戏名是《这锅你来背》（2026-11-01 由「甩锅侠」改名）。目录名、仓库名 `shuaiguo`、存档键、素材名等内部标识沿用旧拼音，不用改；界面、文案和文档里一律用新名字。
玩法定稿见 `这锅你来背-核心玩法.md`，美术和界面规范见 `DESIGN.md`，每轮改动记录见 `implementation-notes.md`。

## 现状与方向

- 现在是**纯静态网页原型**：原生 JS + Canvas，没有构建步骤、没有依赖、没有后端。
- 上线方向已定：Cocos Creator（TypeScript），同时出微信小游戏包和网页包。现阶段只做单机，全部在前端计算，数据只存本地（`localStorage`，键名 `shuaiguo_v2`）。
- 不要提议自建服务器或服务端计算；微信侧以后需要云端能力时用微信云开发。联机以后再定。
- 玩法逻辑尽量和画面分开、关卡数据驱动，方便以后搬到 Cocos，也方便批量模拟调平衡。

## 目录

| 路径 | 内容 |
|---|---|
| `index.html` | 唯一入口：画布、HUD、甩锅键、大厅和浮层容器 |
| `js/engine.js` | 公共引擎：画布、摇杆输入、蛇身轨迹、飘字、浮层、精灵加载、音效 |
| `js/levels.js` | 关卡数据：办公室地图 `OFFICE` + 关卡列表 `LEVELS`。加关卡只往 `LEVELS` 里加一项 |
| `js/game.js` | 主逻辑：对局、AI、绘制、HUD、大厅、关卡介绍、结算 |
| `css/style.css` | 样式，按版本分段追加（v2 / v3 像素风 / v4 大厅） |
| `assets/px/` | 单张像素素材（PNG），图集的来源，也是图集缺图时的后备 |
| `assets/atlas/` + `js/atlas.js` | 由 `pack_atlas.py` 生成的图集和位置表，网页实际从这里加载像素图 |
| `assets/fonts/` + `css/fonts.css` | 由 `build_fonts.py` 生成的自托管子集字体（站酷快乐体、思源黑体粗） |
| `assets/*.svg` | 早期矢量素材，游戏已不加载，只有 `assets.html` 还在用 |
| `assets_pixel/` | 出图脚本、原始素材表 `sheets/`、切图和缩放脚本；`sprites/` 是中间产物，不进仓库 |
| `assets.html` | 早期矢量素材的预览页 |
| `_backup_v1/` | v1 旧代码备份，不进仓库 |

## 本地运行与调试

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

- 打开 `http://localhost:8765`，手机竖屏尺寸（375×812）体验最好。
- `?level=N`：跳过大厅直接进第 N 关介绍（会顺便解锁）。
- `?auto=1`：玩家也交给 AI。
- 控制台 `SG_DEBUG.simulate(关卡序号, 局数)`：纯 AI 快速跑多局，统计名次、背锅、压垮。改数值后用它对比，结果记进 `implementation-notes.md`。
- 改完至少跑一次 `node --check js/*.js`，再在浏览器里走一遍「大厅 → 关卡介绍 → 开局 → 暂停 / 结算 → 回大厅」，确认控制台没有报错。

## 美术与素材

- 以 `DESIGN.md` 为准。要点：16-bit 像素风，纯 2D、经典 RPG 的 3/4 俯视，不做 3D / 等距 / 透视；人物必须全身 Q 版；素材里不放文字；新界面不用 emoji，用 `assets/px/ui_*.png`。
- 新素材用 Codex 内置 `image_gen` 出图，洋红底、附参考图，脚本见 `assets_pixel/gen_assets.sh`、`gen_walk.sh`、`gen_lobby.sh`。
- 出图后：`python3 assets_pixel/cut_sheets.py <表名>` 切图 → `python3 assets_pixel/build_px.py` 缩放并转调色板 PNG → `python3 assets_pixel/pack_atlas.py` 重打图集 → 在 `js/game.js` 的 `SPRITES` 里登记。界面里的 `<img>` 地址用 `E.pxUrl('名字')`，HTML 里写死的图标用 `data-px="名字"`，不要直接写 `assets/px/` 路径（会多发请求）。
- **改了界面文案、加了新字以后**，跑 `python3 assets_pixel/build_fonts.py` 重新裁字体，否则新字会退回系统字体。字体源文件放 `assets_pixel/fonts_src/`（不进仓库，下载地址写在脚本开头）。
- 不要再引用 Google Fonts 等外部资源：服务器在美国，国内访问外部 CDN 很慢。
- `assets/px/` 总体积目标不超过 2 MB。

## 写代码的约定

- 所有函数和关键逻辑都写中文注释，风格跟现有代码一致。
- 颜色只用 `DESIGN.md` §3 的语义色：红 = 对你不利，绿 = 对你有利，黄 = 你自己 / 主操作，灰 = 不可用。
- 文案用职场黑话和群聊口吻，短而损，不点名真实公司、人物或品牌。
- 改动较大时在 `implementation-notes.md` 顶部加一节：用户定的、我定的细节（可改）、偏差、已验证 / 未验证。

## 部署

- `Dockerfile` 用 nginx 托管静态文件，只拷贝 `index.html`、`assets.html`、`css/`、`js/`、`assets/`；`*.md` 不会进镜像。`nginx.conf` 开 gzip，图集和字体缓存一年（地址带哈希），页面和脚本每次确认更新。
- 部署到泊舟自建的 Dokploy（服务器在美国波士顿），以 GitHub 仓库为来源，推送 `main` 自动部署。线上地址目前是 http 的 sslip.io 地址，还没配域名和 https。

## Git

- 直接在 `main` 上开发，不为每个任务新建分支或 worktree。
- 用户要求时才提交；提交信息用中文，一句话说清改了什么，必要时列几条要点。
