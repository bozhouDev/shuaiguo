#!/bin/zsh
# 正式素材生产：7 张像素素材表，洋红底便于抠图，并行调用 Codex 内置 image_gen
# 用法：zsh gen_assets.sh [表名...]   不带参数则生成全部
OUT=/Users/bozhou/my/min_games/shuaiguo/assets_pixel/sheets
PX=/Users/bozhou/my/min_games/prototypes/style-explore/pixel
STYLE_REF=/Users/bozhou/my/min_games/prototypes/style-explore/c_pixel.png   # 用户认可的全身主角像素风
CHAR_REF=$PX/pixel_sprites.png                                             # 各角色外貌设定
SCENE_REF=$PX/pixel_gameplay_v2.png                                        # 已定的实机画面与物件配色
PROP_REF=$PX/pixel_props_v2.png                                            # 已定的物件画法
LOG=${TMPDIR:-/tmp}/shuaiguo-codex-logs
mkdir -p "$OUT" "$LOG"

# 所有素材表共用的硬性规则：洋红底、无文字、统一像素比例、平面 3/4 俯视
RULES='SPRITE SHEET RULES (very important, follow exactly):
- Background: ONE solid flat pure magenta color #FF00FF everywhere behind the sprites. No gradient, no grid lines, no cell borders, no ground shadows, no texture on the background.
- NO TEXT anywhere: no labels, no captions, no letters, no numbers.
- Each sprite is separate, with generous magenta space around it (sprites must not touch or overlap).
- Crisp 16-bit pixel art: hard pixel edges, no anti-aliasing, no blur, no glow, limited palette, 1-pixel dark outline around every sprite, the SAME pixel scale for every sprite on the sheet.
- Camera: classic 16-bit RPG 3/4 top-down (looking down from high above, slight front view). Strictly flat 2D, no perspective, no isometric.
- Sprites must not contain magenta or pink close to #FF00FF.'

# 角色画法：全身 Q 版，像参考图 1 里的主角
CHAR='CHARACTER FORMAT: every character is a FULL-BODY chibi pixel character (big head about 1/3 of the height, visible torso, arms, legs and shoes), drawn front-facing in the 3/4 top-down RPG view, exactly like the smug player character in reference image 1 (the young office worker with a blue tie walking in the office). Not busts, never only the upper body. Keep each character'"'"'s identity (face, hair, glasses, hat, clothes colors) from reference image 2, and keep every character IDENTICAL across all of its poses on this sheet (same face, same hair, same outfit, same proportions, same height).'

typeset -A JOB
typeset -A REFS

JOB[s1_player]="Sheet layout: landscape 3:2, ONE row of 4 sprites, all the same character: the PLAYER 你 (young office worker, messy dark hair, white shirt, blue tie, dark trousers, smug face).
1) normal: walking confidently, smug grin.
2) panic: running, sweating, scared eyes, sweat drops.
3) crushed: squashed down under a messy pile of 5 black woks, dizzy swirl eyes, only head and hands visible under the pile.
4) win: celebrating, fist up, happy, off work."
REFS[s1_player]="$STYLE_REF $CHAR_REF"

JOB[s2_pm_tester]="Sheet layout: landscape 3:2, TWO rows of 4 sprites.
Row 1 = 产品经理 product manager (woman, round glasses, brown hair bun, purple top, dark skirt/trousers, holding a tablet): 1) normal walking with tablet, 2) hit: a black wok just bonked her head, shocked, 3) angry chasing: running forward furious, anger vein, 4) lying flat on the floor exhausted, eyes closed (lying horizontally, still top-down view).
Row 2 = 测试小王 QA tester (young man, blue cap, orange shirt, jeans): same 4 poses: normal walking, hit by a wok on the head, angry chasing, lying flat exhausted."
REFS[s2_pm_tester]="$STYLE_REF $CHAR_REF"

JOB[s3_designer_veteran]="Sheet layout: landscape 3:2, TWO rows of 4 sprites.
Row 1 = 设计师 designer (young man, red beret, orange top, black trousers): 1) normal walking, 2) hit by a black wok on the head, shocked, 3) angry chasing, running furious, 4) lying flat on the floor exhausted, eyes closed.
Row 2 = 老油条 office veteran (bald older man, small glasses, beige shirt, brown trousers, always carries a thermos): 1) normal strolling with thermos, relaxed sly smile, 2) drinking tea from the thermos, standing still, blissful, 3) hit by a black wok on the head, annoyed, 4) lying flat on the floor exhausted."
REFS[s3_designer_veteran]="$STYLE_REF $CHAR_REF"

