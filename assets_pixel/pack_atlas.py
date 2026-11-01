"""
把 ../assets/px/ 里的单张像素素材合并成几张图集，减少网页加载时的请求数（约 160 个 → 十来个）。
用法：python3 pack_atlas.py        （build_px.py 之后运行；改了 assets/px 里的图就要重新跑）
输出：../assets/atlas/<组名>.png 图集，以及 ../js/atlas.js（每张小图在图集里的位置，文件名带内容哈希防缓存）。
分组：每个角色一张（同一角色颜色接近，合成 256 色调色板不失真），物件一张，锅 / 特效 / 图标一张。
单张素材仍保留在 assets/px/ 里，作为图集缺图时的后备，也方便预览。
"""
import hashlib
import json
import os
from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, '..', 'assets', 'px')
OUT = os.path.join(ROOT, '..', 'assets', 'atlas')
JS = os.path.join(ROOT, '..', 'js', 'atlas.js')

# 不进图集的素材：整张背景只在大厅用一次，单独加载更合适
SKIP = {'lobby_bg'}
CHARS = ['player', 'pm', 'tester', 'designer', 'veteran', 'intern', 'boss', 'director']
PROPS = ('desk', 'meeting_table', 'boss_desk', 'cabinet', 'whiteboard', 'tea_counter', 'sofa', 'cooler', 'printer', 'plant')
MAX_W = 2048   # 图集最大宽度，手机端单张纹理不宜超过 2048
PAD = 2        # 小图之间留白，防止裁切时取到邻居的像素


def group_of(name):
    """按素材名决定放进哪张图集。"""
    if name.startswith(PROPS):          # boss_desk 要先于 boss_ 判断
        return 'props'
    for c in CHARS:
        if name.startswith(c + '_'):
            return c
    return 'misc'                        # 锅、特效、图标


def pack(items):
    """货架式装箱：按高度从高到低排，一行放满换行。返回 {名字: (x, y, w, h)} 和图集尺寸。"""
    items = sorted(items, key=lambda kv: (-kv[1].height, -kv[1].width))
    # 宽度取「总面积开方」和最宽那张中较大的，让图集接近正方形
    area = sum((im.width + PAD) * (im.height + PAD) for _, im in items)
    width = min(MAX_W, max(max(im.width for _, im in items) + PAD, int(area ** 0.5 * 1.1)))
    x = y = row_h = 0
    pos = {}
    for name, im in items:
        if x + im.width > width:
            x, y, row_h = 0, y + row_h + PAD, 0
        pos[name] = (x, y, im.width, im.height)
        x += im.width + PAD
        row_h = max(row_h, im.height)
    return pos, width, y + row_h


def main():
    os.makedirs(OUT, exist_ok=True)
    groups = {}
    for fn in sorted(os.listdir(SRC)):
        name = fn[:-4]
        if not fn.endswith('.png') or name in SKIP:
            continue
        groups.setdefault(group_of(name), []).append((name, Image.open(os.path.join(SRC, fn)).convert('RGBA')))

    sheets, total = [], 0
    for g, items in groups.items():
        pos, w, h = pack(items)
        atlas = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        for name, im in items:
            atlas.paste(im, pos[name][:2])
        # 同组颜色接近：转 256 色调色板 PNG（保留透明），体积和单张 128 色时相当
        atlas = atlas.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
        path = os.path.join(OUT, g + '.png')
        atlas.save(path, optimize=True)
        with open(path, 'rb') as f:
            ver = hashlib.md5(f.read()).hexdigest()[:8]
        size = os.path.getsize(path)
        total += size
        sheets.append({'file': f'{g}.png?v={ver}', 'frames': {n: list(p) for n, p in sorted(pos.items())}})
        print(f'{g:10s} {len(items):3d} 张  {w}×{h}  {size / 1024:.0f} KB')

    with open(JS, 'w') as f:
        f.write('/* 由 assets_pixel/pack_atlas.py 自动生成，不要手改。'
                '每张图集里各小图的位置 [x, y, 宽, 高]；文件名带内容哈希，图集更新后浏览器会重新下载 */\n')
        f.write('window.ATLAS = ' + json.dumps({'sheets': sheets}, ensure_ascii=False, separators=(',', ':')) + ';\n')
    print(f'{len(sheets)} 张图集，合计 {total / 1024:.0f} KB')


if __name__ == '__main__':
    main()
