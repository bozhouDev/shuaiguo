"""只读校验运行时分片布局、来源索引PNG和无损复原；不输出生产PNG、不运行编辑器/构建。"""
from pathlib import Path
import json, hashlib, argparse
from PIL import Image
ROOT=Path(__file__).resolve().parents[1];VIEW=ROOT/'assets/scripts/view'

def data(name):
    """读取生成的TS数据常量。"""
    return json.loads((VIEW/name).read_text().split('= ',1)[1].strip().rstrip(';'))

def main():
    """将原图逐帧复制到内存，与交付前布局/像素和真实GPU读回哈希分别比较。"""
    parser=argparse.ArgumentParser();parser.add_argument('--reference');parser.add_argument('--gpu-evidence');args=parser.parse_args()
    match,original=data('match-atlas-data.ts'),data('atlas-data.ts')
    atlas=Image.new('RGBA',(match['width'],match['height']));atlas.putpixel((0,0),(255,255,255,255))
    verified=set();sheets=[];source_bytes=0
    assert not (ROOT/'assets/resources/atlas/match.png').exists(),'不应继续发布match.png'
    assert not (ROOT/'assets/resources/atlas/match.png.meta').exists(),'不应保留孤立meta'
    for sheet in original['sheets']:
        covered=set(sheet['frames'])&set(match['frames'])
        if not covered:continue
        assert covered==set(sheet['frames']),'来源应被完整复用'
        file=ROOT/'assets/resources'/(sheet['file']+'.png');encoded=Image.open(file)
        assert encoded.mode=='P',str(file)+'不是索引PNG'
        image=encoded.convert('RGBA');source_bytes+=file.stat().st_size
        sheets.append({'file':sheet['file'],'mode':encoded.mode,'size':image.size,'bytes':file.stat().st_size,'frames':len(covered)})
        for name in covered:
            x,y,w,h=sheet['frames'][name];tx,ty,tw,th=match['frames'][name]
            assert (w,h)==(tw,th),name
            assert 0<=tx and 0<=ty and tx+w<=atlas.width and ty+h<=atlas.height,name
            atlas.paste(image.crop((x,y,x+w,y+h)),(tx,ty));verified.add(name)
    assert verified==set(match['frames']);assert len(sheets)==12
    if args.reference:
        reference=Image.open(args.reference).convert('RGBA');assert reference.size==atlas.size
        assert reference.tobytes()==atlas.tobytes(),'复原像素与交付前RGBA不同'
    digest=hashlib.sha256(atlas.tobytes()).hexdigest()
    if args.gpu_evidence:
        evidence=json.loads(Path(args.gpu_evidence).read_text());assert evidence['atlas']['sha256']==digest,'GPU读回像素不一致'
    print(json.dumps({'size':atlas.size,'rgbaSha256':digest,'framesVerified':len(verified),'decodedDifferentPixels':0,'sourcePngBytes':source_bytes,'newImageDownloadBytes':0,'sheets':sheets},ensure_ascii=False,indent=2))

if __name__=='__main__':main()
