"""生成对局帧的运行时布局；传输复用原索引色PNG，不输出match.png。"""
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
# 保留既有矩形与4096虚拟UV，从最后一行空余位置追加；重复执行不再移动新旧帧。
layout=SCRIPTS/'match-atlas-data.ts'
if layout.exists():
    old=json.loads(layout.read_text().split('= ',1)[1].strip().rstrip(';'))
    for name,rect in old['frames'].items():
        if name not in sizes or list(sizes[name])!=rect[2:]:
            raise RuntimeError('保留布局时旧帧不能删除或改尺寸：'+name)
        frames[name]=rect
x=y=2;row=0
if frames:
    y=max(r[1] for r in frames.values())
    last=[r for r in frames.values() if r[1]+r[3]+2>y]
    x=max(r[0]+r[2]+2 for r in last)
    row=max(r[1]+r[3]-y for r in last)
for name,(w,h) in sorted(sizes.items(),key=lambda p:(-p[1][1],p[0])):
    if name in frames:continue
    if x+w+2>4096:x=2;y+=row+2;row=0
    if y+h+2>3072:raise RuntimeError('像素区超出3072；需重新评估体积/显存')
    frames[name]=[x,y,w,h];x+=w+2;row=max(row,h)
width=max(r[0]+r[2] for r in frames.values())+2
height=max(r[1]+r[3] for r in frames.values())+2
(SCRIPTS/'match-atlas-data.ts').write_text('// 由 tools/pack-match-atlas.py 生成布局；运行时复用原索引色分片，文字另用动态纹理。\nexport const MATCH_ATLAS = '+json.dumps({'width':width,'height':height,'frames':frames},ensure_ascii=False,separators=(',',':'))+';\n')
meta=SCRIPTS/'match-atlas-data.ts.meta'
if not meta.exists():meta.write_text(json.dumps({'ver':'4.0.24','importer':'typescript','imported':True,'uuid':str(uuid.uuid4()),'files':[],'subMetas':{},'userData':{}},indent=2)+'\n')
print(json.dumps({'frames':len(frames),'size':[width,height],'newImageDownloadBytes':sum((ROOT/'assets/resources'/(sheet['file']+'.png')).stat().st_size for sheet in data['sheets'] if sheet['file']=='atlas/items')}))
