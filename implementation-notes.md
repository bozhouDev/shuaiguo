## 2026-11-04 · P7-4 对局绘制减负（需要刷新编辑器 + 构建，原生/真机待验）

- **用户定的：** 按任务卡及其前置材料执行；不运行CocosCreator、不构建、不提交/推送，不改原型、玩法数值、结算设计。“突然变大”只查路径，不改，等Claude确认。完整交付：[port/tmp/p7-4/report.md](port/tmp/p7-4/report.md)。
- **我定的细节（可改）：** DrawSurface按原连续Graphics池槽缓存上一批局部几何；形状/颜色/alpha/线宽/虚线不变时仅移动节点，Sprite/Label/Mask/外部层边界原样提交。没有新贴图、全局重排或按时间增长的缓存。Node工具增加固定时间回放、同样600步窗口、原生geometry门禁、DPR独立页实验、触点/FPS视口核对及分类请求。
- **实测保留：** 同引擎页面内源码A/B，DPR1、CPU×6、seed1001；第1关10–20秒绘制5.00→3.00ms；第5关10–20秒8.98→6.72ms、clear37.45→17.14，100–110秒7.83→5.90ms、clear27.61→12.57；119秒34口锅的0.5秒补测10.40→8.94ms、clear41.93→26.76。draw call基本不变；端点t/步数/RNG一致。软件GL不代表手机温度、功耗或实际FPS。
- **实测不保留：** CHAR第1/3/5关出现11,062 / 13,357 / 15,336像素差，中文/描边不等价；HUD两版重排均0像素差且少约8次draw call，但脚本更慢，已撤去。DPR3/2内部画布1125×2436 / 750×1624，像素少55.6%，触点正常、15/60切换resize=0；软件GL间隔改善约44–46%，但2倍合成细字更软，本机无公开resolutionScale setter，未启用生产封顶。
- **画面 / 已验证：** 第1/3/5关freeze120各差1个摇杆圆弧边缘像素；第5关100/119秒各差1像素；150/170请求的真实结算0差异。源码黄金100/100、当前编译包黄金100/100及内存变异通过；core14/14、wechat39/39、cloud15/15与共享副本、check:types、perf/tour/result-view20/20、外围/调试/HUD/Label/check-spread、416保护文件及语法/diff检查全过。.meta/core/素材/构建产物原字节，完整审计见报告。
- **偏差 / 未验证：** 第1关70秒、第5关120秒，150/170秒不存在活跃对局，明确N/A并补100/119秒，未延长玩法。7456有第一轮但没有本轮geometry，原生after已拒测；所有after均标明源码页面，Creator本轮编译、微信新包和手机发热未验。窗口/DPR/Boot投影重算、HUD安全区、甩键8%/教学排名15%/下班数字16%/贴纸6%等缩放路径已列出，均未改。
- **范围 / 清理：** 仅改DrawSurface、perf.test.cjs、perf-bench.mjs及本记录；报告/原始证据在port/tmp/p7-4。保留开工AGENTS/.claude/任务卡改动；没有新服务器、CUA或桌面连接，任务浏览器finally关闭并核对退出，保留已有7456与用户应用。HEAD=fff84ef未变，未提交。

---

## 2026-11-04 · P7-3 第5关卡顿（需要刷新编辑器 + 构建，原生/真机待验）

- **用户定的：** 按任务卡完整读所有前置文件，先量再按证据优化；等7456包含P7-2后才测原生基线；不运行/操作CocosCreator、不构建、不提交/推送，不改原型/core/玩法/数值/结算素材。完整交付：[port/tmp/p7-3/report.md](port/tmp/p7-3/report.md)。
- **我定的细节（可改）：** 调试面板增加性能开关，develop/trial或网页debug=1才可创建PerfProbe；近2秒平均/最差5%、玩法逻辑/绘制、真实GFX draw call、活跃节点、本帧改字Label去重数、Graphics顶点、排字、目标FPS/DPR。4Hz更新系统字浮层；关闭恢复hook/监听。Node基准DPR1、CPU×6、seed1001、10秒auto；先断言screen=play及关卡/人数，Profiler启停放在统计窗口外，保存原始profile。
- **选了四项：** 同值outlineColor不写入，避免3.8.8仅比对象身份导致排字/纹理重传；暂停/静止页面保留几何，大厅只随原阶跃变化重画，输入/动画/云进度/排行失败仍失效刷新；介绍页移交预热显示池，点击仍new Match并重读种子/进度/云参数；静止15FPS、对局及连续UI动画60FPS，输入立即唤回60，仅UI idle时钟改用对应真实dt，玩法33ms上限和步进顺序不变。未铺开颜色缓存、CHAR字体、阴影换Sprite、层排序或DPR改造。

**前后对比：** 前为已更新P7-2的原生7456；后为同引擎的页面内TS源码验证，**不是原生新预览/微信新包**。各项为10秒均值，单位见行名。

| 指标（10 秒均值） | 第1关原生前 | 第5关原生前 | 第1关源码后 | 第5关源码后 |
|---|---:|---:|---:|---:|
| 员工 / 领导 | 4 / 1 | 8 / 3 | 4 / 1 | 8 / 3 |
| 平均真实帧间隔 ms | 19.39 | 26.54 | 19.42 | 24.72 |
| 最差5%帧间隔均值 ms | 52.32 | 59.72 | 52.59 | 62.55 |
| 脚本玩法逻辑 ms | 0.43 | 0.62 | 0.30 | 0.57 |
| 脚本绘制 ms | 4.62 | 8.22 | 4.25 | 8.04 |
| draw call / 帧 | 89.31 | 156.86 | 84.77 | 152.19 |
| 活跃 Graphics / 帧 | 31.03 | 53.77 | 31.50 | 52.64 |
| 活跃 Sprite / 帧 | 43.54 | 77.11 | 40.28 | 71.45 |
| 活跃 Label / 帧 | 34.43 | 50.86 | 31.01 | 50.04 |
| 本帧改字 Label / 帧 | 0.62 | 3.31 | 0.38 | 2.52 |
| Graphics 顶点 / 帧 | 9967.61 | 11954.48 | 9931.78 | 11888.32 |
| Label 排字 / 更新 ms | 1.70 | 3.16 | 0.55 | 1.45 |
| Graphics clear / 帧 | 16.32 | 36.23 | 16.22 | 35.06 |

- **每项收益：** 描边单变量页面A/B，1/5关排字1.70→0.49 / 3.16→1.60ms/帧；静止缓存后暂停脚本绘制1/5关8.88→0.13 / 12.52→0.25ms/提交，介绍页0ms/0 clear；同源码冷热池各5次中位数，首提交1/5关59.10→11.80 / 84.50→15.30ms；同一第5关142 draw call、13689顶点画面，60/15目标读回一致，软件GL实测每秒提交约3754→2130，少43.3%，不能当手机节电率。游戏稳态最差5%没证明改善，不能宣称卡顿已修好。
- **画面：** 第1/3/5关seed1001、freeze120，临时固定页面画面随机流0.5以消除第1关此帧爆炸震屏的非玩法随机位移；玩法t/步数/RNG/人数完全一致，三张逐像素差异全部0（含>2阈值0）。比较图/热图/原始差值见报告；源码流程大厅→介绍→开局→暂停15→继续立即60→自然结算→回大厅，页面错误0，关闭浮层后节点移除。
- **已验证：** core14/14、wechat39/39、cloud15/15及副本无漂移、check:types、源码黄金100/100、当前微信编译包黄金100/100+内存变异、性能/结算契约14/14（7+7）、外围/调试/HUD/Label/check-spread、416保护文件、语法/diff检查；159meta/237含subMeta UUID无缺失/孤立/星号/重复，原158meta原字节。红绿回归涵盖同值描边、重复绘制、静止60FPS、显示池移交、新种子/进度/Match隔离、监听/释放、低帧返回33ms、独立HUD与嵌套计时。
- **偏差 / 未验证：** 首次刷新11:41后可测原生P7-2，但后续outline/idle/warm/fps四标记一直未导入；原生after严格拒测，报告后列明确为页面内源码。浏览器为SwiftShader，不能模拟iOS无JIT/手机GPU或证明温度/耗电；3→2倍分辨率像素数理论少55.6%，微信清晰度/坐标待真机，未改。早期未进入play、Profiler边界污染及一次误并发样本均作废未纳表。
- **泊舟手机看：** 刷新本轮TS/meta并构建后，在两台手机开浮层，1/5关分别玩20秒以上拍开局2秒、10秒及发热时；暂停/介绍/结算停5秒应到15且脚本工作接近0，继续立刻60；看整局卡顿/发热、名字/倒计时、前后台、按钮与滚动。报告有native after命令；收到真机证据之前不关闭该卡顿问题。
- **并行变化 / 清理：** 本任务没有写ResultView和结算素材；期间外部HEAD从8c7c967到73d1fe6（顶部图下移12px）并更新构建，已核对保留，未覆盖/还原；保留原有AGENTS/.claude改动。所有本轮浏览器finally关闭并记录进程退出；无新服务器/CUA/长驻助手，保留7456与用户应用；本任务未提交。

---

## 2026-11-04 · P7-2 结算弹窗重做阶段二（需要刷新编辑器 + 构建）

- **用户定的：** 先读末尾裁定，再完整读任务卡、所有指定前置文件和阶段一报告；接入已验收结算素材。失败灰天闹钟、压垮乌云碎锅，两者暗红彩带；保留全部结算操作、返回首页和矮屏滚动。不运行/操作 CocosCreator，不构建、不提交/推送，不改原型/玩法。完整报告 `port/tmp/p7-2/阶段二报告.md`。
- **我定的细节（可改）：** 天空/徽章/彩带、金色描边名次、同行称号星星纪录、厚金玩家行、红虚线过关线、蓝色次按钮/黄色主按钮/纸飞机和底部花草。彩带三段拉伸，九宫格用现有 DrawSurface 裁片缓存；17 项独立资源由 WorldAssets 加载。首页为按钮组下方灰字链接；保留复盘、报告、周五真实证书类型和辅助记录。Tour 原26步全部保留，补成37步，增加二星、辅助后终局/证书、四种增益与长结算底部步骤；App 巡检复用实际 buff 和 maxScroll。
- **素材：** 新增 `assets_pixel/gen_result_red.py` 及暗红 PNG/meta，主面 #BA3F3C、高光 #E8504A，逐色替换保留形状/alpha/描边。新图310×76、778B；20张运行PNG共14,962B，含result元数据72,351B，连阶段一三张整理素材表83,139B。原素材和字体原字节不变，显示文案逐字检查现有字体指标无缺字，无需重新裁字。
- **已验证：** 显示/资源/真实App Mask与巡检12/12，先在旧实现观察到显示契约预期失败；core14/14、wechat39/39、cloud15/15且副本无漂移、check:types、源码黄金100/100、扩展录像177/177、当前编译包黄金100/100及内存变异通过。外围/调试/HUD/Label/check-spread、416保护文件、语法/diff检查通过；158meta/236含subMeta UUID无缺失/孤立/星号/重复，所有原meta保留。完整日志和开工快照见报告目录。
- **偏差 / 未验证：** 7456仍旧：新结算资源0、没有本轮Tour参数，页面错误0，已存明确标记stale的旧截图。未做源码覆盖，不声称网页/微信画面或1:1已验收。375×667长内容采用允许的滚动；Node证明文字/按钮水平边界与真实App Mask底部命中框，设备手势/GPU切片/微信二次编译仍待刷新构建。报告列出新包需复拍的状态、步骤号和三种尺寸，含教学完局补拍。
- **并行变化 / 清理：** 本轮外部仅移除构建game.js开工前的首行巡检开关，已通过SHA256复原关系核实，未覆盖/还原；除此外1111个受审计文件保持原字节。浏览器finally已关闭，无本任务服务器、CUA或headless助手遗留；保留已有编辑器/浏览器/共享服务和开工前AGENTS/任务卡/.claude改动，HEAD不变、未提交。

---

## 2026-11-04 · P7-1 微信编译产物核对与自动巡检（需要刷新编辑器 + 构建）

- **用户定的：** 按任务卡完整读前置文件；不运行/操作CocosCreator、不构建、不提交/推送，不改原型/玩法/resources/ResultView；本轮完成当前包录像和巡检源码后交接，微信截图对比留下一轮。中文报告 `port/tmp/p7-1/report.md`。
- **我定的细节（可改）：** 最小System.register加载器只执行真实编译core/Babel helper，给cc登记空桩；复用未改golden-adapter与原录像比较契约。变异145→146仅作用内存产物副本，避免手改index触发微信二次编译。Tour.ts纯步骤/计时，all共26步、seed1001、默认hold4秒，页面就绪后日志、后台停计时、销毁取消；App复用真实页面/WorldView/core，独立空内存存档且不启动云/上传成绩/震动，改名框不唤起键盘。
- **已验证：** 当前编译包黄金100/100；变异命中第1关seed1001第30帧玩家x。源码黄金100/100、core14/14、wechat39/39、cloud15/15且副本无漂移、tour5/5、严格类型、外围/调试/HUD/Label/check-spread、416保护文件、语法和diff检查通过。189已有构建文件原字节未变，原有meta未改；本轮只新增Tour TS/meta。当前全资产157meta/233含subMeta UUID无缺失/孤立/星号/重复，含期间出现的其他卡result资源。
- **网页证据：** 7456原生预览仍旧，无巡检方法；用独立浏览器页面内存转译本轮TS接真实预览引擎，26步默认4秒跑到done、错误0、不写存档；最终源码快速复验26步并确认关闭debug后巡检全局getter读取0次。源码覆盖只存在于本轮页面，没有改服务器/构建，不能充当新包或微信验收。日志/截图见完整报告。
- **偏差 / 未验证：** 周五关卡120秒，请求推进150秒真实停在t=120的结算，未延长玩法。当前包for-of helper、class字段/访问器、Unicode正则、可选链/??转换未发现错误；Symbol/Array.from设备前提和微信工具二次编译无法从现有包确证。新Tour的Creator编译、微信自动巡检/原生好友画布/逐页截图与原型差异均待刷新构建，尚未宣称画面全部还原。
- **交接 / 清理：** 泊舟刷新导入Tour及meta并构建后，重跑compiled录像，再仅在game.js第一行加全局巡检开关；不手改index.js。报告含窗口号查询/截图命令。浏览器finally关闭、Node终态退出；无新服务器/CUA/桌面连接，不动用户已有应用与其他卡素材，未提交。

---

## 2026-11-04 · P6-2 大厅好友排行榜（需要刷新编辑器，待视觉与微信验收）

- **用户定的：** 完整读任务卡及指定前置文件后执行；大厅独立排行页按方案 B，只做好友、按周一至周五每关最低总账排；未解锁关可看，只有有星成绩入榜。不运行/操作 CocosCreator、不构建、不提交/推送、不部署，不改原型/玩法/全服榜。报告输出 `port/tmp/p6-2/report.md`。
- **我定的细节（可改）：** 大厅底部次按钮排三等分为「老板名称 / 排行 / 玩法」，皇冠图标、16px 标签；排行默认大厅当前日，关闭保留大厅选择，去上班进入排行所选关介绍。新增 FriendRankView.ts 和独立 typescript meta；原生 Canvas 2D 子域只画列表，身份/昵称/头像不回主域。版本化 show/scroll/hide/invalidate 协议、每关成功缓存与滚动位置、本人精确身份黄底、金银铜名次、系统字宽截断、头像失败方块、8 秒请求超时。可见 SubContextView 15 FPS，离页/后台停刷，无子域动画循环；好友 KV 上传成功后失效缓存。
- **模板方案：** 只读核实本机 3.8.8 app.asar 实际 hooks：默认子域生成/恢复在前，自定义 build-templates copySync 在后，再合并 game.json。Node 临时目录连续两次验证自定义入口覆盖和 JSON 保留，测试执行实际 copy 语句与 buildGameJson 函数；没有真实构建。模板额外固定 openDataContext 入口，兼容现有未勾默认模板的配置。保留组件默认 640×960，节点与画布互逆缩放，不改运行时只读设计尺寸。
- **已验证：** core 14/14、wechat 39/39、cloud 15/15 且副本无漂移、黄金录像 100/100、check:types、外围/调试/HUD/Label、check-spread（含子域 JS）、语法与 diff 检查通过；416 保护文件无变化。136 meta/174 含 subMeta UUID 无缺失/孤立/星号/重复；135 原 meta 字节不变，新增 1 TS+1 meta。core/图像/字体/音频字节未变；新可见文字在现有字体内，无需生成原型字体。
- **偏差 / 未验证：** 7456 三尺寸均为旧代码，没有 rank；真实旧截图标 stale，新大厅/排行共六张待编辑器刷新复拍。Node 不能证明 GPU 共享画布、真实好友身份/头像、隐私回调或包体通过。原型局内同分还比 blames/thrown，好友 KV 没这些字段，故按昵称字典序、同名按身份稳定兜底，不扩大上传字段。未复制旧 build，待泊舟手动构建后 Claude 微信截图验收。
- **泊舟待办 / 发现但未改：** 刷新导入新脚本和 meta，重拍六张，手动构建读回自定义子域及 game.json；MP 隐私指引声明「微信朋友关系」，用途为按关好友最好总账榜，检查平台隐私授权弹窗并验首次同意/拒绝与恢复。既有本地清档被云恢复、好友 KV 上传在途的再次结算延后补传、旧模板未加载的文件残留未改。完整文件清单、证据、协议和微信验收点见交付报告。
- **清理：** 本任务 Playwright 浏览器均已关闭，无 CUA/新服务器/编辑器/长驻助手；保留用户已有服务与开工前改动，未提交。

---

## 2026-11-04 · P5-1 微信平台接入代码（Node验收完成，待明天真机）

- **用户定的：** 按任务卡完整读前置文件后执行；空广告位，不运行/操作CocosCreator、不构建、不提交/推送/部署；不改原型/玩法/网页行为，真机留明天。保留开工前AGENTS/.claude/任务卡内容。
- **我定的细节（可改）：** 三种奖励共用微信默认单例，load→show→严格isEnded=true；重复请求/迟到/120秒超时无奖励。InnerAudioContext六音效+两BGM，解析Bundle文件URL避免41个AudioClip隐式播放器；倍速/静音键常量/后台广告来电独立暂停。375宽FIXED_WIDTH、安全区/胶囊按窗口宽换算；分包下载+注册各30秒界限、自动重试一次、点击手动重试。分享复用原配图到500×400 RenderTexture，翻行导出临时PNG，失败退主包默认大厅图；真正外发标题固定老板称呼，保留本地预览和附加报告。微信EditBox单行done/原生100长度，仍按Unicode六字校验，确认键不提前保存。
- **已验证：** test:wechat 24/24、黄金录像100/100、core14/14（五关各50局统计一致）、cloud15/15及共享副本无漂移、check:types通过；外围/调试/HUD/Label全部通过，416保护文件变化0；135meta/173含subMeta UUID无缺失/孤立/星号/重复，129原meta字节不变；新增6TS+6meta，core/图片/字体/音频字节未变；语法和diff检查通过。真实App广告/分享/后台/队列、真实3.8.8键盘适配器均在Node运行，设备边界mock。
- **偏差 / 未验证：** 这些结果不代表编辑器导入、构建、手机回调/GPU导图、听音、真实分享接收或包体通过；没有真实广告位，无法验真实有奖流程；无iOS设备，静音键待后续。微信震动按轻/中/重/长映射，不能逐毫秒等价；默认分享图原字节复用512×768大厅背景，需看平台裁切。加载卡新增状态文字用系统字，无需动冻结字体。
- **发现但未改：** P4-2本地预览仍含自定义老板名（成就标题/小舅子/吃饼报告）；真正外发已用固定称呼，建议后续单独统一预览或接内容安全。P6清档可能被云恢复、权限/索引和榜单UI维持既有边界；旧包/旧预览不当作末次源码验收。
- **交付 / 清理：** 文件清单、十项实现与降级、命令日志、开发者工具/安卓逐条验收、发现但未改见 `port/tmp/p5-1/report.md`；所有本轮Node/Python任务均结束，没有新建浏览器/CUA/服务器/长驻助手，保留用户编辑器与共享服务，未提交。

---

## 2026-11-04 · P6-1 云开发服务端与客户端数据层

- **用户定的：** 按 `port/tasks/P6-1-云开发服务端与客户端接入.md` 执行，已先读任务卡及全部指定前置文件。使用云环境 `cloud1-d3gio6bskae9e684b`、AppID `wx15e416b0643d90af`；云只加分、失败不阻塞游戏。只做服务端和客户端数据层，不做排行榜界面/开放数据域，不改原型/默认数值。保持 main，不运行 CocosCreator、不构建、不提交/推送、不部署 Dokploy；授权用已登录微信 CLI 部署云函数。
- **我定的细节（可改）：** `config/save/track/rank` 四函数、`saves/events/ranks/config` 四集合。core共享最好成绩比较与存档合并，Node生成每函数自包含CommonJS副本；事务保护并发云档/最好成绩/埋点限频。调参白名单仅关卡数值、字段有范围、时长不截断既有日程；开局深拷贝参数，局中不变。微信调用默认3秒超时；本地缓存/400ms存档防抖/200条持久事件队列、每批20条、每人每分钟120条新事件；超限丢弃不报错。好友KV键 `sg_debt_v1_<关卡ID>`，值 `{v:1,debt}`，只记有星局的最小总账。全服名为“打工人#”加身份哈希后四位，不公开老板称呼。
- **必要接入：** 微信原有同步本地存储是空壳，本卡补接 `getStorageSync/setStorageSync`，键名不变。AppView接启动、开局、结算、改名时间戳、带教七步、广告尝试/结果、分享操作和前后台；simulate继续隔离，不加core事件或改变随机调用。`Match.calculateResult.next`改用关卡ID定位，兼容独立参数副本。
- **构建方案：** `cocos/build-templates/wechatgame/project.config.json`合并AppID与 `cloudfunctionRoot: ../../cloudfunctions/`。Node拿现有 `build/wechatgame-001` 的配置模拟合并，路径/AppID/自包含目录均通过；未修改构建产物，明天仍需编辑器真实构建后读回确认。
- **偏差与修正：** 首次微信部署因函数尚处于Creating而上传失败，CLI却退出0；脚本增加终态错误识别，等待创建结束后重试。测试抓到数据库故障被误判空档、防抖在途漏补传、玩家压垮时刻取错字段，以及大批量事件未按要求静默丢弃，均先保留失败证据再修正。构建/真机/控制台设置留待泊舟，不把部署成功当作真实调用验收。

**已验证：**

| 检查 | 结果 |
|---|---|
| `npm run test:core --prefix cocos` | 14/14，含五关各50局simulate逐字段一致 |
| `npm run test:golden --prefix cocos` | 默认路径100/100；适配器改走正式空配置参数注入后仍100/100，快照/事件/结果完全一致 |
| `npm run test:cloud --prefix cocos` | 15/15；服务端内存事务mock、客户端mock微信、缓存/离线/超时/局中隔离、队列重发/限频/排行/构建模板；生成副本无漂移 |
| `npm run check:types --prefix cocos` | 退出0；仅Node调用tsc，未运行编辑器 |
| `node cocos/tools/check-peripheral.cjs` | 原有外围契约与新增真实App埋点、bossNameAt、七步去重全PASS |
| `node cocos/tools/check-debug-panel.cjs` | 全PASS；调试开局参数独立、simulate不写存档/不改活动状态与RNG |
| `node tests/check-port-protected.cjs` | PASS 416个保护文件，内容变化0、无目录增删 |
| Node语法 / `.meta`审计 / `git diff --check` | 全通过；129个meta无星号importer、缺TS meta、孤立meta或重复UUID；新增4个typescript meta |
| 微信云函数部署 | 四函数代码上传success=true；最后track超量语义修正单独补发，结果见完整报告与日志 |

**未验证 / 明天待办：** 编辑器刷新4个新TS；泊舟手动构建，读回AppID/cloudfunctionRoot和meta；开发者工具实际callFunction冒烟；首次调用建集合后逐集合设“仅管理端可读写”或read/write=false；手动建ranks复合排序索引及events分析索引；安卓断网/超时不阻塞、联网补传、跨设备合并、好友KV、真实函数日志与耗时。CLI无invoke子命令，未使用密钥绕行。没有向config写入任何游戏数值。

**发现但未改：** P5广告/分享/震动/安全区空壳；开放数据域/榜单UI；强反作弊；名称时间戳跨设备时钟偏差；调试本地清档会被云同步恢复；介绍页仍用默认信息、全服榜不分调参版本；排行失败没有单独离线补传队列。当前ad_show记录广告流程尝试，真展示仍待P5与真机验收。已有AGENTS/.claude改动保持原样。

**交付与清理：** 完整九节报告、数据库字段/权限/索引、四函数接口、客户端调用点、测试与部署原始输出、明天操作步骤见 `port/tmp/p6-1/report.md`。SDK仅临时装在save函数目录核对实际API，已清理node_modules；没有新开浏览器/CUA/服务器/编辑器，Node/CLI均终态退出，不关闭用户已有共享工具。未提交。

