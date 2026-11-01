#!/bin/zsh
# 大厅素材：大厅背景图 + 大厅用的像素图标表，并行调用 Codex 内置 image_gen
# 用法：zsh gen_lobby.sh [lobby_bg] [s8_lobby_ui]   不带参数则两张都生成
# 生成后：lobby_bg 直接复制到 sprites/ 再跑 build_px.py；s8_lobby_ui 先跑 cut_sheets.py s8_lobby_ui
OUT=/Users/bozhou/my/min_games/shuaiguo/assets_pixel/sheets
PX=/Users/bozhou/my/min_games/prototypes/style-explore/pixel
STYLE_REF=/Users/bozhou/my/min_games/prototypes/style-explore/c_pixel.png   # 用户认可的全身主角像素风
SCENE_REF=$PX/pixel_gameplay_v2.png                                        # 已定的实机画面与物件配色
PROP_REF=$PX/pixel_props_v2.png                                            # 已定的物件画法
UI_REF=$OUT/s7_ui.png                                                      # 已有的 HUD 图标表
LOG=${TMPDIR:-/tmp}/shuaiguo-codex-logs
mkdir -p "$OUT" "$LOG"

# 和 gen_assets.sh 相同的硬规则：无文字、硬像素边、平面 3/4 俯视
COMMON='HARD RULES (very important, follow exactly):
- NO TEXT anywhere: no letters, no numbers, no Chinese characters, no logos with writing. Signs and plaques must be blank.
- Crisp 16-bit pixel art: hard pixel edges, no anti-aliasing, no blur, no glow, no gradients, limited palette, 1-pixel dark outlines, the SAME pixel scale everywhere.
- Camera: classic 16-bit RPG 3/4 top-down (looking down from high above, slight front view). Strictly flat 2D, no perspective, no isometric, no vanishing point, no volumetric light.'

typeset -A JOB
typeset -A REFS

# 大厅背景：竖屏 2:3，上方是背景墙（叠标题），中下部留出空地（站主角和按钮），左右边缘只放次要装饰（手机上会被裁掉）
JOB[lobby_bg]="Generate ONE portrait 2:3 background image (1024x1536) for the main menu lobby of the game: the ground-floor entrance lobby of a cheerful, slightly chaotic office, seen in the SAME 16-bit pixel style, palette and 3/4 top-down camera as the attached in-game screenshot (reference 2) and furniture sheet (reference 3).
NO CHARACTERS, NO PEOPLE, NO WOKS in this image (characters are added by code).
Composition, top to bottom:
- Top 28%: the back wall of the lobby, flat blue-grey wall (#7F8FB0 with a lighter top edge and a darker front face, like the walls in reference 2). On it: closed silver elevator doors in the center, a round wall clock showing about 9 o'clock, a BLANK company plaque (no text), two potted plants, a cork notice board with a few blank colored sticky notes.
- Middle and bottom 72%: a large open, EMPTY floor area with light blue-grey office carpet tiles (#BCCBDD / #B2C2D6 checker, like reference 2) - keep the center of this area completely clear and calm (a menu will be drawn on it).
- Along the left edge: a reception desk (dark wood #A86030, with a monitor and a bell) and a water cooler. Along the right edge: a punch-clock time card machine on a stand, a small sofa, a printer, a tall plant. Keep these objects within the outer 18% on each side, so the center 64% of the width stays empty floor.
- Bottom edge: a dark doormat strip and the glass entrance doors frame.
Low-saturation, light floor; strongest colors only on small props. Overall bright, friendly, funny office mood.
${COMMON}"
REFS[lobby_bg]="$STYLE_REF $SCENE_REF $PROP_REF"

# 大厅图标：和现有 HUD 图标同样大小、同样画法
JOB[s8_lobby_ui]="Generate ONE sprite sheet image, landscape 3:2: 4 UI icons for the game HUD in ONE row, matching the chunky pixel icon style, size and outline of the attached existing icon sheet (reference 2) exactly.
1) a closed golden-grey padlock (level locked),
2) an office staff ID badge on a blue lanyard, with a tiny blank photo square (no text),
3) an open small rule book / manual with blank pages,
4) a desk calendar page with a red top binding (blank page, no numbers).
SHEET RULES:
- Background: ONE solid flat pure magenta color #FF00FF everywhere behind the icons. No gradient, no grid lines, no cell borders, no shadows.
- Each icon is separate, with generous magenta space around it (icons must not touch).
- Icons must not contain magenta or pink close to #FF00FF.
${COMMON}"
REFS[s8_lobby_ui]="$SCENE_REF $UI_REF"

# 需要生成哪些：参数指定，否则全部
keys=(${@:-${(k)JOB}})
for key in $keys; do
  refargs=()
  for r in ${=REFS[$key]}; do refargs+=(-i "$r"); done
  PROMPT="You are producing final production art for the 2D pixel-art mobile game 甩锅侠 (an office game where coworkers throw cooking woks = blame at each other). Reference images are attached for style.

${JOB[$key]}

Use your built-in image generation tool (image_gen) with the attached reference images to generate exactly ONE image, then copy the generated PNG from \$CODEX_HOME/generated_images/... into ${OUT}/${key}.png (overwrite if it exists). Do not write any other files. Do not edit any code."
  codex exec --skip-git-repo-check -s workspace-write -C "$OUT" --add-dir "$HOME/.codex/generated_images" \
    $refargs -- "$PROMPT" > "$LOG/$key.log" 2>&1 &
done
wait
ls -la "$OUT"
