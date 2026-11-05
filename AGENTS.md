# 这锅你来背 · 给 AI 助手的项目说明

办公室题材的反向贪吃蛇小游戏：锅有截止时间，到点在谁身上谁背锅，18:00 按背锅次数排名。
游戏名是《这锅你来背》（2026-11-01 由「甩锅侠」改名）。目录名、仓库名 `shuaiguo`、存档键、素材名等内部标识沿用旧拼音，不用改；界面、文案和文档里一律用新名字。
玩法定稿见 `这锅你来背-核心玩法.md`，美术和界面规范见 `DESIGN.md`，每轮改动记录见 `implementation-notes.md`。

## 现状与方向

- `js/`、`index.html`、`css/` 是已退役的网页原型，只作历史参考；`cocos/` 是唯一在维护的 Cocos Creator（TypeScript）版本，也是玩法与关卡数据的唯一事实源。移植计划和任务卡保存在 `port/`。
- 上线方向已定：Cocos Creator（TypeScript），同时出微信小游戏包和网页包。玩法全部在前端计算，进度存本地（`localStorage`，键名 `shuaiguo_v3`）；微信版已接入微信云开发（`cocos/assets/scripts/platform/CloudServices.ts`）。
- 不要提议自建服务器或服务端计算；微信侧以后需要云端能力时用微信云开发。联机以后再定。
- 玩法逻辑尽量和画面分开、关卡数据驱动，方便批量模拟调平衡。

## 目录

| 路径 | 内容 |
|---|---|
| `index.html`、`js/`、`css/` | 已退役的网页原型，只作历史参考，不用于当前开发、调试或验收 |
| `assets/px/` | 单张像素素材（PNG），图集的来源，也是图集缺图时的后备 |
| `assets/atlas/` + `js/atlas.js` | 由 `pack_atlas.py` 生成的图集和位置表，网页实际从这里加载像素图 |
| `assets/fonts/` + `css/fonts.css` | 由 `build_fonts.py` 生成的自托管子集字体（站酷快乐体、思源黑体粗） |
| `assets/*.svg` | 早期矢量素材，游戏已不加载，只有 `assets.html` 还在用 |
| `assets_pixel/` | 出图脚本、原始素材表 `sheets/`、切图和缩放脚本；`sprites/` 是中间产物，不进仓库 |
| `assets.html` | 早期矢量素材的预览页 |
| `_backup_v1/` | v1 旧代码备份，不进仓库 |
| `cocos/` | Cocos Creator 工程：TS 脚本在 `cocos/assets/scripts/`（玩法逻辑 `core/`、画面 `view/`、平台 `platform/`），测试在 `cocos/tests/`，工具脚本在 `cocos/tools/` |
| `port/` | 移植计划 `移植计划.md`、功能清单和任务卡 `tasks/` |
| `tests/` | Cocos TS 录制的黄金录像（`golden/`）及回归脚本，用来守护 core 行为 |

## 本地运行与调试

在 `cocos/` 下运行 Cocos core 的模拟和检查；这里的 `sim-detail` 不启动 Creator：

```bash
node --experimental-strip-types --import ./tests/register-core.mjs tools/sim-detail.mjs 100 0,1,2,3,4 --seed 6011
npm run test:core
npm run check:types
```

- `sim-detail.mjs` 的关卡列表按从 0 开始的索引填写；它用真实 `makeState/update/calculateResult` 批量模拟，可用 `--items`、`--json` 查看道具场景或机读结果。
- 黄金录像验证按需运行 `npm run test:golden` 与 `npm run test:golden:extra`；微信、云函数和 tour 检查分别用 `npm run test:wechat`、`npm run test:cloud`、`npm run test:tour`。
- `js/` 原型的 `http.server`、`SG_DEBUG` 和 `node --check js/*.js` 只适用于已退役原型，不作为当前工程的验证方法。

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
- 文案用职场口头禅和群聊口吻，短而损，不点名真实公司、人物或品牌。玩家是下沉市场的普通职场人：用会计、业务员、美工、人事这类通用叫法，不用产品经理、需求评审、P0、带教等互联网行话（见 `DESIGN.md` §8）。
- 改动较大时在 `implementation-notes.md` 顶部加一节：用户定的、我定的细节（可改）、偏差、已验证 / 未验证。

## 部署

- `Dockerfile` 用 nginx 托管静态文件，只拷贝 `index.html`、`assets.html`、`css/`、`js/`、`assets/`；`*.md` 不会进镜像。`nginx.conf` 开 gzip，图集和字体缓存一年（地址带哈希），页面和脚本每次确认更新。
- 部署到泊舟自建的 Dokploy（服务器在美国波士顿），以 GitHub 仓库为来源，推送 `main` 自动部署。线上地址目前是 http 的 sslip.io 地址，还没配域名和 https。

