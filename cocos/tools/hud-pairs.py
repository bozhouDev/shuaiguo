"""并排截图和联系表：左原型，右Cocos；不修改源截图。"""
from pathlib import Path
from PIL import Image, ImageDraw
ROOT = Path(__file__).resolve().parents[2]
out = ROOT / 'port/tmp/p3-2'
pairs = []
for p in sorted(out.glob('*-prototype.png')):
    stem = p.name.removesuffix('-prototype.png')
    c = out / (stem + '-cocos.png')
    if not c.exists(): continue
    a, b = Image.open(p).convert('RGB'), Image.open(c).convert('RGB')
    image = Image.new('RGB', (a.width + b.width, max(a.height, b.height)), '#ffffff')
    image.paste(a, (0, 0)); image.paste(b, (a.width, 0)); image.save(out / (stem + '-pair.png')); pairs.append((stem, image))
if pairs:
    sheet = Image.new('RGB', (750, ((len(pairs)+2)//3)*300), '#ffffff')
    draw = ImageDraw.Draw(sheet)
    for i, (stem, image) in enumerate(pairs):
        thumb = image.copy(); thumb.thumbnail((250, 275)); x = (i%3)*250; y = (i//3)*300
        sheet.paste(thumb, (x, y+22)); draw.text((x+3, y+3), stem, fill='#1f2a44')
    sheet.save(out / 'contact.png')
print('PASS', len(pairs), 'pairs')
