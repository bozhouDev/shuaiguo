import {Asset, assetManager, ImageAsset, EffectAsset, Material, Director, director, gfx, Rect, Size, SpriteFrame, Texture2D, TTFFont, resources} from 'cc';
import {ATLAS} from './atlas-data';
import {MATCH_ATLAS} from './match-atlas-data';

// 结算独立素材不回写原型图集；名称与阶段一交付的PNG一一对应。
const RESULT_IMAGES = ['sky_clear', 'trophy', 'ribbon', 'ribbon_red', 'rays_left', 'rays_right',
  'plane', 'grass_left', 'grass_right', 'frame_gold', 'frame_table', 'button_blue', 'button_gold',
  'sky_overcast', 'sky_storm', 'overtime', 'crushed'];

export interface Picture { frame: SpriteFrame; w: number; h: number; canvas: Picture }

// 只加载编辑器已导入的资源，不触发编辑器构建。
function load<T extends Asset>(path: string, type: new (...args: any[]) => T): Promise<T> {
  return new Promise((resolve, reject) => resources.load(path, type, (error, asset) => error ? reject(error) : resolve(asset)));
}

// 图集矩形在运行时切 SpriteFrame；所有派生帧跟随这一局释放。
export class WorldAssets {
  spr: Record<string, Picture> = {};
  title!: TTFFont;
  matchTexture!: Texture2D;
  matchBuffers?:{format:gfx.Attribute[];accessor:any};
  matchMaterial?:Material;matchEffect?:EffectAsset;
  body400!: TTFFont;
  body700!: TTFFont;
  body900!: TTFFont;
  private crops = new Map<Picture, Map<string, Picture>>();
  private frames: SpriteFrame[] = [];

  // 图集失败只报错；图集内缺走路帧退回 normal，爆炸缺图退回撞击星。
  async load(onFonts?:()=>void, strict=false): Promise<void> {
    [this.title, this.body400, this.body700, this.body900] = await Promise.all([load('title', TTFFont), load('body-400', TTFFont), load('body-700', TTFFont), load('body-900', TTFFont)]);
    onFonts?.();
    // 先建共享帧；外围页面与对局共用纹理，完全覆盖的旧角色/图标图集不再加载。
    // 微信后续资源失败会重试load；拼好的纹理/帧继续复用，不能每次重试再占39MB。
    if(!this.matchTexture){
      this.matchTexture=await this.assembleMatch();
      for(const [name,rect] of Object.entries(MATCH_ATLAS.frames))this.spr[name]=this.picture(this.matchTexture,rect);
    }
    const sheets=await Promise.allSettled(ATLAS.sheets.filter(sheet=>Object.keys(sheet.frames).some(name=>!this.spr[name])).map(async sheet=>{
      try{const texture=await this.pixels(sheet.file+'/texture');for(const [name,rect] of Object.entries(sheet.frames))if(!this.spr[name])this.spr[name]=this.picture(texture,rect);}
      catch(error){console.warn('图集加载失败',sheet.file,error);if(strict)throw error;}
    }));
    const failed=sheets.find((s):s is PromiseRejectedResult=>s.status==='rejected');if(failed)throw failed.reason;
    // 必需的结算美术跟随首屏加载；缺失直接报告加载失败，避免静默显示半张弹窗。
    await Promise.all(RESULT_IMAGES.map(async name => {
      const texture = await this.pixels(`result/ui_result_${name}/texture`);
      this.spr[`ui_result_${name}`] = this.picture(texture, [0, 0, texture.width, texture.height]);
    }));
    try {
      const texture = await this.pixels('fx/pot-cartoon-pow-bd83d9f0/texture');
      this.spr['pot-cartoon-pow-bd83d9f0'] = this.picture(texture, [0, 0, texture.width, texture.height]);
    } catch (error) { console.warn('爆炸图加载失败，使用撞击星', error); }
    for (const kind of ['calm', 'parry', 'rankup']) {try {const texture = await this.pixels(`ui/praise-${kind}/texture`); this.spr[`praise-${kind}`] = this.picture(texture, [0, 0, texture.width, texture.height]);}catch(error){console.warn('贴纸加载失败',kind,error);}}

  }

