import {Color, EffectAsset, Material, Label, Layers, Node, Rect, RenderData, Size, Sprite, SpriteFrame, Texture2D, UITransform, director, gfx} from 'cc';
import {WorldAssets, Picture} from './WorldAssets';
import {DrawSurface} from './DrawSurface';
import {displayText} from './ui-data';
import {UI_METRICS} from './ui-metrics';
import {MATCH_ATLAS} from './match-atlas-data';

interface Ink {r:number;g:number;b:number;a:number}
interface TextTile {frame:SpriteFrame;uv?:number[];w:number;h:number}
interface Mesh {xy:number[];uv?:number[];indices:number[]}
// 所有私有引擎网格访问集中在这一处；沿3.8.8 Sprite的标准批处理通道提交，材质/贴图相同即可合批。
// 网格容量只在拓扑改变时调整，日常位置、颜色、方向更新不创建Graphics或MeshRenderData。
const meshAssembler = {
  updateRenderData(sprite:any):void {const rd=sprite.renderData;if(rd&&sprite.spriteFrame)rd.updateRenderData(sprite,sprite.spriteFrame);},
  // Sprite.onEnable仍会调用这两个标准回调；本网格的UV/颜色由fillBuffers维护。
  updateColor():void {},
  updateUVs():void {},
  fillBuffers(sprite:any):void {
    const rd=sprite.renderData;if(!rd)return;const mesh:Mesh=sprite.__matchMesh,chunk=rd.chunk,m=sprite.node.worldMatrix,vb=chunk.vb,stride=rd.floatStride;
    const color=sprite.color,uv=mesh.uv,base=sprite.spriteFrame.uv;
    for(let i=0;i<mesh.xy.length/2;i++){
      const x=mesh.xy[i*2],y=-mesh.xy[i*2+1],at=i*stride;
      vb[at]=m.m00*x+m.m04*y+m.m12;vb[at+1]=m.m01*x+m.m05*y+m.m13;vb[at+2]=m.m02*x+m.m06*y+m.m14;
      vb[at+3]=uv?uv[i*2]:(base[0]+base[6])/2;vb[at+4]=uv?uv[i*2+1]:(base[1]+base[7])/2;
      vb[at+5]=color.r/255;vb[at+6]=color.g/255;vb[at+7]=color.b/255;vb[at+8]=color.a/255;
    }
    const buffer=chunk.meshBuffer,ib=buffer.iData,offset=buffer.indexOffset;for(let i=0;i<mesh.indices.length;i++)ib[offset+i]=chunk.vertexOffset+mesh.indices[i];buffer.indexOffset+=mesh.indices.length;rd.vertDirty=false;
  },
};
// 精灵与文字分别驻留；文字仍由原生Label整段栅格，不切字、不启用CHAR。
export class MatchAtlas {
  readonly white:SpriteFrame;
  readonly textTexture:Texture2D;
  readonly material:Material;
  readonly format:gfx.Attribute[];readonly accessor:any;
  readonly pictures:Record<string,Picture>={};
  readonly curves=new Map<string,{points:number[];indices:number[]}>();
  private texts=new Map<string,TextTile>();private frames:SpriteFrame[]=[];
  // 继续用旧4096虚拟坐标排字，保留插值舍入；实际上传时减去旧精灵区偏移。
  private x=2;private y=2423;private row=0;
  private baker:DrawSurface;
  constructor(readonly texture:Texture2D,readonly assets:WorldAssets,root:Node){
    const batcher=director.root!.batcher2D as any;
    if(!assets.matchBuffers){
      const format=[new gfx.Attribute(gfx.AttributeName.ATTR_POSITION,gfx.Format.RGB32F),new gfx.Attribute(gfx.AttributeName.ATTR_TEX_COORD,gfx.Format.RG32F),new gfx.Attribute(gfx.AttributeName.ATTR_COLOR,gfx.Format.RGBA32F),new gfx.Attribute('a_match',gfx.Format.R32F)];
      // 标准36字节池已被静态地图/外围分散占用。独立40字节格式只供本对局通道使用，最大一个16位索引缓冲。
      const standard=batcher.switchBufferAccessor(),Accessor=standard.constructor,accessor=new Accessor(director.root!.device,format,65532,65532*4);
      if(batcher._bufferAccessors.has(40))throw Error('对局顶点格式与现有40字节通道冲突');batcher.registerBufferAccessor(40,accessor);assets.matchBuffers={format,accessor};
    }
    this.format=assets.matchBuffers.format;this.accessor=assets.matchBuffers.accessor;
    this.textTexture=new Texture2D();this.textTexture.reset({width:4096,height:256});
    this.textTexture.setFilters(Texture2D.Filter.NEAREST,Texture2D.Filter.NEAREST);this.textTexture.setMipFilter(Texture2D.Filter.NONE);
    this.textTexture.uploadData(new Uint8Array(4096*256*4));
    this.material=assets.matchMaterial||(assets.matchMaterial=this.makeMaterial());
    this.material.setProperty('matchTextTexture',this.textTexture);
    this.white=this.frame(0,0,1,1);
    for(const [name,rect] of Object.entries(MATCH_ATLAS.frames)){const [x,y,w,h]=rect,frame=this.frame(x,y,w,h),p={frame,w,h} as Picture;p.canvas=p;this.pictures[name]=p;}
    const node=new Node('TextRasterizer');node.layer=Layers.Enum.UI_2D;root.addChild(node);node.setPosition(-10000,-10000);
    this.baker=new DrawSurface(node,assets);this.baker.cull=false;
  }
  // 文字UV加2，额外材质采样器指向独立小纹理；主Sprite仍绑精灵图，交错遮挡不打断合批。
  // 复制当前引擎已导入的内置effect各平台源码，不修改引擎/全局材质，也不依赖运行时effect编译器。
  private makeMaterial():Material {
    const source=EffectAsset.get('for2d/builtin-sprite')!;if(!source)throw Error('缺少内置精灵材质');
    const effect=new EffectAsset();effect.name='shuaiguo-retained';effect.techniques=JSON.parse(JSON.stringify(source.techniques));effect.shaders=JSON.parse(JSON.stringify(source.shaders));
    const helper=`uniform sampler2D matchTextTexture;
    vec4 matchSample(sampler2D tex, vec2 uv) {
      if(uv.x>3.0){float d=uv.y;float aa=0.05;
#if __VERSION__ >= 300 || defined(GL_OES_standard_derivatives)
 aa=fwidth(d);
#endif
return vec4(1.0,1.0,1.0,1.0-smoothstep(-aa,0.0,abs(d)-1.0));}
      if(uv.x<1.0)return CCSampleWithAlphaSeparated(tex,(floor(uv*4096.0)+0.5)/vec2(${this.texture.width}.0,${this.texture.height}.0));
      vec2 p=(uv-vec2(2.0,0.0))*4096.0-0.5;
      vec2 f=fract(p),b=(floor(p)-vec2(0.0,2421.0)+0.5)/vec2(4096.0,256.0),d=vec2(1.0/4096.0,1.0/256.0);
      return mix(mix(CCSampleWithAlphaSeparated(matchTextTexture,b),CCSampleWithAlphaSeparated(matchTextTexture,b+vec2(d.x,0.0)),f.x),mix(CCSampleWithAlphaSeparated(matchTextTexture,b+vec2(0.0,d.y)),CCSampleWithAlphaSeparated(matchTextTexture,b+d),f.x),f.y);
    }
`;
    const names=new Map<string,string>();
    for(const shader of effect.shaders as any[]){
      const sampler={name:'matchTextTexture',type:gfx.Type.SAMPLER2D,count:1,defines:[],stageFlags:gfx.ShaderStageFlagBit.FRAGMENT,binding:1};
      shader.samplerTextures.push(sampler);
      shader.descriptors.find((d:any)=>d.rate===1).samplerTextures.push({...sampler});
      const old=shader.name;shader.name='shuaiguo-retained|'+old;names.set(old,shader.name);shader.hash=(shader.hash+17694)>>>0;
      for(const version of ['glsl1','glsl3','glsl4'])if(shader[version]?.frag){const code=shader[version].frag;if(!code.includes('CCSampleWithAlphaSeparated(cc_spriteTexture, uv0)'))throw Error('3.8.8精灵采样契约已变化');shader[version].frag=(version==='glsl1'?'#extension GL_OES_standard_derivatives : enable\n':'')+code.replace('vec4 frag () {',(version==='glsl4'?helper.replace('uniform sampler2D matchTextTexture;','layout(set = 1, binding = 1) uniform sampler2D matchTextTexture;'):helper)+'vec4 frag () {').replace('CCSampleWithAlphaSeparated(cc_spriteTexture, uv0)','matchSample(cc_spriteTexture, uv0)');}
    }
    for(const technique of effect.techniques)for(const pass of technique.passes)pass.program=names.get(pass.program)!;
    effect.onLoaded();this.assets.matchEffect=effect;const material=new Material();material.initialize({effectAsset:effect,defines:{USE_TEXTURE:true}});return material;
  }
  // 位置、字号、描边完全交给现有DrawSurface/原生TTF；只在内容或样式变化时烘一次。
  text(s:string,font:string,fill:string,stroke?:string,width=0):TextTile|undefined {
    const key=JSON.stringify([s,font,fill,stroke,width]);let tile=this.texts.get(key);if(tile)return tile;
    const c=this.baker;c.root.active=true;c.begin();c.font=font;c.fillStyle=fill;if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.strokeText(s,0,0);}c.fillText(s,0,0);c.end();
    const label=c.root.getComponentsInChildren(Label)[0];label.updateRenderData(true);
    const canvas=label.assemblerData!.canvas,w=canvas.width,h=canvas.height,size=label.node.getComponent(UITransform)!.contentSize;
    if(this.x+w+2>this.textTexture.width){this.x=2;this.y+=this.row+2;this.row=0;}
    // 满了不扩容、不清空/覆盖旧字。该节点使用原生Label，数量受可见节点数限制。
    if(w+4>this.textTexture.width||this.y-2421+h+2>this.textTexture.height){c.root.active=false;return undefined;}
    const region=new gfx.BufferTextureCopy();region.texOffset.x=this.x;region.texOffset.y=this.y-2421;region.texExtent.width=w;region.texExtent.height=h;
    director.root!.device.copyTexImagesToTexture([canvas as HTMLCanvasElement],this.textTexture.getGFXTexture()!,[region]);
    tile={frame:this.white,uv:[this.x/4096,(this.y+h)/4096,(this.x+w)/4096,(this.y+h)/4096,this.x/4096,this.y/4096,(this.x+w)/4096,this.y/4096],w:size.width,h:size.height};this.texts.set(key,tile);this.x+=w+2;this.row=Math.max(this.row,h);c.root.active=false;return tile;
  }
  // 所有动态帧都明确禁止二次动态图集搬移；像素图仍为最近邻。
  private frame(x:number,y:number,w:number,h:number):SpriteFrame {const f=new SpriteFrame();f.texture=this.texture;f.rect=new Rect(x,y,w,h);f.originalSize=new Size(w,h);f.packable=false;[x/4096,(y+h)/4096,(x+w)/4096,(y+h)/4096,x/4096,y/4096,(x+w)/4096,y/4096].forEach((v,i)=>f.uv[i]=v);this.frames.push(f);return f;}
  destroy():void {this.baker.root.destroy();this.textTexture.destroy();for(const f of this.frames)f.destroy();this.frames=[];this.texts.clear();this.curves.clear();}
}
// 常驻部件以语义名称索引；没有按每帧调用序号改身份、begin/end或隐藏“多余池槽”。
export class MatchNode {
  readonly node:Node;readonly children=new Map<string,MatchNode>();private sprite?:Sprite;private nativeLabel?:Label;private tr?:UITransform;private overflow?:DrawSurface;private textKey='';private imageKey='';private colorKey='';private lastInk='#FFFFFF';private lastAlpha=1;private meshCapacity={vertices:0,indices:0};private geometryKey='';
  constructor(parent:Node,name:string,readonly atlas:MatchAtlas){this.node=new Node(name);this.node.layer=Layers.Enum.UI_2D;parent.addChild(this.node);}
  // 每个部件创建一次，分支显隐由调用者明确设置。
  child(name:string):MatchNode {let n=this.children.get(name);if(!n){n=new MatchNode(this.node,name,this.atlas);this.children.set(name,n);}return n;}
  show(on:boolean):this {if(this.node.active!==on)this.node.active=on;return this;}
  at(x:number,y:number,angle=0,sx=1,sy=sx):this {const n=this.node;if(n.position.x!==x||n.position.y!==-y)n.setPosition(x,-y);const degrees=-angle*180/Math.PI;if(n.angle!==degrees)n.angle=degrees;if(n.scale.x!==sx||n.scale.y!==sy)n.setScale(sx,sy,1);return this;}
  // 仅Y次序发生变化时调人物容器；人物内部部件顺序保持原型。
  order(i:number):void {if(this.node.getSiblingIndex()!==i)this.node.setSiblingIndex(i);}
  private renderer():Sprite {if(!this.sprite){this.tr=this.node.addComponent(UITransform);this.sprite=this.node.addComponent(Sprite);this.sprite.sizeMode=Sprite.SizeMode.CUSTOM;this.sprite.trim=false;this.sprite.customMaterial=this.atlas.material;}return this.sprite;}
  tint(ink:string,alpha=1):this {const key=ink+':'+alpha;if(this.colorKey===key)return this;this.colorKey=key;this.lastInk=ink;this.lastAlpha=alpha;const c=parseInk(ink);this.renderer().color=new Color(c.r,c.g,c.b,Math.round(c.a*alpha));return this;}
  image(name:string,x:number,y:number,w:number,options:{h?:number;angle?:number;flip?:boolean;alpha?:number}={}):this {
    const p=this.atlas.pictures[name]||this.atlas.assets.spr[name];if(!p){this.show(false);return this;}return this.picture(p.frame,x,y,w,options.h??w*p.h/p.w,options.angle||0,options.flip?-1:1,options.alpha??1);
  }
  picture(frame:SpriteFrame,x:number,y:number,w:number,h:number,angle=0,flip=1,alpha=1):this {this.show(true);const s=this.renderer() as any;this.at(x,y,angle,flip,1);
    const key=frame.uuid+':'+frame.rect.x+':'+frame.rect.y+':'+frame.rect.width+':'+frame.rect.height+':'+w+':'+h;
    if(s.spriteFrame!==frame||this.imageKey!==key||s._assembler!==meshAssembler){const uv=Array.from(frame.uv);this.mesh({xy:[-w/2,h/2,w/2,h/2,-w/2,-h/2,w/2,-h/2],uv,indices:[0,1,2,1,3,2]},'#FFFFFF',alpha,frame);this.imageKey=key;}else this.tint('#FFFFFF',alpha);return this;}
  text(s:string,x:number,y:number,size:number,fill='#1F2A44',stroke:string|undefined='#FFFDF5',font='title',alpha=1,width=Math.max(3,size/5)):this {
    if(!s){this.show(false);return this;}const key=JSON.stringify([s,size,fill,stroke,font,width]);if(key!==this.textKey||this.overflow?.root.active){const tile=this.atlas.text(s,`${size}px ${font}`,fill,stroke,width);
      if(!tile){this.at(x,y);if(this.sprite)this.sprite.enabled=false;
        if(!this.overflow){const node=new Node('NativeTextOverflow');node.layer=Layers.Enum.UI_2D;this.node.addChild(node);this.overflow=new DrawSurface(node,this.atlas.assets);this.overflow.cull=false;}
        const c=this.overflow;c.root.active=true;c.begin();c.font=`${size}px ${font}`;c.globalAlpha=alpha;c.fillStyle=fill;if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.strokeText(s,0,0);}c.fillText(s,0,0);c.end();return this.show(true);
      }
      if(this.sprite)this.sprite.enabled=true;if(this.overflow)this.overflow.root.active=false;
      const uv=tile.uv||tile.frame.uv,u=[uv[0]+2,uv[1],uv[2]+2,uv[3],uv[4]+2,uv[5],uv[6]+2,uv[7]];this.at(x,y);this.mesh({xy:[-tile.w/2,tile.h/2,tile.w/2,tile.h/2,-tile.w/2,-tile.h/2,tile.w/2,-tile.h/2],uv:u,indices:[0,1,2,1,3,2]},'#FFFFFF',alpha,this.atlas.white);this.textKey=key;}else {this.show(true);this.at(x,y);const sprite=this.renderer() as any;if(sprite.__matchMesh&&sprite._assembler!==meshAssembler)this.mesh(sprite.__matchMesh,'#FFFFFF',alpha,sprite.spriteFrame);this.tint('#FFFFFF',alpha);}return this;
  }
  // 原画笔把飘字alpha同时乘到描边栅格和整段顶点，直接烘整段会改变淡出中的白边。
  // 这几个短命Label常驻到各自生命周期结束，内容不变不改字；保留原TTF双重透明度直到有等价合批方案。
  nativeText(s:string,x:number,y:number,size:number,fill:string,alpha:number):void {
    this.show(true);this.at(x,y);let l=this.nativeLabel;if(!l){this.node.addComponent(UITransform);l=this.nativeLabel=this.node.addComponent(Label);l.font=this.atlas.assets.title;l.useSystemFont=false;l.overflow=Label.Overflow.NONE;l.enableWrapText=false;l.horizontalAlign=Label.HorizontalAlign.CENTER;l.verticalAlign=Label.VerticalAlign.CENTER;l.fontSize=size;l.lineHeight=size*1.2;l.enableOutline=true;l.outlineWidth=Math.max(3,size/5)/2;}
    s=displayText(s);if(l.string!==s){const fallback=Array.from(s).some(ch=>!UI_METRICS.title[ch]&&ch!=='\n');l.font=fallback?null:this.atlas.assets.title;l.useSystemFont=fallback;if(fallback)l.fontFamily='sans-serif';l.string=s;}const c=parseInk(fill),color=new Color(c.r,c.g,c.b,Math.round(c.a*alpha));if(!l.color.equals(color))l.color=color;const outline=new Color(255,253,245,Math.round(255*alpha));if(!l.outlineColor.equals(outline))l.outlineColor=outline;
  }
  // 三角形/矩形/圆弧共用精灵白像素，进入同一合批通道；不经过Graphics的独立材质与缓冲。
  mesh(mesh:Mesh,ink:string,alpha=1,frame=this.atlas.white):this {
    this.show(true);const s=this.renderer() as any;
    if(s._assembler!==meshAssembler){s.destroyRenderData();s._assembler=meshAssembler;s.__matchMesh=mesh;const data=RenderData.add(this.atlas.format,this.atlas.accessor);data.initRenderDrawInfo(s);s._renderData=data;}
    const rd=s.renderData,count=mesh.xy.length/2;
    if(count>this.meshCapacity.vertices||mesh.indices.length>this.meshCapacity.indices||!rd.vertexCount){const vertices=Math.max(this.meshCapacity.vertices,2**Math.ceil(Math.log2(Math.max(4,count)))),indices=Math.max(this.meshCapacity.indices,2**Math.ceil(Math.log2(Math.max(6,mesh.indices.length))));rd.dataLength=vertices;rd.resize(vertices,indices);this.meshCapacity={vertices,indices};}
    s.__matchMesh=mesh;s.customMaterial=frame.texture===this.atlas.texture?this.atlas.material:null;s.spriteFrame=frame;rd.vertDirty=true;s.markForUpdateRenderData();this.tint(ink,alpha);this.show(true);return this;
  }
  rect(x:number,y:number,w:number,h:number,ink:string,alpha=1):this {if(w<=0||h<=0)return this.show(false);this.at(x,y);if(this.sameGeometry('rect:'+w+':'+h,ink,alpha))return this;return this.mesh({xy:[0,0,w,0,0,h,w,h],indices:[0,1,2,1,3,2]},ink,alpha);}
  // 与旧DrawSurface相同的4px曲线离散；填充按凸扇三角化，平移留给节点。
  ellipse(x:number,y:number,rx:number,ry:number,ink:string,alpha=1,start=0,end=Math.PI*2,stroke=0,dash:number[]=[]):this {
    this.at(x,y);const shapeKey=['ellipse',rx,ry,start,end,stroke,...dash].join(':');if(this.sameGeometry(shapeKey,ink,alpha))return this;const n=Math.max(8,Math.ceil(Math.abs(end-start)*Math.max(rx,ry)/4)),key=[n,start,end].join(':'),full=Math.abs(end-start)>=Math.PI*2;let curve=full?this.atlas.curves.get(key):undefined;
    if(!curve){const points:number[]=[],indices:number[]=[];if(!full)points.push(0,0);for(let i=0;i<=n;i++){const a=start+(end-start)*i/n;points.push(Math.cos(a),Math.sin(a));}for(let i=1;i<points.length/2-1;i++)indices.push(0,i,i+1);curve={points,indices};if(full)this.atlas.curves.set(key,curve);}
    const xy=curve.points.map((v,i)=>v*(i%2?ry:rx));
    if(stroke){this.path(!full?xy.slice(2):xy,ink,stroke,alpha,full,dash);this.geometryKey=shapeKey;return this;}
    return this.mesh({xy,indices:curve.indices},ink,alpha);
  }
  // 调用者的几何参数未变时沿用网格；原生重新激活可能换回默认assembler，需恢复本通道。
  retainMesh():boolean {this.show(true);const s=this.sprite as any;if(!s?.__matchMesh)return false;if(s._assembler!==meshAssembler)this.mesh(s.__matchMesh,this.lastInk,this.lastAlpha,s.spriteFrame);return true;}
  // 固定形状只移动节点/改颜色；只有呼吸半径、扇形角度等真实变化才改常驻顶点。
  private sameGeometry(key:string,ink:string,alpha:number):boolean {this.show(true);const same=this.geometryKey===key&&(this.sprite as any)?._assembler===meshAssembler;this.geometryKey=key;if(same){this.show(true);this.tint(ink,alpha);}return same;}
  // 固定线段或折线的连续网格；虚线距离不在每段重启，和旧画笔一致。
  path(points:number[],ink:string,width:number,alpha=1,closed=false,dash:number[]=[],round=false):this {
    if(this.sameGeometry(['path',width,closed,round,...dash,'points',...points].join(':'),ink,alpha))return this;
    const xy:number[]=[],indices:number[]=[],uv:number[]=[],segments:number[][]=[];
    if(closed&&Math.hypot(points[0]-points.at(-2)!,points[1]-points.at(-1)!)<1e-8)points=points.slice(0,-2);const length=points.length/2;
    if(!dash.length&&length>1){const normals:number[][]=[];for(let i=0;i<length-1+(closed?1:0);i++){const j=(i+1)%length,dx=points[j*2]-points[i*2],dy=points[j*2+1]-points[i*2+1],d=Math.hypot(dx,dy)||1;normals.push([dy/d,-dx/d]);}
      for(let i=0;i<length;i++){const prev=normals[(i-1+normals.length)%normals.length],next=normals[i%normals.length];let nx:number,ny:number;if(!closed&&i===0){[nx,ny]=normals[0];}else if(!closed&&i===length-1){[nx,ny]=normals.at(-1)!;}else{const k=1+prev[0]*next[0]+prev[1]*next[1];nx=(prev[0]+next[0])/Math.max(.01,k);ny=(prev[1]+next[1])/Math.max(.01,k);}const x=points[i*2],y=points[i*2+1];xy.push(x+nx*width/2,y+ny*width/2,x-nx*width/2,y-ny*width/2);uv.push(4,1,4,-1);}
      for(let i=0;i<length-1+(closed?1:0);i++){const a=i*2,b=(i+1)%length*2;indices.push(a,a+1,b,a+1,b+1,b);}if(!round)return this.mesh({xy,uv,indices},ink,alpha);
    }
    let dashAt=0,left=dash[0]||Infinity,draw=true;
    for(let i=1;i<length+(closed?1:0);i++){
      const j=i%length,k=(i-1)%length,ax=points[k*2],ay=points[k*2+1],bx=points[j*2],by=points[j*2+1],len=Math.hypot(bx-ax,by-ay);if(!len)continue;
      let at=0;while(at<len-1e-8){const step=Math.min(left,len-at);if(draw)segments.push([ax+(bx-ax)*at/len,ay+(by-ay)*at/len,ax+(bx-ax)*(at+step)/len,ay+(by-ay)*(at+step)/len]);at+=step;left-=step;if(left<1e-8){dashAt=(dashAt+1)%dash.length;left=dash[dashAt];draw=dashAt%2===0;}}
    }
    for(const [ax,ay,bx,by] of dash.length?segments:[]){const d=Math.hypot(bx-ax,by-ay),nx=(by-ay)/d*width/2,ny=-(bx-ax)/d*width/2,j=xy.length/2;xy.push(ax+nx,ay+ny,ax-nx,ay-ny,bx+nx,by+ny,bx-nx,by-ny);indices.push(j,j+1,j+2,j+1,j+3,j+2);uv.push(4,1,4,-1,4,1,4,-1);}
    // 圆端线仅用于甩出锅拖影，不改变折线虚线的端点。
    if(round)for(const at of [0,points.length-2]){const j=xy.length/2;xy.push(points[at],points[at+1]);uv.push(4,0);const direction=Math.atan2(points.at(-1)!-points[1],points.at(-2)!-points[0]);for(let i=0;i<=12;i++){const a=direction+(at===0?Math.PI/2:-Math.PI/2)+i*Math.PI/12;xy.push(points[at]+Math.cos(a)*width/2,points[at+1]+Math.sin(a)*width/2);uv.push(4,1);if(i)indices.push(j,j+i,j+i+1);}}
    return this.mesh({xy,uv,indices},ink,alpha);
  }
  destroy():void {this.node.destroy();}
}
// 同一有限实体集合只回收消失对象；无逐帧重置/遍历隐藏峰值池，持续长局内存不会随已消失锅累积。
export class MatchCollection<T extends object> {
  private live=new Map<T,MatchNode>();private spare:MatchNode[]=[];private serial=0;
  constructor(readonly parent:MatchNode,readonly name:string){}
  sync(values:readonly T[],draw:(node:MatchNode,value:T,index:number)=>void):void {
    const present=new Set(values);for(const [key,node] of this.live)if(!present.has(key)){node.show(false);this.spare.push(node);this.live.delete(key);}
    values.forEach((value,i)=>{let node=this.live.get(value);if(!node){node=this.spare.pop()||this.parent.child(this.name+'-'+this.serial++);this.live.set(value,node);}node.show(true);node.order(i);draw(node,value,i);});
  }
}
// CSS色只在颜色变化时设置渲染器；浮点alpha与旧Color.round口径一致。
function parseInk(value:string):Ink {const rgba=value.match(/^rgba?\(([^)]+)\)/);if(rgba){const n=rgba[1].split(',').map(Number);return {r:n[0],g:n[1],b:n[2],a:Math.round((n[3]??1)*255)};}const c=new Color(value);return {r:c.r,g:c.g,b:c.b,a:c.a};}
