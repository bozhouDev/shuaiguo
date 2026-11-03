// Node内存转译：只替换Cocos设备边界，真实App/绘图/音频/存档逻辑继续执行。
const fs=require('node:fs'),path=require('node:path'),{EventEmitter}=require('node:events');
const ts=require('/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources/resources/3d/engine/node_modules/typescript');
class Node extends EventEmitter {
 children=[];components=[];position={x:0,y:0,z:0};active=true;
 constructor(name=''){super();this.name=name;}
 get scene(){return this.parent?this.parent.scene:this;}
 addChild(n){n.parent=this;this.children.push(n);}
 addComponent(Type){let c=this.getComponent(Type);if(c)return c;c=new Type();c.node=this;this.components.push(c);return c;}
 getComponent(Type){return this.components.find(c=>c instanceof Type);}
 getComponentsInChildren(Type){return [...this.components.filter(c=>c instanceof Type),...this.children.flatMap(n=>n.getComponentsInChildren(Type))];}
 setPosition(x,y,z=0){this.position={x,y,z};}setScale(){}setSiblingIndex(){}
 destroy(){this.destroyed=true;for(const child of this.children)child.destroy();}
}
class UITransform {contentSize={width:0,height:0};setContentSize(width,height){this.contentSize={width,height};}setAnchorPoint(){}}
class Label {static HorizontalAlign={CENTER:0,LEFT:1};static VerticalAlign={CENTER:0};static Overflow={NONE:0};get string(){return this.text||'';}set string(s){this.text=s;}}
class Graphics {static LineCap={BUTT:0,ROUND:1,SQUARE:2};static LineJoin={MITER:0,ROUND:1,BEVEL:2};constructor(){return new Proxy(this,{get:(o,k)=>k in o?o[k]:()=>{}});}}
class Sprite {static SizeMode={CUSTOM:0};}
class Color {constructor(){this.a=255;}}
const textures=[];class RenderTexture {constructor(){textures.push(this);}reset({width,height}){this.width=width;this.height=height;}readPixels(){return new Uint8Array(this.width*this.height*4).fill(255);}destroy(){this.destroyed=true;}}
class Camera {static ProjectionType={ORTHO:1};}
const director=new EventEmitter();
const cc={Node,UITransform,Label,Color,Graphics,Sprite,RenderTexture,Camera,RenderRoot2D:class{},Director:{EVENT_AFTER_DRAW:'draw'},director,
 Layers:{Enum:{UI_2D:1}},KeyCode:{},Game:{EVENT_HIDE:'hide',EVENT_SHOW:'show'},game:new EventEmitter(),Input:{EventType:{}},input:new EventEmitter(),view:Object.assign(new EventEmitter(),{getVisibleSize:()=>({width:375,height:812})}),sys:{platform:'wechat',Platform:{WECHAT_GAME:'wechat'}},Mask:class{static Type={GRAPHICS_RECT:0};},AudioClip:class{},assetManager:{}};
const cache=new Map();
function load(file){file=path.resolve(__dirname,'../../..',file);if(!file.endsWith('.ts'))file+='.ts';if(cache.has(file))return cache.get(file).exports;const mod={exports:{}};cache.set(file,mod);const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','module','exports',js)(s=>s==='cc'?cc:s==='cc/env'?{PREVIEW:false}:load(path.resolve(path.dirname(file),s)),mod,mod.exports);return mod.exports;}
module.exports={load,cc,textures};
