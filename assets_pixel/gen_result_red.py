"""从验收后的金色彩带逐色替换为暗红版；不改轮廓、透明度或原素材。"""
from pathlib import Path
import json
import uuid
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'cocos/assets/resources/result/ui_result_ribbon.png'
OUTPUT = SOURCE.with_name('ui_result_ribbon_red.png')
# 警报红同色系：主面压暗，最高光仍为规范的警报红，白字清晰可读。
COLORS = {
    'FFD84D': 'BA3F3C', 'FFF3B0': 'E8504A', 'F0C000': 'D94742',
    'C98A00': '8F302F', 'A86030': '762B31', '784818': '5C2530',
}


def generate():
    """保留未命中的描边色，图片和meta均可确定性重跑。"""
    source = Image.open(SOURCE).convert('RGBA')
    mapping = {tuple(bytes.fromhex(a)): tuple(bytes.fromhex(b)) for a, b in COLORS.items()}
    pixels = [(*mapping.get(pixel[:3], pixel[:3]), pixel[3]) for pixel in source.getdata()]
    output = Image.new('RGBA', source.size)
    output.putdata(pixels)
    output.quantize(colors=32, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(OUTPUT, optimize=True)
    # 沿用原图导入设置，独立UUID；不让编辑器启动来生成meta。
    meta = json.loads(SOURCE.with_suffix('.png.meta').read_text())
    old_uuid = meta['uuid']
    new_uuid = str(uuid.uuid5(uuid.NAMESPACE_URL, 'shuaiguo/result/ui_result_ribbon_red'))
    text = json.dumps(meta, ensure_ascii=False, indent=2).replace(old_uuid, new_uuid).replace('ui_result_ribbon', 'ui_result_ribbon_red')
    OUTPUT.with_suffix('.png.meta').write_text(text + '\n')
    print(f'{OUTPUT.relative_to(ROOT)} {output.width}×{output.height} {OUTPUT.stat().st_size} B')


if __name__ == '__main__':
    generate()
