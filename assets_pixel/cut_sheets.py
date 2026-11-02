"""
把 sheets/ 下的洋红底素材表抠图并切成单张透明 PNG，输出到 sprites/。
用法：python3 cut_sheets.py
做法：洋红判定为背景 → 按行投影切行 → 每行按列投影切格 → 裁到紧贴边界。
"""
import os
import sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))
SHEETS = os.path.join(ROOT, 'sheets')
OUT = os.path.join(ROOT, 'sprites')

# 每张素材表里的素材名，按「从上到下、从左到右」的顺序
NAMES = {
    'intro_skin': ['intro_plate', 'intro_tab_gold', 'intro_tab_blue'],
    'ui_praise': ['ui_praise_thumb', 'ui_praise_bounce', 'ui_praise_rankup'],
    's1_player': ['player_normal', 'player_panic', 'player_crushed', 'player_win'],
    's2_pm_tester': ['pm_normal', 'pm_hit', 'pm_angry', 'pm_flat',
                     'tester_normal', 'tester_hit', 'tester_angry', 'tester_flat'],
    's3_designer_veteran': ['designer_normal', 'designer_hit', 'designer_angry', 'designer_flat',
                            'veteran_normal', 'veteran_tea', 'veteran_hit', 'veteran_flat'],
    's4_intern_director': ['intern_normal', 'intern_cry', 'intern_hit', 'intern_flat',
                           'director_walk', 'director_aim', 'director_chase', 'director_idle'],
    # s5 第 1 行是旧版墨镜老板，2026-11-02 起改用 s9_boss，这 4 格写 None 不再输出
    's5_boss_items': [None, None, None, None,
                      'wok', 'wok_flying', 'fx_anger', 'fx_tears', 'fx_sweat', 'fx_dizzy', 'fx_impact'],
    's6_props': ['desk', 'meeting_table', 'boss_desk', 'cooler', 'printer', 'plant', 'plant_small',
                 'cabinet', 'whiteboard', 'tea_counter', 'sofa'],
    's7_ui': ['ui_clock', 'ui_wok', 'ui_crown', 'ui_star', 'ui_star_empty',
              'ui_pause', 'ui_sound_on', 'ui_sound_off', 'ui_warning', 'ui_exit'],
    's9_boss': ['boss_walk', 'boss_aim', 'boss_chase', 'boss_idle'],  # 地中海盖顶版老板（gen_assets.sh）
    's8_lobby_ui': ['ui_lock', 'ui_badge', 'ui_book', 'ui_calendar'],  # 大厅图标（gen_lobby.sh）
}

# 四向走路表：w_<角色>.png，3 行（朝下 d / 朝上 u / 朝右 s）× 4 帧 → <角色>_walk_<方向><帧号>
WALKERS = ['player', 'pm', 'tester', 'designer', 'veteran', 'intern', 'boss', 'director']
for _who in WALKERS:
    NAMES['w_' + _who] = [f'{_who}_walk_{d}{i}' for d in 'dus' for i in range(4)]

# 每张表每行有几个素材（用于在每行里挑最宽的几道空隙切开）
ROWS = {
    'ui_praise': [3],
    's1_player': [4], 's2_pm_tester': [4, 4], 's3_designer_veteran': [4, 4],
    's4_intern_director': [4, 4], 's5_boss_items': [4, 7], 's6_props': [3, 4, 4], 's7_ui': [5, 5], 's8_lobby_ui': [4], 's9_boss': [4],
    **{'w_' + w: [4, 4, 4] for w in WALKERS},
}

# 自动切不准的行，手工给出列边界（原图像素坐标）：(表名, 第几行) → [(x0, x1), ...]
# s5 第 2 行：泪水两股之间的空隙比「锅」和「飞行锅」之间还宽，按空隙切会错位
COL_OVERRIDE = {
    ('s5_boss_items', 1): [(0, 235), (235, 515), (515, 690), (690, 915), (915, 1090), (1090, 1300), (1300, 1536)],
}

ROW_GAP = 16   # 行与行之间至少多少像素空白才算分行
MIN_SIZE = 24  # 小于这个尺寸的碎块当噪点丢掉


def key_magenta(rgb):
    """返回不透明度蒙版：洋红及其抗锯齿描边视为背景。"""
    r, g, b = [rgb[..., i].astype(np.int32) for i in range(3)]
    lo = np.minimum(r, b)
    # 洋红：红、蓝都高，绿明显低于两者（紫色衣服的绿通道较高，不会被误抠）
    bg = (r > 140) & (b > 140) & (g < lo * 0.45)
    return ~bg


