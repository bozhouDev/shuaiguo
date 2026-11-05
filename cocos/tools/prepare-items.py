"""切用户提供的三种蓝框道具；仅写Cocos素材和布局，不改原型。"""
from pathlib import Path
from collections import deque
import json,uuid
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]

def main():
    """去除与边缘相连的黑底，保留内部黑线和蓝框，最近邻统一像素比例。"""
    source=Image.open(ROOT.parent/'assets_pixel/sheets/s_items_p8.png').convert('RGBA')
    boxes=[(80,144,657,617),(724,166,1325,617),(1395,168,1971,617)]
    names=['item_clear','item_invincible','item_delay'];frames={};images=[];x=2
    for name,box in zip(names,boxes):
        pic=source.crop(box);w,h=pic.size;pixels=pic.load();seen=set();queue=deque([(i,j) for i in range(w) for j in (0,h-1)]+[(i,j) for i in (0,w-1) for j in range(h)])
        while queue:
            a,b=queue.popleft()
            if (a,b) in seen or not(0<=a<w and 0<=b<h):continue
            seen.add((a,b))
            if max(pixels[a,b][:3])>35:continue
            pixels[a,b]=(0,0,0,0);queue.extend([(a-1,b),(a+1,b),(a,b-1),(a,b+1)])
        pic=pic.crop(pic.getbbox());w,h=pic.size
        pic=pic.resize((60,round(h/w*60)),Image.Resampling.NEAREST);pic=pic.resize((120,pic.height*2),Image.Resampling.NEAREST)
        frames[name]=[x,2,*pic.size];images.append((x,pic));x+=pic.width+2
    sheet=Image.new('RGBA',(x,max(im.height for _,im in images)+4))
    for x,pic in images:sheet.paste(pic,(x,2))
    dest=ROOT/'assets/resources/atlas/items.png';meta=dest.with_suffix('.png.meta')
    if not meta.exists():
        data=json.loads((dest.parent/'misc.png.meta').read_text());old=data['uuid'];new=str(uuid.uuid4())
        data=json.loads(json.dumps(data).replace(old,new).replace('misc','items'))
        sub=data['subMetas']['f9941']['userData'];sub.update(trimX=0,trimY=0,offsetX=0,offsetY=0,width=sheet.width,height=sheet.height,rawWidth=sheet.width,rawHeight=sheet.height,trimType='none');sub.pop('vertices',None)
        meta.write_text(json.dumps(data,indent=2)+'\n')
    sheet.quantize(colors=128,method=Image.Quantize.FASTOCTREE).save(dest,optimize=True)
    p=ROOT/'assets/scripts/view/atlas-data.ts';head,text=p.read_text().split('= ',1);data=json.loads(text.strip().rstrip(';'));data['sheets']=[s for s in data['sheets'] if s['file']!='atlas/items'];data['sheets'].append({'file':'atlas/items','frames':frames})
    p.write_text(head+'= '+json.dumps(data,ensure_ascii=False,indent=2)+';\n')
    print(json.dumps({'file':str(dest.relative_to(ROOT)),'bytes':dest.stat().st_size,'size':sheet.size,'frames':frames},ensure_ascii=False))
if __name__=='__main__':main()
