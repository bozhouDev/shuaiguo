"""直接裁参考图的下班面板与闹钟，擦除全部文字，输出无字对照图。"""
from pathlib import Path
from collections import deque
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
SRC = ROOT / 'ref/closing_countdown_ref.webp'
OUT = ROOT / 'sprites'
SIZE = (1204, 296)
TIERS = [('yellow', 126), ('orange', 461), ('red', 796)]
CLOCK_BOX = (36, 49, 300, 252)


def save_sprite(name, image):
    """保存原尺寸切片，后续由 build_px 统一缩放和量化。"""
    image.save(OUT / (name + '.png'))


def main():
    """固定坐标覆盖字及硬阴影，保留边框、角标、数字框高光和钟体。"""
    OUT.mkdir(exist_ok=True)
    source = Image.open(SRC).convert('RGBA')
    compare = Image.new('RGB', (SIZE[0] * 2, SIZE[1] * 3), '#BCCBDD')
    for row, (tier, top) in enumerate(TIERS):
        original = source.crop((86, top, 1290, top + SIZE[1]))
        base = original.copy()
        # 外部近黑背景透明化；只处理四角外围，内部深色描边不抠除。
        pixels = np.array(base)
        dark = np.max(pixels[:, :, :3], axis=2) < 9
        outside = np.zeros(dark.shape, dtype=bool)
        queue = deque([(x, y) for y in range(SIZE[1]) for x in (0, SIZE[0]-1)]
                      + [(x, y) for x in range(SIZE[0]) for y in (0, SIZE[1]-1)])
        # 只抠除与画布外界相通的近黑像素，避免深黑描边出现透明针孔。
        while queue:
            x, y = queue.popleft()
            if not (0 <= x < SIZE[0] and 0 <= y < SIZE[1]) or outside[y, x] or not dark[y, x]:
                continue
            outside[y, x] = True
            queue.extend(((x-1, y), (x+1, y), (x, y-1), (x, y+1)))
        pixels[outside, 3] = 0
        base = Image.fromarray(pixels)
        clock = original.crop(CLOCK_BOX)
        cp = np.array(clock)
        # 黄色/奶油色/红振动线与深色外描边留下，滤掉蓝色面板背景。
        r, g, b = [cp[:, :, i].astype(int) for i in range(3)]
        keep = (r > 100) | ((b < 66) & (r < 35) & (g < 40))
        cp[:, :, 3] = np.where(keep, 255, 0)
        clock = Image.fromarray(cp)
        draw = ImageDraw.Draw(base)
        # 从无字空隙取深蓝，整块清除钟体、标题、短横线和副标题及阴影。
        navy = original.getpixel((310, 180))
        draw.rectangle((36, 49, 830, 252), fill=navy)
        # 数字、秒字的阴影也在覆盖范围内；左上角高光位于此范围之外。
        fill = {'yellow': '#FFDE30', 'orange': '#FD6D2C', 'red': '#F53938'}[tier]
        draw.rectangle((899, 74, 1131, 232), fill=fill)
        save_sprite('closing_base_' + tier, base)
        save_sprite('closing_clock_' + tier, clock)
        composite = base.copy()
        composite.alpha_composite(clock, CLOCK_BOX[:2])
        compare.paste(original.convert('RGB'), (0, row * SIZE[1]))
        compare.paste(composite, (SIZE[0], row * SIZE[1]), composite)
        if row == 0:
            # 去掉数字块：沿用左侧无字面板的整列边框，补到右侧原阶梯角之前。
            plain = base.copy()
            strip = base.crop((500, 0, 501, SIZE[1])).resize((338, SIZE[1]), Image.Resampling.NEAREST)
            plain.paste(strip, (830, 0))
            # 保留右端原始外框，只抹掉数字框可能伸入的内侧残边。
            ImageDraw.Draw(plain).rectangle((830, 49, 1168, 252), fill=navy)
            save_sprite('closing_base_plain', plain)
    compare.save(ROOT / 'ref/closing_compare_src.png')


if __name__ == '__main__':
    main()
