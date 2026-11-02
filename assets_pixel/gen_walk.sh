#!/bin/zsh
# 四向走路素材表：每个角色 1 张，3 行（朝下 / 朝上 / 朝右）× 4 帧，洋红底
# 用法：zsh gen_walk.sh [角色...]   不带参数则生成全部
OUT=/Users/bozhou/my/min_games/shuaiguo/assets_pixel/sheets
SPR=/Users/bozhou/my/min_games/shuaiguo/assets_pixel/sprites
STYLE_REF=/Users/bozhou/my/min_games/prototypes/style-explore/c_pixel.png
LOG=${TMPDIR:-/tmp}/shuaiguo-codex-logs
mkdir -p "$OUT" "$LOG"

RULES='SPRITE SHEET RULES (very important, follow exactly):
- Background: ONE solid flat pure magenta color #FF00FF everywhere behind the sprites. No gradient, no grid lines, no cell borders, no ground shadows, no texture.
- NO TEXT anywhere: no labels, no letters, no numbers, no arrows.
- Exactly 3 rows x 4 columns = 12 sprites, evenly spaced on a regular grid, generous magenta space between sprites (sprites must never touch or overlap).
- Crisp 16-bit pixel art: hard pixel edges, no anti-aliasing, no blur, limited palette, 1-pixel dark outline, the SAME pixel scale for every sprite.
- Strictly flat 2D, classic 16-bit RPG 3/4 top-down character walk sheet. No perspective, no isometric.
- Sprites must not contain magenta or pink close to #FF00FF.'

WALK='WALK CYCLE SHEET for ONE character (the character in reference image 1, keep face, hair, glasses, hat, clothes colors and chibi FULL-BODY proportions IDENTICAL in all 12 sprites, same height, feet on the same baseline in every frame):
- Row 1: walking DOWN toward the camera (front view), 4 frames: right foot forward, legs together passing, left foot forward, legs together passing. Arms swing opposite to legs.
- Row 2: walking UP away from the camera (back view, we see the back of the head and back of the clothes), same 4 frames.
- Row 3: walking to the RIGHT (side profile facing right), same 4 frames with clear leg stride.
Reference image 2 only shows the overall pixel-art style.'

typeset -A WHO REF
WHO[w_player]='the PLAYER: young office worker, messy dark hair, white shirt, blue tie, dark trousers, smug face.'
REF[w_player]=player_normal
WHO[w_pm]='product manager woman: round glasses, brown hair bun, purple top, dark skirt, holding a tablet.'
REF[w_pm]=pm_normal
WHO[w_tester]='QA tester young man: blue cap, orange shirt, jeans.'
REF[w_tester]=tester_normal
WHO[w_designer]='designer young man: red beret, orange top, black trousers.'
REF[w_designer]=designer_normal
WHO[w_veteran]='office veteran: bald older man, small glasses, beige shirt, brown trousers, carrying a thermos.'
REF[w_veteran]=veteran_normal
WHO[w_intern]='intern young woman: brown ponytail, white shirt, black skirt, staff badge.'
REF[w_intern]=intern_normal
WHO[w_boss]='the BOSS (2026-11-02 comb-over version): middle-aged man with a shiny bald crown and a few long greasy strands combed across from one side, bushy dark tufts above the ears, black sunglasses, big beer belly stretching the white shirt with one button popped open, too-tight dark navy suit, short red tie on top of the belly, hands behind his back, drawn bigger than normal coworkers. From the back view the shiny bald crown with the thin combed strands must be clearly visible.'
REF[w_boss]=/Users/bozhou/my/min_games/prototypes/boss-ugly/sheets/a_combover.png   # 选定的丑化样稿
WHO[w_director]='the director: middle-aged man, black glasses, neat dark hair, grey suit, blue tie, holding a yellow clipboard, drawn a bit bigger than coworkers.'
REF[w_director]=director_walk

keys=(${@:-${(k)WHO}})
for key in $keys; do
  PROMPT="You are producing final production sprite sheets for the 2D pixel-art mobile game 这锅你来背 (an office game). Reference images are attached.

${RULES}

${WALK}

Character: ${WHO[$key]}

Layout: landscape 3:2 image.

Use your built-in image generation tool (image_gen) with the attached reference images to generate exactly ONE image, then copy the generated PNG from \$CODEX_HOME/generated_images/... into ${OUT}/${key}.png (overwrite if it exists). Do not write any other files. Do not edit any code."
  # 参考图：写素材名就取 sprites/ 里的单张，写绝对路径就直接用
  ref=${REF[$key]}; [[ $ref == /* ]] || ref="$SPR/$ref.png"
  codex exec --skip-git-repo-check -s workspace-write -C "$OUT" --add-dir "$HOME/.codex/generated_images" \
    -i "$ref" -i "$STYLE_REF" -- "$PROMPT" > "$LOG/$key.log" 2>&1 &
done
wait
ls -la "$OUT"/w_*.png
