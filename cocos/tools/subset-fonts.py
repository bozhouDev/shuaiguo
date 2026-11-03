"""仅生成骨架画面所需 TTF，不修改原型字体；依赖已有 fontTools。"""
from pathlib import Path
from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / 'assets_pixel/fonts_src'


def build(source, output, text, weight=None):
    """中文裁字与固定字重；输出微信支持的静态 TTF。"""
    font = TTFont(SOURCE / source)
    if weight is not None:
        font = instantiateVariableFont(font, {'wght': weight})
    options = Options()
    subset = Subsetter(options)
    subset.populate(text=text)
    subset.subset(font)
    font.flavor = None
    font.save(ROOT / 'assets/resources' / output)
    print(output, (ROOT / 'assets/resources' / output).stat().st_size, 'bytes')


if __name__ == '__main__':
    build('ZCOOLKuaiLe-Regular.ttf', 'title.ttf', '这锅你来背点一下')
    build('NotoSansSC-VF.ttf', 'body.ttf', '背锅 3+1.5', 700)
