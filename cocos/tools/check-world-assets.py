"""只读审计像素导入、三份字体字重/cmap和资源体积，不启动编辑器。"""
from pathlib import Path
import json,re,hashlib
from fontTools.ttLib import TTFont
ROOT=Path(__file__).resolve().parents[2]
assets=ROOT/'cocos/assets'
bad=[]; metas=[]
def inspect(obj,where):
    if not isinstance(obj,dict):return
    if obj.get('importer')=='*':bad.append(where)
    for k,v in obj.get('subMetas',{}).items():inspect(v,where+':'+k)
for p in assets.rglob('*.meta'):
    metas.append(str(p.relative_to(ROOT)));inspect(json.loads(p.read_text()),str(p.relative_to(ROOT)))
assert not bad,bad
fonts=[]
for name,w in [('title.ttf',400),('body-700.ttf',700),('body-900.ttf',900)]:
    p=assets/'resources'/name;f=TTFont(p);assert f['OS/2'].usWeightClass==w
    fonts.append({'file':name,'bytes':p.stat().st_size,'weight':w,'family':f['name'].getDebugName(1),'style':f['name'].getDebugName(2),'glyphs':len(f.getBestCmap()),'variable':'fvar' in f})
copies=[]
for kind in ['atlas','fx']:
    for p in (ROOT/'assets'/kind).iterdir():
        q=assets/'resources'/kind/p.name
        assert p.read_bytes()==q.read_bytes(),q
        copies.append({'file':str(q.relative_to(ROOT)),'bytes':q.stat().st_size})
# 图集随代码一起打包，禁止重复加入单图后备及目录meta。
assert not (assets/'resources/fallback').exists(),'重复的 resources/fallback 仍存在'
assert not (assets/'resources/fallback.meta').exists(),'过期的 fallback.meta 仍存在'
report={'metas':len(metas),'badImporters':bad,'fonts':fonts,'copies':copies,'atlasBytes':sum(x['bytes'] for x in copies if '/atlas/' in x['file']),'fxBytes':sum(x['bytes'] for x in copies if '/fx/' in x['file'])}
(ROOT/'port/tmp/p3-1/asset-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print('PASS',len(metas),'meta importer正常；三份静态字体字重400/700/900；复制资源字节一致；无重复单图后备及meta')
