"""导出UI排版所用的实际TTF字宽，不依赖系统字体回退或DOM。"""
from pathlib import Path
import json
from fontTools.ttLib import TTFont
ROOT = Path(__file__).resolve().parents[1]
metrics = {}
for name in ['title', 'body-400', 'body-700', 'body-900']:
    font = TTFont(ROOT / f'assets/resources/{name}.ttf')
    metrics[name] = {chr(ch): font['hmtx'][g][0] / font['head'].unitsPerEm for ch, g in font.getBestCmap().items()}
(ROOT / 'assets/scripts/view/ui-metrics.ts').write_text('// 由 tools/ui-metrics.py 按TTF hmtx生成，单位em。\nexport const UI_METRICS: Record<string, Record<string, number>> = ' + json.dumps(metrics, ensure_ascii=False, separators=(',', ':')) + ';\n')
print('UI字体字宽', {k: len(v) for k, v in metrics.items()})
