"""
把游戏用到的两款网页字体裁成「只含游戏里出现过的字」的子集 woff2，放在自己服务器上，不再从 Google Fonts 加载（国内很慢）。
用法：python3 build_fonts.py      （新增或改了界面文案后重新跑一次，否则新字会退回系统字体显示）
字体源文件放在 fonts_src/（不进仓库），没有时从 Google Fonts 官方仓库下载：
  ZCOOLKuaiLe-Regular.ttf  https://github.com/google/fonts/raw/main/ofl/zcoolkuaile/ZCOOLKuaiLe-Regular.ttf
  NotoSansSC-VF.ttf        https://github.com/google/fonts/raw/main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf
输出：../assets/fonts/*.woff2 和 ../css/fonts.css（文件名带内容哈希，字体更新后浏览器会重新下载）
"""
import glob
import hashlib
import io
import os
from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.join(ROOT, '..')
SRC = os.path.join(ROOT, 'fonts_src')
OUT = os.path.join(PROJ, 'assets', 'fonts')
CSS = os.path.join(PROJ, 'css', 'fonts.css')

# 要输出的字体：(CSS 字体名, 字重, 源文件, 可变字体要固定到的字重 / None)
FONTS = [
    ('ZCOOL KuaiLe', 400, 'ZCOOLKuaiLe-Regular.ttf', None),   # 标题、按钮、数字、飘字
    ('Noto Sans SC', 700, 'NotoSansSC-VF.ttf', 700),         # 弹窗正文
    ('Noto Sans SC', 900, 'NotoSansSC-VF.ttf', 900),         # 弹窗标题和按钮
]


def used_chars():
    """收集页面、脚本、样式里出现的所有字符，再补上全部可见 ASCII 和常用中文标点。"""
    text = ''
    for path in [os.path.join(PROJ, 'index.html')] + glob.glob(os.path.join(PROJ, 'js', '*.js')) + [os.path.join(PROJ, 'css', 'style.css')]:
        with open(path, encoding='utf-8') as f:
            text += f.read()
    chars = {c for c in text if ord(c) > 0x7E}
    chars |= {chr(i) for i in range(0x20, 0x7F)}
    chars |= set('，。！？、：；“”‘’（）《》【】…—·～')
    return ''.join(sorted(chars))


def build(family, weight, src, wght, chars):
    """裁出一个字重的子集，返回 woff2 字节。"""
    font = TTFont(os.path.join(SRC, src))
    if wght is not None:
        font = instantiateVariableFont(font, {'wght': wght})  # 可变字体先固定到指定字重
    opts = Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['*']
    opts.name_IDs = ['*']
    sub = Subsetter(opts)
    sub.populate(text=chars)
    sub.subset(font)
    buf = io.BytesIO()
    font.flavor = 'woff2'
    font.save(buf)
    return buf.getvalue()


def main():
    os.makedirs(OUT, exist_ok=True)
    for old in glob.glob(os.path.join(OUT, '*.woff2')):
        os.remove(old)
    chars = used_chars()
    print(f'共 {len(chars)} 个字符')
    rules = []
    for family, weight, src, wght in FONTS:
        data = build(family, weight, src, wght, chars)
        ver = hashlib.md5(data).hexdigest()[:8]
        name = f"{family.replace(' ', '')}-{weight}.{ver}.woff2"
        with open(os.path.join(OUT, name), 'wb') as f:
            f.write(data)
        print(f'{name:40s} {len(data) / 1024:.0f} KB')
        # font-display: swap —— 字体没到之前先用系统字体显示，不让界面空白
        rules.append(f"@font-face {{ font-family: \"{family}\"; font-weight: {weight}; font-style: normal; font-display: swap;\n"
                     f"  src: url(../assets/fonts/{name}) format(\"woff2\"); }}")
    with open(CSS, 'w', encoding='utf-8') as f:
        f.write('/* 由 assets_pixel/build_fonts.py 自动生成，不要手改：自托管的子集字体，只含游戏里用到的字 */\n')
        f.write('\n'.join(rules) + '\n')


if __name__ == '__main__':
    main()