---

## 2026-11-04 · P4-2 有意改进与调试面板（分项记录）

### A · rankDown 音效

- **用户定的：** 只做任务卡 A；先读任务卡及全部前置文件。保持 main，不运行/操作 CocosCreator、不构建、不提交/推送；冻结原型，不新增 `cocos/assets` 文件，不做 B–E。
- **我定的细节（可改）：** `rankDown → sfx_rank_down`，音量 0.4，与现有 `rankup` 一致。沿用原有预载、播放和 50ms 同名去重路径，不改触发条件。直接扩充已有 Node 外围契约，无新增资产或测试专用生产接口。
- **偏差说明：** 任务卡写“core 发 rankDown”，当前源码实际由 `AppView.render → PraiseView.rank → AudioView.sfx` 触发（排名依据仍来自 core）；沿用既有边界，未移动到 core。

**改动文件与原因：**

- `cocos/assets/scripts/view/audio-data.ts`：登记已有掉榜采样及音量。
- `cocos/assets/scripts/view/AudioView.ts`、`PraiseView.ts`：仅修正“掉榜故意无声”的过时注释，运行逻辑未改。
- `cocos/tools/check-peripheral.cjs`：以真实 `Match.ranking()` 和 `PraiseView.rank()` 触发 `AudioView.sfx()`，在 WebAudio 设备边界记录排播采样、音量与倍速；覆盖前三和周五前两名、持续掉榜不逐帧重播、快速回榜再掉榜的 49ms 去重/51ms 恢复。原有 38 项仍与冻结原型逐项严格比较，只允许新增 rankDown；音频测试失败也在 finally 释放音频和定时器。
- `implementation-notes.md`：新增本节，后续各项在本节追加。

**已验证（命令均从仓库根目录执行）：**

| 命令 / 检查 | 输出 |
|---|---|
| `node cocos/tools/check-peripheral.cjs`（先加测试、未登记采样） | 退出 1：`掉出名额应实际排播 sfx_rank_down`，`5 !== 6`，确认回归测试抓住原问题 |
| `node cocos/tools/check-peripheral.cjs`（登记后） | 退出 0；真实排名掉出前三/前两名播放 sfx_rank_down，音量 0.4，49ms 去重/51ms 恢复；其余外围契约全部 PASS |
| `node tests/golden/verify.cjs --adapter cocos/tests/golden-adapter.cjs` | PASS 100/100，快照、事件、最终结果完全一致 |
| `npm run test:core --prefix cocos` | tests 14 / pass 14 / fail 0，含五关各 50 局模拟逐字段比较 |
| `npm run check:types --prefix cocos` | 退出 0，无类型错误；仅 Node 执行 tsc，未启动编辑器 |
| `node tests/check-port-protected.cjs` | PASS 416 个保护文件，内容变化 0，保护目录无增删 |
| `for file in js/*.js cocos/tools/check-peripheral.cjs; do node --check "$file" || exit; done` | 退出 0 |
| `git diff --check` | 退出 0，无空白错误 |
| Node 内联只读 `.meta` 审计与开工前 SHA-256 对比 | PASS 125 个 meta：无缺失、孤立、星号 importer、重复 UUID；所有 TS importer 正确。`cocos/assets` 240 个文件无增删，仅上述 3 个 view 源码变化；core、meta、音频和资源字节均未变 |

**待刷新复拍 / 未验证：**

1. 编辑器刷新确认加载了末次源码后，网页中实际掉出前三、周五掉出前两名各录一次，核对 sfx_rank_down 加载和听感，持续落榜不连响；快速回榜再落榜补声音调用记录。
2. 设置关闭音效再掉榜应静音，重开后复验；微信 AudioSource 路径及真机实际声音留待刷新/后续平台验收。Node 排音通过不等于已听音或真机通过，未使用 7456 旧预览作证明。

**发现但未改：**

- 掉榜触发位置与任务卡描述有差异，见上；core 和事件文本未改。
- `AudioView.synth` 没有 rankDown 合成预设，采样尚未就绪/加载失败时仍可能无声；本项按卡片只登记现有采样，未新增兜底策略。
- 自定义老板称呼、分享人物图、emoji、隐藏调试面板保留给 B–E；开工前已有的 `AGENTS.md`、`.claude/` 与任务卡等改动保留。

**清理：** Node 检查进程已结束，测试 finally 释放音频/定时器；未创建浏览器、CUA、开发服务器或其他长驻助手，未操作用户已开的编辑器及服务。


### B · 写死的“老板”改用自定义称呼

- **用户定的：** 只执行任务卡 B；已先读任务卡、AGENTS、DESIGN 指定章节、移植计划 §9、功能清单 §19/§22、P4-1 记录和 `cocos/assets/scripts/`。保持 main，不运行 CocosCreator、不构建、不提交/推送；冻结原型，不新增 `cocos/assets` 文件，不实施 C–E。
- **我定的细节（可改）：** 本局称呼统一由 `Match.bossName()` 解析；新增 `bossText()` 仅供原始台词在出口替换，排除“老板娘”，使用回调保留 `$&` 等输入，不递归替换新称呼。保留全局关卡/事件数据，默认称呼的事件文本和对象字段不变。大厅玩法弹窗打开时解析一次称呼，避免逐帧创建对局。
- **偏差说明：** 任务卡/计划估计 5 处；功能清单 §22 当前并未逐条列出这 5 处。以冻结源码逐处核对后，实际还包括收尾、结算、分享、教学、条件提示、介绍和玩法弹窗，全部属于 B 的称呼范围。原型不改；角色类别、场景/关卡固定名称不替换。

**改动文件与原因：**

| 文件 | 改动 |
|---|---|
| `cocos/assets/scripts/core/state.ts` | 画饼会议和急件群消息用本局称呼；既有发火/查岗占位符改用回调，按领导 type 选称呼，避免 `$&` 被当替换语法 |
| `cocos/assets/scripts/core/pots.ts` | 无来源天降锅、老板护短弹回飘字用本局称呼；经理来源和老板娘分支保持原文 |
| `cocos/assets/scripts/core/agents.ts` | 天降锅死因复盘用本局称呼 |
| `cocos/assets/scripts/core/schedule.ts` | 第 1 关收尾派活台词在输出时替换 |
| `cocos/assets/scripts/core/match.ts` | 统一原始台词替换；教学/条件提示出口替换称呼；吃饼、小舅子结算报告及传入分享的数据用本局称呼 |
| `cocos/assets/scripts/view/IntroView.ts` | 关卡描述、图解和基本视野规则显示自定义称呼，固定关卡名保留 |
| `cocos/assets/scripts/view/AppView.ts` | 大厅和对局中的玩法弹窗，boss 显示自定义称呼；经理/老板娘仍显示其类别名 |
| `cocos/assets/scripts/view/ResultView.ts` | 参与/不参与排名两种小舅子关系标签均显示“称呼 + 小舅子” |
| `cocos/assets/scripts/view/ShareView.ts` | 隐藏成就标题复用 core 已生成的称呼报告；人物素材不变，未做 C |
| `cocos/tools/check-peripheral.cjs` | 扩充真实 core 事件和页面绘字边界契约，覆盖默认、“王总”、“王老板$&”；新增断言先红后绿 |
| `cocos/tests/settlement.test.mjs` | 旧存档“张老板”夹具明确列出吃饼/小舅子两段新预期，并同时核对分享副本；其余字段、排名和存档继续严格对照原型，未使用全局文本归一化 |
| `implementation-notes.md` | 在现有 P4-2 下追加本项记录，保留 A 原记录 |

**逐处盘点（改了的）：**

| 冻结原型出处 | 本项处理 |
|---|---|
| `js/game.js:324` 画饼会议 | 群发人改称呼 |
| `js/game.js:138、334` 急件消息 | 事件原始数据保留，排时间表时替换 |
| `js/game.js:383` 无来源天降锅 | 默认派活人改称呼；有来源仍用来源领导的 name |
| `js/game.js:659` 老板护短 | 仅老板分支改称呼，老板娘独立分支保留 |
| `js/game.js:2434` 天降锅复盘 | 责任来源改称呼 |
| `js/game.js:1229` / `js/levels.js:149` 收尾派活 | 原台词输出时替换 |
| `js/game.js:2471–2472` 吃饼、小舅子报告 | 结算和分享数据同步用称呼 |
| `js/game.js:2473、2479` 排名标签 | 免排名/参与排名两条路径同步用称呼 |
| `js/game.js:2583` 分享隐藏成就标题 | 直接使用已生成的称呼报告，不二次替换 |
| `js/levels.js:147、161、164、242、310` 教学/条件提示 | 在 showHint 出口替换，不改关卡常量及台词标记 |
| `js/game.js:2725`、`js/levels.js:174、200、211、238、249、273、307` 介绍文案 | 基本规则、关卡描述/图解在显示时替换 |
| `js/game.js:2700` 玩法领导列表 | boss 用 bossName；经理和老板娘类别保持 |
| `js/game.js:342` 已有发火/查岗模板 | 已支持称呼，修正特殊替换字符的字面保留 |

**没改的 + 理由：**

- `LEADER_TYPES.boss.name = '老板'`、`wife.name = '老板娘'`：角色类别；不修改公共类型数据。
- `bossName()` 的默认值、名称编辑框的缺省内容、规则缓存初值：空称呼恢复“老板”的既有契约。
- 大厅“老板名称”、编辑框“给老板起个称呼”“留空恢复‘老板’”：功能说明/默认值说明，不是在称呼某位领导。
- `OFFICE.rooms/sources` 的“老板办公室”：固定场景名称；`LEVELS[3].name` 的“周四 · 老板画饼”、周五“老板娘查账”：固定关卡主题名，选关、介绍标题、下一关按钮沿用。
- 所有“老板娘”独立角色文案（护短、查账等）和“经理”：用户修改的是 boss 的称呼，不给其他角色改名。
- `EVENTS.p0.msg`、`LEVELS.desc/news/tips/tutorial/finale` 中原始“老板”字面量：保留冻结数据，在上表各消费出口已替换，不是仍会原样显示。
- 源码注释、变量/素材前缀、类型键：内部标识，不是可见称呼。已有 `leader.name` / `eye.name` 派活、被抓、追责和名牌本已使用正确名称，继续沿用。

**测试 / 检查（均从仓库根目录执行）：**

| 命令 / 检查 | 输出 |
|---|---|
| `node cocos/tools/check-peripheral.cjs`，首次新增断言，未修生产代码 | 退出 1：`群消息应使用称呼：【全员群】王总：大家停一下，开个三分钟短会。` |
| 同命令，补发火预告边界断言，未修模板回调 | 退出 1：`发火预告也应逐字保留自定义称呼`（“王老板$&”夹具） |
| `node cocos/tools/check-peripheral.cjs`，修复后 | 全部 PASS；称呼专项覆盖群消息、天降/护短/收尾飘字、复盘、免排名/参与排名标签、结算/分享、教学/条件提示、五关介绍、无对局大厅玩法弹窗；经理/老板娘/固定关卡名不变；A 的音效契约继续 PASS |
| `node tests/golden/verify.cjs --adapter cocos/tests/golden-adapter.cjs` | PASS 100/100，快照 + 事件 + 最终结果完全一致，空存档默认称呼逐字等同原型 |
| `npm run test:core --prefix cocos` | tests 14 / pass 14 / fail 0，含五关各 50 局模拟逐字段比较。曾因旧夹具仍期待“吃了老板”出现 13/14，已只更新上述明确文案预期 |
| `npm run check:types --prefix cocos` | 退出 0，无类型错误；仅 Node 执行 tsc，未启动编辑器 |
| `node cocos/tools/check-hud-layout.cjs` | PASS HUD 数字/矩形、四屏宽胶囊避让、横幅排版、toast 截止、只读 RNG |
| `node tests/check-port-protected.cjs` | PASS 416 个保护文件，无内容变化和目录增删 |
| `for file in js/*.js cocos/tools/check-peripheral.cjs; do node --check "$file" || exit; done` / `git diff --check` | 退出 0 |
| Python 内联只读 `.meta` 审计 + 开工前 SHA-256 对比 | PASS 125 个 meta：无缺失、孤立、星号 importer、重复 UUID，TS importer 正确；`cocos/assets` 240 个文件无增删，仅上述 9 个已有 TS 变化，meta/音频/图片/字体均未变 |
| `cocos/.venv/bin/python` 内联字体检查 | 修改脚本的字符串汉字集合无新增，四款 TTF 的本项固定台词汉字缺字 0。无需重裁冻结字体；任意自定义汉字继续走已有系统字体回退 |

**待刷新复拍 / 未验证：**

1. 编辑器刷新并确认最终源码已重编译后，大厅保存“王总”→五关介绍→玩法弹窗→开局，复拍短/长称呼、折行、名牌和设置存档回读；特别核对关卡固定主题名和“老板娘”未被改名。
2. 复拍画饼、急件、无来源天降锅、护短、周一收尾、教学/条件提示；失败触发天降锅复盘，结算核对吃饼报告和小舅子两种排名标签、隐藏成就分享预览。
3. 清空称呼恢复“老板”后复拍相同流程。Node 已验证字符串/事件及绘字边界，未验证最终 Cocos 字体栅格、长称呼布局、真实触控或微信真机；未使用 7456 旧预览作证据。

**发现但未改：**

- 上述角色类别、固定场景/关卡名称、名称设置说明按理由保留。
- 小舅子成就图 `tester_flat`、界面 emoji、隐藏调试面板留给 C/D/E；未更改 A 已完成音效逻辑。
- 原型里相同的称呼缺陷保持冻结；现有未提交 `AGENTS.md` 和 `.claude/` 保留。

**清理：** 本项只运行短时 Node/Python 检查，无浏览器、CUA、开发服务器或常驻助手；未触碰用户已有编辑器/服务。没有新增 `cocos/assets` 文件，没有构建、提交、推送。

### C · 小舅子成就分享卡使用本人躺平图

- **用户定的：** 只执行任务卡 C；先读任务卡及全部前置文件。保持 main，不运行 CocosCreator、不构建、不提交/推送，冻结原型，不新增 `cocos/assets` 文件。
- **我定的细节（可改）：** 仅将隐藏成就配图中的 `tester_flat` 换成已有 `nephew_flat`，保留原来的 contain 矩形、标题、文案及末关证书优先级。没有新增文字，无需重裁字体。
- **偏差：** 无。已确认 `atlas-data.ts` 的 `atlas/nephew` 登记 `nephew_flat: [0,696,230,116]`，对应 PNG 已在 `cocos/assets/resources/atlas/nephew.png`，切片在图集边界内。

**改动文件与原因：**

- `cocos/assets/scripts/view/ShareView.ts`：隐藏成就分享卡改用小舅子本人的躺平素材。
- `cocos/tools/check-peripheral.cjs`：检查图集登记、PNG 文件和切片边界；通过真实 core 加锅触发小舅子压垮，从 `ShareView.draw()` 到真实 `ScreenPaint.contain/image()`，在最终绘图边界核对素材。覆盖周三/周五、小舅子压垮/未压垮、到点/玩家压垮共 8 种组合；输赢成就卡用本人，普通战报与末关证书保持原分支。
- `implementation-notes.md`：在现有 P4-2 节追加 C，保留 A/B 记录。

**测试 / 检查（命令均从仓库根目录执行）：**

| 命令 / 检查 | 输出 |
|---|---|
| `node cocos/tools/check-peripheral.cjs`（先加断言，未修生产代码） | 退出 1：`小舅子隐藏成就分享卡必须绘制 nephew_flat`，实际为 `boss_chase + tester_flat`，期望为 `boss_chase + nephew_flat` |
| 同命令（替换素材后） | 退出 0；`PASS nephew_flat图集/PNG切片有效；小舅子压垮输赢卡绘制本人，普通战报及末关证书优先级不变`；A/B 及原有外围契约均 PASS |
| `node tests/golden/verify.cjs --adapter cocos/tests/golden-adapter.cjs` | PASS 100/100，快照、事件、最终结果完全一致 |
| `npm run test:core --prefix cocos` | tests 14 / pass 14 / fail 0，含五关各 50 局模拟统计逐字段比较 |
| `npm run check:types --prefix cocos` | 退出 0，无类型错误，仅 Node 执行 tsc |
| `node tests/check-port-protected.cjs` | PASS 416 个保护文件，内容变化 0，保护目录无增删 |
| `for file in js/*.js cocos/tools/check-peripheral.cjs; do node --check "$file" || exit; done` | 退出 0 |
| Python 内联只读 `.meta` 审计 + 开工前 SHA-256 对比 | PASS 125 个 meta，无缺失/孤立/星号 importer/重复 UUID，TS importer 正确；240 个资产文件无增删，仅 `ShareView.ts` 变化，core/meta/图集/音频/字体字节未变 |

**待刷新复拍：**

1. 确认编辑器已刷新最终源码后，压垮小舅子并分别进入胜/负结算 → 分享预览，复拍躺平人物的大金链子、墨绿上衣及完整显示效果。
2. 未压垮时复拍普通输赢卡；末关通关且压垮小舅子时仍应显示证书。Node 绘图契约不等于 Cocos 栅格截图或微信真机验收，本项未使用 7456 旧预览作证明。

**发现但未改：**

- 冻结原型 `js/game.js` 的同一成就卡仍引用 `tester_flat`，按本卡冻结要求保留。
- 界面 emoji 和隐藏调试面板留给 D/E；真实微信分享接口留给 P5。
- 开工前已有的 `AGENTS.md`、`.claude/rules/`、`.claude/skills/` 保留，未触碰。

**清理：** 未创建浏览器、CUA、预览服务器或常驻助手，未操作用户编辑器及已有服务；本项仅运行 Node/Python 检查。


### D · emoji 换像素图标

- **用户定的：** 只执行任务卡 D；先读任务卡、AGENTS.md、DESIGN.md、计划 §9、功能清单 §19/§22、P4-1 记录及 `cocos/assets/scripts/`。保持 main，不运行 CocosCreator、不构建、不提交/推送；原型冻结，core 事件文本不改，不新建 `cocos/assets` 文件，不出新图。
- **我定的细节（可改）：** 现成图集按下表复用；奶茶和播放三角暂用纯文字。最终 Label 之前去掉 emoji、变体选择符、ZWJ、旗帜/肤色、键帽附记、字符星星和播放三角；只处理显示副本，不改原始称呼/存档/core 事件。宽度和换行使用同一副本，避免去图标后留空位。输入框自建 Label 的 string setter 也做过滤（3.8.8 的 EditBox 会先写 Label 再发文字事件，因此不能只等 TEXT_CHANGED）。
- **偏差：** 无新增图片或资产；按卡片允许的纯文字排版降级处理没有合适图标的场景。Node 检查只证明源码/排版/节点赋值契约，不代表刷新后的 Cocos 栅格截图或真机效果。

**先行盘点与替换（原型行号以本轮冻结源码为准）：**

| Cocos 出现位置 | 原型出处 | 原来的字符 / 当前处理 |
|---|---|---|
| `MessageView.draw` 的下午茶群消息 | `js/game.js:137` EVENTS.tea | 🧋：渲染副本去掉末尾图标和空格，保留“下午茶到了，茶水间自取”；core 原文与收到的 message 不改 |
| `WorldPainter.draw` 茶水间高亮标签 | `js/game.js:2106` | 🧋 下午茶：纯文字“下午茶”，保留绿字和茶水间高亮 |
| `WorldPainter.drawDueTag` 头顶最急锅倒计时 | `js/game.js:1829` | ⏰N：`ui_clock` Sprite + 独立数字 Label，数字的黄/红告警语义不变 |
| `WorldPainter.draw` 屏外急件持有者 | `js/game.js:2260` | 🔥：完整 `wok` 图集锅图，保留红色圆圈和指向箭头，与局内急件共用锅图素材 |
| `SpriteTools.edgeHint` 字符分支 / 缺图兜底 | `js/engine.js:275` | 原型的 ❓ 兜底：Cocos 原有字符串分支仅用于 🔥，本轮删除字符入口；未知精灵复用 `ui_warning`，不调用 emoji 字体 |
| `AppView.modal('rules')` 截止时间 | `js/game.js:2702` | ⏰：`ui_clock` |
| 同上，摇杆与甩锅 | `js/game.js:2703` | 🕹️：`ui_wok` |
| 同上，领导视野 | `js/game.js:2704` | 👀：`ui_warning` |
| 同上，18:00 总账 | `js/game.js:2705` | 🧾：`ui_book` |
| 同上，天降锅 | `js/game.js:2709` | ☄️：`wok_flying` |
| 同上，反甩与急件 | `js/game.js:2710` | 🛡️：`fx_impact`（沿用反甩命中的反馈素材） |
| 同上，12 口压垮 | `js/game.js:2711` | 💥：`ui_warning` |
| `IntroView.draw` 关卡页签与最好成绩行 | `js/game.js:2745/2762` | ★：按实际星数绘制 `ui_star`，前后文字按图集比例一起居中 |
| 大厅 / 结算 / 普通分享卡星级 | 大厅日历、`js/game.js:2485` 结算星级等 | 已经用 `ui_star` / `ui_star_empty`，保留；原型 alt 的 ★☆ 不会传到 Cocos Label |
| `IntroView.draw` 开始按钮 | `js/game.js:2764` | ▶：纯文字“开始上班”，按钮命中框/动作不变 |
| `ScreenPaint.button` 广告前缀 | `css/style.css:63/665` | ▶ 广告 ·：纯文字“广告 · ”，保留广告标识及红色前缀 |
| `core/config.ts` 领导类别 emoji 字段 | `js/game.js:129/131` | 🤵 / 👔：没有显示调用，保持 core 原始字段；画面领导本来就用像素人物 |
| 自定义称呼带入名牌、群消息、教学、飘字、分享、名称输入 Label | 原型称呼编辑允许 Unicode（`cleanBossName`） | 对显示副本过滤；如“王总🧋”显示“王总”，原始输入与存档值不变 |

**改动文件与原因：**

| 文件 | 变更 |
|---|---|
| `cocos/assets/scripts/view/AppView.ts` | 玩法列表从 emoji 前缀改为图集 icon/text；自建 EditBox Label 接入过滤 |
| `cocos/assets/scripts/view/WorldPainter.ts` | 头顶像素闹钟、纯文字下午茶、屏外急件锅图 |
| `cocos/assets/scripts/view/SpriteTools.ts` | 移除边缘提示字符串图标入口，缺图复用像素警告图 |
| `cocos/assets/scripts/view/IntroView.ts` | 页签/最好成绩字符星改 Sprite，开始按钮移除三角 |
| `cocos/assets/scripts/view/ScreenPaint.ts` | 广告前缀移除三角；星级绘制支持仅画已获星数（原默认三槽不变） |
| `cocos/assets/scripts/view/ui-data.ts` | 统一显示字符过滤规则，字体裁剪复用 |
| `cocos/assets/scripts/view/DrawSurface.ts` | 最终 Label 写入与世界测宽先过滤，再判断字体回退；提供输入 Label 的过滤边界 |
| `cocos/assets/scripts/view/UiPaint.ts` | 测宽、换行、文字渲染统一使用纯文本显示副本 |
| `cocos/assets/scripts/view/MessageView.ts` | 群消息在解析标题、测宽和换行前移除 emoji，不修改原始 message |
| `cocos/tools/subset-fonts.py` | 不再补入 emoji，读取画面层同一正则过滤全部字体输入；本项字体报告写入 `port/tmp/p4-2-d/fonts.json` |
| `cocos/assets/resources/{title,body-400,body-700,body-900}.ttf` | 重裁四份已有字体；总计 1,184,212 B，比本轮开始增加 5,512 B（现有“全文源码含注释”采字策略带来的新增说明用字），cmap 图标字符为 0，源码汉字缺字 0 |
| `cocos/assets/scripts/view/ui-metrics.ts`、`visual-data.ts` | 重生成四字体字宽与世界标题字宽；保留字符字宽逐项不变，HEADS 完全不变 |
| `cocos/tools/check-label-icons.cjs` | 新增 Node 检查，真实页面/排版/DrawSurface 在最终 Label setter 处拒绝 emoji，另扫描全部 view 字符串/模板片段、实际 TTF cmap、图集 PNG 切片；没有新增 Cocos 资产文件 |
| `implementation-notes.md` | 在既有 P4-2 节追加本项，保留 A/B/C 及 P4-1 记录 |

**测试 / 检查（命令均从仓库根目录执行）：**

