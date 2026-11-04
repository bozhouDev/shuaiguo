// 常驻节点的身份/容量/回收/最终文字边界；像素与真实提交另由页面内3.8.8验证。
const {test}=require('node:test'),assert=require('node:assert/strict');
const {cc,load}=require('./wechat/view-harness.cjs');
let allocations=0;
class Color {constructor(r=0,g,b,a=255){if(typeof r==='string'){const v=parseInt(r.replace('#',''),16);this.r=v>>16;this.g=(v>>8)&255;this.b=v&255;}else {this.r=r;this.g=g??r;this.b=b??r;}this.a=a;}equals(c){return this.r===c.r&&this.g===c.g&&this.b===c.b&&this.a===c.a;}}
class Data {static add(){return new Data();}vertexCount=0;initRenderDrawInfo(){}resize(v,i){allocations++;this.vertexCount=v;this.chunk={vb:new Float32Array(v*10),bufferId:0,vertexOffset:0,meshBuffer:{iData:new Uint16Array(65535),indexOffset:0},setIndexBuffer(){}};}updateRenderData(){}destroy(){}}
class Sprite {static SizeMode={CUSTOM:0};_assembler={};_renderData=new Data();color=new Color(255,255,255);get renderData(){return this._renderData;}destroyRenderData(){this._renderData=null;}markForUpdateRenderData(){}}
cc.Label.prototype.color=new Color(255,255,255);cc.Label.prototype.outlineColor=new Color(255,255,255);
cc.Color=Color;cc.Sprite=Sprite;cc.RenderData=Data;
const OriginalNode=cc.Node;
class Node extends OriginalNode {scale={x:1,y:1,z:1};getSiblingIndex(){return this.parent?.children.indexOf(this)??0;}setSiblingIndex(index){if(!this.parent)return;const list=this.parent.children;list.splice(list.indexOf(this),1);list.splice(index,0,this);}setScale(x,y,z){this.scale={x,y,z};}addChild(n){if(n.parent){const at=n.parent.children.indexOf(n);if(at>=0)n.parent.children.splice(at,1);}super.addChild(n);}removeFromParent(){if(this.parent){this.parent.children.splice(this.parent.children.indexOf(this),1);this.parent=null;}}}
cc.Node=Node;cc.UITransform.prototype.contentSize={width:0,height:0};
const {MatchNode,MatchCollection}=load('cocos/assets/scripts/view/MatchNodes');
const frame={uuid:'white',rect:{x:0,y:0,width:1,height:1},uv:[0,1,1,1,0,0,1,0]},atlas={white:frame,material:{},assets:{title:{}},format:[],accessor:{},pictures:{},curves:new Map(),text(s){return {frame,w:s.length*12,h:17};}};
test('同一语义部件千帧移动保持身份，固定形状只建一次网格',()=>{
 const root=new MatchNode(new Node(),'root',atlas),n=root.child('shadow');allocations=0;
 for(let i=0;i<1000;i++){n.ellipse(i,20,24,8,'rgba(31,42,68,.22)');assert.equal(root.child('shadow'),n);}
 assert.equal(allocations,1);assert.equal(n.node.position.x,999);
 n.rect(0,0,20,10,'#FFD84D');const count=allocations;n.rect(20,40,20,10,'#FFD84D');assert.equal(allocations,count);
 n.show(false);n.show(true);assert.equal(root.child('shadow'),n);
});
test('半径持续变化只更新常驻容量，帧后移除对象有界回收且新对象不抢存活者',()=>{
 const root=new MatchNode(new Node(),'root',atlas),pool=new MatchCollection(root,'pot'),a={},b={};let aNode,bNode;
 pool.sync([a,b],(n,v)=>{if(v===a)aNode=n;else bNode=n;});pool.sync([b],n=>assert.equal(n,bNode));
 pool.sync([{},b],(n,v)=>{if(v===b)assert.equal(n,bNode);else assert.equal(n,aNode);});
 for(let i=0;i<1000;i++)pool.sync([{},b],()=>{});assert.equal(root.children.size,2);
 allocations=0;for(let i=0;i<1000;i++)root.child('halo').ellipse(0,0,20+Math.sin(i),20+Math.sin(i),'#E8504A');assert.ok(allocations<=2,allocations);
});
test('重新显示部件遇到引擎重置组装器时恢复本网格，buffer容量继续有效',()=>{
 const n=new MatchNode(new Node(),'shape',atlas);n.ellipse(0,0,20,20,'#FFD84D');const sprite=n.node.getComponent(Sprite),assembler=sprite._assembler;
 sprite._assembler={};sprite._renderData=new Data();n.show(false);n.ellipse(2,3,20,20,'#FFD84D');assert.equal(sprite._assembler,assembler);assert.ok(sprite.renderData.vertexCount>0);
});
test('飘字最终Label过滤用户称呼里的emoji，同时保留原描边二次透明度',()=>{
 const n=new MatchNode(new Node(),'float',atlas);n.nativeText('老板🧋：这个你来',1,2,17,'#E8504A',.5);
 const label=n.node.getComponent(cc.Label);assert.equal(label.string,'老板：这个你来');assert.equal(label.color.a,128);assert.equal(label.outlineColor.a,128);
});
test('本机3.8.8原生Sprite重新激活的UV回调契约通过，删除回调的内存变异会失败',()=>{
 const fs=require('node:fs'),ts=require('/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources/resources/3d/engine/node_modules/typescript');
 const source=fs.readFileSync('/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources/resources/3d/engine/cocos/2d/components/sprite.ts','utf8'),ast=ts.createSourceFile('sprite.ts',source,ts.ScriptTarget.Latest,true);
 const cls=ast.statements.find(s=>ts.isClassDeclaration(s)&&s.name?.text==='Sprite'),method=cls.members.find(m=>m.name?.getText(ast)==='_updateUVs');assert.ok(method,'必须调用当前引擎真实UV边界');
 const native={exports:{}};new Function('exports',ts.transpileModule('class NativeBoundary { _assembler:any; '+method.getText(ast)+' } exports.NativeBoundary=NativeBoundary;',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText)(native.exports);
 const n=new MatchNode(new Node(),'shape',atlas);n.ellipse(0,0,20,20,'#FFD84D');const assembler=n.node.getComponent(Sprite)._assembler,boundary=new native.exports.NativeBoundary();boundary._assembler=assembler;
 assert.doesNotThrow(()=>boundary._updateUVs());const original=assembler.updateUVs;try{delete assembler.updateUVs;assert.throws(()=>boundary._updateUVs(),/not a function/);}finally{assembler.updateUVs=original;}assert.doesNotThrow(()=>boundary._updateUVs());
});
test('同一飞锅节点从普通锅切到急件时重新显示急件锅身，切回时不残留光圈',()=>{
 const {RetainedWorld}=load('cocos/assets/scripts/view/RetainedWorld'),world=Object.create(RetainedWorld.prototype),hotAtlas={...atlas,pictures:{wok:{frame,w:143,h:150},wok_flying:{frame,w:150,h:132}}};world.atlas=hotAtlas;
 const n=new MatchNode(new Node(),'pot',hotAtlas);world.wok(n,0,0,'急件',42);assert.equal(n.child('hotPot').node.active,false);
 world.hot(n,0,0,1);assert.equal(n.child('hotPot').node.active,true,'复用节点里的急件锅身必须可见');assert.equal(n.child('image').node.active,false);
 world.wok(n,0,0,'改方案',42);assert.equal(n.child('hotPot').node.active,false);assert.equal(n.child('hotHalo').node.active,false);assert.equal(n.child('image').node.active,true);
});
test('稳定对局提示只在失效时重排，HUD每帧仍更新，教学和提示入场保持逐帧绘制',()=>{
 const {MatchUi}=load('cocos/assets/scripts/view/MatchUi');let begins=0,hudUpdates=0;
 const ui=Object.assign(Object.create(MatchUi.prototype),{surface:{width:375,height:812,begin(){begins++;},end(){},insertLayer(){}},hudNodes:{node:{}},hud:{bottom:30,pulseAt:-Infinity,draw(){hudUpdates++;}},match:{S:{tut:null}},avoidance:()=>({top:0}),messages:{hintOn:false,hintChange:-Infinity,msgOn:false,msgChange:-Infinity,toastAt:-Infinity,toastUntil:-Infinity,draw(){},drawToast(){}},closing:{notice:{hidden:true},draw(){}},tutorial:{draw(){}},p:{}});
 for(const time of [10,10.1,10.2])ui.draw(time,{x:307,y:650},false);assert.equal(begins,1,'稳定提示不应每帧重排');assert.equal(hudUpdates,3,'HUD数值和脉冲必须继续更新');
 ui.hud.bottom=60;ui.draw(10.3,{x:307,y:650},false);assert.equal(begins,2,'HUD换行改变消息起点时失效');
 ui.messages.msgChange=10.3;ui.messages.msgOn=true;ui.draw(10.35,{x:307,y:650},false);ui.draw(10.4,{x:307,y:650},false);assert.equal(begins,4,'提示入场逐帧继续');
 ui.match.S.tut={};ui.draw(11,{x:307,y:650},true);ui.draw(11.1,{x:307,y:650},true);assert.equal(begins,6,'教学目标即使减少动态也不能被缓存冻结');
});
// 小文字纹理满时保留已用栅格；新文字交回节点自己的原生Label，不覆盖在屏幕上的旧字。
test('独立文字缓存满时拒绝覆盖旧字，已有文字仍命中缓存',()=>{
 const {MatchAtlas}=load('cocos/assets/scripts/view/MatchNodes'),cache=Object.create(MatchAtlas.prototype),tile={frame,w:12,h:17};
 Object.assign(cache,{texts:new Map([['["旧","12px title","#fff",null,0]',tile]]),x:4090,y:2670,row:12,textTexture:{width:4096,height:256},baker:{root:{active:false,getComponentsInChildren:()=>[{updateRenderData(){},assemblerData:{canvas:{width:30,height:30}},node:{getComponent:()=>({contentSize:{width:30,height:30}})}}]},begin(){},end(){},fillText(){}}});
 assert.equal(cache.text('新','12px title','#fff'),undefined,'满缓存必须安全退回原生文字');
 assert.equal(cache.text('旧','12px title','#fff'),tile,'已显示文字不应失效');
 assert.equal(cache.baker.root.active,false,'临时栅格器须隐藏');
});
// 走真实资源加载入口验证复用，不能只匹配源码字符串推断旧图集已停用。
test('外围帧和对局共用同一纹理，完整覆盖的十二张旧图集不加载',async()=>{
 const requests=[],released=[],copies=[],uploads=[],blits=[];let textureCount=0,failNextResult=false;const scratch={gpuTexture:{glTexture:'scratch'},resize(){},destroy(){this.destroyed=true;}};
 class Texture {static Filter={NEAREST:0,NONE:0};static WrapMode={CLAMP_TO_EDGE:0};width=4081;height=2421;constructor(){textureCount++;}reset(size){Object.assign(this,size);}setFilters(){}setMipFilter(){}setWrapMode(){}getGFXTexture(){return {gpuTexture:{glTexture:'match'}};}uploadData(){}destroy(){this.destroyed=true;}}
 class Frame {uv=[];destroy(){}}
 cc.ImageAsset=class{};cc.assetManager.releaseAsset=image=>released.push(image);
 cc.gfx={...cc.gfx,TextureInfo:class{},TextureType:{TEX2D:0},TextureUsageBit:{SAMPLED:1,TRANSFER_SRC:2,TRANSFER_DST:4},Format:{RGBA8:0},BufferTextureCopy:class{texOffset={x:0,y:0};texExtent={width:0,height:0};}};
 const state={framebuffer:'previous-fbo',texture:'previous-texture'};const gl={FRAMEBUFFER:1,FRAMEBUFFER_BINDING:2,TEXTURE_BINDING_2D:3,TEXTURE_2D:4,COLOR_ATTACHMENT0:5,createFramebuffer:()=>({}),getParameter:key=>key===2?state.framebuffer:state.texture,bindFramebuffer:(_target,value)=>state.framebuffer=value,bindTexture:(_target,value)=>state.texture=value,framebufferTexture2D(){},copyTexSubImage2D(...args){blits.push(args);},deleteFramebuffer(){}};
 cc.director.root={device:{gl,createTexture(){return scratch;},copyTextureToBuffers(){},copyBuffersToTexture(images,texture,regions){copies.push({images,texture,regions});},copyTexImagesToTexture(images,texture,regions){uploads.push({images,texture,regions});}}};

 cc.Texture2D=Texture;cc.SpriteFrame=Frame;cc.Rect=class{constructor(x,y,width,height){Object.assign(this,{x,y,width,height});}};cc.Size=class{constructor(width,height){Object.assign(this,{width,height});}};cc.TTFFont=class{};
 cc.resources={load(name,Type,done){requests.push(name);if(failNextResult&&name.startsWith('result/')){failNextResult=false;return done(Error('临时资源失败'));}const asset=new Type();asset.data={};asset.width=2;asset.height=2;done(null,asset);}};
 const {WorldAssets}=load('cocos/assets/scripts/view/WorldAssets'),assets=new WorldAssets();await assets.load(undefined,true);
 const forbidden=['boss','cashier','designer','director','intern','misc','nephew','player','pm','tester','veteran','wife'];
 for(const name of forbidden){assert.ok(!requests.includes('atlas/'+name+'/texture'),name+'仍在重复加载');assert.ok(requests.includes('atlas/'+name),name+'未作为ImageAsset加载');}
 assert.ok(!requests.some(name=>name.startsWith('atlas/match')),'仍在下载match.png');
 assert.equal(released.length,12,'来源图未逐张释放');assert.equal(uploads.length,12);assert.ok(uploads.every(v=>v.texture===scratch),'所有来源必须共用搬运区');assert.ok(scratch.destroyed,'启动后不能驻留搬运区');assert.equal(copies.length,1,'只允许白像素走CPU上传');assert.equal(blits.length,211,'211帧必须GPU直接复制');assert.deepEqual(state,{framebuffer:'previous-fbo',texture:'previous-texture'},'必须恢复引擎GL绑定');
 assert.equal(textureCount,25,'只能新建一张对局纹理，其余24张为底板/结算/特效');
 for(const name of ['lobby','intro','props'])assert.ok(requests.includes('atlas/'+name+'/texture'),name+'必需底图不应丢失');
 for(const name of ['player_normal','boss_idle','ui_star','wok'])assert.equal(assets.spr[name].frame.texture,assets.matchTexture,name+'没有复用对局纹理');
 // 微信会在资源失败后对同一WorldAssets重试；已完成拼装的GPU纹理必须复用。
 const completed=assets.matchTexture;failNextResult=true;await assert.rejects(assets.load(undefined,true),/临时资源失败/);await assets.load(undefined,true);
 assert.equal(assets.matchTexture,completed,'重试不得另建一张39MB纹理');assert.equal(released.length,12,'重试不得再次解码十二张来源');
 const cropped=assets.crop(assets.spr.player_normal,1,2,3,4);assert.equal(cropped.frame.texture,assets.matchTexture);assert.equal(cropped.w,3);assert.equal(cropped.h,4);assets.destroy();assert.ok(assets.matchTexture.destroyed);
});
