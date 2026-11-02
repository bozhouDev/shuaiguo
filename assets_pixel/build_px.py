"""
把 sprites/ 里切好的原尺寸素材按用途缩放后输出到 ../assets/px/，供游戏加载。
用法：python3 build_px.py
缩放目标 ≈ 游戏里的绘制尺寸 × 3（适配 3 倍屏），原图更小的不放大。
"""
import os
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'sprites')
OUT = os.path.join(ROOT, '..', 'assets', 'px')

# 按前缀决定「最长边」上限（像素）
LIMITS = [
    (('closing_base_',), 1170),  # 下班参考底板：390px 的三倍尺寸
    (('closing_clock_',), 258),  # 独立钟层保留同一缩放比例
    (('intro_',), 1800),  # 参考图界面底板和按钮切片保持原尺寸
    (('player_', 'pm_', 'tester_', 'designer_', 'veteran_', 'intern_', 'nephew_', 'cashier_'), 230),  # 同事：游戏里约 64–70px 高
    (('boss_desk',), 640),                                                   # 老板桌（要排在 boss_ 前面）
    (('boss_', 'director_', 'wife_'), 300),                                           # 领导：约 84–96px 高
    (('wok',), 150),                                                         # 锅：约 32–48px
    (('pie',), 120),                                                        # 地上的饼：40px 三倍图
    (('fx_',), 120),                                                         # 特效
    (('ui_',), 96),                                                          # 状态栏图标
    (('desk', 'meeting_table', 'tea_counter', 'sofa', 'whiteboard', 'cabinet'), 720),
    (('cooler', 'printer', 'plant'), 300),
    (('lobby_',), 768),                                                      # 大厅整张背景（竖屏 2:3）
]


def limit_of(name):
    """找出素材名对应的最长边上限。"""
    for prefixes, lim in LIMITS:
        if name.startswith(prefixes):
            return lim
    return 400


def main():
    os.makedirs(OUT, exist_ok=True)
    total = 0
    # 可只构建指定素材，避免更新其他已验收的像素图。
    files = [name + '.png' for name in sys.argv[1:]] if len(sys.argv) > 1 else sorted(os.listdir(SRC))
    for fn in files:
        if not fn.endswith('.png'):
            continue
        im = Image.open(os.path.join(SRC, fn)).convert('RGBA')
        lim = limit_of(fn[:-4])
        k = min(1.0, lim / max(im.size))
        if k < 1:
            # 缩小用 BOX 取平均，像素块边缘比 LANCZOS 更干净、不出振铃
            im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.BOX)
        path = os.path.join(OUT, fn)
        # 像素画颜色少：转成 128 色调色板 PNG（保留透明），体积约降到三分之一
        im = im.quantize(colors=64 if fn.startswith('wife_') else 128, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
        im.save(path, optimize=True)
        total += os.path.getsize(path)
        print(f'{fn:22s} {im.width}×{im.height}')
    print(f'合计 {total / 1024:.0f} KB')


if __name__ == '__main__':
    main()