| 命令 / 检查 | 输出 |
|---|---|
| `node cocos/tools/check-label-icons.cjs`（先加检查，未修生产代码） | 退出 1：`最终Label仍含图标字符：下午茶到了，茶水间自取 🧋`，确认检查抓住旧问题 |
| 同命令（修复并重裁字体后） | 退出 0；30 组（五关 × 三屏 × 两种称呼）真实页面/世界绘制；最终 Label 赋值扫描 5,885 次，图标字符 0；加载卡、输入框首次/复用、群消息/教学/toast/飘字/HUD/倒计时均覆盖；四 TTF 实际 cmap 图标字符 0；view 源码固定字符串/模板片段无 emoji |
| `node cocos/tools/check-peripheral.cjs` | 全部 PASS；A/B/C 音效、称呼、分享图及旧存档/广告/声音/教学/大厅契约不回退 |
| `node cocos/tools/check-hud-layout.cjs` | PASS 等宽数字、6 个矩形、四屏宽胶囊避让、横幅/toast、只读 RNG |
| `npm run test:core --prefix cocos` | tests 14 / pass 14 / fail 0，含五关各 50 局统计逐字段比较 |
| `npm run test:golden --prefix cocos` | PASS 100/100，快照 + 事件 + 最终结果完全一致（空存档、默认“老板”） |
| `npm run check:types --prefix cocos` | 退出 0，无类型错误；仅 Node 运行 tsc，没有启动 CocosCreator |
| `node tests/check-port-protected.cjs` | PASS 416 个保护文件，内容变化 0，保护目录无增删 |
| `npm run fonts:subset --prefix cocos` | 四份字体 `missingChinese` 均为空；只重写已有 TTF |
| `cocos/.venv/bin/python cocos/tools/ui-metrics.py`、`cocos/.venv/bin/python cocos/tools/world-metrics.py` | 字宽 1224 / 1227 / 1227 / 1227，头像 225；与 HEAD 对比保留字宽无变化、HEADS 不变 |
| Python 内联只读 `.meta` 审计 + `/tmp/shuaiguo-p4-2-d-before.json` 开工前 SHA-256 对比 | PASS 240 个资产文件无增删；125 个 meta 字节不变、无缺失/孤立/星号 importer/重复 UUID（含 subMetas），TS importer 正确；core、图片、图集、音频均无字节变化 |
| `for file in js/*.js cocos/tools/check-label-icons.cjs; do node --check "$file" || exit; done`、`git diff --check` | 退出 0 |

**待刷新复拍：**

1. 明天刷新脚本及四份字体后，375×812 / 375×667 / 360×780 复拍大厅 → 关卡介绍 → 开局 → 暂停/结算 → 大厅，确认字体加载/控制台与原有交互。
2. 群消息下午茶末尾没有 emoji、空行或残留占位；茶水间纯文字与高亮；头顶闹钟数字在 9/5/2 秒时不重叠。
3. 屏外急件的红圈锅图、正常领导/同事头像和饼提示、缺图警告；四项基本玩法及后三项高级玩法的图标尺寸、正文换行、滚动与按钮。
4. 介绍页 1/2/3 星、未通关及旧存档最好成绩行，开始按钮/广告前缀；大厅/结算/分享的原有实星空星仍正常。
5. 默认/“王总”及带 emoji 的称呼，在名牌、消息、结算分享、名称输入框的首次打开/复用/输入期间没有系统 emoji Label。输入框过滤采用当前 3.8.8 accessor 契约，需在刷新后的引擎与微信真机核验；系统键盘自身的候选/原生输入区域不属于 Cocos Label 扫描。

**发现但未改 / 建议补画：**

- 建议补画独立奶茶图标；可选补画摇杆、视野眼睛、账单、反甩护盾、播放按钮专用小图标。目前按上表复用或用纯文字，等待泊舟决定风格后走既定出图流程，本项没有生图。
- core 保留 `EVENTS.tea.msg` 的 🧋 和未使用的领导 🤵/👔；冻结原型继续保留全部原 emoji/字符星。保留不是遗漏：黄金录像事件文本必须逐字一致。
- 介绍底板自带的像素图形、已有 Sprite 星星、Graphics 箭头/闪光本来不是字体 emoji，保持不变。
- 隐藏调试面板 E、真实微信接口 P5、其他 A/B/C 事项不在本轮变更范围。原有 `AGENTS.md` 和 `.claude/rules/`、`.claude/skills/` 工作内容未触碰。

**清理：** 本轮只运行已结束的 Node/Python 命令；没有创建浏览器、CUA、预览服务器、常驻助手，未运行/操作用户 CocosCreator 或已有预览服务；未提交、推送、部署。

---

### E · 隐藏调试面板

- **用户定的：** 只执行任务卡 E；先读任务卡及指定前置文件。保持 main，原型冻结，不运行/操作 CocosCreator、不构建、不提交/推送；不新增 `cocos/assets` 文件，不改 A–D 功能。
- **我定的细节（可改）：** 工牌使用单调真实时间的滑动窗口，1.5 秒内最近 5 次有效点击打开；离开大厅、打开其他面板、切后台重置。开关在 App 启动时只读一次，微信不逐帧调用同步接口。面板选关从 1 起显示，传给 core 的下标从 0 起；直接开局按原 `?level` 语义解锁所选关。auto 与强制带教互斥，强制带教自动选有教学的第 1 关。种子允许空值或 uint32（含 0）；模拟默认 20 局、可输入 1–200 局。清档只删除 `shuaiguo_v3`（进度/称呼/带教/成就），保留声音设置。
- **实现边界 / 偏差：** 面板状态和绘制暂放已有 `LobbyView.ts`，动作和延迟模拟任务放已有 `AppView.ts`，避免新脚本今晚无法导入，之后可拆。模拟复用独立 `Match.simulate`，不会清掉活动对局横幅或消费其 RNG；32ms 后执行，先显示忙碌态，重复点击不重复排队，关闭/销毁取消尚未开始的任务。核心模拟本身仍为同步，200 局时的真机响应速度未验证。版本显示源码版本 `0.4.2-e`；当前构建链没有应用构建时间注入，且本轮禁止构建，因此时间字段如实显示“尚未构建”，没有把本机运行时间冒充构建时间。

**改动文件与原因：**

| 文件 | 改动 |
|---|---|
| `cocos/assets/scripts/platform/Platform.ts` | 补 `debugEnabled` / 指定键 `removeStorage` 平台边界 |
| `cocos/assets/scripts/platform/WebPlatform.ts` | 仅 `?debug=1` 开启；清档使用 `localStorage.removeItem`，不调用全局 clear |
| `cocos/assets/scripts/platform/WechatPlatform.ts` | 环境判断在平台层调用 `wx.getAccountInfoSync`，只放行 develop/trial；release、未知、接口缺失/异常关闭；清档按键调用 `wx.removeStorageSync`，不可用明确报失败 |
| `cocos/assets/scripts/view/AppView.ts` | 工牌动作、debug 面板/数字输入/清档确认、直接开局、模拟摘要与取消清理；旧 URL 参数和 `SG_DEBUG` 同样受 debug 开关约束；复用原生单行 EditBox 与 Mask 滚动 |
| `cocos/assets/scripts/view/LobbyView.ts` | debug 开启才登记工牌命中框；隐藏入口计数和面板绘制，开关沿用黄/灰胶囊样式，忙碌模拟按钮灰色不可点 |
| `cocos/assets/scripts/view/PlayerStore.ts` | 删除本游戏进度键，返回成功/失败，保留设置 |
| `cocos/assets/scripts/view/WorldView.ts` | 无 App 组织器的旧独立预览入口也要求 debug 才解析参数，避免旁路 |
| `cocos/assets/scripts/view/ui-data.ts` | 调试手势/局数边界数据、源码版本与未构建状态 |
| `cocos/tools/check-debug-panel.cjs` | 新增 Node 契约；内存转译，运行真实 App 动作、WorldView/Match 构造、存档与页面排版，只替换设备节点/资源初始化 |
| `implementation-notes.md` | 在同一 P4-2 节追加 E，保留前四项记录 |

**测试 / 检查（均从仓库根目录执行）：**

| 命令 / 检查 | 输出 |
|---|---|
| `node cocos/tools/check-debug-panel.cjs`（先加测试、未实现） | 退出 1：`TypeError: web.debugEnabled is not a function`，确认测试抓住缺少门禁的初态 |
| 同命令（完成后） | 9 组 PASS：平台门禁、真实 App 初始化禁参/禁全局、真实工牌 down/up 的 4/5 次与 1.5 秒边界/超时/后台重置、第五关直接开局与 seed1001 初态、auto/已完成带教互斥、数字校验、真实 simulate 逐字段一致与存档/活动局/RNG隔离、二次清档/取消/失败、关闭及销毁取消任务、三屏排版 |
| `node tests/golden/verify.cjs --adapter cocos/tests/golden-adapter.cjs` | PASS 100/100，快照 + 事件 + 最终结果完全一致（空存档、默认称呼） |
| `npm run test:core --prefix cocos` | tests 14 / pass 14 / fail 0；五关各 50 局统计逐字段一致 |
| `npm run check:types --prefix cocos` | 退出 0，无类型错误；只执行 Node tsc，不启动编辑器 |
| `node cocos/tools/check-peripheral.cjs` | 全部 PASS，A–C 与旧存档/广告/声音/教学/大厅契约不回退 |
| `node cocos/tools/check-hud-layout.cjs` | PASS HUD 数字/矩形、四屏宽胶囊避让、横幅/toast、只读 RNG |
| `node cocos/tools/check-label-icons.cjs` | PASS 30 组既有画面、最终 Label 5885 次图标字符 0；全部 view 固定字符串/模板与实际四 TTF cmap 图标字符 0 |
| `node tests/check-port-protected.cjs` | PASS 416 个保护文件，内容变化 0，保护目录无增删 |
| `for file in js/*.js cocos/tools/check-debug-panel.cjs; do node --check "$file" || exit; done`、`git diff --check` | 退出 0 |
| Python 内联只读 `.meta` 审计 + `/tmp/shuaiguo-p4-2-e-before.json` SHA-256 对比 | PASS 240 个资产文件无增删；125 个 meta 字节不变，无缺失/孤立/星号 importer/重复 UUID（含 subMetas），TS importer 正确；仅上表 8 个现有 TS 变化，core/图片/图集/字体/音频未变 |
| TypeScript AST 提取本项 view 字符串/模板片段 + 四 TTF cmap 核对 | 本项 254 个固定文案汉字均已覆盖，四字体缺字 0；新增缺字只出现在平台/源码注释，实际界面不新增字形，无需重裁冻结的原型字体 |

**待刷新复拍：**

1. 刷新并确认末次代码已编译后，375×812 / 375×667 / 360×780：大厅 → 工牌 1.5 秒五连点 → 面板；无 `debug=1` 时重复同样动作没有入口，旧 `level/auto/tut/seed` 参数及 `SG_DEBUG` 不生效。
2. 五关直接开局，auto 开/关，已完成带教后的强制带教，种子留空/0/1001；核对暂停、结算、回大厅，控制台无错误。种子/局数首次及复用 EditBox、系统键盘、输入校验、卡片滚动/横竖屏重排和字体需实际复拍。
3. 模拟 1/20/200 局摘要、忙碌态、关闭取消及长摘要滚动；Node 逐字段证明不写存档，不代表手机同步模拟耗时已验收。
4. 清档取消保持原数据，确认后进度/称呼/带教/成就清空、声音设置保留，刷新页面后回读；存储禁用时应显示失败。
5. 微信开发/体验/正式环境真机复验门禁（正式版完全不可达）、原生输入和清档 API；本轮只在平台接口边界模拟了真实 API 返回值，不称已完成微信验收。

**发现但未改：**

- 应用构建时间尚无产物元数据来源；字段现显示“尚未构建”，后续构建链需注入真实时间。源码版本号可改，不使用 Creator 的 3.8.8 冒充游戏版本。
- 微信已有 `getStorage/setStorage`、安全区、广告/分享等仍为 P5 空壳；本轮只补本项要求的环境判断和按键删除，没有扩做完整平台适配。
- 旧预览验收脚本里的 `?level/auto/freeze` 等现在需要一起附加 `debug=1`；未修改这些历史脚本，也未用 7456 旧代码作为本项通过证据。
- A–D 功能、冻结原型/core，以及开工前 `AGENTS.md`、`.claude/rules/`、`.claude/skills/` 的内容保持原状。

**清理：** 本轮 Node/Python 检查均已结束；没有创建浏览器、CUA、预览服务器或长驻助手，没有操作用户已有编辑器/服务。新增文件仅为 `cocos/tools/` 的 Node 契约，资产目录没有新增文件。未构建、提交、推送。

---

## 2026-11-04 · P4-1 外围界面与声音（无人值守续做收尾，最终源码待刷新复验）

- **用户定的：** 按任务卡末尾裁定继续：先采当前新预览的完整基线，再只改已有cocos/assets文件；7456未重编译也继续做Node检查并交付。保持main，不运行/操作CocosCreator、不构建、不改原型/core、不提交/推送/部署，不新增资产文件。
- **我定的细节（可改）：** 沿用AppView与六个页面view；校准大厅三屏DOM几何/图标/动势、日期与介绍Mask、结算70px黄数字/同行星级/复盘、分享叠层/证书文字、九格贴纸闪光、像素加载卡；EditBox先配单行再激活、微任务全选/缓存复用、首帧测量重排；未知名字系统字体回退；网页采样/BGM合成兜底、浮层插入顺序、模拟表现事件隔离。
- **已在刷新后的P4-1初稿上验收：** 30组并排图；五关大厅→介绍→开局→暂停→继续→结算→大厅，seed1001下最终状态/RNG/存档和声音调用一致；旧存档含无debt/成就/名称兼容，老板名“王掌柜”进新对局；设置即存及刷新保留；复活/顶包/增益，教学/急件补测音效。最终截图/存档设置/补充音效运行均零报错。初稿取消按钮click/uiBack差1，源码已修。
- **末次源码已验证：** core14/14、黄金100/100、严格类型、416保护文件无变化、125meta无缺失/星号/重复、四字体源码汉字缺字0；采样兜底先红后绿，存档/假广告1950ms/微信广告失败/两总线/50ms/双响倍速/BGM续播从头后台/教学末步不重建/三屏大厅矩形<0.1px/胶囊契约通过；语法和diff检查通过。
- **待刷新复验：** 新鲜度证明7456仍是本轮修复前初稿，以上末次源码不能称已在浏览器通过；全部30图及完整交互/声音需明天刷新后复跑。旧预览曾有EditBox快速销毁触发引擎延迟scrollIntoView错误，正常收键盘后的最终基线通过；缓存修复尚未实测。任意称呼字体、分享各变体、实际音频听感、真机均未验证。
- **偏差 / 发现但未改：** 冻结原型375px带教仍二行，Cocos按卡片要求单行，约30px横幅差异保留说明；微信AudioSource无公开rate，非网页倍速尚未等价；完整单张PNG后备未导入，需新增资产而今晚禁止。P4-2和P5真实接口原边界保留，不把未完成实现写成通过。
- **资源 / 交付：** 音频原字节2,077,176B；四字体1,178,700B；已有构建主包2,141,657B、resources分包3,237,100B、audio分包2,085,220B，只读旧包，不是末次源码构建证明。完整九项报告、逐项状态、38音效计数、截图差异和明日清单在`port/tmp/p4-1/report.md`。
- **清理：** Playwright finally关闭、临时8765停止，无CUA；保留用户编辑器28816/7456和原有未提交内容，详见cleanup.json。

---

## 2026-11-04 · P3-2 HUD、群消息、带教与收尾（裁定 3 续做，等待资源刷新后完成最终复验）

- **用户定的：** 按任务卡裁定2/3完成对局覆盖层，复用现有7456，不运行CocosCreator、不构建、不改core/原型、不提交/推送/部署；Computer Use只准现有项目切前台和资源管理器刷新，用完即断开。正式面板/声音P4，真实微信避让P5。
- **我定的细节（可改）：** UiPaint/HudView/MessageView/TutorialView/ClosingView/MatchUi代码节点，TTF字宽、Label池；顶部避让接口、capsule=1的44px边界/87×32可见红框。数字用最宽占位，修正跳过按钮错误图标预留（窄14/宽13），排版新增先红后绿证明。验收修正画布键盘焦点、开始/跳过后的原型DOM刷新、有限次CSS动画冻结相位。
- **已验证：** core14/14、黄金100/100、类型、416受保护文件不变、66meta无星号/缺失/重复、等宽/四屏宽避让/横幅/toast/RNG及跳过按钮排版契约通过；四字体汉字缺字0，合计1,139,044B，比P3-1增加354,520B，无新PNG。41组并排图覆盖五关/带教7步/跳过/四增益与到期消耗/保护提示/精确10、5、2秒/铃声/胜负/窄屏/胶囊；最终版本取证状态见完整报告开头。
- **交互：** 实际触控走七步，tap/Enter/Space开始、tutDone和统计清零；空/完成存档与强制教学；跳过、暂停双时钟、收尾禁用与后台引擎事件、占位结算重开；已跑通版本console.error/pageerror均0。保护测试先前未聚焦Canvas产生空toast，已修验收脚本并用真实J键复验，未改玩法。
- **差异 / 后续：** 等宽占位可能多折一行；Noto400与系统sans、Label/DOM栅格/描边/基线、原生按钮焦点框与黄光等逐图说明；不宣称逐像素一致。P4/P5按卡片边界保留。完整8项交付与逐项45状态、命令/日志在port/tmp/p3-2/report.md。
- **编辑器 / 清理：** CUA绑定旧启动警告窗口，未点退出/重启/其他设置，已立即断开；现有项目PID28816/7456未退出，按钮修正需资源刷新后的新鲜度门槛。任务浏览器finally退出，本任务8765交付前关闭，最终状态见cleanup.json，保留用户其他进程和工作。

---

## 2026-11-03 · P3-1 对局世界画面与操作（已完成裁定 2）

- **用户定的：** 原整卡按上一条裁定完成；本轮仅执行裁定2去掉单图后备；Boot直接开普通一局，只做世界、操作、主循环。沿用现有Cocos编辑器与7456，不运行CocosCreator、不构建、不改原型/core玩法、不做P3-2/P4覆盖层，不提交/推送/部署。保护脚本只冻结原型与已入库录像/清单，core以黄金录像保护。
- **我定的细节（可改）：** Graphics/Sprite/Label/Mask门面沿用原型绘制顺序；地板/墙/家具静态节点，相机移根，动态节点池与屏外剔除。表现随机、walk、飘字、震屏在view。TTF池仅在内容/字号变化时改字，数字ceil秒，不增加BMFont。14图集+fx；裁定2删除65张重复PNG（595,114 B）、65份meta和目录meta，删补载代码及FALLBACK表。图集失败console.error；缺走路帧退图集内_normal、缺爆炸退撞击星。导入工具不再生成单图后备，审计断言目录和meta不存在。逐源图片缓存裁片，修复运行时空UUID造成头像串图。
- **字体与标题取证：** 三份静态TTF：快乐体400（190,376 B）、思源700 Bold（297,232 B）、900 Black（296,916 B）；修正旧Thin名称。源码全部对局中文cmap缺字0。旧P1五字标题与冻结原型WOFF2栅格逐像素一致，先前“看起来没生效”未复现为实际回退；真正覆盖缺陷是旧子集仅8字，新增“会议室 老板 急件”回退，现已扩全且栅格与原型一致。证据font-reference-proof.json/png。
- **行为对齐：** dt=min(.033,真实间隔)，update后仅按原型“有锅且未压垮”条件调用frameAim，再绘制，避免空手额外清掉旧目标。后台清输入、保持暂停，恢复首帧不跳；触摸/P/Esc继续。窗口重排更新视口与相机。缺步帧/爆炸降级、图集失败报错且不请求单图、纯render不改玩法快照/随机流、实际15纹理NEAREST、DPR3→2、正式禁参条件分支通过。DESIGN.md只同步已定的≥8口冒汗阈值。
- **偏差和差异：** 原型普通世界Sprite默认平滑，Cocos按卡片强制最近邻，边缘更硬；Graphics/Label/Mask栅格/描边/基线存在小像素差，震屏由独立表现随机产生偏移；25张图逐条说明。周四seed1001在114.35s自然压垮，“快结束”如实显示终局，未续命。性能另用真实rAF每帧1/60共同负载，让两版都经历完整120s；正常主循环未改固定步长，首轮可变dt的不同早死结果也保留。
- **已验证：** 裁定2本轮重跑core14/14、类型、旧TS黄金录像100/100、保护检查与58份meta审计全部通过；缺步帧/爆炸后备保留，图集失败逐条报错且不请求单图。周一/周五auto正常可变dt主循环各跑到70s/120s的time/over（4286/7283步），console.error/pageerror为0；周五60s中段前后截图差异像素0，玩法状态与修改前及原型完全一致，新增并排图ruling2-level-4-middle-pair.png。强化后的检查在旧代码上按预期失败，刷新既有编辑器后通过。以下为保留的原整卡证据：core14/14、类型通过、旧TS黄金录像100/100；保护416文件内容不变；58个meta含subMetas无importer="*"（裁定2删除66份）。15基本+10专项并排图，15组自然图核心状态精确一致；五关auto均到over，手动双指+甩锅整局到70s，键盘/输入框/暂停/后台事件/重排通过，浏览器console/pageerror 0。周五共同负载两边7288帧，平均16.666ms、最差1%16.800ms；Cocos update均0.061ms、draw均0.820ms；CPU热点和原型对照见报告。语法、diff空白和更新后的check:preview通过。
- **编辑器导入：** 裁定2仅在既有编辑器控制台调用refresh-asset刷新db://assets，确认RULING2_ASSET_REFRESH_DONE，关闭本次打开的开发者工具并释放CUA。以下为原整卡导入记录：未启动第二进程；重新导入资源曾遇旧body.ttf缓存ENOENT，通过既有编辑器消息列表核对refresh-asset接口，在其控制台刷新db://assets，导入新增图、清掉过期记录并完成编译。没有清空用户历史日志。只刷新预览不足以确保外部文件变更已导入。
- **未验证 / 后续：** 安卓/微信真机操作、系统真实后台、正式包禁参及包体/分包、手机满帧待泊舟验收；P3-2/P4的HUD、群消息、带教覆盖层、下班浮层、贴纸、外围界面和音频不在本卡。桌面rAF结果不作为手机性能证明。完整8项报告、逐项功能状态、原25张图及裁定2周五中段复验图、可复现命令在`port/tmp/p3-1/report.md`。
- **清理：** 本轮浏览器通过finally退出；原型8765服务关闭并核对无监听，CUA连接释放；保留用户原有编辑器/7456及全部其他未提交工作。未提交、未推送、未部署。

---

## 2026-11-03 · P2-2 补齐录像外逻辑验证

- **用户定的：** 按 `port/tasks/P2-2-补齐录像外的逻辑验证.md` 执行，读取任务卡、AGENTS、移植计划要求章节、P2-1 卡、上一节记录、黄金录像工具、适配器和 core 全部源码。原型和旧 100 组录像冻结，只补 core / 测试 / 本节；保持 main，不运行 CocosCreator，不碰 view / platform / 场景 / 素材，不提交、不推送、不部署。
- **我定的细节（可改）：** 新录像独立存 `tests/golden/input/`、`tutorial/`、`buffs/`、`ads/`，清单为 `extra-manifest.json`。按末尾裁定，新录像 gzip 仅在本地缓存并由 `.gitignore` 排除，只入库脚本和清单；清单新增完整录像的 SHA-256（对象键排序的规范 JSON，保留数组顺序和原始浮点），录制与自动重建均先核对哈希，绝不重写基准。每帧存完整玩法状态 SHA256（包含蛇身轨迹、全部角色、目标、锅、日程、教学定时器剩余时间和随机流），每 30 帧及终局另存完整检查点；浮点仍按 P0 的四位小数。教学回调仅保存占位标记，不在取快照时执行。表扬、特效和飞锅弧线继续按 P0 的表现边界排除。
- **输入与按钮：** 输入随机流用独立 LCG，由输入种子初始化，不消费玩法 RNG；包含追近同事、随机转向、0 / 0.15 / 0.34 / 0.35 / 0.7 / 1 的力度、松手、窗口内按弹和同帧多按。原型自验重新生成主输入，TS 重放保存的实际输入。无瞄准对照重放完全相同的输入，共同输入结束后松手。七步教学只靠摇杆、甩锅和真实“开始上班”按钮回调完成；跳过走真实 `btnSkip` 回调。
- **接口补齐：** `Match.frameAim()` 明确要求每帧 update 后调用；`revive()` / `rescue()` 对应原型广告成功回调，平台层以后在广告成功时调用；`shareOutcome()` 返回隐藏成就 / 证书判断；`calculateResult` 增加广告资格和周五彩蛋；`simulate.ts` 忠实搬运 SG_DEBUG.simulate（固定种子和异常都恢复 RNG / 活动对局，无种子继续消费流）。`Engine.fxRand` 不消耗玩法流，`muted` 对应模拟标志。新增 TS 的 meta 按已有 schema 生成，未启动编辑器导入。
- **偏差 / 测试适配：** 无玩法、数值或旧录像比对规则偏差。结算 oracle 只在 harness 的内存源码里读取真实 finish 局部变量，没有重写原型公式。周四 / 周五里的 HTML 包含判断分别映射到纯计算返回的吃饼文案、彩蛋、广告资格和证书名称，原有规则断言保留；画面本身留给 P3 / P4。广告夹具通过真实加锅触发压垮，顶包先构造明确落榜的终局；广告等待由 fakeAd 立即回调替代。周三晚复活 / 顶包改选种子 5002，避免 5001 在 104.9167 秒自然压垮而未到目标时刻，其余广告样本用 5001。
- **已验证：** 原型和 TS 各通过旧 100/100；按末尾裁定删除全部 177 个本地新录像后，TS 验证器自动从原型重建 177/177 个并全部核对完整 SHA-256，逐帧比对 PASS 177/177；原 100 组终局和全部新录像的结算 / 存档一致；五关各 50 局、种子 6011 的统计未使用误差容忍，全部字段完全一致。core 测试 14/14，含搬来的周四 10 个场景、周五、随机契约、40 组存档兼容夹具、复盘平分、隐藏成就、早晚广告、18:00 截断、后台冻结和教学确认锁定。类型、JS / CJS / MJS 语法及 diff 空白检查通过；16 个 core meta importer 正确且 UUID 无重复。受保护 433 个文件开工前后 SHA256 变化 0；相对 HEAD 的逐文件内容哈希也全部相同，保护目录无增删。
- **未验证：** Cocos 编辑器 / 构建 / 网页画面 / 微信包 / 真机 / 真实广告服务均未运行；本卡验证的是 Node 中的纯逻辑、输入和广告成功回调。没有创建浏览器、CUA、开发服务器或长驻测试助手。