JOB[s4_intern_director]="Sheet layout: landscape 3:2, TWO rows of 4 sprites.
Row 1 = 实习生 intern (young woman, brown ponytail, white shirt, black skirt, staff badge): 1) normal walking, timid, 2) crying, big streaming tears, 3) hit by a black wok on the head, 4) lying flat on the floor exhausted.
Row 2 = 总监 director (middle-aged man, black glasses, neat dark hair, grey suit, blue tie, holds a yellow clipboard), drawn about 1.25x taller/bigger than the coworkers: 1) normal walking with clipboard, stern, 2) aiming: raising TWO black woks, one in each hand, ready to throw, 3) chasing: striding fast, angry, pointing, 4) standing arms crossed, judging."
REFS[s4_intern_director]="$STYLE_REF $CHAR_REF"

JOB[s5_boss_items]="Sheet layout: landscape 3:2, TWO rows.
Row 1 = 老板 the BOSS (stocky middle-aged man, black sunglasses, slicked dark hair, dark navy suit, red tie), drawn about 1.4x bigger than normal coworkers, 4 sprites: 1) normal patrolling walk, hands behind back, 2) aiming: winding up to throw a big black wok held overhead, 3) chasing: running angrily, red face, 4) standing with hands on hips, angry anger vein.
Row 2 = items and effects, 7 small sprites: 1) a black cooking wok with a short handle seen from above, with a BLANK yellow sticky note stuck on it (no writing), 2) the same wok tilted mid-air flying with small motion lines, 3) an anger vein symbol (red cross-shaped vein mark), 4) two streams of blue tears, 5) three blue sweat drops, 6) dizzy swirl with small yellow stars, 7) a yellow-white impact burst star."
REFS[s5_boss_items]="$STYLE_REF $CHAR_REF"

JOB[s6_props]="Sheet layout: landscape 3:2, office furniture and objects only (no characters), 11 sprites arranged in 3 rows. Match the dark-wood furniture, blue monitors and navy chairs of reference image 1 exactly.
1) double work desk: one long dark-wood desk with TWO computers (upright monitors with glowing blue/green screens, keyboards, mice, a red mug, a yellow sticky note, a paper sheet) and TWO navy office chairs with backrests in front (south side) of the desk.
2) long meeting table: oval dark-wood table with papers and a small plant on it, with 8 navy chairs with backrests around it.
3) boss desk: big executive dark-wood desk with a monitor, gold trophy, coffee cup, papers, yellow nameplate, and a large black leather chair behind it (north side).
4) water cooler with a blue water bottle on top.
5) office printer / copier with paper tray.
6) large potted plant. 7) small potted plant.
8) grey filing cabinet. 9) whiteboard on wheels with a simple diagram.
10) tea corner counter with a coffee machine, kettle and cups.
11) small two-seat sofa."
REFS[s6_props]="$SCENE_REF $PROP_REF"

JOB[s7_ui]="Sheet layout: landscape 3:2, UI icons for the game HUD, 10 icons in 2 rows, each icon is a chunky pixel icon about the same size: 1) alarm clock, 2) black wok (side view, small), 3) gold crown with a ribbon (ranking), 4) gold star filled, 5) empty star outline (grey), 6) pause button (two bars), 7) speaker sound on, 8) speaker muted, 9) red exclamation warning sign, 10) office door with an exit arrow (off work / 下班)."
REFS[s7_ui]="$SCENE_REF $STYLE_REF"

# 需要生成哪些表：参数指定，否则全部
keys=(${@:-${(k)JOB}})
for key in $keys; do
  refargs=()
  for r in ${=REFS[$key]}; do refargs+=(-i "$r"); done
  if [[ $key == s6_props || $key == s7_ui ]]; then extra=''; else extra="$CHAR"; fi
  PROMPT="You are producing final production sprite sheets for the 2D pixel-art mobile game 这锅你来背 (an office game where coworkers throw cooking woks = blame at each other). Reference images are attached for style and identity.

${RULES}

${extra}

${JOB[$key]}

Use your built-in image generation tool (image_gen) with the attached reference images to generate exactly ONE image, then copy the generated PNG from \$CODEX_HOME/generated_images/... into ${OUT}/${key}.png (overwrite if it exists). Do not write any other files. Do not edit any code."
  codex exec --skip-git-repo-check -s workspace-write -C "$OUT" --add-dir "$HOME/.codex/generated_images" \
    $refargs -- "$PROMPT" > "$LOG/$key.log" 2>&1 &
done
wait
ls -la "$OUT"
