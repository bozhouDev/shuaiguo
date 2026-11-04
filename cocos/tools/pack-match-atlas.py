"""只生成既有211帧的运行时布局；传输复用原索引色PNG，不输出match.png。"""
from pathlib import Path
import json, uuid
ROOT=Path(__file__).resolve().parents[1]
SCRIPTS=ROOT/'assets/scripts/view'
data=json.loads((SCRIPTS/'atlas-data.ts').read_text().split('= ',1)[1].strip().rstrip(';'))
frames={};sizes={}
for sheet in data['sheets']:
    if sheet['file'] in ['atlas/lobby','atlas/intro','atlas/props']:continue
    for name,(_,_,w,h) in sheet['frames'].items():
        if not name.startswith(('intro_','lobby_')):sizes[name]=(w,h)
# 布局必须与已有对局图一致，保留4096虚拟UV和保护边；不量化、不缩放。
x=y=2;row=0
for name,(w,h) in sorted(sizes.items(),key=lambda p:(-p[1][1],p[0])):
    if x+w+2>4096:x=2;y+=row+2;row=0
    if y+h+2>3072:raise RuntimeError('像素区超出3072；需重新评估体积/显存')
    frames[name]=[x,y,w,h];x+=w+2;row=max(row,h)
width=max(r[0]+r[2] for r in frames.values())+2;height=y+row+2
(SCRIPTS/'match-atlas-data.ts').write_text('// 由 tools/pack-match-atlas.py 生成布局；运行时复用原索引色分片，文字另用动态纹理。\nexport const MATCH_ATLAS = '+json.dumps({'width':width,'height':height,'frames':frames},ensure_ascii=False,separators=(',',':'))+';\n')
meta=SCRIPTS/'match-atlas-data.ts.meta'
if not meta.exists():meta.write_text(json.dumps({'ver':'4.0.24','importer':'typescript','imported':True,'uuid':str(uuid.uuid4()),'files':[],'subMetas':{},'userData':{}},indent=2)+'\n')
print(json.dumps({'frames':len(frames),'size':[width,height],'newImageDownloadBytes':0}))
