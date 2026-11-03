"""提取对局全部源码字符，生成静态 TTF；不改原型字体。"""
from pathlib import Path
import re, json, subprocess
from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / 'assets_pixel/fonts_src'


def build(source, output, text, weight=None):
    """固定变量字重，同时修正变量字体遗留的 Thin 名称和 OS/2 标记。"""
    font = TTFont(SOURCE / source)
    if weight is not None:
        font = instantiateVariableFont(font, {'wght': weight}, inplace=True)
        family = 'Shuaiguo Noto Sans SC'
        style = {400: 'Regular', 700: 'Bold', 900: 'Black'}[weight]
        for nid, value in {1: family, 2: style, 3: family + ' ' + style, 4: family + ' ' + style,
                           6: 'ShuaiguoNotoSansSC-' + style, 16: family, 17: style}.items():
            for platform, enc, lang in [(3, 1, 0x409), (1, 0, 0)]:
                font['name'].setName(value, nid, platform, enc, lang)
        font['OS/2'].usWeightClass = weight
        font['OS/2'].fsSelection = (font['OS/2'].fsSelection & ~((1 << 6) | (1 << 5))) | (1 << (6 if weight == 400 else 5))
        font['head'].macStyle = (font['head'].macStyle & ~1) | (0 if weight == 400 else 1)
    options = Options()
    subset = Subsetter(options)
    subset.populate(text=text)
    subset.subset(font)
    font.flavor = None
    out = ROOT / 'assets/resources' / output
    font.save(out)
    return {'file': output, 'bytes': out.stat().st_size, 'weight': font['OS/2'].usWeightClass,
            'family': font['name'].getDebugName(1), 'style': font['name'].getDebugName(2),
            'glyphs': len(font.getBestCmap()),
            'missingChinese': ''.join(ch for ch in text if '\u4e00' <= ch <= '\u9fff' and ord(ch) not in font.getBestCmap())}


if __name__ == '__main__':
    files = [ROOT.parent / 'js/levels.js', ROOT.parent / 'js/game.js',
             *sorted((ROOT / 'assets/scripts/core').glob('*.ts')),
             *sorted((ROOT / 'assets/scripts/view').glob('*.ts'))]
    # 源码全部中文和标点纳入，动态插值再补完整数字和拉丁字母；宁可多收，不漏台词。
    text = ''.join(p.read_text() for p in files) + '这锅你来背甩!弹!急件0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz +-.×½'
    # 复用画面层同一正则，原型/core/注释中保留的图标字符不再进入字体子集。
    rules = (ROOT / 'assets/scripts/view/ui-data.ts').read_text()
    pattern = re.search(r'^export const LABEL_ICON_PATTERN = (/.+/gu);$', rules, re.M).group(1)
    text = subprocess.run(['node', '-e',
                           f'const fs=require("node:fs");process.stdout.write(fs.readFileSync(0,"utf8").replace({pattern},""));'],
                          input=text, text=True, capture_output=True, check=True).stdout
    text = ''.join(sorted(set(text)))
    reports = [build('ZCOOLKuaiLe-Regular.ttf', 'title.ttf', text),
               build('NotoSansSC-VF.ttf', 'body-400.ttf', text, 400),
               build('NotoSansSC-VF.ttf', 'body-700.ttf', text, 700),
               build('NotoSansSC-VF.ttf', 'body-900.ttf', text, 900)]
    dest = ROOT.parent / 'port/tmp/p4-2-d'
    dest.mkdir(parents=True, exist_ok=True)
    (dest / 'fonts.json').write_text(json.dumps({'sources': [str(p.relative_to(ROOT.parent)) for p in files],
                                               'characters': len(text), 'fonts': reports}, ensure_ascii=False, indent=2))
    print(json.dumps(reports, ensure_ascii=False, indent=2))