  // 来源只建ImageAsset。共用一张临时gfx搬运纹理，避免2D Canvas预乘/反预乘改变半透明颜色。
  // 逐帧copyTexSubImage2D保留原始RGBA，不读回CPU、不经Canvas，不建来源Texture2D。
  private async assembleMatch(): Promise<Texture2D> {
    const texture=new Texture2D();texture.reset({width:MATCH_ATLAS.width,height:MATCH_ATLAS.height});
    texture.setFilters(Texture2D.Filter.NEAREST,Texture2D.Filter.NEAREST);texture.setMipFilter(Texture2D.Filter.NONE);
    texture.setWrapMode(Texture2D.WrapMode.CLAMP_TO_EDGE,Texture2D.WrapMode.CLAMP_TO_EDGE);
    const device=director.root!.device;
    const sheets=ATLAS.sheets.filter(sheet=>Object.keys(sheet.frames).some(name=>name in MATCH_ATLAS.frames));
    // 搬运区仅在启动期间存在，一次处理一个来源；上限取真实来源尺寸，不开4096整图CPU副本。
    const scratch=device.createTexture(new gfx.TextureInfo(gfx.TextureType.TEX2D,gfx.TextureUsageBit.SAMPLED|gfx.TextureUsageBit.TRANSFER_SRC|gfx.TextureUsageBit.TRANSFER_DST,gfx.Format.RGBA8,1,1));
    // gfx没有跨WebGL1/2的公开区域复制入口。只在此处取原生句柄，且原样恢复绑定，不改引擎状态缓存。
    const gl=(device as unknown as {gl:WebGLRenderingContext}).gl;
    const gl2=gl as WebGL2RenderingContext,framebufferTarget=gl2.READ_FRAMEBUFFER??gl.FRAMEBUFFER;
    const framebufferBinding=gl2.READ_FRAMEBUFFER_BINDING??gl.FRAMEBUFFER_BINDING,framebuffer=gl.createFramebuffer();
    const native=(t:gfx.Texture):WebGLTexture=>(t as unknown as {gpuTexture:{glTexture:WebGLTexture}}).gpuTexture.glTexture;
    try {
      const white=new gfx.BufferTextureCopy();white.texExtent.width=white.texExtent.height=1;
      device.copyBuffersToTexture([new Uint8Array([255,255,255,255])],texture.getGFXTexture()!,[white]);
      for(const sheet of sheets){
        const image=await load(sheet.file,ImageAsset);
        try {
          scratch.resize(image.width,image.height);
          const region=new gfx.BufferTextureCopy();region.texExtent.width=image.width;region.texExtent.height=image.height;
          device.copyTexImagesToTexture([image.data as HTMLImageElement],scratch,[region]);
          const previousFramebuffer=gl.getParameter(framebufferBinding),previousTexture=gl.getParameter(gl.TEXTURE_BINDING_2D);
          try {
            gl.bindFramebuffer(framebufferTarget,framebuffer);gl.framebufferTexture2D(framebufferTarget,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,native(scratch),0);
            gl.bindTexture(gl.TEXTURE_2D,native(texture.getGFXTexture()!));
            for(const [name,[sx,sy,w,h]] of Object.entries(sheet.frames)){
              if(!(name in MATCH_ATLAS.frames))continue;
              const [x,y]=MATCH_ATLAS.frames[name as keyof typeof MATCH_ATLAS.frames];
              gl.copyTexSubImage2D(gl.TEXTURE_2D,0,x,y,sx,sy,w,h);
            }
          } finally {gl.bindTexture(gl.TEXTURE_2D,previousTexture);gl.bindFramebuffer(framebufferTarget,previousFramebuffer);}
        } finally {assetManager.releaseAsset(image);}
      }
      return texture;
    } catch(error){texture.destroy();throw error;}
    finally {gl.deleteFramebuffer(framebuffer);scratch.destroy();}
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
  destroy(): void { const buffers=this.matchBuffers;if(buffers){this.matchBuffers=undefined;director.once(Director.EVENT_AFTER_DRAW,()=>{const b=director.root?.batcher2D as any;if(b?._bufferAccessors.get(40)===buffers.accessor){b._bufferAccessors.delete(40);if(b._staticVBBuffer===buffers.accessor)b._staticVBBuffer=null;}buffers.accessor.destroy();});}this.matchMaterial?.destroy();this.matchEffect?.destroy();for (const frame of this.frames) frame.destroy(); this.matchTexture?.destroy(); this.frames = []; this.crops.clear(); }
}
