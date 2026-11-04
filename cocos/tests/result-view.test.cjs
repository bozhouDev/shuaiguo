// 结算显示契约：真实core与文字排版，只替换Cocos绘图设备，不当作截图验收。
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const ts=require('/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources/resources/3d/engine/node_modules/typescript');
const cache=new Map();
// 内存转译不写编辑器缓存，运行真实页面入口。
function load(file){file=path.resolve(file);if(!file.endsWith('.ts'))file+='.ts';if(cache.has(file))return cache.get(file).exports;const mod={exports:{}};cache.set(file,mod);new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(s=>load(path.resolve(path.dirname(file),s)),mod,mod.exports);return mod.exports;}
const {Match}=load('cocos/assets/scripts/core/match'),{ResultView}=load('cocos/assets/scripts/view/ResultView'),{ScreenPaint}=load('cocos/assets/scripts/view/ScreenPaint'),{ATLAS}=load('cocos/assets/scripts/view/atlas-data');
const {prepareTourResult}=load('cocos/assets/scripts/view/Tour');
// 记录最终绘制内容与点击矩形，含真实字宽、PNG尺寸和九宫格切片。
function render(m,reason='time',width=340,top=0){
 const images=[],texts=[],spr={};
 for(const sheet of ATLAS.sheets)for(const [name,rect]of Object.entries(sheet.frames))spr[name]={name,w:rect[2],h:rect[3]};
 for(const file of fs.readdirSync('cocos/assets/resources/result').filter(n=>n.endsWith('.png'))){const buf=fs.readFileSync('cocos/assets/resources/result/'+file),name=file.slice(0,-4);spr[name]={name,w:buf.readUInt32BE(16),h:buf.readUInt32BE(20)};}
 const surface=new Proxy({assets:{spr},drawImage(pic,...args){images.push({name:pic.name,args});},fillText(text,x,y){texts.push({text,x,y,size:Number(this.font.match(/[\d.]+/)[0]),font:this.font.includes('900')?'body-900':this.font.includes('700')?'body-700':'body-400'});}},{get:(o,k)=>k in o?o[k]:()=>{}});
 const p=new ScreenPaint(surface),r=m.calculateResult(reason),height=new ResultView(p).draw(m,r,{x:0,y:top,w:width,h:700});
 return {p,r,height,images,texts,actions:p.actions};
}
test('三星/二星/一星沿用真实名次，天空奖杯金带、表格金框、飞机和花草接入',()=>{
 for(const [kind,stars]of [['three',3],['two',2],['one',1]]){
  const m=new Match({seed:1001,auto:true});prepareTourResult(m,kind);const out=render(m),names=out.images.map(i=>i.name);
  assert.equal(out.r.stars,stars);for(const n of ['sky_clear','trophy','ribbon','rays_left','rays_right','frame_gold','frame_table','plane','grass_left','grass_right','button_blue','button_gold'])assert.ok(names.includes('ui_result_'+n),n);
  assert.ok(!names.includes('ui_result_ribbon_red'));assert.deepEqual(out.actions.map(a=>a.action),['share','next','retry','menu']);
  assert.equal(out.texts.filter(t=>t.text==='新纪录').length,1);
 }
});
test('失败/压垮用各自天空和徽章、暗红带；广告资格来自core且不冒出奖杯',()=>{
 for(const kind of ['fail','crush']){const m=new Match({level:1,seed:1001,auto:true});prepareTourResult(m,kind);const out=render(m,kind==='crush'?'crushed':'time'),names=out.images.map(i=>i.name);
  for(const n of [kind==='crush'?'sky_storm':'sky_overcast',kind==='crush'?'crushed':'overtime','ribbon_red'])assert.ok(names.includes('ui_result_'+n),n);
  assert.ok(!names.includes('ui_result_trophy'));assert.ok(!names.includes('ui_result_rays_left'));
  assert.deepEqual(out.actions.map(a=>a.action),['share-blame',kind==='crush'?'revive':'rescue','buff','retry','menu']);
  assert.ok(out.texts.some(t=>t.text==='广告 · '));
 }
});
test('所有按钮和文字在窄屏边界内，滚动到底能点重来和首页；绘制不改玩法与存档',()=>{
 for(const width of [288,328,340])for(const kind of ['three','one','fail','crush']){
  const m=new Match({level:kind==='three'?4:1,seed:1001,auto:true});prepareTourResult(m,kind);const reason=kind==='crush'?'crushed':'time',before=JSON.stringify(m.S),out=render(m,reason,width);
  assert.equal(JSON.stringify(m.S),before);assert.ok(Number.isFinite(out.height));
  for(const a of out.actions){assert.ok(a.x>=0&&a.x+a.w<=width);assert.ok(a.y>=0&&a.y+a.h<out.height);}
  for(const t of out.texts){const w=out.p.width(t.text,t.size,t.font);assert.ok(t.x-w/2>=-1&&t.x+w/2<=width+1,JSON.stringify(t));}
  const viewport=(667-32)*.92,scroll=Math.max(0,out.height-viewport),bottom=render(m,reason,width,-scroll);
  for(const name of ['retry','menu']){const a=bottom.actions.find(a=>a.action===name);assert.ok(a.y>=0&&a.y+a.h<=viewport,`${name}不可滚动触达`);}
 }
});
test('周五证书、复活/顶包后、教学与四种广告增益保留入口和附加结算',()=>{
 for(const help of ['none','revived','rescued']){const m=new Match({level:4,seed:1001,auto:true});prepareTourResult(m,'three');if(help!=='none')m.S[help]=true;const out=render(m);assert.equal(out.r.shareInfo.kind,'cert');assert.ok(out.actions.some(a=>a.label==='领证书，发朋友圈'));assert.ok(!out.actions.some(a=>a.action==='next'));assert.ok(out.texts.some(t=>t.text.includes('下班证书')));}
 const revived=new Match({level:1,seed:1001,auto:true});prepareTourResult(revived,'crush');revived.revive();assert.ok(!render(revived,'crushed').actions.some(a=>a.action==='revive'));
 const rescued=new Match({level:1,seed:1001,auto:true});prepareTourResult(rescued,'fail');rescued.rescue();assert.ok(!render(rescued).actions.some(a=>a.action==='rescue'));
 for(const buff of ['trip','gold','news','legs']){const m=new Match({level:1,seed:1001,buff,auto:true});prepareTourResult(m,'fail');const out=render(m);assert.ok(out.actions.some(a=>a.action==='buff'));assert.ok(out.texts.some(t=>t.text.includes('推荐：')));}
 const tut=new Match({seed:1001,tutorial:true});prepareTourResult(tut,'three');assert.ok(render(tut).actions.some(a=>a.action==='retry'));
});
test('结算所有固定文字在现有字体子集内，长称呼行不侵入锅与总账列',()=>{
 const {UI_METRICS}=load('cocos/assets/scripts/view/ui-metrics');
 for(const type of ['three','two','one','fail','crush','revived','rescued'])for(const level of [0,1,4]){
  const m=new Match({level,seed:1001,auto:true});prepareTourResult(m,type);const out=render(m,type==='crush'?'crushed':'time');
  for(const t of out.texts)for(const ch of t.text)assert.ok(UI_METRICS[t.font][ch],`缺字 ${ch}`);
 }
 const name='一二三四五六',m=new Match({level:4,seed:1001,progress:{unlocked:5,best:{},bossName:name}});prepareTourResult(m,'three');const out=render(m);
 const t=out.texts.find(t=>t.text===name+'小舅子');assert.ok(t);assert.ok(t.x+out.p.width(t.text,t.size,t.font)/2<=224,'长称呼压到锅图标');
});
test('WorldAssets加载全部结算PNG并设置最近邻，九宫格裁片缓存且销毁派生帧',async()=>{
 const {load:loadView,cc}=require('./wechat/view-harness.cjs');
 const frames=[];class Texture {static Filter={NEAREST:0,NONE:1};static WrapMode={CLAMP_TO_EDGE:0};reset(size){Object.assign(this,size);}setWrapMode(){}getGFXTexture(){return {gpuTexture:{glTexture:{}}};}destroy(){}setFilters(...args){this.filters=args;}setMipFilter(v){this.mip=v;}}
 // 只替换新增GPU设备边界；结算PNG加载、帧尺寸、最近邻和裁片仍走真实WorldAssets。
 cc.ImageAsset=class{};cc.assetManager.releaseAsset=()=>{};
 cc.gfx={...cc.gfx,TextureInfo:class{},TextureType:{TEX2D:0},TextureUsageBit:{SAMPLED:1,TRANSFER_SRC:2,TRANSFER_DST:4},Format:{RGBA8:0},BufferTextureCopy:class{texOffset={x:0,y:0};texExtent={width:0,height:0};}};
 cc.director.root={device:{gl:{createFramebuffer(){},getParameter(){},bindFramebuffer(){},framebufferTexture2D(){},bindTexture(){},copyTexSubImage2D(){},deleteFramebuffer(){}},createTexture:()=>({gpuTexture:{glTexture:{}},resize(){},destroy(){}}),copyTexImagesToTexture(){},copyBuffersToTexture(){}}};
 cc.Texture2D=Texture;cc.TTFFont=class{};cc.Rect=class{constructor(x,y,width,height){Object.assign(this,{x,y,width,height});}};cc.Size=class{};
 cc.SpriteFrame=class{constructor(){frames.push(this);}destroy(){this.destroyed=true;}};
 const paths=[];cc.resources={load(file,Type,done){paths.push(file);if(Type===Texture){const png=fs.readFileSync('cocos/assets/resources/'+file.replace(/\/texture$/,'.png')),texture=new Texture();texture.width=png.readUInt32BE(16);texture.height=png.readUInt32BE(20);done(null,texture);}else if(Type===cc.ImageAsset){const png=fs.readFileSync('cocos/assets/resources/'+file+'.png');done(null,{width:png.readUInt32BE(16),height:png.readUInt32BE(20),data:{}});}else done(null,{});}};
 const {WorldAssets}=loadView('cocos/assets/scripts/view/WorldAssets'),assets=new WorldAssets();await assets.load(undefined,true);
 const expected=fs.readdirSync('cocos/assets/resources/result').filter(n=>n.endsWith('.png')&&!/ribbon_\d/.test(n)).map(n=>n.slice(0,-4));
 assert.equal(expected.length,17);for(const name of expected){const pic=assets.spr[name];assert.ok(pic);assert.ok(paths.includes(`result/${name}/texture`));assert.deepEqual(pic.frame.texture.filters,[0,0]);assert.equal(pic.frame.texture.mip,1);}
 const pic=assets.spr.ui_result_frame_gold,a=assets.crop(pic,0,0,16,16);assert.equal(assets.crop(pic,0,0,16,16),a);
 assets.destroy();assert.ok(frames.every(f=>f.destroyed));
});
test('真实App结算Mask在375×667固定，滚到底的重来/首页矩形仍可命中',()=>{
 const {load:loadView,cc}=require('./wechat/view-harness.cjs'),{AppView}=loadView('cocos/assets/scripts/view/AppView');
 for(const kind of ['three','fail','crush']){
  const m=new Match({level:kind==='three'?4:1,seed:1001,auto:true});prepareTourResult(m,kind);const reason=kind==='crush'?'crushed':'time',out=render(m,reason),mask=new cc.Node(),root=new cc.Node();mask.addComponent(cc.UITransform);
  const surface=new Proxy({width:375,height:667},{get:(o,k)=>k in o?o[k]:()=>{}}),viewport=(667-32)*.92;
  const host={panes:[{surface:out.p.c,p:out.p,mask,root}],surface,paint:{box(){}},heights:{result:out.height},scroll:out.height-viewport,actions:[],real:1,world:{match:m},result:out.r,reduced:()=>true,panel:'result'};
  AppView.prototype.modal.call(host,'result');assert.equal(mask.getComponent(cc.UITransform).contentSize.height,viewport);assert.equal(host.maxScroll,out.height-viewport);
  const top=mask.position.y*-1;for(const name of ['retry','menu']){const a=host.actions.find(a=>a.action===name);assert.ok(a);assert.ok(a.y>=top&&a.y+a.h<=top+viewport);}
 }
});
