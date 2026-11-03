"""从原图 alpha 和标题 TTF 导出头像裁切及字宽，不依赖运行平台的像素读回。"""
from pathlib import Path
import json, re, math
from PIL import Image
from fontTools.ttLib import TTFont
ROOT=Path(__file__).resolve().parents[2]
atlas=json.loads(re.search(r'window.ATLAS = (.*);', (ROOT/'js/atlas.js').read_text()).group(1))
heads={}
for sheet in atlas['sheets']:
    image=Image.open(ROOT/'assets/atlas'/sheet['file'].split('?')[0]).convert('RGBA')
    for name,(x,y,w,h) in sheet['frames'].items():
        # 对齐 JS Math.round，不用 Python 的偶数舍入。
        sample=image.crop((x,y,x+w,y+math.floor(h*.3+.5)))
        pixels=list(sample.getdata()); xs=[i%w for i,p in enumerate(pixels) if p[3]>128]
        size=min(w,math.floor(h*.46+.5)); hx=sum(xs)/len(xs) if xs else w/2
        heads[name]=[max(0,min(w-size,math.floor(hx-size/2+.5))),size]
font=TTFont(ROOT/'cocos/assets/resources/title.ttf'); units=font['head'].unitsPerEm
metrics={chr(ch):font['hmtx'][glyph][0]/units for ch,glyph in font.getBestCmap().items()}
(ROOT/'cocos/assets/scripts/view/visual-data.ts').write_text('// 由 tools/world-metrics.py 生成，头像 alpha 统计和 TTF 字宽。\nexport const HEADS: Record<string, number[]> = '+json.dumps(heads,separators=(',',':'))+';\nexport const METRICS: Record<string, number> = '+json.dumps(metrics,ensure_ascii=False,separators=(',',':'))+';\n')
print('头像',len(heads),'字宽',len(metrics))