## 从 Claude Code Game Studios 引入的技能和规则

2026-11-03 从 [Donchitos/Claude-Code-Game-Studios](https://github.com/Donchitos/Claude-Code-Game-Studios)（MIT）挑了 7 个技能、3 条规则，基本原文照搬，改动有：去掉技能里调用外部脚本 `yaml-helper.sh` 的命令（它和 `project.yaml` 都没引进来）；规则的生效路径改成本项目的；`gameplay-code.md`、`test-standards.md` 里只适用于 Godot / Unity / Unreal 的写法换成了本项目的（2026-11-04）。原框架的 49 个角色、钩子、流程文档都没引入，技能里提到的 `/sprint-plan`、`/bug-triage`、`/hotfix`、`/design-review`、`/propagate-design-change`、`creative-director` 等不存在，跳过即可。

| 技能 | 什么时候用 |
|---|---|
| `/playtest-report` | 找人试玩后，把零散反馈整理成结构化报告，并分成设计 / 数值 / Bug / 打磨四类 |
| `/bug-report` | 记 Bug、验证修复（`verify`）、关闭（`close`），没有试玩确认不算修好 |
| `/balance-check js/levels.js` | 调数值时找离谱值和必胜套路；要配合 `SG_DEBUG.simulate` 的实测数据 |
| `/perf-profile` | 低端手机卡顿、移植 Cocos 后查性能 |
| `/asset-audit` | 查素材体积、命名、没被引用的图、引用了却不存在的图 |
| `/patch-notes` | 发版时从 git 记录生成给玩家看的更新公告 |
| `/tech-debt` | 记录和排序技术债（`scan / add / prioritize / report`） |

角色（`.claude/agents/`）：2026-11-05 引入 `game-designer`（游戏设计师），用来诊断核心循环、上瘾感、难度曲线和数值方案，理论包括 MDA、自我决定论、心流、三层循环、锯齿形难度曲线。改动有：设计文档路径改成 `这锅你来背-核心玩法.md`，数值文件路径改成 `cocos/assets/scripts/core/levels.ts`、`config.ts`，去掉 `production/session-state/` 记录，注明它委派的其他角色不存在。它没有 Bash 权限，需要跑模拟时由主会话代跑。

规则（`.claude/rules/`）：`gameplay-code.md` 对 `cocos/assets/scripts/core/` 的 `.ts` 生效，`ai-code.md` 对 AI 相关的 `.ts` 生效，`test-standards.md` 对 `tests/` 和 `*.test.ts` 生效。它们只管 Cocos 工程（`cocos/assets/scripts/`）的 TS，不拿来要求 `js/` 原型。

这些技能按原框架的目录写，在本项目里按下表对照：

| 技能里写的 | 本项目实际对应 |
|---|---|
| 引擎 / code root（`src/`、`Assets/`、`Source/`） | Cocos 版是 `cocos/assets/scripts/`（TS，玩法逻辑在 `core/`，画面在 `view/`）；原型是 `js/` |
| `design/gdd/`、`game-concept.md`、`game-brief.md`、游戏支柱 | `这锅你来背-核心玩法.md` |
| `design/art/art-bible.md`（素材规范、命名、体积预算） | `DESIGN.md`；素材体积预算：`assets/px/` 总计不超过 2 MB |
| asset root | `assets/px/`、`assets/atlas/`、`assets/fonts/`；精灵登记在 `js/game.js` 的 `SPRITES`，也通过 `E.pxUrl('名字')` 和 `data-px="名字"` 引用 |
| `assets/data/`、`design/balance/`、`design/registry/entities.yaml` | 关卡和数值在 `js/levels.js`；实测数据用 `SG_DEBUG.simulate`，历史结果记在 `implementation-notes.md` |
| `project.yaml` 的 `performance.*` 预算 | 目前没定，按技能规则报 `NOT ASSESSED`，不要自己编一个 |
| `commands.test` | Cocos 版：在 `cocos/` 下跑 `npm run test:core`，其余测试在 `cocos/tests/`（node:test）；原型：语法检查用 `node --check js/*.js` |
| `modes.automation`、`review_mode` | 按 `collaborative` / `solo` 处理：写文件前先问，不派总监角色审核 |
| 报告输出目录（`production/qa/`、`production/polish/`、`docs/tech-debt-register.md` 等） | 沿用原路径，但必须先问过泊舟、同意了才写 |
| `.claude/docs/*.md`（automation-modes、config-resolution、code-root-resolution、director-gates） | 没有引入；按上面的 `collaborative` 处理，代码根目录见上表，director gate 跳过 |

## Git

- 直接在 `main` 上开发，不为每个任务新建分支或 worktree。
- 用户要求时才提交；提交信息用中文，一句话说清改了什么，必要时列几条要点。