**新增录像数量与体积（只计 gzip，不计清单和工具）：**

| 覆盖 | 组数 | 压缩体积 | 逐帧记录数 |
|---|---:|---:|---:|
| 手动输入 | 50 | 50,469,958 B（48.13 MiB） | 285,151 |
| 同输入、不额外调用帧末瞄准 | 50 | 49,780,555 B（47.47 MiB） | 272,182 |
| 七步带教 / 跳过带教 | 2 | 704,654 B（0.67 MiB） | 9,525 |
| 4 种增益 × 5 关 × 3 种子 | 60 | 57,570,744 B（54.90 MiB） | 371,769 |
| 5 关的早复活 / 晚复活 / 顶包 | 15 | 19,831,279 B（18.91 MiB） | 101,844 |

共 **177 组、178,357,190 字节（170.09 MiB）、1,040,471 帧**。保留逐帧摘要及完整检查点，所以本轮录像体积较大。手动 50 组为 0–4 关 × 2001–2010；增益种子 4001–4003；带教 3001 / 3002。

手动玩家：按键 12,066 次，甩出 3,415 次，甩中 1,330 次，反甩 564 次，被抓现行 586 次，按空 7,501 次；冷却期间输入 3,243 次，轻推 172,577 帧、松手 13,200 帧、最短角差超过 2 弧度的急转输入 2,006 帧。按空次数由互斥的四个 pressFire 分支计算：总按键 − 甩出 − 被抓 − 反甩；另直接记录触发 WHIFF_LOCK 的 4,456 帧。完整教学经历 walk / sky / throw / expire / sight / dodge / rank 后正式开局，跳过路径也保存 tutDone。15 组免死金牌录像中，5 组实际消耗了金牌。

**每帧瞄准对照：** 50 对全部改变玩法状态，其中 20 对连结算结果都改变。周一（关卡 0）种子 2001 第 49 帧（0.8167 秒）首先分叉，首个不同的完整检查点为第 60 帧，字段 `agents[0].aimTgt`：有帧末瞄准为角色 2，对照为 null。P3 “先 update 再算瞄准”的硬性要求应保留。

**验收命令与输出（仓库根目录）：**

```text
node tests/golden/verify.cjs
PASS 100/100 组黄金录像完全一致（快照 + 事件 + 最终结果）
node tests/golden/verify.cjs --adapter cocos/tests/golden-adapter.cjs
PASS 100/100 组黄金录像完全一致（快照 + 事件 + 最终结果）

# 按 extra-manifest.json 逐项删除 177 个新 gzip，确认四目录剩余文件 0；未删除旧录像。
node tests/golden/verify-extra.cjs --adapter cocos/tests/extra-adapter.cjs
自动重建 177 个；PASS 177/177 新录像（逐帧状态 + 输入 + 事件 + 结算 + 存档）

# 指定重录：先删除该组及对应 aim 组，验证自动补齐依赖。
node tests/golden/record-extra.cjs --case input-0-2001-noaim
自动重建 input/input-0-2001-aim.json.gz
PASS 新录像 1 组，366027 bytes，SHA-256 全部一致（清单未改）
node tests/golden/verify-extra.cjs --case input-0-2001-noaim
PASS 1/1 新录像（逐帧状态 + 输入 + 事件 + 结算 + 存档）

node tests/golden/record-extra.cjs --resume
PASS 新录像 177 组，178357190 bytes，SHA-256 全部一致（清单未改）
shasum -a256 -c port/tmp/p2-2-ruling/manifest.sha256
tests/golden/extra-manifest.json: OK

node --test tests/golden/files.test.cjs
tests 3 / pass 3 / fail 0
# 完整哈希保护原始浮点、数组顺序及非帧字段；两个真实 CLI 遇到错误哈希都退出 1。
# 缺失录像不落盘、坏缓存不被覆盖，清单内容始终不变；负测进程由测试收回。

node tests/golden/report-extra.cjs
数量、覆盖断言通过；50 对状态不同，20 对结算不同；体积和覆盖次数均与原记录相同
npm run test:core --prefix cocos
tests 14 / pass 14 / fail 0
# 包含结算 / 存档 / 广告 / 收尾、搬来的规则断言，以及五关各 50 局统计逐字段完全相同。
npm run check:types --prefix cocos
退出 0，无类型错误
node tests/check-port-protected.cjs
PASS 受保护文件 433 个，内容变化 0，保护目录无增删（相对 HEAD）
# 另逐文件比较开工前快照：470 个文件 SHA-256 全部不变，含旧工具与 core。

git status --short --untracked-files=all -- tests/golden/input tests/golden/buffs tests/golden/ads tests/golden/tutorial
无输出；另检查 177 个缓存全被 git check-ignore 命中，清单未被忽略
git ls-files -- 'tests/golden/level-*.json.gz' | wc -l
100
rg -n '/[t]mp/shuaiguo-p2-2' tests cocos/tests implementation-notes.md
无匹配（退出 1）；旧临时输入清单命令改为 --mode input，直接用仓库清单

for file in js/*.js tests/*.cjs tests/golden/*.cjs cocos/tests/*.cjs cocos/tests/*.mjs; do node --check "$file" || exit; done
git diff --check
均退出 0
# extra.cjs / report-extra.cjs 整理前后语法树一致；原有比对逻辑和 TS 玩法未改。
```

Node 23 的 ExperimentalWarning 为类型擦除提示。类型检查仅由 Node 执行 tsc，没有启动 CocosCreator。`record-extra.cjs` 无 --resume 时重录全部新录像，可用 --mode / --case 指定范围；--resume 复用哈希一致的缓存，verify-extra 自动从原型重建缺失缓存。所有路径均校验清单哈希，清单不会随录制更新；旧 record.cjs / verify.cjs / manifest / 100 个 gzip 均未改。本轮日志与开工前校验快照保存在已忽略的 `port/tmp/p2-2-ruling/`。

**调试修正：**

1. 关卡 0 / 种子 2001 初次接入缺少 frameAim，报 `m.frameAim is not a function`；补上对 pickAim(player) 的明确帧末 API。
2. 种子 6011 的模拟测试先观察到 `m.simulate is not a function`；原样搬运原型统计和 try / finally 恢复逻辑，随后五关各 50 局全字段一致。
3. 未出现需调整现有 TS 玩法的关卡 / 种子 / 字段差异。没有改数值、随机顺序或在适配器里修值。
4. harness 调试修正了教学按钮的 DOM 替身（稳定 querySelector、focus、insertAdjacentHTML、parentElement.classList）及 VM 跨上下文数组的结构比较；JSON 转换仅移除 VM 原型身份。顶包结果直接读取真实广告回调触发的那次 finish，未额外结算一次。广告选样调整见上。

**发现但未改（仅追加，未重复 P2-1）：**

- `js/game.js:2458`：末关过关仍将 unlocked 更新到 6，虽然 LEVELS 只有 5 关；是否把 6 当作全通标记留待后续裁定，未擅自夹到 5。
- `js/game.js:2962`：simulate 成功返回时清空原对局的浮字和横幅计时，没有恢复模拟前的这些表现状态；本轮照搬清理语义。

---

## 2026-11-03 · P2-1 玩法逻辑忠实翻译（黄金录像 100/100 一致）

- **用户定的：** 完整阅读 `port/tasks/P2-1-玩法逻辑翻译.md` 及其全部前置源文件，按原型忠实翻译，不调数值、不修原型问题。只改 core、测试入口、package 命令和本节；保持 main。Cocos 编辑器已开，不运行 CocosCreator，不触碰 view / platform / 场景 / 素材，不提交、不推送、不部署。
- **我定的细节（可改）：** 每局一个 `Match`，持有 `S/L/E/auto/simulating/mode/shake/横幅计时/输入/存档副本`；同一对局的方法按系统拆文件，构造时绑定回调，保留原型传入 `makeLeader/tutNext/raging` 的调用方式。常量和关卡数据保持数值、字段、数组顺序。纯计算与表现事件分离，事件统一为 `{t, kind, args}`；每次调用的省略参数和时机保持不变。
- **偏差 / 结构适配：** 无玩法或黄金录像契约偏差。Cocos 的类型检查器拒绝 `.ts` 导入后缀，因此 core 沿用无后缀导入；Node 23 测试入口只做路径解析补全，仍由原生 `--experimental-strip-types` 擦除类型，没有编译产物、数值修正或比对放宽。`check:types` 增加 `--lib esnext,dom`，仅补原型已用的标准库声明，不关闭 strict。没有修改 `tests/golden/verify.cjs`、`record.cjs`、harness。未启动浏览器、开发服务器或第二个 Cocos 进程。
- **已验证：** 编辑器自动生成的 14 个新 TS `.meta` 均保留；core 共 15 个 `.meta` 的 importer 全为 typescript，UUID 无重复。TS 和原型各 100/100 黄金录像完全一致；核心测试 4/4（原有随机序列 5000 项、完整地图/关卡数据、多局交错完整状态及事件、结算进度与原型对照及进度隔离）；严格类型检查通过；原型所有 JS 语法检查通过；diff 空白检查通过。原型及黄金录像 415 个文件 SHA256 全部未变。额外对 106 个翻译函数做函数体结构核对：擦除类型、还原实例/常量引用及等价布尔数值转换后，差异 0。
- **未验证：** 未运行 Cocos、构建、浏览器视觉或真机；本轮没有把 core 接到画面层。黄金录像不覆盖带教、手动输入、结算分支和收尾表现；本轮仅对一局结算的进度结果做原型对照，其余仍按任务卡留待 P2-2 补专项测试。表扬贴纸仍由画面层实现，core 只发出 `praise(kind)` 意图。

**文件结构与原型对应：** 所有 core 文件均在 `cocos/assets/scripts/core/`，单文件最长不足 500 行。

| 文件 | 对应原型内容 |
|---|---|
| `random.ts` | engine 的 mulberry32；沿用既有算法，增加读写本局状态 |
| `engine.ts` | engine 的 rand / pick / shuffle / dist / clamp / angDiff / pollKeys / Snake / Floats / pushOut / collide；sfx / toast / buzz / bgm 改为事件 |
| `types.ts` | OFFICE、LEVELS、Agent、Pot、Leader、State、带教、进度、输入与事件的类型描述；不增加状态字段 |
| `levels.ts` | `js/levels.js` 的 OFFICE、LEVELS（含工位生成循环），原样数据 |
| `config.ts` | game 的手感常量、PERSONAS、LEADER_TYPES、EVENTS、INCIDENT_MSGS、BUFFS、PIE_PROMISES、STEER_OFFSETS 等 |
| `state.ts` | 工具、总账、时钟、称呼清理、makeAgent / giveStartPots / makeLeader / makeState / incidentLeader / buildSchedule |
| `pots.ts` | 锅接收、飞行、瞄准、视野、甩锅、反甩、护短、压垮、归责和到期爆炸 |
| `navigation.ts` | NAV 网格构造（每局单独创建） |
| `leaders.ts` | navIdx / navFree / navPt / navClear / findPath / walkTo；领导巡逻、追责、瞄准、派锅、带教走位、视野朝向、碰撞派锅 |
| `schedule.ts` | 鸡血与出纳跟风、画饼会议和吃饼、updateSchedule / startFinale / burst / startEvent / startIncident |
| `tips.ts` | TIP_CHECKS 条件（每局独立闭包） |
| `tutorial-steps.ts` | TUT_STEPS 全部步骤（每局独立闭包），DOM 操作改为画面事件 |
| `tutorial.ts` | coachLocked / agentByKey / tutLater / tutNext / tutEvent / updateTutorial / tutCanFire / startWork |
| `agents.ts` | 避障、甩锅目标、小舅子塞锅、think / updateAgent / ranking / starsOfRank / update / diagnose |
| `match.ts` | 原型闭包状态、表现出口、showCoach / showHint / showMsg / updateBanners、输入清理、finish 纯计算（calculateResult）、startClosing / updateClosing / updateClosingNotice 的纯计算与事件 |
| `cocos/tests/golden-adapter.cjs` | 独立运行 TS core；snapshot / normalize 按 record.cjs 原样映射；只记录旧录像的七类事件 |
| `cocos/tests/register-core.cjs`、`.mjs` | Node 中只补全 core 相对导入的 `.ts` 路径，不加载 Cocos 或原型 |
| `cocos/tests/match.test.mjs` | 关卡/地图一致性、多局隔离、进度计算对照与隔离；保留原有 random.test.mjs |
| `cocos/package.json` | 增加 test:golden；test:core 预载路径解析；check:types 补标准库声明 |

**验收门槛的命令与输出（仓库根目录）：**

```text
node tests/golden/verify.cjs --adapter cocos/tests/golden-adapter.cjs
PASS 100/100 组黄金录像完全一致（快照 + 事件 + 最终结果）

node tests/golden/verify.cjs
PASS 100/100 组黄金录像完全一致（快照 + 事件 + 最终结果）

npm run test:core --prefix cocos
tests 4 / pass 4 / fail 0

npm run check:types --prefix cocos
退出 0，无类型错误

node --check js/*.js
for file in js/*.js; do node --check "$file" || exit; done
git diff --check
均退出 0

python3 /tmp/shuaiguo-p2-check-protected.py
SHA256（开工前记录，与收尾逐文件重算比较）
js/ + index.html + css/ + assets/ + tests/golden/*.gz + tests/golden/manifest.json
415 个文件，变化 0；受保护目录无增删
```

Node 23 仅有其自带的 ExperimentalWarning（类型擦除），不是测试失败。`npm run test:golden --prefix cocos` 也提供同一验收入口。

**调试过程中修正过的不一致：**

- 首次定向跑关卡 0 / 种子 1001 即 PASS 1/1；随后全部 100 组一次通过。没有关卡 / 种子 / 快照字段 / 事件参数层面的失败或修正，也没有改适配器去修数值。
- 在第一次可运行版本之前，整理翻译工具的标识符分类：排除单字母 `S/L`、包含 `P0_*` 常量、将 `E` 绑定本局；最终没有全局对局变量。类型检查阶段补可擦除的类型断言和回调类型；布尔相减显式写 `Number(boolean)`，与 JS 减法的隐式转换等价。
- 加载检查最初报告 `.ts` 导入后缀不被 Cocos 类型检查器接受，改为工程原有无后缀导入和测试专用路径补全；没有改运行逻辑。独立函数体审计工具起初用了错误的 sourceFile 打印字面量，修正审计工具后 106/106 一致，未因此更改 core 数值或逻辑。

**发现但未改（待 Claude / 泊舟裁定，不将可疑行为直接定性为 Bug）：**

1. `js/game.js:358–359`：先 newPot 再检查 a.crushed，已经出局仍会多消耗一次抽标签的随机数；必须保留这个顺序。
2. `js/game.js:1497`、`:1584`：pickDumpTarget 有“保留已有目标”分支，但普通 think 在调用它前先清空 a.target，通常不会走到这个保留分支。
3. `js/game.js:1724`：玩家压垮只写 S.over，不像同事一样标记 a.crushed / crushedAt；finish 单独强制末名，ranking() 的玩家位置仍可能不同。两个字段口径均照搬。
4. `js/game.js:138`、`:324`（以及原型其他提示）：急件 / 画饼群消息写死“老板”，自定义称呼不生效；移植计划 §9 已列为后续画面文案修正，本轮未改。
5. `js/game.js:1769`、`:3017`：横幅计时在外层帧循环推进，黄金录像不调用它，首次提示后的 hintTimer 会保持正值。不是录像错误；适配器忠实使用已裁定的 update-only 口径。
6. `js/game.js:2149`的 draw() 会调用 pickAim() 更新 aimTgt，真实绘制与纯 update 录像的状态来源不同；本轮不混入绘制调用，P3 接画面时应注意保留原调用职责。

**core 与原型结构不同的地方及行为理由：**

1. 原型闭包变量改成 Match 字段，随机数由该局 Engine / Mulberry32 持有；数组、对象、Set、排序比较器和遍历顺序保持原样。跨局交错测试与单跑的完整状态及事件严格一致。
2. 原型函数拆成方法对象，在 Match 构造时逐个绑定；`this.fn` 代替闭包 fn，函数当回调传递时仍访问同一局。TIP_CHECKS / TUT_STEPS / NAV 每局创建，不共享活动状态。
3. E.Snake 内的无状态数学工具改用模块函数；rand / pick / shuffle 经本局随机流。运算表达式和交换顺序相同，随机序列与黄金录像已验证。
4. 原型表现调用改为事件；spawnFx / Floats 仍维护其原列表，shake 的每次赋值发事件。新增 bgm、praise、shake、教学按钮/焦点/指针清理、横幅和结算事件不进入旧录像七类契约；过滤仅发生在测试适配器，生产 core 仍全部发出。
5. DOM 教学控制改成输入对象重置与按钮等事件，画面按钮调用 startWork；原 document.hidden 改成 updateClosing 的 hidden 入参。update、横幅计时、Floats 计时、倒计时通知、closing 计时仍为独立入口，调用节奏由画面层控制，黄金录像只调 update。
6. 平台存档访问改成构造时传入 JSON 进度副本、loadProgress / saveProgress 的内存副本和 progress 事件；沿用原型 JSON 序列化语义。calculateResult 返回原型 finish 的排名、星数、总账、最佳记录、解锁、复盘和分享数据计算；finish 发反馈事件，画面层消费，core 不触碰平台存储。
7. 为 strict 补充字段类型、非空断言和 callback 类型；这些均擦除。排名中 boolean 相减显式用 Number 转换，其结果和原型隐式转换相同。golden-adapter 的快照打包函数不改比对规则，verify / record / harness / 录像保持不变。

---

## 2026-11-03 · Cocos 工程骨架按裁定 2 收尾（编辑器预览通过，微信 CLI 被服务端口阻塞）

- **用户定的：** 按任务卡末尾「裁定 2」改为编辑器构建；保持现有 Cocos 工程打开，绝不运行 `CocosCreator --build`、不启动第二个 Cocos、不打编辑器补丁。日常使用 7456 浏览器预览；基于泊舟已构建的 `wechatgame-001` 验证。仍在 main，不改原型，不搬玩法或全部素材，不接云 / 广告 / 分享，不提交、不推送、不部署。
- **我定的细节（可改）：** 删除 `build:wechat`、`build:web` 及会启动 Cocos、清缓存的 `tools/build.mjs`，避免误用；以只读 `check:build` 检查每次编辑器出包。保留先前的三层 TS、唯一 Boot、375×812 固定宽度、70 高角色和 TTF 字体子集。角色选择原型单张 PNG 直接导入，便于后续按清单批量搬运，图集打包另定；运行时 min/mag 都为 NEAREST、mipmap 关闭。
- **本轮改动：** `cocos/package.json`、`tools/check-build.mjs`（新增）、`tools/build.mjs`（删除）、`tools/check-web.mjs`、`tools/wechat.mjs`、`tools/package-size.mjs`、`settings/v2/packages/engine.json`、`settings/v2/packages/wechatgame.json`（新增）及本节。同步本机忽略文件 `profiles/v2/packages/wechatgame.json` 的 AppID 和当前任务选项；现有包 `build/wechatgame-001/project.config.json` 确认并保存为目标 AppID。原先的 `.gitignore`、AGENTS、`.claude/`、移植计划和任务卡全部保留，本轮不改；未操作 Git 索引。
- **偏差 / 阻塞：** 微信 CLI 的 `islogin` 前置检查就返回服务端口关闭（shell 退出 246），按任务卡停止该分支，未运行打开、编译、预览；没有本轮二维码、模拟器截图或手机验收，不把旧图当新证据。7456 默认预览编辑器当前空场景，显式用 `?scene=3b08c73f-d17c-4dfc-a45e-854ddae97b2f` 指向 Boot；桌面工具栏会占 48px，验证改用 Android 移动浏览器上下文，使预览按自身机制全屏，游戏可见区域实测为 375×812，没有修改游戏适配逻辑。
- **已验证：** 现有包 Boot / 角色 / 两款字体 / 音效及 AppID 清单通过；PNG / MP3 与原型 SHA256 一致；mulberry32 共 5000 项一致；类型、JS/MJS 语法和 diff 空白检查通过；17 个 meta 前后 SHA256 全部一致，Importer 均健康，场景及 Boot 脚本 UUID 未改；assets 下无多余 JS。预览中角色高 70，min/mag 最近邻，title_LABEL / body_LABEL 均 loaded，字体资源为 TTF、非系统字体，四角节点位置正确，点击日志出现，非静音 PCM 音源 duration=0.351104s、peak=0.937767、AudioContext=running，控制台错误 0（有 headless WebGL ReadPixels 性能警告）。
- **未验证：** 微信开发者工具编译 / 二维码 / 模拟器画面、真实扬声器听感、手机安全区；共享 AppID 设置被下次编辑器构建实际采用，以及引擎裁剪后的产物和体积；发布用 web-mobile 包。本轮截图是编辑器预览，不能替代网页发布包、微信包或真机验收。P1 完整门槛尚未通过，不进入 P2。

**需要泊舟手动操作：**

1. 微信开发者工具 → 设置 → 安全设置 → 开启「服务端口」（一次性开关；CLI 可能随后要求登录，当前尚未走到登录验证）。本轮遵守任务卡没有代开。开启后才能继续 `open:wechat` / `preview:wechat`，没有让泊舟重建 Cocos 来绕过此阻塞。
2. 下次出包仍由泊舟在当前 Cocos 的「构建发布」面板点「构建」。先重新打开构建面板 / 项目设置，确认 AppID 为 `wx15e416b0643d90af` 且功能裁剪已读到文件设置；编辑器当前预览日志仍含旧模块，文件改动不能证明其内存配置已刷新。若面板仍是旧值，关闭并重新打开当前工程后再确认（本轮没有重启）。分别构建微信与 web-mobile 后运行下列验包命令；不再要求 CLI 各连续三次。
3. 获得本轮新二维码后由泊舟手机扫码，确认画面、音效听感和安全区。上述后两项是每次版本验收，不能承诺一次点击以后再也不需要人工构建 / 真机验收。

**工程结构（沿用骨架，新增验包与共享微信设置）：**

```text
cocos/
  assets/scenes/Boot.scene (+ meta)
  assets/scripts/Boot.ts
  assets/scripts/core/random.ts
  assets/scripts/view/SmokeView.ts
  assets/scripts/platform/{Platform,WebPlatform,WechatPlatform}.ts
  assets/resources/{player_normal.png,title.ttf,body.ttf,ui_click.mp3} (+ meta)
  settings/v2/packages/{project,engine,builder,wechatgame,...}.json
  build-config/{wechatgame,web-mobile}.json  # 旧构建配置作参考，不是编辑器当前任务
  .creator/default-meta.json、.gitignore、package.json、tsconfig.json
  tests/random.test.mjs
  tools/{check-build,check-web,wechat,package-size}.mjs
  tools/subset-fonts.py、tools/requirements.txt
  build/wechatgame-001/                    # 本机产物，不入库
```

首轮工程由安装目录 `Contents/Resources/templates/empty-2d` 模板复制，唯一 Canvas + Boot，所有可见节点及相机由代码创建。core 不 import cc，只用可擦除 TS；平台层仍只有接口与空壳。缓存、profiles、build、venv 等继续忽略；素材 meta 和 settings 入库。站酷快乐体 title.ttf 2192 字节、思源黑体粗 body.ttf 3136 字节，本轮未增加文案、不重新裁字；正式建议从所有静态文案抽取字符后生成 TTF，动态昵称所需字另定覆盖/回退方案，不能把本次小子集当完整字体。大标题如固定不变可另评估位图字，暂不实施。

