"""把验收左右图逐张拼接；不编辑任何素材。左原型，右Cocos。"""
from pathlib import Path
from PIL import Image, ImageChops, ImageStat, ImageDraw
import json
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'port/tmp/p3-1'
report=[]
for left in sorted(OUT.glob('*-prototype.png')):
    name=left.name.removesuffix('-prototype.png')
    right=OUT/(name+'-cocos.png')
    if not right.exists():continue
    a=Image.open(left).convert('RGB');b=Image.open(right).convert('RGB')
    assert a.size==b.size==(375,812)
    pair=Image.new('RGB',(750,836),'#FFFDF5');pair.paste(a,(0,24));pair.paste(b,(375,24))
    draw=ImageDraw.Draw(pair);draw.text((8,6),'Prototype | '+name,fill='#1F2A44');draw.text((383,6),'Cocos | '+name,fill='#1F2A44')
    pair.save(OUT/(name+'-pair.png'))
    delta=ImageChops.difference(a,b);report.append({'file':name+'-pair.png','meanAbsoluteRGB':sum(ImageStat.Stat(delta).mean)/3})
(OUT/'pair-metrics.json').write_text(json.dumps(report,indent=2))
print('PASS',len(report),'pairs; left=prototype right=Cocos')
# 同一浏览器栅格化的字体证据：旧/新/原型源字形逐行展示，避免仅凭字体名验收。
proof=OUT/'font-reference-proof.json'
if proof.exists():
    import base64,io
    samples=json.loads(proof.read_text())['samples']
    board=Image.new('RGB',(800,90*len(samples)+24),'#FFFDF5');d=ImageDraw.Draw(board)
    d.text((8,6),'Same canvas raster: title / extended world text',fill='#1F2A44')
    for i,sample in enumerate(samples):
        y=24+i*90;d.text((8,y),sample['family'],fill='#1F2A44')
        for col,key in enumerate(['title','extended']):
            im=Image.open(io.BytesIO(base64.b64decode(sample[key].split(',')[1]))).convert('RGBA')
            board.paste(im,(400*col,y+20),im)
    board.save(OUT/'font-reference.png')