def runs(profile, gap):
    """把一维投影中非零的连续区间找出来，间隔小于 gap 的空白会被合并。"""
    idx = np.flatnonzero(profile)
    if idx.size == 0:
        return []
    spans, start, prev = [], idx[0], idx[0]
    for i in idx[1:]:
        if i - prev > gap:
            spans.append((start, prev + 1))
            start = i
        prev = i
    spans.append((start, prev + 1))
    return [s for s in spans if s[1] - s[0] >= MIN_SIZE]


def split_cols(profile, k):
    """在一行的列投影里挑出最宽的 k-1 道空白切开，返回 k 个 (x0, x1)。"""
    idx = np.flatnonzero(profile)
    gaps = []  # (宽度, 起点, 终点)
    for a, b in zip(idx[:-1], idx[1:]):
        if b - a > 1:
            gaps.append((b - a - 1, a + 1, b))
    if len(gaps) < k - 1:
        return None
    cuts = sorted(sorted(gaps, reverse=True)[:k - 1], key=lambda g: g[1])
    bounds, start = [], idx[0]
    for _, g0, g1 in cuts:
        bounds.append((start, g0))
        start = g1
    bounds.append((start, idx[-1] + 1))
    return bounds


def walk_rows(mask):
    """走路表是规整的 3 行：在三分线附近找投影最空的那一行切开（行距很窄，按空隙阈值会粘连）。"""
    prof = mask.sum(axis=1)
    h = mask.shape[0]
    cuts = [0] + [int(np.argmin(prof[c - 60:c + 60]) + c - 60) for c in (h // 3, 2 * h // 3)] + [h]
    rows = []
    for y0, y1 in zip(cuts[:-1], cuts[1:]):
        ys = np.flatnonzero(mask[y0:y1].any(axis=1))
        rows.append((y0 + ys[0], y0 + ys[-1] + 1))  # 收紧到这一行素材的上下边界
    return rows


def cut(sheet):
    """切一张素材表，返回 [(名字, RGBA 图)]；数量对不上时报错。"""
    img = Image.open(os.path.join(SHEETS, sheet + '.png')).convert('RGB')
    # 开局底板按参考图坐标切片，保留完整背景，不做洋红抠图。
    if sheet == 'intro_skin':
        boxes = [(0, 0, 956, 1645), (48, 84, 330, 230), (338, 84, 620, 230)]
        if img.size != (956, 1645):
            raise SystemExit('intro_skin 必须为 956×1645，避免界面坐标漂移')
        return [(name, img.crop(box).convert('RGBA')) for name, box in zip(NAMES[sheet], boxes)]
    rgb = np.array(img)
    mask = key_magenta(rgb)
    rgba = np.dstack([rgb, (mask * 255).astype(np.uint8)])
    pieces = []
    rows = runs(mask.any(axis=1), ROW_GAP)
    if sheet.startswith('w_'):
        rows = walk_rows(mask)
    if len(rows) != len(ROWS[sheet]):
        raise SystemExit(f'{sheet}: 切出 {len(rows)} 行，预期 {len(ROWS[sheet])} 行')
    for r, ((y0, y1), k) in enumerate(zip(rows, ROWS[sheet])):
        row = mask[y0:y1]
        cols = COL_OVERRIDE.get((sheet, r)) or split_cols(row.any(axis=0), k)
        if cols is None:
            raise SystemExit(f'{sheet}: 第 {len(pieces) + 1} 块所在行素材粘连，切不开')
        for x0, x1 in cols:
            # 裁到紧贴素材的边界
            cell = mask[y0:y1, x0:x1]
            ys, xs = np.flatnonzero(cell.any(axis=1)), np.flatnonzero(cell.any(axis=0))
            if sheet.startswith('w_'):
                # 走路帧：同一行共用上下边界，脚底对齐、高度一致，播放时人不会忽大忽小
                pieces.append(rgba[y0:y1, x0 + xs[0]:x0 + xs[-1] + 1])
            else:
                pieces.append(rgba[y0 + ys[0]:y0 + ys[-1] + 1, x0 + xs[0]:x0 + xs[-1] + 1])
    names = NAMES[sheet]
    if len(pieces) != len(names):
        raise SystemExit(f'{sheet}: 切出 {len(pieces)} 块，预期 {len(names)} 块，需要调 ROWS/COL_OVERRIDE 或重出图')
    return [(n, Image.fromarray(p, 'RGBA')) for n, p in zip(names, pieces)]


def main():
    os.makedirs(OUT, exist_ok=True)
    sheets = sys.argv[1:] or list(NAMES)
    for sheet in sheets:
        for name, im in cut(sheet):
            if name is None:  # 已废弃的格子：照常切开保证顺序，但不输出
                continue
            im.save(os.path.join(OUT, name + '.png'))
            print(f'{sheet:22s} → {name:16s} {im.width}×{im.height}')


if __name__ == '__main__':
    main()