**AppID 与引擎设置：**

- 共享配置：`settings/v2/packages/wechatgame.json` 的 `builder.options.wechatgame.appid`。同时同步本机 `profiles` 的同项及当前 `taskOptionsMap`，避免本机旧测试号覆盖共享值。`build-config/wechatgame.json` 的 AppID 原本就正确，但编辑器已有任务不会自动导入它。现有产物 AppID、compileType=game 已通过只读验包；是否下次自动带入仍待编辑器构建确认。
- 新关闭：2D 物理总开关及各实现、Spine 总开关与 3.8/4.2、DragonBones、2D 粒子、Video、WebView、TiledMap；同时移除 includeModules 对应项。原已关闭的 3D、骨骼动画、3D 物理、3D 粒子、地形、光照探针、XR、后处理等保持关闭。此游戏碰撞会由纯 TS 计算，不需要 Box2D。
- 保留：base、WebGL / WebGL2、2d（含 Sprite / Label）、Graphics、UI、音频、animation、tween；保守保留 affine-transform、RichText、Mask、intersection-2d、profiler、custom-pipeline。后面可能用到群聊富文本、裁切、几何相交及调试；渲染管线和后端依赖拿不准时不换。没有编译或承诺裁剪后的节省量。
- 分离引擎建议：本阶段保持 `separateEngine=false`，先拿到裁剪包。不要直接采用“插件不计主包”的前提：[Cocos 3.8 官方说明](https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/wechatgame-plugin.html) 当前 Q&A 写的是引擎代码仍计入首包；共享缓存可以减少重复下载，并要求内置引擎、非调试构建。是否符合微信当前上传口径、3.8.8 版本插件可用性以及本 AppID 授权，应以开发者工具和真机的实测为准。以后可单独构建插件版比较，不把它作为当前主包超限的解决保证。功能裁剪设置依据 [Cocos 项目设置](https://docs.cocos.com/creator/3.8/manual/zh/editor/project/index.html)，仍须新包回归。

**命令、输出与证据：**

所有命令从仓库根目录执行；本轮没有创建 HTTP 服务、安装包、上传或构建。

| 步骤 | 命令 | 本轮结果 |
|---|---|---|
| 核心对照 | `npm run test:core --prefix cocos` | `tests 1 / pass 1 / fail 0`；5 个种子各 1000 项逐项等于真实 harness 加载的原型 E.random；`port/tmp/test-core-ruling2.log` |
| 类型 | `npm run check:types --prefix cocos` | 退出 0；`typecheck-ruling2.log` |
| 现有包验收 | `npm run check:build --prefix cocos -- build/wechatgame-001` | PASS，meta、Boot、四种资源及 AppID / compileType；`build-check-ruling2.log` |
| 体积 | `npm run report:size --prefix cocos -- build/wechatgame-001` | 成功，支持换目录；`package-size-ruling2.log` |
| 浏览器预览 | `PLAYWRIGHT_MODULE=/tmp/shuaiguo-browser-check/node_modules/playwright/index.mjs npm run check:preview --prefix cocos` | PASS 375×812、日志与非静音音源、错误 0；`editor-preview.log` / `editor-preview-check.json` |
| 微信前置 | `/Applications/wechatwebdevtools.app/Contents/MacOS/cli islogin` | 服务端口关闭，退出 246；摘录 `wechat-cli-blocker.txt` |
| 微信恢复后 | `npm run open:wechat --prefix cocos -- build/wechatgame-001`；`npm run preview:wechat --prefix cocos -- build/wechatgame-001` | **未执行**；后者预期写 `port/tmp/preview-qr.png`；结束用 `close:wechat` 只关这个工程 |
| 网页发布包以后 | 泊舟编辑器构建后：`npm run check:build --prefix cocos -- build/web-mobile` | **未执行**；`serve:web` 与 `check:web -- http://127.0.0.1:18765/ web-mobile` 仍可供新发布包验收，用完关闭服务 |
| 语法 / 空白 | `node --check js/*.js`；逐文件 `for f in js/*.js cocos/tools/*.mjs; do node --check "$f" || exit; done`；`git diff --check` | 通过；原型文件无 diff |

本轮为配置和本机工具调整，未新写镜像实现的单元测试；已有随机测试保持不变，工具以真实产物、预览和 JSON 统计验证。限定脚本的简化检查完成：未引入通用扫描抽象，保留中文关键逻辑及平台限制注释；小包的几次只读目录扫描没有值得扩大改动的性能成本。

**截图与清理：**

- `port/tmp/editor-preview.png`：本轮 375×812 编辑器预览，目检像素边缘清晰、两款中文字体字形生效。包含编辑器默认的 FPS / vConsole 调试浮层，右下角标记有遮挡；四角节点位置另有 runtime 记录，不据此宣称手机安全区通过。
- 微信模拟器截图、`preview-qr.png`：本轮未生成。旧 `web-mobile.png` / `web-check.json` 不作为本轮证据。默认空场景与桌面工具栏失败检查分别保留为 `editor-preview-empty-scene*`、`editor-preview-toolbar*`，未隐藏失败。
- Playwright 在 finally 中退出；已确认没有本轮 headless 浏览器或测试 Node 残留，18765 未监听。CUA 会话已 reset，未操作构建按钮、未退出用户编辑器，现有 7456 服务保留。两个原有 Cocos 主程序 PID 31496 / 31548 在本轮前后均未变，分别为启动器与工程子进程，没有新增 Cocos。meta 前后哈希见 `meta-ruling2-before.json` / `meta-ruling2-after.json`，17/17 一致。

**现有微信包体报告与分包建议（仅建议，不实施）：**

目录 `cocos/build/wechatgame-001/`，当前无分包和远程包。以下按磁盘未压缩文件字节汇总，含开发工具配置文件，作为主包上界，不能当作微信上传后的准确压缩包大小或审核结论。

| 分类 | 字节 | MiB | 占目录 |
|---|---:|---:|---:|
| 总计 | 2,991,973 | 2.853368 | 100% |
| cocos-js 引擎 | 2,602,083 | 2.481540 | 86.97% |
| 验证素材 resources（含导入数据） | 19,139 | 0.018252 | 0.64% |
| 内置素材 internal | 171,511 | 0.163566 | 5.73% |
| 适配、场景、脚本及其他 | 199,240 | 0.190010 | 6.66% |

现有包低于任务卡 4 MiB 预算约 1.147 MiB；正式全部素材不能据此保证装得下。原始验证素材 PNG=7986、title.ttf=2192、body.ttf=3136、MP3=3449 字节。引擎单文件 `_virtual_cc-DSsdqisG.js` 为 2,366,556 字节；Spine wasm 205,175 字节及桥接脚本仍在旧包内，只作为下次裁剪的对照，不能提前从总量里扣除。

主包建议保留 Boot / 加载页、核心代码、首屏图标和少量必需 TTF / 点击音效；办公室地图、角色动作和各关特有图片按公共包 + 关卡 Asset Bundle / 微信子包加载，避免主场景直接引用把依赖重新拉回主包。短音效可在相关子包，BGM / 长音频优先独立音频包；确实超总量或启动下载预算时再评估微信云存储与缓存 / 离线降级，本阶段不接云、不上传。不实施分包或远程迁移。

## 2026-11-03 · 随机种子与黄金录像完成（按任务卡裁定）

- **用户定的：** 执行 `port/tasks/P0-1-随机种子与黄金录像.md` 及末尾裁定；不改玩法、数值、画面、文案、存档格式；在 main 上完成，不提交、不推送、不部署，不创建 cocos。绘制随机独立；表扬贴纸属于画面层，不进入录像；录像使用空存档（老板默认叫“老板”）、托管玩家、`simulating=true`、`makeState(false)`。
- **我定的细节（可改）：** mulberry32 的状态每次截成 uint32；显式种子模拟在 finally 恢复随机状态与原 simulating 标志，无种子继续消费当前流。录像每组新建 harness，固定 1/60 秒，每 30 步及结束时记录，结束恰逢采样点也另记 final；浮点四位，统一正负零，特殊数转字符串。对象引用用 agent id / leader 索引，Set 保存成员；快照包含任务卡全部字段、剩余日程、节奏与事件标志，不带表扬字段。事件记录接口调用意图，不执行音频和真实 DOM；不跑 finish、HUD、下班过场。verify 支持同步 `--adapter`、定向 level/seed 和临时 data 目录，用法均写在脚本头，无 README。
- **改动文件：** `js/engine.js`、`js/game.js`、`tests/game-harness.cjs`、`tests/thursday.cjs`、`tests/random.cjs`、`tests/golden-tools.cjs`、`tests/golden/record.cjs`、`tests/golden/verify.cjs`、`tests/golden/manifest.json`、`tests/golden/balance-results.json`、`tests/golden/level-{0..4}-seed-{1001..1020}.json.gz`（100 个）、本文件。原有 `AGENTS.md`、`.claude/`、`port/` 修改原样保留；不改关卡、样式、素材或字体。
- **偏差 / 修正：** 无玩法偏离。首版录像多记了蛇身轨迹，已收回任务卡所需字段后重录；最终 100 组均存完整快照及事件，无哈希降级。首次 verify 揭露 JSON 将 -0 写为 0 的误报，已规范零值并补回归，未改游戏状态或断言。此前“前置排查后停止”小节已由本节替换，没有保留两节。

**Math.random 分类（左列为基线 HEAD 行号，箭头后为交付代码行号）：**

| 位置 | 处理与理由 |
|---|---|
| engine.js:11 → 24 | rand 改 E.random，初始化和 update 共用 |
| engine.js:13 → 26 | pick 改 E.random，锅标签等会进入状态 |
| engine.js:29 → 42 | shuffle 改 E.random，日程及会议文本进入状态 |
| game.js:688 | 改 E.random，AI 反甩概率 |
| game.js:949 | 改 E.random，领导按锅数选人时的随机权重 |
| game.js:952 | 改 E.random，领导点名玩家概率 |
| game.js:1024 | 改 E.random，随机天降锅 |
| game.js:1124 | 改 E.random，AI 抢饼意愿 |
| game.js:1531 | 改 E.random，回避小舅子护短的决策 |
| game.js:1623 第一处 | 改 E.random，AI 主动甩锅概率 |
| game.js:1623 第二处 | 改 E.random，领导面前忍住不甩的概率 |
| game.js:2876 | 保留 Math.random，只选择大厅点击主角后的台词，不进对局状态 |
| engine.js:22（新增） | fxRand 内保留 Math.random，纯表现随机源 |
| game.js:2091（原来两次 E.rand） | 两处均改 E.fxRand，只改变绘制平移，不消费种子状态 |

全量追踪 draw 及绘制辅助函数、DOM、音频路径：除此震屏外，没有 E.rand / E.pick / E.shuffle 调用；`buildSchedule` 的文案、会议承诺和 `eatPie` 的气泡在 update / 初始化路径产生，继续走种子随机。交付代码只剩 engine.js:22、game.js:2876 两处 Math.random。

**其他不确定因素排查（以下为交付代码行号）：**

| 位置 | 结论 |
|---|---|
| engine.js:628 | 表扬退出定时器；按裁定排除整个表扬路径 |
| engine.js:658 | toast 定时器只移除 DOM class，不改 S |
| engine.js:670；game.js:2527–2547 | 假广告完成回调能复活、顶包、开新局；不在录像 / update 路径，按裁定不录 |
| engine.js:951、1047 | 延迟合成音和 BGM 调度，只改音频状态，不改 S |
| engine.js:680–687；game.js:3007–3022 | 正常 RAF 使用 performance.now / 帧时间来驱动 update；原型保持变步长，录像 / simulate 分别显式传 1/60、1/30，不改正式帧循环 |
| engine.js:11 | Date.now 仅用于默认起种；录像和带种子的 simulate 在初始化对局前覆盖种子；update 调用链无 Date.now / performance.now |
| game.js:187–206；engine.js:573–599 | 相机、画布 rect、DOM 占位影响表扬资格及 praiseAt / outSince；按裁定不进录像、不影响玩法 |
| game.js:1151–1158、2086–2092、2253–2263 | st.w / st.h 与相机只用于绘制裁切、气泡和边缘指示，不参与命中、AI、排名 |
| game.js:1751–1756、1769–1772 | DOM rect 仅放置横幅；横幅计时在主循环外于 update 后推进，录像沿用 simulate 的仅 update 口径。当前每关仅一条 tips，无按时间 hints，不改变本次局内结果或提示触发 |
| game.js:226、237–245 | 自定义老板称呼来自存档 / 编辑输入框；录像每组空存档固定“老板”，不读取用户真实存档 |
| game.js:1645–1666 | 输入来自键盘 / 摇杆状态；录像 auto=true，玩家走 AI 分支，不读人工输入 |
| game.js:346、950、1073、1128、1145、1238、1682–1687 | 排日程、选目标、选饼、最近拾取者、喷锅、排名均为确定性比较器；平手依赖现代 JS 的稳定 sort 和现有数组顺序，随机权重提前在 map 中产生，没有在比较器里取随机数。TS 移植须保留平手顺序 |
| engine.js:544、587、843；game.js:2180、2354 | 对象遍历 / 其余 sort 只做贴纸、音频资源、画人遮挡次序、SVG；不决定玩法。simulate 的统计对象按固定角色插入顺序累计，不反向影响 S |
| game.js:188 | simulating 跳过 praise，按裁定排除 |
| game.js:201 | simulating 清空 outSince 并跳过名次表扬，按裁定排除 |
| game.js:476–480 | simulating 阻止成就写真实存档；nephewCrushed、护短追责、局内结果照常计算 |
| game.js:2915–2916、2964 | simulate 入口开启 simulating，finally 恢复；harness 只在测试副本中设置同样标志，不加正式游戏钩子 |

**验证命令和输出摘要：**

- 基线：改代码前通过原 harness 加载未修改的 HEAD（`c2e6506af84ec9f9d0f54c4b8185fab28e1bb4a1`），各关调用 `ctx.SG_DEBUG.simulate(i, 200)`；`git show HEAD:js/{engine,game,levels}.js` 的原文件另外保存在 `/tmp/shuaiguo-p0-1/`。基线使用原生 Math.random，不假称可以用新种子复现旧批次。
- 改后：`ctx.SG_DEBUG.simulate(i, 200, 20261103 + i)`，仍用原模拟步长 1/30；前后原始统计及种子保存在 `tests/golden/balance-results.json`。
- `node --check js/*.js` 退出 0；另逐文件执行 `for f in js/*.js; do node --check "$f" || exit; done`，避免 Node 只检查第一个脚本；新增 / 修改 CJS 均逐文件语法检查；`git diff --check` 通过。
- `node tests/thursday.cjs`：10 tests passed；只将固定随机替身从 ctx.Math.random 改到 ctx.E.random，断言不变。`node tests/friday.cjs`：排名/目标/视野/护短/追责及星级/路线/预警/证书/广告两组通过。
- `node tests/random.cjs`：序列复现、零种子已知首值、状态读写、表现随机隔离、带种子模拟复现、正常与异常恢复、无种子推进全部通过；实现前先看到 E.seed 不存在的预期失败。
- `node tests/golden-tools.cjs`：-0 / JSON 往返、字段 / 数组 / 缺失差异、完整 / 哈希比较、全部七种事件入口、对局禁用 Math.random、30 步采样与 final 通过。
- `node tests/golden/record.cjs`：5 关 × 20 种子全部生成；最终两次连续 `node tests/golden/verify.cjs` 均输出 `PASS 100/100 组黄金录像完全一致（快照 + 事件 + 最终结果）`。只读核验不重录基准。
- 比较器负测：仅修改 `/tmp/shuaiguo-p0-1/mismatch/` 录像副本的第一个玩家 x，再运行 `node tests/golden/verify.cjs --data /tmp/shuaiguo-p0-1/mismatch`，退出 1，准确输出 level=0、seed=1001、time=0.5、`$.snapshots[0].agents[0].x`、old=547.774、fresh=546.774；正式基准未动。
- 补充同随机流对照：旧 HEAD 使用独立 mulberry32 流替换 Math.random，改后使用同一序列替换 E.random，各关 `simulate(i, 5)`，五关的所有统计字段逐项完全相同。这是同流契约检查，不代替前后各 200 局的原生随机统计。
- Chromium / Playwright 375×812：`python3 -m http.server 18765 --bind 127.0.0.1` + `node /tmp/shuaiguo-p0-1/browser.cjs`；大厅 → 周一介绍 → auto 开局 → 暂停（验证 S.t 冻结）→ 继续 → 自然 18:00 结算（本次第 2 名）→ 返回大厅 → 周四介绍 → 新开局（8 人）；没有调时钟、改锅或强制结算。pageerror、console.error、console warning 均为 0。截图实际目检通过，记录及截图在 `/tmp/shuaiguo-p0-1/`。浏览器已在 finally 关闭，18765 服务已退出，确认端口无监听、本任务无 Chromium / agent-browser 残留；未操作用户浏览器、未建立 CUA 会话。

**统计前后对比（每关前后各 200 局，名次数字为局数）：**

| 关卡 | 过关率：前 → 后 | 名次 1..N：前 → 后 | 玩家压垮：前 → 后 |
|---|---|---|---|
| 周一 | 75.5% → 79.0% | 42/53/56/49 → 38/53/67/42 | 0 → 1 |
| 周二 | 87.5% → 84.5% | 46/48/81/25 → 38/61/70/31 | 8 → 9 |
| 周三 | 8.5% → 9.5% | 1/2/14/28/31/124 → 4/6/9/24/47/110 | 74 → 58 |
| 周四 | 11.5% → 11.0% | 2/5/16/18/25/27/107 → 2/7/13/20/22/36/100 | 89 → 77 |
| 周五 | 1.0% → 1.5% | 0/2/8/19/18/23/21/109 → 0/3/12/17/10/17/13/128 | 100 → 115 |

过关率差均小于 0.87 个合并标准误。名次低频相邻档合并至每组期望数至少 5 后，χ²/自由度依次为 1.722/3、3.757/3、9.284/4、2.380/5、7.702/5，均未达到常用 5% 显著性阈值；本批未检出分布变化，不表示证明两种随机源的任意样本都相同，也不代表真人通关率。

**录像与局长：** 100 个 gzip JSON 共 **7,652,232 字节**（7.30 MiB），低于十进制 8 MB 和 8 MiB；100 组全部完整，无哈希降级。共 20,096 份快照、82,365 条事件（sfx 17,953、toast 542、buzz 1,212、showMsg 618、showHint 60、floats 32,354、spawnFx 29,626；无表扬）。平均局长按跑到 S.over（包含提前压垮）计算：周一 **70.0000 秒**、周二 **120.0000 秒**、周三 **106.6208 秒**、周四 **99.8800 秒**、周五 **103.6117 秒**。

- **已验证：** 种子接口、模拟隔离、全部原回归、两次完整录像复核、比较器正负测、前后统计、同流对照、375×812 指定完整流程与清理；简化检查修掉 harness 的重复模板替换和无用参数，没有弱化测试。
- **未验证 / 边界：** 尚未接入 TS / Cocos，所以不宣称新旧引擎已对齐；真人手感与微信真机未测。表扬贴纸、实际音频播放成功、DOM 避让、广告、带教和下班过场不属于这批黄金录像，由画面层功能清单另验；正式原型仍按真实 dt 更新。截图和临时基线源文件位于 /tmp，不当作永久仓库资产；统计和黄金录像已落盘仓库。

## 2026-11-03 · 难度随时间爬升、临时事件、第一关提速、提示减量

- **用户定的：** 玩着没有“差一点就赢”的感觉，整局太平；要越到下班越难（同事更急、更聪明），加合情合理的临时事件（如老板发火疯狂派锅）。选了“平滑爬升 + 临时事件”。第一关带教要快，教完缩短并在后段加难。提示太多：新东西放进关卡介绍页，局内每关只留 1 条，在新东西第一次出现时弹。
- **我定的细节（可改）：**
  - 同事难度从 `ai`（开局）按上班进度 ^1.6（前缓后陡）爬到新字段 `aiEnd`（下班），`focus` 也跟着爬。
  - `rushAt`（默认 75%，周一 46 秒、其余 90 秒）进入“急着下班”：同事走路 ×1.08、思考间隔 ×0.8、积极度 ×1.15、头上冒汗，只弹一次 toast。原来 105 秒的“突击派活”toast 去掉，派锅加速保留。
  - 新字段 `incidents`，提前 2 秒群消息：**老板发火**（10 秒：走路 ×1.5、派锅间隔 ×0.45、一次多丢一口、不丢天降锅、瞄准 ×0.7、视野长和角 ×1.25 并加深，同事积极度 ×1.25，老板换怒气图）；**领导查岗**（9 秒：以 ×1.7 速度朝你走，到 110 以内停下盯着你，头顶“查岗”）。周一 32 秒发火；周二 64 发火、98 老板查岗；周三到周五约 50 秒经理查岗、84–86 秒发火。
  - 周一正式上班 90 → 70 秒，派锅 5/28/48 秒起每 9/7/5.5 秒，同事 aggr .5→.95、parry 0→.4，下午茶收尾 68 → 58 秒。带教 7 步文案全部缩短，步骤间等待约减半，老板走位 ×2 → ×3。
  - 周二同事 aiEnd aggr 1.5 / parry 1.35 / focus 1.5，点名 .25 → .3；周三到周五开局倍率略降、下班倍率比原来高。
  - 关卡介绍页：新字段 `news`（3 行，图标 + 文案），用纸色块盖住底板的闹钟 / 摇杆 / 眼睛换成本关人物图；周一不写 news，仍讲基本规则。介绍文案改读 `L.desc`（原来 showIntro 里写死）。
  - 局内提示：按时间弹的 `hints` 全删；每关只留一条 `tips`：周一站进老板视野、周二同事的锅第一次飞向你（反弹）、周三 / 周五瞄准被亲属看着的小舅子、周四地上第一次有饼。去掉“锅快到点”“掉出前三”；横幅停留 4.6 → 3.4 秒；老板娘查账 toast 改为每局一次。
- **模拟（AI 代替玩家，周一到周五）：** 改前 100 局 96% / 92% / 8% / 6% / 2%；改后 150 局 69% / 85% / 19% / 9% / 3%。周一、周二第 3、4 名明显变多（周二第 3 名 67/150），即更多局在过关线附近决出。主角每 1/4 局背锅：周一 0 → .17 → .23 → 2.05，周二 .43 → .80 → .87 → 2.92，难度确实往后堆。各批波动约 ±5–10 个百分点。
- **已验证：** `node --check`；`tests/thursday.cjs`、`tests/friday.cjs` 全过；浏览器看了周二、周三、周四介绍页（图标盖住、闹钟闪光已盖掉）、周二发火（怒气图、大视野、群消息）、急着下班、老板查岗、周一带教首句，控制台无报错。字体已重裁（本机 python 没装 fontTools，用 `uv run --with fonttools --with brotli` 跑的）。
- **未验证：** 真人手感——AI 玩家比真人弱，周一 69% 不代表真人过关率；查岗、发火的数值没经过真人试玩；周五介绍页、周一完整带教节奏没在浏览器里完整走一遍；玩法文档的各关描述还没同步。

## 2026-11-02 · 爆炸跟人走、关卡全开、总账结算、周二到周五加难

- **用户定的：** 锅在人身上到点爆炸时，人在走动，爆炸要跟着人走，动画要放完；关卡不再按顺序解锁，想玩哪关点哪关；下班结算把“炸了的锅”和“身上还背着的锅”合在一起算，身上的锅按半口算；后面几关太简单，从“同事更聪明、锅更急派得更密、领导更针对你”三个方向加难。“背锅太多被开除”的开除线这次不做。
- **我定的细节（可改）：** 爆炸特效记下相对蛇头的偏移，每帧按蛇头位置画；空中到点的锅仍在原地炸；时长 1.05 → 1.1 秒（33 帧 × 30fps）。总账 = 背锅次数 + 身上锅数 × ½，急件按炸了的分量（3）折半算 1.5；排名先比总账，同分比背锅次数；最好成绩改存总账（旧存档用背锅次数比）。HUD 身上有锅时显示“背锅 3+1.5”，没锅时照旧“背锅 3”；结算表每行写“炸了 N · 身上 N 口”，右边是总账，表头下一句写算法；关卡介绍、规则列表、周一带教“名次”那句同步改说法。关卡锁直接去掉，星数和 `unlocked` 照常记录（以后要恢复解锁顺序，把两处 `const locked = false` 改回去即可）。
- **加难做法：** 新增三个关卡参数：`ai.focus`（同事专挑同事里总账最少的人甩，那个人算“更近”、找人半径也更大，你领先时就是盯你）、`ai.dodge` / `ai.sneak`（躲锅、领导面前忍住不甩的倍率）、`leaderFocus`（老板、经理每次派活先点你名的概率，你在丢锅范围内才算；老板娘照旧只查榜首）。数值：周二期限 30 → 26、天降锅 .25 → .3、同事 aggr .7 → .9 / parry .45 → .7 / focus .5、点名 .25、派锅间隔约缩 12–15%；周三期限 24 → 20、天降锅 .3 → .35、aggr 1.35 / parry 1.3 / dodge 1.2 / sneak 1.2 / focus 1、点名 .35、派锅间隔 4.8 / 3.9 / 3.1 / 1.8；周四开局 2 → 3 口、期限 24 → 20、天降锅 .25 → .3、aggr 1.4 / parry 1.3 / focus 1.2、点名 .4，派锅同周三；周五开局 2 → 3 口、期限 23 → 19、天降锅 .08 → .12、aggr 1.45 / parry 1.35 / focus 1.4、点名 .45、派锅间隔 4.4 / 3.5 / 2.8 / 2。
- **模拟（AI 代替玩家，各 100 局，Node 加载原引擎）：** 改前 → 只改结算 → 结算 + 加难：周二 99% → 99% → 99%（4 人前三过关，过关本身很难掉；第 1 名从 68 局降到 40 局）；周三 29% → 28% → 17%；周四 22% → 26% → 9%；周五 3% → 4% → 1%。周一 40 局 95%，不受影响。
- **已验证：** `node --check`；`tests/friday.cjs`、`tests/thursday.cjs` 全过；Node 里验证到点爆炸带 `follow`、主角走 100 爆炸跟着走 100、总账 3.5 排在 3 之后。375×812 浏览器：清空存档后大厅五关都能点、能切到周三；周二托管跑完一局，HUD 显示“背锅 0+0.5”，结算表“老油条 炸了 6 · 身上 3 口 → 7.5”；控制台无报错。字体已用 `build_fonts.py` 重裁。测试完已恢复原存档。
- **未验证：** 真人手感（AI 玩家比真人弱很多，模拟只能看相对变化）；爆炸跟人走的画面只验证了逻辑，没在浏览器里截到正在跟走的帧；周二只有 4 人、前三过关，靠数值很难再加难，要明显变难得改人数或名额；玩法文档里的各关数值还是旧的，没改。

## 2026-11-02 · 主题配色加上墙和房间地面

- **用户定的：** 周一、周三、周四都是米色系，只换地毯看不出区别；在三个方案里选了“墙和房间地面一起换色”（不加装饰物）。
- **我定的细节（可改）：** 每套主题给墙（顶面、顶边高光、正面）和三间房的地面配色，描边固定墨蓝；周一保持原色。各关颜色见玩法文档“主题配色”表。三间房的地面刻意和工位区地毯拉开，保留“靠颜色认房间”。
- **改动：** `js/game.js` 的 `THEMES` 每套补 `wood` / `lilac` / `mint` / `wall`，新增默认墙色 `WALL` 和 `wallOf()`，`drawWall` 按主题取色。
- **提交前补的：** 审查时加的新文字（“前两名”、两句老板话术）不在上次裁出的字体里，已用 `build_fonts.py` 重建字体；合并了 style.css 里同一选择器前后覆盖的两条规则。
- **已验证：** `node --check`；960×1440 浏览器把周二到周五各开一局看全图，墙和房间颜色正确，四关一眼能分开，控制台无报错。
- **未验证：** 手机竖屏下只能看到局部，墙色在小屏上的观感没逐关看；真机。

## 2026-11-02 · 周五审查（Claude 审查 Codex）

- **审查结论：** 名额、星级、老板娘查账、45° 视野、护短 +3、姐姐追人、证书和彩蛋都按规格做了；老板娘 16 张素材逐张看过，卷发、金耳环、豹纹、计算器各姿势一致，和老板、经理一眼能分开。
- **审查时改的：** 彩蛋预告“我们是大小周”原来没过关也显示，改成只在过关时显示；玩家一直排第 1 时，老板娘每次派锅（约 5 秒）都弹一次“查你账”提示，改成 20 秒最多一次，头顶气泡和瞄准音效照常；“前二”改成“前两名”（倒计时、名次提示、关卡提示）。Codex 为了让第 5 张卡居中，在大厅和介绍页的滑动条两头补了半屏留白，结果右边空一大块，已去掉，首尾的卡滚不到正中就停在边上。
- **已验证：** `node --check`；375×812 浏览器看了周五介绍页（标签条第 3–5 关、名额说明）、开局名额提示、冬日地毯、老板娘出场，控制台无报错。浏览器复核 `SG_DEBUG.simulate`：周四 100 局 22%，周五 100 局 8%，和 Codex 的 200 局 8% 一致。
- **未验证：** 真人通关、广告复活后过关的证书、微信真机。

## 2026-11-02 · 周五 · 老板娘查账

- **用户定的：** 第五关冬日主题，周四原八人阵容不加人；老板、经理、老板娘三位领导同时在场。老板娘大波浪卷发、大金耳环、棕黄黑斑豹纹外套、手拿计算器，88px；专查排名第一的未压垮同事（排除小舅子），45° 总视野，护短 +3；小舅子压垮后由姐姐追责。2 个下班名额，小舅子占 1 个，压垮后空出；过关三星，失败零星。会议、散会、随机事件、复活、顶包照常；最后一关发原有证书，结算增加大小周彩蛋。不提交、不推送、不部署、不改玩法文档。
- **我定的细节（可改）：** 120 秒一局，开局同事 2 口锅，普通期限 23 秒；天降锅概率 0.08（开局第一口仍沿用原机制）。3 / 30 / 70 / 105 秒起派锅基准间隔 5 / 4 / 3.2 / 2 秒，保留 ±15% 抖动；老板娘间隔倍率 1.1、速度 76、每次 1 口、预警 0.6 秒（老板 0.8 秒）。老板娘按全榜选目标，不因距离或玩家身份换人；从南侧 (480,1320) 起巡，走南侧和外围过道。AI 积极度 1.25、反甩倍率 1.15。22 / 74 秒画饼，各讲 3.6 秒、撒 4 张、留地 9 秒；38 / 62 / 98 秒散会派 6 / 7 / 7 口；35–108 秒三个随机事件（卡纸、下午茶、急件）。两位亲属视野重叠时按姐姐 +3 处理。玩家被查提示“同事里你排第 1，老板娘查你账！快躲红线”。
- **改动：** 新增 s13_wife 四姿势表、w_wife 三行十二帧（左向镜像），逐姿势检查脸、卷发、耳环、豹纹和计算器；初稿多出的金项链已用内置 image_gen 去除。仅构建新增 16 张图，注册 wife 图集和 SPRITES，补生成/切图/构建脚本；DESIGN.md §4.1 只补一行。新增后 assets/px 为 2,015,317 字节，故仅将 wife 图转为 64 色，现为 **1,994,327 字节**（小于十进制 2 MB），旧素材不压缩。全局名额改为关卡 passRank，覆盖星级、HUD、掉出名额提示、倒计时、抢饼判断、反馈贴纸、模拟和结算分割线；周一至周四原文案保留。周五介绍盖住旧三档星级图案，改为两名额说明；横向关卡条两端补留白，使第五卡/标签也居中。压垮小舅子的成就卡不再覆盖末关通关证书，证书原文案未改。字体已重裁，存档键仍为 shuaiguo_v3。
- **已验证：** 所有 js/*.js 逐文件 node --check；git diff --check；周四既有 10 项回归全部通过。tests/friday.cjs 覆盖榜单释放名额、前二三星/第三失败、查账选玩家及同事、排除压垮者、45°/60° 视野边界、老板 +2/老板娘 +3、姐姐追责、路线节点可通行、0.6 秒预警、旧关 3/2/1 星级、通关成就与两种证书、复活减 6 口及顶包减 3 后重算。真实 SG_DEBUG.simulate(4,200) 经 Node 加载原引擎执行，无复活：**16/200 过关（8%）**，玩家压垮 83 局，小舅子压垮 4 局；名次分布 1–8 名分别 1/15/18/16/22/21/16/91；平均玩家背锅 14.4 次、天降锅 2.6 次、生成 103.2 口锅；完整结果在 tests/friday-results.json。最终 16 张透明成品按小尺寸逐张目检，身份一致。
- **浏览器已验证：** 测试版 Chromium 启动 SIGABRT，浏览器连接服务不可用，改用桌面 Chrome 开发工具 375×812；实际看过周五介绍、开局冬日地图、名额横幅、老板娘头像、瞄准红线、头顶“账做得这么干净？我查查”及玩家领先提示、守住前二倒计时、第二名三星结算/分割线/彩蛋、凭本事下班证书和返回大厅第五卡居中。瞄准与成功结算用 SG_DEBUG.state 构造场景，不作为真人过关证据；测试制造的周五星级已移除。无游戏 JS 异常；控制台存在原有 favicon.ico 404 和 AudioContext 自动播放警告，因此不宣称控制台绝对零报错。本次验收标签已关闭、CUA 连接已释放、8765 服务已退出并确认无监听。
- **未验证：** 真人完整通关手感、微信真机、真实广告和真实分享。复活/顶包及关系户证书本轮仅做逻辑验收，未完整走浏览器广告流程；暂停流程本轮桌面操作受用户切换标签及控制连接超时影响，未完成验收。8% 为这 200 局样本值，不代表真人通过率。
- **与规格的出入：** 玩法未主动偏离；浏览器“控制台无报错”未完全达成，原因及未覆盖流程如上。保留既有未提交改动，没有新建说明文档。

## 2026-11-02 · 周四审查和大厅横向滑动（Claude 审查 Codex）

- **用户定的：** 大厅周一到周四的关卡卡片要能横向滑动，现在挤在一起看不清；小舅子换成独立形象；周四加一个普通同事（出纳）；每关都要比上一关难一点。
- **我定的细节（可改）：** 大厅关卡条改成横向滑动，每张卡约占 26% 宽，两头能露出下一张；进大厅和关卡介绍页时，当前关自动滚到中间。Codex 写的关卡介绍页四等分标签也改成同样的滑动条（每张约 32.6%）。机器人身上 9 口锅以上不去抢饼，免得多吃 2 口直接把自己压垮，但踩到照样吃。地上有饼时，屏幕边缘加一个黄圈箭头，指向离你最近的一张饼。黄色表示这是可选的主动操作，吃不吃由玩家自己定。`E.edgeHint` 新增 `{ sprite, whole: true }`，用来把整张道具图放进圈里。老板话术池补上玩法文档里的“今年辛苦一点，明年给大家涨薪”“格局要打开”两句。
- **审查结论：** 周四的会议、撒饼、自动拾取、鸡血（速度、扇形、射程、同事出手距离）、出纳跟风、结算和分享都按文档实现了。急件撞上老板讲话时会推迟到讲完再发，处理得对。素材风格统一。
- **留下的问题：** `cashier_angry` 戴了眼镜，`cashier_normal` 等姿势没有，违反 DESIGN.md“同一角色各姿势身份一致”，需要重出这一张。`tests/` 和 `assets_pixel/ingame/thursday/` 是 Codex 留下的测试脚本和截图，还没决定要不要留在仓库里。
- **已验证：** 375×812 浏览器：大厅和介绍页滑动正常，当前关居中；周四开局、会议预告、撒饼、鸡血特效、气泡、屏幕边缘饼提示都看到了，控制台无报错。AI 代替玩家模拟：周二 40 局全过；周三两批共 100 局过 28%，周四两批共 100 局过 20%。每批波动较大（周四单批 15%–23%），但合起来逐关变难。
- **未验证：** 真人手感、微信真机。

## 2026-11-02 · 周四 · 老板画饼（第二部分）

- **用户定的：** 第四关秋日主题；周三六位同事再加出纳，场上八人；小舅子不排名，其余七人前三下班；老板上午、下午各画一次饼；自动拾取、多两口锅、十秒鸡血；出纳优先甩给三秒内刚被甩中过的人；结算和分享记录玩家吃饼数。
- **我定的细节（可改）：** 一局 120 秒，22 / 74 秒开会（约 10:39 / 14:33），提前 2.5 秒通知；讲 3.6 秒、随机三句，每句 1.2 秒；每次四张饼，保留 9 秒，末两秒闪烁，拾取半径 32px。落点在老板周围 90 / 125 / 160 / 195px 的无障碍候选环上，饼间至少 55px；两张连续吃只刷新十秒，不叠加速度。鸡血扇形半径 200、总角 45°，飞锅最大航程随之由 200 加到 250；同事出手距离 ×4/3。鸡血绿色是增益，+2锅红字是代价。NPC 每批只抽一次抢饼意愿：锅 ≥4 或落后前三时 85%，顺风 12%，小舅子低锅 30%；已有鸡血不主动追饼。出纳：speed .94、turn 4.7、react .23、aggr .95、seekR 480、seekMin 1、dodge .8、caution .7、parry .35、throwR 120、sneak .75。新增出生点 (320,720)、(640,720)，第四关用前七个。
- **最终难度：** 同事开局两锅、期限 24 秒、天降锅概率 .25、积极度 ×1.2、反甩 ×1.1；领导在 3 / 30 / 70 / 105 秒起分别约每 5.5 / 4.5 / 3.6 / 2 秒派锅，经理间隔 ×1.3、一次两口；38 / 62 / 98 秒散会各 6 / 7 / 7 口；35–108 秒随机三种事件各一次。首版 22 秒/.36/1.3/1.2 过难，四组固定种子仅 25/160，已回调。难度主要来自额外同事、跟风与饼的负担，未改周三配置。
- **改动：** levels.js 关卡、出生点、会议配置、介绍与 hints；game.js 人设、三秒实际命中记录、会议与过道撒饼、自动拾取、所有角色增益、气泡与绿色特效、结算/分享和模拟统计；css/style.css 四关标签尺寸与底板残线遮盖；字体重建；tests/game-harness.cjs、tests/thursday.cjs、tests/thursday-results.json 留下可复跑规则与数据。老板讲话时停止移动、普通派锅和碰撞派锅；若随机急件撞上讲话，推迟到讲完发，不吞掉事件；经理照常派锅。
- **自测数据：** Chrome 375×812 中真实执行 SG_DEBUG.simulate(3,40)，固定种子 20261102：8/40 过关（20%），压垮 11/40，平均背锅 12.1、吃饼 .925 张；周三 simulate(2,40)：15/40（37.5%），压垮 6/40，平均背锅 12.4。Node 真实逻辑 + DOM/音频桩，四组种子 20261102–20261105，周四分别 9/40、7/40、12/40、4/40，合计 32/160（20%）；周三 12/40、13/40、12/40、13/40，合计 50/160（31.25%）。跨浏览器/Node 的同种子结果不完全相同，浏览器值作为本次验收值，不宣称任意随机批次都落在目标区间。完整数据见 tests/thursday-results.json。
- **已验证：** 10 项规则断言通过；所有 JS 逐文件 node --check、Python 编译、生成脚本 zsh -n、git diff --check 通过；字体重建。Chrome 375×812 iframe 中走过大厅→四关介绍→开局→会议预告→吃饼→暂停/继续→压垮结算/分享→正常18:00结算→大厅；无横向溢出，页面错误和 console.error 记录均为 0；吃饼有 +2锅、绿色特效与具体承诺，分享显示吃饼数，0张结算不显示；暂停时会议时钟保持不变，恢复后撒四张饼。截图在 assets_pixel/ingame/thursday/。
- **偏差：** Playwright 浏览器启动失败，改用现有 Chrome GUI 和 375×812 iframe；会议位置与正常下班结算使用调试状态定位，正常结算截图不是自然赢局的证明。下午第二场由时间表与批量模拟验证，未单独录制浏览器第二场。首阶段只在游戏内图集预览展示出纳与饼，第二阶段已加入正式对局。素材提示词文件为本次生成规格归档，非工具请求原始日志。源码及本地存档键保持 shuaiguo_v3；未改玩法文档，未提交、推送或部署。
- **未验证：** 真人完整一局的手感与实际过关率、微信真机、原生微信分享；网页分享仍是原有 Demo 预览。无未完成的本次玩法实现项。临时验收页已删除，本任务 Chrome 标签已关闭，CUA 会话已释放，8765 服务器已退出并确认端口无监听。

## 2026-11-02 · 两套正式同事素材与饼（第一部分）

- **用户定的：** 先完成素材再做周四；内置 image_gen、洋红底、参考现有角色；小舅子大金链子与手机，出纳独立配饰主色，人物 64px；保留已有未提交修改，不提交。
- **我定的细节（可改）：** 小舅子墨绿上衣、黑短发、大金链子；出纳砖红上衣、黑齐耳短发、深色袖套。鸡血绿色火焰表示能力增益，加锅另用红字。饼显示宽 40px。新角色沿用 230px 源图上限和 64px 绘制高度。
- **改动：** 五张 image_gen 素材表切出 35 张；更新 cut_sheets/build_px/pack_atlas、SPRITES、小舅子人物状态和局内提示；删除红肩章与白手机的临时绘制；DESIGN.md 阵容表只加两行。SG_DEBUG.previewAssets() 可从游戏图集查看全部新素材。
- **偏差：** 出纳与饼先在游戏内素材预览验收，其实际对局行为留第二部分接入。姿势由生成图提供，不宣称不同姿势逐像素一致。独立 Playwright 缺默认浏览器，指定现有 Chromium 后 SIGABRT，改用 Chrome GUI 验收。
- **已验证：** 顺序完成 image_gen → 保存并读尺寸 → cut_sheets → build_px（只构建新增图）→ pack_atlas；35 张约 262 KiB，assets/px 合计 1,791,295 B，低于 2 MB；所有 JS 逐文件 node --check 通过；Chrome 375×812 iframe 内素材预览可见，周三大厅→介绍→开局，正式小舅子与专属提示图标已显示。
- **未验证：** 真机微信；本部分未更改玩法数值，周三回归模拟随第二部分做。

## 2026-11-02 · 周三加入小舅子（Codex 开发，Claude 审查）

- **用户定的：** 周三加小舅子（关系户）；规则见玩法文档「关系户（老板小舅子）」：不干活、当着老板的面甩他会被护短、永远背锅 0 次、周三不占名额、能被压垮。
- **我定的细节（可改）：** 小舅子开局空手；每口锅单独等 1–2 秒后塞给最近、能甩中的人，他甩锅不会被抓现行。锅砸中他时他站在**老板**视野里才护短（经理不护短）：锅弹回、扔锅的人背锅 +2，老板头上冒“他还小，你多担待点”。锅在他身上到点，背锅算给最后甩给他的人；领导、散会直接派给他的锅到点就消失。排名用关卡字段 `nephewRanked`（周三 false）：排名表最上面单列“不参与排名”，右上角名次和过关线都不算他。压垮后存隐藏成就 `achievements.nephewCrushed`，老板追最后甩中他的人 5 秒（`NEPHEW_CHASE`），结算和分享卡换成“今天我把老板小舅子压垮了”。同事在他站在老板视野里时大多会忍住不甩。
- **临时形象：** 复用业务员素材，加红肩章和白色手机；局内提示图标也用业务员。和业务员太像，正式素材要尽早做。
- **审查时改掉的：** Codex 按项目说明把存档键从 `shuaiguo_v3` 改回了 `shuaiguo_v2` 并加了迁移，已恢复为 v3（v3 是三关改版时有意换的键，AGENTS.md 里写的 v2 已过时）；急件到点的提示被统一成“急件到点，X 背锅 +3”，已恢复原文案；“关系户下班证书”被改成“领导罩着下班证书”，不在这次范围，已恢复；周三关卡介绍只写了小舅子，补回经理。
- **留给周五的问题：** `nephewRanked: true` 时排名把没被压垮的小舅子固定排第 1。周五如果只有第 1 名下班，玩家就永远过不了，做周五时要先定他占名额的方式。
- **已验证：** `node --check` 通过；`SG_DEBUG.simulate(2, 40)`：过关率 35%（Codex 加入前的基线约 40%），玩家平均背锅 11，小舅子平均每局接锅 33 口、背锅 0、40 局没被压垮，护短共触发 18 次；375×812 浏览器进周三，介绍页显示 7 人、右上角名次分母是 6，小舅子名牌和提示正常，控制台无报错；字体已重建。
- **未验证：** 真人手动触发护短、压垮小舅子后的成就、追人和分享卡（模拟里没出现过压垮）；真机。

## 2026-11-02 · 每关主题配色

- **用户定的：** 地图不变，每关加一套主题颜色，先做最简单的、只改颜色。参考图有六套：默认办公、春日绿意、海滨度假、赛博夜城、秋日枫叶、冬日雪景。
- **我定的细节（可改）：** 周一默认办公、周二春日绿意、周三海滨度假；周四秋日枫叶、周五冬日雪景、周六赛博夜城（加班到深夜）。只换工位区地毯，房间地面和墙不动；地毯保持低饱和浅色（DESIGN.md §3.2）。
- **改动：** `js/game.js` 加 `THEMES` 和 `floorOf()`，`drawFloor` 按当前关的主题取色；`js/levels.js` 每关加 `theme` 字段。秋日、冬日的配色已写好，还没有关卡用。
- **偏差：** 赛博夜城是深色地板，现在的深色文字标签放上去看不清，这次没做。
- **已验证：** JS 语法检查通过；375×812 浏览器里进周二、周三对局，地毯分别是浅草绿和浅沙色，控制台无报错。
- **未验证：** 周一带教全流程（只改了取色函数，周一是原色）、真机效果。

## 2026-11-02 · 老板丑化：改成地中海盖顶

- **用户定的：** 原来的老板太美化了，要丑化一点；从 12 个丑化方向的样稿里选了 A「地中海盖顶」。样稿和对比图在 `../prototypes/boss-ugly/`（`overview.jpg`）。
- **我定的细节（可改）：** 保留黑墨镜、藏青西装、红领带作为识别特征，只改头型和身材：秃顶加几缕横梳的头发、两鬓炸毛、啤酒肚、衬衫崩一颗扣。老板的 4 个动作单独出一张表 `s9_boss`（`gen_assets.sh`），`s5_boss_items` 第 1 行的旧老板在 `cut_sheets.py` 里改成 `None`，不再输出，锅和特效不动。走路表 `w_boss` 重出（`gen_walk.sh` 的 REF 现在支持写绝对路径）。两张表都用 A 样稿作为身份参考。
- **素材：** 重出 `boss_walk/aim/chase/idle` 和 12 帧走路，build_px 只构建了这 16 张，图集已重打。`assets/px` 合计 1.8 MB，没超过 2 MB。旧的老板表和成品备份在 `../prototypes/boss-ugly/old/`。
- **注意：** 老油条也是光头，两人现在都是秃头。靠老板的墨镜、两鬓炸毛和体型来区分，画面边缘的方位头像也能分开（老板红框戴墨镜，老油条绿框戴小眼镜）。
- **已验证：** JS 语法检查；390×844 浏览器第 1 关自动对局，老板巡逻和走路正常，屏幕边缘的头像已换成新脸，控制台无报错；16 张素材按游戏尺寸拼图检查过，帧间一致、脚底对齐。
- **未验证：** 瞄准、追人、结算页、「领导出差」Buff 卡上的新老板没在实机里逐个看到（用的是同一批图，按理会自动换上）。

---

## 2026-11-02 · 下班倒计时按参考图直接切片重做

- **用户定的：** 素材直接从参考图裁切（assets cut directly from the reference），不再 CSS 拼框。三档 10–6 秒黄 / 5–3 秒亮橙 / 2–1 秒红，角标按原图黄 / 黄 / 红；去除素材中的标题、副标题、短横线、数字和「秒」，文字由代码叠加。钟体独立抖动，保留排名文案、逐秒弹跳及音效、0.45 秒铃声 + 1 秒反馈。字体先保持思源黑体（用户定）。
- **我定的细节（可改）：** 三张统一裁框为 x=86..1290（右端不含）、y=126..422 / 461..757 / 796..1092，尺寸 1204×296（4.068:1，包含完整描边与底部硬边）。显示宽 min(390px,100vw - 16px)。钟层 left/top/width/height=2.990%/16.554%/21.927%/68.581%；文字区=25.415%/15.541%/42.359%/67.568%；副标题相对文字区 top=62%；数字区=74.585%/18.919%/18.771%/58.784%。标题 8.1cqw、副标题 5cqw、数字 16cqw、「秒」6cqw；10 的字宽单独缩小以免溢出。10–6 秒平静钟，5–3 秒黄振动钟（用户按参考图定），2–1 秒红振动钟。
- **素材与复现：** 运行 python3 assets_pixel/cut_closing_ref.py，再运行 build_px.py（指定 closing_base_yellow/orange/red/plain 与 closing_clock_yellow/orange/red 七个名字），最后 pack_atlas.py。底板 1170×288，钟层 258×198；七张共 56,127 B，全部 assets/px 共 1,492,001 B。删除 ui_closing_clock 的旧成品、原表、提示词和切图配置；图集及 SPRITES 已更新。对照图 assets_pixel/ref/closing_compare_src.png 左边原图，右边无字底板叠钟体。
- **擦字问题与偏差：** 参考 WebP 存在细微色差，字有深色描边与硬阴影；整块覆盖文字及阴影区域，用无字空隙的深蓝补齐，数字底色用黄/亮橙 #FD6D2C/红填平，保留数字块左上高光、原边线与厚底边。透明化只处理与外界连通的近黑背景，避免内部黑描边产生针孔。钟层通过颜色分离保留原钟及振动线。擦除区域比原图更均匀；中文按要求用思源黑体 900，字形不是原图生成的像素字，不能声称文字逐像素相同。无数字块底板用无字面板的一列延展，保留右端阶梯切角；铃声奶油白标题、成功绿 #2F9E6B、失败红 #E8504A，不对底板整体染色。旧版 CSS 边框、角标和振动线全部移除。
- **已验证 / 未验证：** 原尺寸无字对照图与无数字底板已目视检查，未见残字；素材压缩、图集重打、所有 JS 逐个 node --check、git diff --check 通过。无新增界面文字，未重新裁字体。Claude 在 412px 宽浏览器里看过 8/5/4/2 秒、18:00 铃声和失败反馈，控制台无报错；320px 只量了尺寸（304×75，不溢出）。未验证：真机触屏、音效实听、成功反馈画面。

---

## 2026-11-02 · 音频：BGM 和音效换成真实素材

- **用户定的：** 先梳理要哪些音频；先让 Codex 上网找可商用素材，找不到的用 API 生成；生成选 ElevenLabs。
- **清单（43 项）：** BGM 4 首（大厅 / 对局 / 17:00 突击派活 / 周五关）、短曲 4 首（过关、加班、压垮、解锁）、音效 35 个（对局核心、办公室事件、界面）。完整清单、来源、授权、Codex 的评语都在 `assets_audio/sources.json`，`audio.html` 可逐个试听。
- **素材来源：** Codex 找到 34 项，全部 CC0、免署名（Kenney、OpenGameArt、Freesound 等），原始文件放 `assets_audio/src/`（不进仓库，约 30 MB）。另有 8 项没找到合适的（压垮短曲、急件引信、撞领导、同事压垮、散会喷锅、打印机卡纸、上班、突击派活），用 `assets_audio/gen_elevenlabs.py` 按 sources.json 里的提示词生成；最后 3 秒的急促滴答用 tick 升调连响两次代替，不单独做。
- **我定的细节（可改）：** `build_audio.py` 统一转码：BGM 两遍 loudnorm 到 -18 LUFS、立体声 96 kbps；音效去开头静音、峰值 -1 dB、单声道 64 kbps；下班铃截到 2.2 秒。清单生成到 `js/audio.js`（带内容哈希）。引擎改为采样优先，缺的或没加载好的退回原来的合成音；音效一次预载，BGM 播到哪首加载哪首。BGM 场景：大厅和关卡介绍放 lobby，开局从头放 work，17:00 换 rush，暂停后接着放，结算停；音乐开关立刻生效。第一次触摸页面就解锁音频，大厅音乐不用等开局。所有按钮统一点击音（返回类用低音），连甩越连越高，结算星星逐个叮、新解锁再叮一声。批量模拟时静音。
- **偏差：** 周五关 BGM 已选好但第 5 关还没做，先不打包。素材来自不同作者，风格基本统一在 16-bit，但实录的锅声、门铃和电子音混在一起，需要真人试听后再换。
- **已验证：** JS 语法检查；浏览器 375×812 走了大厅 → 关卡介绍 → 第 3 关自动对局 → 暂停 / 继续 → 17:00 换曲 → 下班铃 → 结算 → 回大厅 → 设置里开关音乐，用播放记录确认每个场景播的是对的文件，控制台无报错。
- **ElevenLabs 补的 8 项：** 已生成，每项两版（`src/<id>__v1.mp3`、`__v2.mp3`），游戏默认用第 1 版，`audio.html` 里两版并排可比，想换就改 sources.json 的 src 再跑 build_audio.py。本机 python.org 版 Python 没装根证书，运行生成脚本要加 `SSL_CERT_FILE=/etc/ssl/cert.pem`。现在共 41 个文件 1.98 MB。
- **未验证：** 真人试听（听感、音量平衡、mp3 循环接缝、AI 生成的两版哪个好）；iOS Safari 和微信小游戏真机。

---

## 2026-11-02 · 锅到期漫画爆炸（已按用户纠正）

- 用户定的：明确使用 pixelfx 的 `explosions/cartoon-pow`，带 POW! 字样的漫画爆炸；缩小后在到期的锅上播放。
- 我定的细节（可改）：原版默认参数导出本地33帧透明序列图，30fps、1.05秒；普通锅画布宽92、急件110，中心对准锅。保留原版配色、文字、射线与散星；文字按用户指定参考作为素材规范的特例。
- 偏差与修正：此前误选 small-explosion 火球冒烟，现已替换并删除错误素材。使用本地序列帧代替整套运行时粒子库，素材约191 KiB；版本、导出参数、MIT许可见 assets/fx/。
- 已验证：JS语法检查；375×812浏览器大厅→介绍→开局→暂停/继续→回大厅；普通/急件同时到期位置与背锅+4；飞锅到期；动画暂停和清理；实机截图，无页面异常。
- 未验证：微信小游戏真机。用户随后要求更新，按现有 main 自动部署流程提交发布；线上结果见本次会话核验。

## 2026-11-02 · 开局页按参考图美术与坐标重做

- **用户定的：** 上一版视觉差距过大，要求尽量百分百还原参考图，允许生成图片素材；周一、周二、周三全部统一。
- **我定的细节（可改）：** 内置 image_gen 以参考图为编辑目标，去掉文字、数字、锁和播放三角，保留背景、锅、闹钟、摇杆、眼睛、奖杯、奖牌星星、草丛与按钮。底板保持 956×1645；文字、锁、数字和按钮交互使用 DOM，按原稿坐标定位并同比缩放。选中关卡切换金色按钮切片，其余浅蓝；文字仍取真实人数、期限、急件惩罚。周二增加反弹和散会提示，周三增加经理与急件提示。最好成绩、重看教学使用原图留白区。
- **素材与复现：** 原参考在 `assets_pixel/ref/intro-reference.jpg`；生成底板与提示词在 `assets_pixel/sheets/intro_skin.png`、`intro_skin.prompt.txt`。执行 `cut_sheets.py intro_skin` → `build_px.py intro_plate intro_tab_gold intro_tab_blue` → `pack_atlas.py`。底板保留不透明背景，不做洋红抠图；独立 intro 图集约 84 KB。全体 assets/px 共 1,438,586 B，仍低于 2 MB。新增图片统一经 E.pxUrl 使用。
- **偏差：** 生成图保留原稿风格与几何构图，但不宣称像素逐点相同；游戏文字仍为真实可访问文本。周一将“带教老师”换成当前角色老周。不同屏幕保持原稿比例，长屏留蓝边、矮屏可滚动，不拉伸插画。没有修改对局数值。
- **已验证：** 375×812、320×568、1440×1000 三关均无横向溢出、规则文字溢出、缺图或 JS 异常；开局→教学/正式对局→暂停→回大厅、选关高亮、锁定、重看教学、最好成绩均实测。浏览器截图对照原图检查位置与美术。曾因测试脚本重复等待已完成教学而超时，修正测试前置状态后全部通过。所有 JS 语法、Python 脚本语法与 git diff --check 检查通过；字体重新裁剪。
- **未验证：** 微信真机、整局结算与真实触觉反馈。本轮继续此前已授权的提交部署流程，发布结果以会话中的线上核验为准。

---

## 2026-11-02 · 三天开局介绍按参考图重做

- **用户定的：** 按提供的像素风参考图优化开始部分，周一、周二、周三都做。
- **我定的细节（可改）：** 统一蓝底、奶油纸卡、阶梯边框、黄色主按钮和浅蓝返回按钮；顶部保留三关切换、锁定和通关星级。每页用三张图文规则卡与前三名星级奖励。周一讲截止时间、摇杆和老板视野；周二讲反弹、散会喷锅；周三讲双领导、急件。期限、人数、急件惩罚取实际配置。使用现有图集素材，无新增图片请求；字体已重新裁剪。
- **偏差：** 按现有素材复用闹钟、手势、人物、皇冠和盆栽，未复刻参考图的眼睛、摇杆、奖杯和草丛插画。人数标签使用中性深蓝，红色留给风险提醒。小屏采用卡片内部纵向滚动，内容不截断。
- **已验证：** 所有 JS 逐个 node --check，git diff --check。独立 Chromium 浏览器实测 375×812、320×568、1440×900 的三关页面：无横向溢出、无缺图、无脚本异常。走通大厅→周一介绍→教学→跳过教学→暂停→继续→回大厅；周二、周三开局→暂停→回大厅；关卡切换、锁定、最好成绩和重看教学。截图检查修正了浅蓝按钮边框拉伸和 320px 装饰溢出。精简与本地正确性审查完成；没有改玩法，因此未新增单元测试。
- **未验证：** 真机微信环境与完整一局结算；本次仅改开局介绍，不更改对局和结算逻辑。实现验收时尚未提交、部署；随后用户要求直接提交部署。测试浏览器和临时服务用后关闭。

---

## 2026-11-02 · 表现反馈像素贴纸（稳住了 / 漂亮 / 好样的）

- **用户定的：** 照 `../prototypes/shuaiguo-feedback.html` 方案一、2px 一格实现。三组文案原样保留；calm 仅零背锅普通甩锅命中、10 秒冷却，parry 仅反甩后真正命中、3 秒冷却；开局 15 秒后连续掉出前三至少 3 秒再回升触发 rankup。带教、批量模拟不触发；优先级 1／2／3、无队列；暂停／设置／结算／大厅／重开立即清理，closing 不出新贴纸。main 上直接改，不提交。
- **我定的细节（可改）：** 在素材和字体就绪后预合成并解码三种模板，开局复用；只对实际播出的贴纸记冷却。宽度预算额外计入星星与 1.06 倍弹出。挂点与横幅冲突时选最近的空闲纵向位置，无空位静默跳过；后到的横幅与贴纸碰撞时立即清除贴纸，保留横幅且不移动已播放贴纸（closing 不做此清除）。退出动画仍占优先级，clearPraise 连正在被打断淡出的旧贴纸一起清理。rankup 只有播放成功才响三连音和震动。
- **素材：** 内置 image_gen 生成 `assets_pixel/sheets/ui_praise.png`，原始提示词见同名 `.prompt.txt`；附 c_pixel.png 风格参考。按 cut_sheets → build_px → pack_atlas 接入。成品 `assets/px/ui_praise_thumb.png` 2,072 B、`ui_praise_bounce.png` 2,355 B、`ui_praise_rankup.png` 2,160 B，合计 6,587 B；像素目录合计 1,357,474 B（约 1.29 MiB），低于 2 MB。运行字体裁剪，更新 fonts.css、字体、misc 图集和 atlas 索引。
- **偏差：** 浏览器无法启动，未能截原型图作为第二张生图参考，仅附风格图并按原型代码和用户描述实现；未制作任何冒充实机截图的图片。正式生成图先关平滑缩为 21×21 真像素再两倍画入低分辨率画布；未使用原型手绘图标后备。
- **已验证：** 每个 js 文件逐个 `node --check`、`git diff --check`。Node VM 执行实际 game.js 函数，验证 calm/parry 命中与冷却、第一次背锅后禁 calm、反甩当下无贴纸且被再弹回不报 parry、3/4 名抖动和连续 3 秒回升、带教／模拟／非 play 状态屏蔽、主角屏幕 y 换算。另一组测试执行实际引擎函数（模拟 DOM/动画），验证高级打断、低级/同级丢弃、120ms 收起、清除定时器、30%/62% 挂点、320px 宽度预算、减少动态 160ms 淡入淡出。检查透明 PNG 与体积。
- **浏览器补验（Claude，同日）：** 375×812、`?level=2` 实际开局，用 `SG_DEBUG.praise` 依次弹出三种贴纸，三个生成图标与标题合成清晰；calm 后 0.4 秒弹 rankup 时 calm 淡出、rankup 接上，反过来 calm 被丢弃；主角屏幕 y=200 时挂点换到 62%（503px）；点暂停后贴纸立即消失；控制台无报错。320×568 下贴纸宽度缩到 265px、不溢出。
- **补验发现并修复：** 小屏上教学横幅占住 30% 挂点时，备选位置只避横幅、不避主角，贴纸落在屏幕正中盖住主角。`praisePosition` 把主角（avoidY-50 ~ avoidY+40）也算作占位，修复后贴纸改放到主角下方。代价：320×568 且有教学横幅时，贴纸会压住「甩」键的上半部分约 1.5 秒（不拦截点击）。
- **自然触发：** `?level=2&auto=1` 跑 38 秒，calm（17 秒、31 秒，间隔满足 10 秒冷却）、rankup（18 秒）、parry（23 秒）都由真实对局事件触发。
- **未验证：** rankup 音效与震动实听、减少动态效果模式、完整一局到结算的流程、SG_DEBUG.simulate 批量对局。浏览器截图没有存成 `assets_pixel/ingame/praise_*.png`。

---

## 角色叫法改成下沉市场通用版（2026-11-02）
- 用户定的：玩家主要是下沉市场的职场人，不一定在互联网公司，角色改用 B 方案：会计、业务员、美工、老油条、新来的，领导是老板、老板娘；相关的词一起改，不能穿帮；关系户先记进文档。
- 改动：产品经理→会计、测试小王→业务员、设计师→美工、实习生→新来的、总监→经理；P0→急件（只改界面，代码里的 `P0_LIFE`、`hot`、`p0` 等标识不变）；【技术群】→【工作群】，HR→人事；锅上的字：线上Bug→返工、加急→盘点、复盘→对账、改需求→改方案、写文档→做表格；周三关卡名改成「开大会」，散会消息改成销售会、月度总结会、安全培训；带教→教学（按钮、标题）；大厅台词换掉「对齐口径」「谁提的需求」。重新裁剪了字体。
- 偏差：第二位领导先叫「经理」，没叫「老板娘」，因为 `director_` 形象是西装打领带的男人，直接改名会穿帮。老板娘和关系户的设计记在玩法文档的「预留」一节。
- 我定的细节（可改）：教学里老周的台词改成「第一天上班？我是老周……」，并说明那个「新来的」比你早来一周，免得和主角也是新人这件事冲突。
- 文档：同步了玩法文档和 `DESIGN.md` 的角色表；`DESIGN.md` §8 和 `AGENTS.md` 加了一条「不用互联网行话」。素材文件名（`pm_`、`tester_` 等）没改。
- 已验证：JS 语法检查通过；375×812 浏览器里看过第 3 关介绍（老板、经理）、开局后头顶名字（会计、业务员、美工、老油条）、主角拿着急件时甩锅键显示「急件」，以及第 1 关教学第一句台词和「跳过教学」按钮；新字都走自托管字体，控制台没有报错。
- 未验证：没完整打完一局，所以结算战报、急件事件群消息、散会消息都只核对了文案，没在画面上看过。


## 下班收尾流程（2026-11-02）
- 用户定的：按参考图分成提前预告、最后 3 秒倒计时、18:00 到点提示、胜负反馈、结算；前三名通关要明确传达「准点下班」。
- 我定的细节（可改）：提前 8 个实际对局秒预告，随当前名次切换「守住前三 / 冲进前三」；最后 3 秒小面板显示 3、2、1，各响一次轻提示音；到点铃声提示 0.45 秒，随后胜负反馈 1 秒，再淡入结算。时长常量在 js/game.js 顶部。
- 行为：18:00 截断最后一帧，先处理当时已截止的锅，再冻结移动、派锅与计分；收尾期间不能暂停/打开设置，切后台停止收尾计时；成功用绿色标题和主角下班姿势，失败用红色标题。提前压垮仍立即结算，保留复活、找人顶锅、下一关和再来一局。
- 界面：预告贴在 HUD 下方，不遮主角中心视野、不截获操作；临时隐藏普通教学/群消息，避免重叠；结算标题改成「准点下班！ / 这次得加班了 / 被锅压垮了」。减少动态效果设置下不播放淡入。重裁三款字体。
- 偏差：无新美术素材，复用 player_win / player_panic；沿用现有对局时间（暂停不计时），没有改变关卡数值和前三名规则。
- 已验证：所有 JS 语法及 git diff --check；临时 Playwright 浏览器脚本通过大厅→介绍→开局→暂停/继续→结算→回大厅；调试状态构造第 2 名两星与第 4 名失败，验证动态预告、3/2/1、18:00、成绩及位置冻结；恰好 18:00 到期的锅计分，晚 0.01 秒的不计分；找人顶锅后成功、下一关、提前压垮、复活通过。320 / 375 像素手机宽度和 1280 桌面布局检查、截图检查，控制台无报错。
- 验证方式：仓库没有自动化测试框架，使用 /tmp 下的临时浏览器脚本和已有 SG_DEBUG.state 构造末局状态，不增加生产测试接口或依赖。未验证：完整手动打完一局、真机触屏与实际扬声器听感。未提交、未部署。


## 老板自定义称呼（2026-11-02）
- 用户定的：老板脚下显示参考图式名牌，大厅可改名，长度约 5–6 字。
- 我定的细节（可改）：最多 6 个 Unicode 字符，默认「老板」，留空恢复默认；大厅独立「老板称呼」入口，保存/取消；白底、深蓝描边、红字，宽度随名字变化。
- 数据：复用当前实际存档键 shuaiguo_v3，新增 bossName 字段，保留其他进度；新局创建老板时读取，总监仍叫总监；动态领导台词同步使用称呼，教学固定文案仍使用角色称谓。
- 已验证：六字保存、刷新保留、新局读取、七字拒绝保存；大厅→介绍→开局→暂停→回大厅；375×812 大厅布局、控制台无错误；JS 语法检查与字体重新裁剪。
- 未验证：真机输入法与软键盘；任意自定义字不可能全部进入字体子集，缺字使用系统字体回退。


## 带教手指换参考图素材（2026-11-01）
- 用户定的：手绘 SVG 效果差，要贴近所给参考图。
- 我定的细节（可改）：内置 imagegen 以参考图生成透明底 PNG，保留长食指、宽奶油白手掌、蓝灰阶梯阴影、袖口与黄色点击线；原图留在 `assets_pixel/sheets/ui_coach_hand.png`，缩为 192×207 的游戏素材 `assets/px/ui_coach_hand.png`，显示为 80×88。生成提示词见同目录 `.prompt.txt`。
- 改动：移除旧 SVG，使用 `data-px` 从图集取图，更新图集并重新对齐指尖；最后一步的操作锁保持现有实现。
- 偏差：透明背景直接由 imagegen 生成，未用洋红底切图；只做透明边界裁切与最近邻缩小，不改生成图内容；没有新文案，无需裁字体。
- 已验证：JS 语法和 diff 检查通过；375×812 浏览器检查手指无白底、指尖落在开始按钮；通过临时调试快速到最后一步后点击开始，手指消失、正式计时；控制台无错误。像素素材总计约 1.6 MB。
- 未验证：真机触屏、完整七步手动通关。


## 带教手指与最后一步锁定（2026-11-01）
- 用户定的：带教操作要有手指引导；最后一步只允许点「开始上班」，确认后正式开始。
- 我定的细节（可改）：沿用现有像素 SVG 图标做法画透明白手套，配慢速轻点动画；走路时指摇杆，停手时再提示；有锅、瞄准同事且不在领导视野里时指「甩」；最后指「开始上班」。手指不拦截点击，减少动态效果设置下不播放动画。
- 行为：最后一步冻结对局更新，拦截摇杆、甩锅、跳过、设置、暂停与快捷键；进入/退出时清空按键和摇杆、释放指针捕获，避免把带教操作带入正式局。确认后收起手指，恢复正常输入，上班时钟从 09:00 起算。
- 偏差：未重新生图，未增加 PNG、图集或文案，无需重新裁字体；保留本次任务前已有的带教标题牌高度调整。
- 已验证：全部 JS 文件语法检查通过；375×812 浏览器查看最后一步，手指指向按钮；用调试状态快速推进带教后，方向键、暂停快捷键与背景点击未改变玩家位置或对局时间，点击「开始上班」后解除锁定、时钟推进，再暂停并返回大厅正常，控制台无错误。
- 未验证：真机多指触屏与完整七步手动通关；此次最后一步验证通过临时调试加速到达，未改生产带教步骤。

## v5（2026-11-01）：三关 + 第 1 关带教
- 用户定的：两关改三关；新第 1 关要简单、有爽感，基本规则都在第 1 关教完；带教用「停住时间、做对了才往下」；按实现计划里的默认数值开工
- 原型：`../prototypes/shuaiguo-tutorial.html`（用户看过后确认流程）
- 关卡：
  - 第 1 关「周一 · 入职第一天」（新）：带教 7 步 → 正式上班 90 秒 → 68 秒起下午茶收尾；你 + 产品 / 实习生 / 老油条，老板一位；锅期限 40 秒，同事积极度 ×0.5、完全不反弹，老板约每 10 秒 → 8 秒丢一次，没有天降锅（带教之后）、散会、随机事件
  - 第 2 关「周二 · 早会之后」= 原第 1 关，数值不变；教学提示从 9 条减到 4 条（反弹、散会、压垮、冒火同事）
  - 第 3 关「周三 · 需求评审」= 原第 2 关，原样
- 做法：
  - `game.js` 把时间拆成两个：`S.t` 对局物理时间（锅的截止、动画），`workT()` 上班时钟（派锅节奏、散会、事件、提示、下班判定、屏幕时钟）。带教时 `S.t0 = Infinity`，时钟停在 09:00
  - 带教数据在 `levels.js` 的 `tutorial`（站位 + 步骤文案），做法在 `game.js` 的 `TUT_STEPS`（enter 布置、check 完成条件、事件回调 potOnMe / land / blame / arrive）
  - 带教保护：锅不走时间（`due = Infinity`，开始上班时统一起算）；还没讲到甩锅时按「甩」无效、键变灰；在视野里 / 扇形里没人时按「甩」只提示不扔；同事站着不动；老板只按剧本走位和派锅，不追人、撞上不派锅
  - 老周的话沿用教学横幅样式（标签「带教」+ 老油条端茶头像），一直显示到下一句；最后一步横幅里有「开始上班」按钮
  - 新字段：`basic`（介绍只列 3 条基本规则）、`tips`（看情况弹：锅快到点 / 带锅站进视野 / 15 秒后掉出前三）、`finale`（下午茶 + 老板塞 4 口锅，期限卡在 18:00）
  - 存档键 `shuaiguo_v2` → `shuaiguo_v3`，新增 `tutDone`；第一次进第 1 关走带教，之后跳过；HUD 有「跳过带教」，第 1 关介绍有「重看带教」；`?tut=1` 强制带教；`?auto` / 模拟不走带教
- 我定的细节（可改）：
  - 带教结束时清零所有人的背锅次数（带教里实习生背了 2 次），免得重玩跳过带教时难度不一样
  - 带教里被甩中的同事不一定是实习生，「到点背锅」那一步用实际被甩中的人（文案里的 `{who}`）
  - 老周的自我介绍加了一句「大家都叫我老油条」，和场上名字对上
  - 原型里「站着不动自动转向同事」没带进来（真游戏有轻推摇杆原地转向）
  - 下午茶收尾时同事躲人的力度 ×0.25、往茶水间走的力度 1.1 → 2.2（只在第 1 关的收尾生效，第 2、3 关的下午茶事件不变）
  - 黄圈放在 (595, 745)：原先 640 在 375 宽的屏幕上贴边被切
- 偏差：
  - **修了一个旧 bug**：关卡难度倍率写 0 时被 `||` 当成没填、按 1 倍算（第 1 关 `parry: 0` 一开始没生效）。改成只有没填才按 1
  - 第 1 关关掉了「实习生被欺负 → 老板追人」：带教结束时大家站得近，同事 3 秒内就把实习生甩到 3 口，老板马上追人，这个机制第 1 关没教
  - 下午茶从计划的 72 秒提前到 68 秒（收尾约 22 秒）：72 秒时 AI 玩家平均 1.2 口没甩掉，第 1 名只有 47%
  - 老板带教时的停留点 (790, 545) → (765, 540)，视野更容易同时罩住实习生和主角；寻路失败时直接算到位，免得卡住
  - 带教中途暂停点「重新开始」，会从头再走一遍带教（`tutDone` 在开始上班或跳过时才记）
- 模拟（AI 代替玩家，不含带教）：
  - 第 1 关 100 局名次 1/2/3/4 = 67/21/8/4；平均背锅 你 1.2 / 产品 2.6 / 实习生 4.4 / 老油条 2.7；收尾期间 AI 玩家平均背锅 0.9
  - 第 2 关 40 局 1/2/3/4 = 20/13/6/1（和改动前一致）
  - 第 3 关 200 局前三 71 局（35.5%）；改动前的代码同样 200 局前三 61 局（30.5%），属于随机波动，逻辑没变
- 已验证：375×812 下完整走了一遍带教 7 步（键盘模拟摇杆）→ 开始上班 → 下午茶收尾 → 结算 → 下一关进第 2 关；跳过带教、重看带教、看情况弹的「快到点」提示、大厅三页日历（工牌 0/9）都正常；`node --check` 通过；字体已重新裁剪；控制台没有游戏报错
- 未验证：真人手指操作摇杆走带教的手感；真人玩下午茶收尾能不能在 22 秒内跑到茶水间连甩；「带锅站进视野」「掉出前三」两条提示只看了代码，没实际触发

## v4.2（2026-11-01）：大厅按图稿重做
- 用户给了一张大厅图稿，要求首页改成那样
- 改动：标题加黄色放射线、描边加粗；副标题改成奶油切角框；主角站中间、头顶三口锅呈弧形；实习生和老油条从两侧朝主角走来（原来是左右来回走）；关卡卡片改成切角框，当前关深蓝金边 + 「当前」标签 + 外侧闪光；卡片下加「第 N 关 · 关名」分隔线；「去上班」改成带工牌图标和 ▶ 的黄色大按钮；「玩法」改成居中的小按钮
- 复用弹窗的 `--frame-cream` / `--frame-yellow` / `.rays`，新增 `--frame-navy-gold`（当前关卡片框）；没有新素材
- 我定的细节（可改）：锅上下浮动、闪光交替闪烁、同事原地轻微起伏（全用 CSS）；当前关是第一张时，闪光放在卡片左侧；屏高 ≤ 720 时整体收紧
- 已验证：375×812、375×667 布局；点主角冒台词、切关卡、去上班进关卡介绍；无控制台错误

## v4.1（2026-11-01）：网页加载提速
- 背景：线上服务器在美国波士顿，国内每个请求约 0.6 秒才开始返回；开局要加载约 175 个文件、没压缩没缓存，还从 Google Fonts 拿字体
- 用户选了三项：合并图片、nginx 开 gzip 和缓存、去掉 Google Fonts
- 做法：
  - 图集：`assets_pixel/pack_atlas.py` 把 160 张小图按角色 / 物件 / 图标分成 10 张图集（256 色调色板，合计约 1.1 MB，比单张合计还小），位置表在 `js/atlas.js`；引擎 `E.loadAtlas` 加载后切成单张，界面 `<img>` 用 `E.pxUrl` 拿 data URL
  - 字体：`assets_pixel/build_fonts.py` 只保留代码里出现过的约 980 个字，站酷快乐体 95 KB、思源黑体 700 / 900 各约 150 KB（思源黑体只在弹窗出现时才下载）
  - nginx：`nginx.conf` 开 gzip（game.js 100 KB → 35 KB）；图集、字体缓存一年（地址带内容哈希）；单张素材和大厅背景缓存 1 天；页面、脚本、样式每次确认更新
- 我定的细节（可改）：大厅背景单独加载不进图集；单张素材仍保留在 `assets/px/`，图集某张加载失败时自动退回单张
- 已验证：本地首屏请求数 175 → 19，没有任何外部请求，无控制台错误；大厅、关卡介绍、局内画面、HUD 和横幅图标都正常；Docker 本地构建镜像，`nginx -t` 通过，响应头的 gzip 和缓存时长都对
- 未验证：线上（需要推送后自动部署）实际打开时间；没有在国内真机网络下测

## v4（2026-11-01）：大厅
- 用户定的：大厅是《这锅你来背》自己的主界面（不是多游戏合集）、静态场景菜单（不做可走动大厅）；素材按现有风格用 Codex 生成
- 流程：加载完 → 大厅 → 「去上班」进关卡介绍 → 「开始上班」开局；结算、暂停、关卡介绍都能「回大厅」
- 新素材（`assets_pixel/gen_lobby.sh`）：`lobby_bg`（门厅背景，512×768，54 KB）、`ui_lock` / `ui_badge` / `ui_book` / `ui_calendar`
- 我定的细节（可改）：
  - 大厅内容：左上「工牌 N/6 星」、右上静音；标题 + 副标题「今天这锅，反正不是我的」；主角站中间待机，点他换成得意姿势冒一句甩锅台词
  - 两个同事路过：实习生身后拖 3 口锅、老油条空手拿保温杯溜达（幸灾乐祸的对照），按走过的距离换帧，和局内一致
  - 关卡做成两页「日历」（周一 / 周三），点一页切换当前关；默认选中最新解锁的关
  - 宽屏时背景按高度铺满、居中，两侧露地毯色
- 偏差：
  - 结算页和暂停里原来的「选关」改成了「回大厅」（大厅里能选关），避免按钮再变多
  - 关卡介绍里的 🔒 换成了像素锁图标（DESIGN.md 要求新界面不用 emoji）；规则列表抽成 `rulesHtml()`，大厅「玩法」和关卡介绍共用
  - `?level=N` 调试参数会跳过大厅，直接进关卡介绍
- 已验证：375×812 和 1280×800 下看过布局；大厅 → 玩法 → 关卡介绍 → 开局 → 暂停 → 回大厅整条走通，无控制台错误；有进度时星星、解锁和默认关卡正确
- 未验证：真机刘海屏的安全区；结算页「回大厅」只看了代码（和暂停用同一个函数）

## v3（2026-11-01）：出事追责
- 用户选了方案一“出事追责”，并加了两条：不能当着领导甩锅（扇形视野，稍长但别太难）、天降锅（只砸主角）；锅太多直接判输保留
- 锅从字符串改成对象 `{ label, due, hot }`；甩锅总是扔最急的那口；P0 也是一口锅，只是期限 10 秒、到点背锅 +3
- 我定的细节（可改）：
  - 计时从锅第一次落到人身上开始，飞行中也在走；到点时还在空中，算扔锅的人
  - 天降锅只由老板丢；第 3 秒固定一口代替原来的“第一口锅固定丢给玩家”，主角开局空手
  - 领导视野被墙挡住；被抓现行 = 锅不走 + 背锅 +1；反甩（弹回飞来的锅）不受视野限制
  - 压垮从 20 口降到 12 口（9 口报警），因为没有了消化，锅会自然到点消失
  - 去掉 15 秒自动消化、积分、总分、“总分翻倍”广告；复活改为甩掉 6 口，“找人顶锅”改为背锅 −3（−2 时实测常和同名次并列，排不上去）
  - 主角最急那口锅剩 10 秒内时，头顶右侧标“⏰N”：站着不动时锅叠在人身下，挡住了锅上的数字
- 用户中途要求：去掉左上角的全场排名面板，只保留右上角“第 N 名”；我在旁边加了一个“背锅 N”小标签（375 宽时会和静音 / 暂停键排在第二行）
- 模拟（AI 代替玩家）：第 1 关 30 局名次 1/2/3/4 = 15/10/3/2，平均背锅 你 2.2 / 产品 2.7 / 实习生 7.6 / 老油条 4.7；第 2 关天降锅 35% 时前三 13/30，降到 30% 后 14/40
- 未验证：真人能否看清倒计时颜色；第 2 关主角背锅比同事多 2–3 次，主要来自天降锅，可能显得不公平

## v2.5（2026-11-01）：扇形收窄、距离减半
- 用户要求：扇形大约 30°，距离至少减一半，现在太好甩
- 我按「总开角 30°」理解（左右各 15°，`AIM_CONE` 0.95 → 0.26）；如果原意是左右各 30°，改成 0.52 即可
- 扇形半径 300 → 150；锅最远飞 360 → 200（略大于扇形，给走动的目标留余量）
- 同事的出手距离 `throwR` 同比例减半（130 / 120 / 115 / 110 / 110 / 90），保留性格差异；扇形规则对同事一样生效，公平
- 没改：锅的追踪（6 弧度/秒）和砸中半径（40）。距离近了以后追踪作用变小，先不动
- 模拟（各 40 局）：每局出手第 1 关 64 → 30、第 2 关 345 → 148；第 1 关名次 1/2/3/4 = 27/7/4/2；第 2 关前三 21/40，AI 玩家被压垮 2 局

## v2.4（2026-11-01）：工位、锅变小
- 工位按格子中心缩到 85%（绘制宽 240 → 204，碰撞框 228×80 → 194×68），左右过道 80 → 约 116px，上下过道也宽了约 24px；新碰撞框完全在旧的里面，出生点和巡逻点不受影响
- 锅统一缩到 80%（`POT_SCALE`，只改画面，砸中判定不变）；尾巴间距 26 → 22
- 提交时 `game.js` 只提交我的这几行：另一个会话正在改飞行锅贴图（`drawFlyingWok`，未提交），工作区里也给它加了同样的缩放
- 模拟（各 40 局）：第 1 关名次 1/2/3/4 = 25/11/3/1；第 2 关前三 24/40

## v2.3（2026-11-01）：松手就停 + 扇形瞄准 + 两关拉开难度
- 主角松手就停（按住摇杆 / 方向键才走）；同事、领导照常一直动
- 我加的：摇杆轻推（< 底座半径 35%）只原地转向不走，不然站着没法调瞄准方向
- 扇形瞄准：半角 40° → 55°、半径 280 → 300；扇形画出来（绿 = 有目标能甩，白 = 没人，灰 = 冷却），目标头上写“甩他!”
- 甩锅手感辅助（我加的）：锁定目标不来回跳（还在 1.25 倍扇形里就继续锁）；锅追踪 2.5 → 6 弧度/秒；砸中半径 34 → 40；射程 340 → 360
- 难度：关卡加了 `ai: { aggr, parry }` 倍率（只乘在同事身上）
  - 第 1 关：开局 1 口、丢锅间隔 8 / 6.5 / 5.2 / 3 秒、散会 3 / 4 口、同事积极度 ×0.7、反甩 ×0.45
  - 第 2 关：开局 2 口、间隔 5.5 / 4.5 / 3.6 / 2 秒、散会 5 / 6 / 6 口、3 个随机事件全出、积极度 ×1.15、反甩 ×1.1
- 模拟（AI 代替玩家，AI 玩家一直在走，不代表松手就停的真人）：第 1 关 60 局名次 1/2/3 = 44/11/5，没有同事被压垮；第 2 关 80 局过关 55%（原 72%），AI 玩家被压垮 5 局，实习生几乎每局被压垮（约 89 秒）
- 中途发现：另一个会话提交了像素美术（590b993），改了 `game.js` 的绘制部分；两边改动没有互相覆盖，我把扇形颜色加深了，原来的透明度在像素地板上几乎看不见
- 未验证：真人松手就停后被领导锅砸中的频率（站着不动必中）；第 2 关实习生总被压垮，是否太惨

## v2.2（2026-11-01）：不减速 + 降速 + 领导不穿墙
- 背锅不再减速；人的速度 175 → 145
- 其他速度同比例放慢：领导丢的锅 125 → 105、老板巡逻 80 → 68、总监 95 → 80、老板追人 140 → 120。甩锅速度 620 不变
- 领导寻路：20px 网格 A*（障碍按半径 20 外扩，不切墙角），路径再拉直；巡逻换点时算一次，追人时每 0.4 秒重算
- 两条巡逻路线的停留点从桌子里挪出来：老板 (780,190) → (790,214)，总监 (220,190) → (220,214)
- 偏差：**领导丢的锅、散会喷的锅撞墙也会掉地上**（原来能穿墙）。跟甩锅一致，桌子仍能飞过去。老板在办公室里丢锅只能从门口飞出来
- 验证：AI 自动玩第 2 关 25 秒，两位领导每 0.1 秒采样 500 次，没有一次在墙或桌子里；80 局模拟耗时 1.3 秒，寻路不卡
- 模拟（各 40 局）：第 1 关名次 1/2/3 = 18/15/7、每局压垮同事约 0.03 个；第 2 关名次 1–5 = 9/9/11/4/7，过关率约 72%，实习生平均剩 17 口、每局压垮约 0.5 个

## v2.1 本轮（2026-11-01）：按键甩锅 + 固定摇杆
- 定下的：摇杆固定在一个比例位置；甩锅改成按键扔出去；甩空了锅立刻回到自己身上；甩出去的锅要快
- 改动：`js/engine.js`（固定摇杆 + 甩锅键输入 + 3 个音效）、`js/game.js`（甩锅整段重写、AI 出手和反甩、瞄准圈和来锅预警、按钮状态）、`index.html`（`#btnThrow`）、`css/style.css`、`js/levels.js`（教学提示）
- 我选的细节（都可以改）：
  1. 摇杆中心在屏幕宽 24%、高 80%；手指按在画面任意位置都算摇杆，方向按“手指相对摇杆中心”算；甩锅键在右下，和摇杆同高
  2. 自动瞄准：前方左右约 40°、280 以内挑人，预判走位；没人就直线扔
  3. 锅速 620，射程 340；甩完 0.6 秒冷却
  4. 反甩：锅离砸中不到 0.22 秒时按「甩」弹回，+15 分；每来回一次加速 12%、窗口缩到 75%
  5. 同事反甩概率：老油条 65%、测试 40%、产品 35%、设计师 30%、实习生 10%
- 偏差：
  1. **P0 也改成按「甩」扔出去**（原来碰到就传）。碰撞不再甩锅，P0 继续靠碰就和规则冲突；P0 飞行中倒计时到了，炸在扔的人手里
  2. **甩出去的锅能飞过桌椅，只有墙挡。** 工位很密，被桌子挡会大量甩空、很挫败
  3. **砸到刚接锅（护盾 0.8 秒）的人算甩空、锅弹回。** 自动瞄准会跳过护盾中的人，所以一般只在扔出后对方刚好接到别的锅时发生
  4. **“不能立刻甩回”只限制同事 AI（1.5 秒），玩家不受限。** 反甩已经是“还手”的机制，再锁住玩家会很别扭
  5. 按空惩罚：没锅可甩也没锅可弹时按「甩」，0.4 秒内不能反甩（防狂按），原讨论里没有
  6. 领导丢的锅仍然慢（现 105）、不能反甩，留到后面做“甩回给老板”
- 已验证：`node --check` 通过；375×812 下看过瞄准线/圈、甩锅键、提示条位置；用脚本测过甩空回身、玩家反甩成功（+15 并砸回对方）、同事反甩；无控制台错误
- 模拟（各 40 局，AI 代替玩家）：
  - 第 1 关：名次 1/2/3 = 16/16/8；实习生平均剩 13 口，每局约 0.25 个同事被压垮；每局约 140 次出手、22 次甩空、72 次反甩
  - 第 2 关：名次 1–6 = 10/13/5/6/5/1，过关率 70%；实习生平均剩 17 口，每局约 0.5 个同事被压垮
- 未验证：真机双手操作手感；0.22 秒反甩窗口对触屏是否太紧；实习生成了全场出气筒（反甩率最低），是否要调


## v2 本轮范围（2026-11-01）
- 按讨论定稿的方向重做：所有同事都是和玩家同规则的“蛇 + AI”；锅只来自领导和具体地点；按排名结算；两关
- 文件：`js/levels.js`（地图 + 两关数据，替代原 `level1.js`）、`js/game.js`（重写）、`css/style.css`（追加 v2 样式）、`index.html`
- 新素材：`assets/director.svg`（总监）、`assets/npc_designer.svg`（设计师）
- v1 代码备份在 `_backup_v1/`，确认不需要后可删
- 调试：`?auto=1` 让 AI 代替玩家；`?level=2` 直接进第 2 关（会顺便解锁）；控制台 `SG_DEBUG.simulate(关卡序号, 局数)` 快速跑纯 AI 对局统计

## 按讨论定的、但细节是我选的（都可以改）
1. 领导“谁闲着丢给谁”：视野内锅最少的人，锅数相同随机。第 1 关第一口固定丢给玩家（教学）
2. 防乒乓：接锅后 3 秒内不能甩回给刚甩给你的人；刚接锅的人 1 秒内不能再被甩；接锅后愣 0.6 秒
3. 锅数相同比甩锅得分（讨论里提过、你没反对，就按这个做了）
4. 锅会砸中路上碰到的第一个人，不一定是瞄准的人
5. 随机事件做了 3 个：打印机卡纸、下午茶、P0 烫手山芋
6. 第 2 关名字定为“周三 · 需求评审”，新增总监（一次丢两口）和设计师

## 偏差（Deviations）
1. **消化改为所有人相同（每 15 秒 1 口，原来同事 9 秒、玩家没有）。** 规则要对称；“回工位干活”需要能停下，而蛇停不下来，先用最保守的自动消化
2. **去掉了“同事背满 5 口躺平”。** 和“同事也会甩锅”冲突（躺平的人也该能甩锅），改为所有人统一 20 口压垮：同事被压垮就出局、排最后
3. **实习生规则加了限制：老板要在实习生 480 以内才“看得见”，追完冷却 15 秒，追人 4 秒、速度 140。** 首次模拟发现同事们总往实习生身上甩，老板平均每局追人 9 次、几乎次次追上，占了全部领导派锅的九成，第 1 关平均每局压垮 1 个同事
4. **玩家先结算甩锅，同事之间顺序随机。** 两人同时贴近时，玩家优先甩出去，单机里手感更好；联机时需要服务器裁决
5. **教学提示挪到屏幕下方**，顶部留给排名和群消息；窄屏（≤420px）HUD 收紧成一行，避免右侧按钮换行压住群消息
6. ~~领导仍不做障碍物碰撞~~（v2.2 已加寻路）

## 已验证
- 三个 JS 文件 `node --check` 通过；浏览器内无控制台错误
- 375×812 手机尺寸下看过：选关页、局内（排名面板、群消息、瞄准线、冲你来的同事标记）、最后 10 秒排名放大、结算排名表
- AI 模拟（`SG_DEBUG.simulate`，各 40 局，AI 代替玩家）：
  - 第 1 关：AI 玩家名次 1/2/3 = 19/10/11，没有被压垮；平均每局压垮同事 0.1 个
  - 第 2 关：AI 玩家名次 1–5 = 19/9/5/5/2，过关率约 80%；平均每局压垮同事约 0.8 个
- 局域网服务：`python3 -m http.server 8090 --bind 0.0.0.0`，本机用局域网 IP 访问返回 200

## 未验证 / 待定
- 真人手感和难度：AI 玩家速度和反应都比同事好一点，真人表现未知
- 手机真机通过局域网访问没测（macOS 防火墙可能拦截 Python 的入站连接）
- 第 2 关同事被压垮偏多，是“高光”还是“太乱”需要真人试玩判断
- 无尽模式未做

## v3 像素美术接入（2026-11-01）
素材：`assets_pixel/sheets/`（Codex 出的 7 张洋红底素材表）→ `cut_sheets.py` 切成 60 张 → `build_px.py` 缩放到 `assets/px/`（约 2.6 MB）。游戏改为加载 `assets/px/*.png`。

### 偏差（Deviations）
1. **角色只有正面朝向，不做左右翻转。** 素材里各姿势朝向不统一，翻转会出现“背着走”，先保持正面
2. **没有走路帧动画**，用上下轻微起伏代替；角色状态按优先级切图：压垮 → 被砸（接锅后 0.6 秒）→ 哭 → 喝茶 → 生气/追人 → 普通
3. **地板、墙由代码绘制**（地毯棋盘格、会议室木地板、老板室淡紫地毯、茶水间薄荷瓷砖；墙加深色正面），没有出图
4. **摆设按新图比例重排**：会议桌、老板桌缩小；新增白板、文件柜、茶水台、沙发、小盆栽；碰撞框随之调整（白板、沙发不挡路）
5. **领导瞄准时不再另画一口锅**，瞄准图里已经举着锅
6. **HUD 改为直角深蓝面板 + 硬阴影**，仍用 ZCOOL KuaiLe 字体；像素中文字体因体积暂缓
7. **屏幕边缘的“人在哪”指示气泡仍是 emoji**，`ui_*` 图标、`fx_tears/sweat/dizzy/impact`、`wok_flying`、`player_win` 已切好但还没用上
8. 旧的 SVG 素材保留在 `assets/` 未删除，引擎仍支持 `loadSprites(..., 'svg')`

### 已验证
- 375×812 下跑第 1 关：角色/领导/锅/桌子/三个房间显示正常，无控制台错误；截图在 `assets_pixel/ingame/`

## v3.1 四向走路动画 + 特效（2026-11-01）
- 8 个角色各出一张走路表 `assets_pixel/sheets/w_*.png`（朝下 / 朝上 / 朝右 × 4 帧），切成 `<角色>_walk_<d|u|s><0-3>` 共 96 帧；往左走用朝右镜像
- 特效：砸中 / 撞领导 / 反甩冒撞击星，愣住时头顶转圈晕，锅多冒汗，实习生哭有泪，甩出去和领导丢的锅用「飞行锅」贴图，领导追人头顶冒怒
- HUD 和排名里的 emoji 换成像素图标；结算页加主角立绘（过关庆祝 / 被压垮 / 没过关慌张）和像素星星

### 偏差（Deviations）
1. **走路帧按走过的距离换帧（每 13px 一帧）**，不按时间；停下超过 6 帧显示双脚并拢那帧。这样速度快慢和步伐自动匹配
2. **被砸、喝茶、压垮、玩家愣住仍用正面专用姿势**，不分方向；生气、哭改成「走路动画 + 头顶/脸上特效」，原来的 angry / cry 单张图只在缺走路帧时兜底
3. **领导追人不再用 chase 单张图**，改播走路动画（速度快所以步伐快）+ 怒气符号；瞄准、原地等待仍用专用姿势
4. **背面看不到脸，不画泪**；侧面泪缩小挪到脸朝的一侧
5. **素材改为 128 色调色板 PNG**（`build_px.py` 里 quantize），总量从 6.9 MB 降到 1.2 MB，肉眼看不出差别
6. 走路表行距很窄，自动按空隙分行会粘连，改为在三分线附近找最空的一行切开（`walk_rows`）
7. 屏幕边缘的人物指示气泡仍是 emoji，`ui_warning`、`ui_exit` 还没用上

### 已验证
- 375×812 下：上下左右四个方向的走路帧、镜像，晕 / 汗 / 撞击星 / 飞行锅 / 实习生侧面流泪，结算页立绘和星星；截图在 `assets_pixel/ingame/4~6`

## v3.2 像素弹窗 + 教学横幅（2026-11-01，按用户图稿）
按用户给的三张弹窗图（暂停 / 设置 / 结算）和「背锅规则」横幅图重做。

### 偏差（Deviations）
1. **图稿里没有设置入口**：把 HUD 和大厅右上角的「静音」喇叭换成齿轮，点了打开设置弹窗。对局中打开会先暂停，关掉后接着玩。
2. **游戏原来没有背景音乐和震动**：
   - 背景音乐：为了让设置里的开关有用，用 WebAudio 合成了一段 8-bit 循环小调。大厅和对局中响，暂停和结算时停。
   - 震动：被锅砸、被领导砸、被压垮时调用 `navigator.vibrate`。只在安卓生效，iOS 网页不支持，会静默忽略。
   - 三个开关的状态存在 localStorage `shuaiguo_settings`。
3. **结算弹窗比图稿多了几样东西**，因为这些和过关、变现有关，不能删：
   - 星级和「新纪录」：跟在「/ N人 · 称号」后面。
   - 「下一关」：过关时作为主按钮。此时「再来一局」降为次按钮，「返回首页」降为文字链接。
   - 两个广告按钮：被压垮时出「甩掉 6 口锅」，没进前三时出「找人顶锅」。
4. **结算删掉了**：分享文案卡片、甩出 / 抓现行 / 剩余三格统计、「晒战绩」按钮、右上角主角立绘、「更多关卡开发中」按钮。
5. **弹窗字体改为 Noto Sans SC 粗黑体**（与图稿一致）。HUD 和大厅仍是站酷快乐体，两套字体并存，统一与否待定。
6. **图标画法**：弹窗用的图标（暂停、齿轮、音符、喇叭、震动、奖杯、关闭）用 16×16 点阵写在 `game.js` 的 `PX_ICONS` 里，生成 SVG。没有用 Codex 出图。
7. **所有教学提示都换成横幅样式**，不只是「背锅规则」这一条：
   - 数据格式改成 `{ title, icon, sub, text }`。
   - 文案按「小字一行 + 大字一行」重写，意思不变。

### 已验证（375×812）
- 暂停弹窗、设置弹窗（开关能切换并保存）、结算弹窗（第 1 名过关，带下一关按钮）、大厅齿轮入口、第 8 秒的「背锅规则」横幅，显示都正常。
- 控制台没有报错。

### 未验证
- 没进前三的结算画面（被压垮的已看过：大字「被压垮」+ 广告复活按钮，正常）。
- 背景音乐在真机上的音量和听感。
- 安卓真机上的震动。
