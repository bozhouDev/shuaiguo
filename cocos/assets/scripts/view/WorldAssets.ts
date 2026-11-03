import {Asset, Rect, Size, SpriteFrame, Texture2D, TTFFont, resources} from 'cc';
import {ATLAS} from './atlas-data';

export interface Picture { frame: SpriteFrame; w: number; h: number; canvas: Picture }

// 只加载编辑器已导入的资源，不触发编辑器构建。
function load<T extends Asset>(path: string, type: new (...args: any[]) => T): Promise<T> {
  return new Promise((resolve, reject) => resources.load(path, type, (error, asset) => error ? reject(error) : resolve(asset)));
}

// 图集矩形在运行时切 SpriteFrame；所有派生帧跟随这一局释放。
export class WorldAssets {
  spr: Record<string, Picture> = {};
  title!: TTFFont;
  body400!: TTFFont;
  body700!: TTFFont;
  body900!: TTFFont;
  private crops = new Map<Picture, Map<string, Picture>>();
  private frames: SpriteFrame[] = [];

  // 图集失败只报错；图集内缺走路帧退回 normal，爆炸缺图退回撞击星。
  async load(onFonts?:()=>void): Promise<void> {
    [this.title, this.body400, this.body700, this.body900] = await Promise.all([load('title', TTFFont), load('body-400', TTFFont), load('body-700', TTFFont), load('body-900', TTFFont)]);
    onFonts?.();
    await Promise.all(ATLAS.sheets.map(async sheet => {
      try {
        const texture = await this.pixels(sheet.file + '/texture');
        for (const [name, rect] of Object.entries(sheet.frames)) this.spr[name] = this.picture(texture, rect);
      } catch (error) { console.warn('图集加载失败', sheet.file, error); }
    }));
    try {
      const texture = await this.pixels('fx/pot-cartoon-pow-bd83d9f0/texture');
      this.spr['pot-cartoon-pow-bd83d9f0'] = this.picture(texture, [0, 0, texture.width, texture.height]);
    } catch (error) { console.warn('爆炸图加载失败，使用撞击星', error); }
    for (const kind of ['calm', 'parry', 'rankup']) {try {const texture = await this.pixels(`ui/praise-${kind}/texture`); this.spr[`praise-${kind}`] = this.picture(texture, [0, 0, texture.width, texture.height]);}catch(error){console.warn('贴纸加载失败',kind,error);}}

  }

  // 图集和爆炸序列图统一像素采样，不启用模糊和mipmap。
  private async pixels(path: string): Promise<Texture2D> {
    const texture = await load(path, Texture2D);
    texture.setFilters(Texture2D.Filter.NEAREST, Texture2D.Filter.NEAREST); texture.setMipFilter(Texture2D.Filter.NONE);
    return texture;
  }

  // 禁用 trim 和动态合图，原型的留白、脚底和像素坐标保持不变。
  private picture(texture: Texture2D, [x, y, w, h]: number[]): Picture {
    const frame = new SpriteFrame();
    frame.texture = texture; frame.rect = new Rect(x, y, w, h);
    frame.originalSize = new Size(w, h); frame.packable = false;
    this.frames.push(frame);
    const picture = {frame, w, h} as Picture; picture.canvas = picture;
    return picture;
  }

  // 爆炸帧和头像裁切按矩形缓存，避免每帧分配 SpriteFrame。
  crop(pic: Picture, x: number, y: number, w: number, h: number): Picture {
    const r = pic.frame.rect;
    // 运行时SpriteFrame的uuid可能为空；必须用源Picture身份隔离，不能让不同人物共用裁片。
    let cache = this.crops.get(pic);
    if (!cache) {cache = new Map(); this.crops.set(pic, cache);}
    const key = `${x}:${y}:${w}:${h}`;
    let crop = cache.get(key);
    if (!crop) {
      crop = this.picture(pic.frame.texture as Texture2D, [r.x + x, r.y + y, w, h]);
      cache.set(key, crop);
    }
    return crop;
  }

  // 头像中心由导入脚本依据原图 alpha 统计，和原型 headCrop 使用相同公式。
  headCrop(name: string, heads: Record<string, number[]>): {canvas: Picture; sx: number; sy: number; size: number} | null {
    const pic = this.spr[name], head = heads[name];
    return pic && head ? {canvas: pic, sx: head[0], sy: 0, size: head[1]} : null;
  }

  // 节点销毁后释放本局派生帧，resources 资源仍由 Cocos 管理。
  destroy(): void { for (const frame of this.frames) frame.destroy(); this.frames = []; this.crops.clear(); }
}
