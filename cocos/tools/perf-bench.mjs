// 已有7456或明确标注的独立源码页；默认DPR1/CPU×6，finally关闭浏览器，不启动/构建Creator。
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const arg=(key,fallback)=>process.argv.find(s=>s.startsWith(`--${key}=`))?.slice(key.length+3)??fallback;
const phase=arg('phase','before'),seconds=Number(arg('seconds','10')),mode=arg('mode','bench'),variant=arg('variant','native');
const out=path.resolve(root,arg('out',`port/tmp/p7-3/${phase}`));await fs.mkdir(out,{recursive:true});
const base=arg('url','http://localhost:7456/'),url=new URL('?scene=3b08c73f-d17c-4dfc-a45e-854ddae97b2f&debug=1&seed=1001&auto=1',base).href;
// 原生预览先核对刷新版本；独立源码页另标sourceHost，不冒充Creator原生预览。
async function freshness(){
 const b=new URL('/scripting/x/',base),map=await (await fetch(new URL('import-map.json',b))).json(),sources={};
 for(const name of ['AppView','WorldAssets','DrawSurface','WorldView','WorldPainter','HudView','InputView']){const key=Object.keys(map.imports).find(k=>k.endsWith(`/${name}.ts`));sources[name]=key?await(await fetch(new URL(map.imports[key],b))).text():'';}
 return {at:new Date().toISOString(),p72:sources.WorldAssets.includes('ribbon_red')&&sources.AppView.includes('step.buff'),p73:sources.AppView.includes('PerfProbe'),outline:sources.DrawSurface.includes('3.8.8的outlineColor'),idle:sources.AppView.includes('frameKey()'),warm:sources.AppView.includes('takeVisuals()'),fps:sources.AppView.includes('frameRate(60)'),geometry:sources.DrawSurface.includes('recordGeometry'),retained:sources.WorldPainter.includes('RetainedWorld')&&sources.HudView.includes('drawRetained')&&sources.InputView.includes('drawRetained'),sources:Object.fromEntries(Object.entries(sources).map(([n,s])=>[n,{bytes:s.length,sha256:createHash('sha256').update(s).digest('hex')}]))};
}
const standalone=process.argv.includes('--source-host');
const fresh=standalone?{at:new Date().toISOString(),p72:true,sourceHost:true,creatorPreview:false}:await freshness();await fs.appendFile(path.join(out,'freshness.ndjson'),JSON.stringify(fresh)+'\n');console.log('FRESHNESS',JSON.stringify(fresh));
if(mode==='freshness')process.exit(0);
assert.ok(fresh.p72,'7456仍是旧P7-2，先等泊舟刷新；本次未测量');
if(phase==='after'&&!process.argv.includes('--source-overlay'))for(const feature of ['outline','idle','warm','fps','geometry','retained'])assert.equal(fresh[feature],true,`7456尚未导入${feature}，本次未测量`);
for(const feature of arg('expect','').split(',').filter(Boolean))assert.equal(fresh[feature],true,`7456尚未导入${feature}，本次未测量`);
assert.ok(['native','outline-guard'].includes(variant),'未知A/B变体');
if(variant==='outline-guard')assert.equal(fresh.outline,false,'单项A/B必须基于尚无该修复的原生基线');
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/tmp/shuaiguo-browser-check/node_modules/playwright/index.mjs');
const require=createRequire(import.meta.url),ts=require('/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources/resources/3d/engine/node_modules/typescript');
const sourceOverlay=process.argv.includes('--source-overlay');
// 额外A/B沿用项目既有做法：只在测试页面替换App，结果明确标注，不能冒充Creator原生预览。
async function sourceModules(dir,base=dir){const result={};for(const entry of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())Object.assign(result,await sourceModules(file,base));else if(entry.name.endsWith('.ts')&&entry.name!=='Boot.ts')result[path.relative(base,file).split(path.sep).join('/')]=ts.transpileModule(await fs.readFile(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;}return result;}
const modules=sourceOverlay?await sourceModules(path.resolve(root,arg('source-dir','cocos/assets/scripts'))):undefined;
// 基线也用同一份调试仪器；只注入观察hook，不替换App/World/绘图源码。
const probeSource=ts.transpileModule(await fs.readFile(path.join(root,'cocos/assets/scripts/view/PerfProbe.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader','--enable-precise-memory-info']});
const report={phase,seconds,cpuThrottle:6,dpr:Number(arg('dpr','1')),renderDprOverride:arg('render-dpr',null),fresh,variant,sourceOverlay,sourceRoot:sourceOverlay?arg('source-dir','cocos/assets/scripts'):null,moduleHashes:modules?Object.fromEntries(Object.entries(modules).map(([n,s])=>[n,createHash('sha256').update(s).digest('hex')])):undefined,levels:[],screens:[],errors:[]};
report.browserPids=execFileSync('ps',['-axo','pid,ppid,comm'],{encoding:'utf8'}).trim().split('\n').slice(1).map(s=>s.trim().split(/\s+/)).filter(([pid,parent,...command])=>Number(parent)===process.pid&&/chrome|chromium/i.test(command.join(' '))).map(([pid])=>Number(pid));
const get=()=>cc.director.getScene().getChildByName('Canvas').getChildByName('Boot').getComponent('Boot').app;
const ev=(page,fn,data)=>page.evaluate(({get,fn,data})=>(0,eval)(`(${fn})`)((0,eval)(`(${get})`)(),data),{get:get.toString(),fn:fn.toString(),data});
// CDP样本按叶节点累计自耗时，明确排除(program)；保留原始profile供复核。
function top(profile){
 const nodes=new Map(profile.nodes.map(n=>[n.id,n])),totals=new Map(),functions=new Map();
 profile.samples?.forEach((id,i)=>totals.set(id,(totals.get(id)||0)+(profile.timeDeltas?.[i]||0)));
 for(const [id,us]of totals){const f=nodes.get(id).callFrame,key=[f.scriptId,f.functionName,f.lineNumber,f.columnNumber].join('|'),entry=functions.get(key)||{function:f.functionName||'(anonymous)',url:f.url,scriptId:f.scriptId,line:f.lineNumber+1,selfMs:0};entry.selfMs+=us/1000;functions.set(key,entry);}
 return [...functions.values()].filter(x=>!['(program)','(idle)','(garbage collector)'].includes(x.function)).sort((a,b)=>b.selfMs-a.selfMs).slice(0,20);
}
async function open(level,freeze){const page=await browser.newPage({viewport:{width:375,height:812},deviceScaleFactor:Number(arg('dpr','1')),isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36'});page.setDefaultTimeout(90000);
 // 在首个GL分配前记录真实纹理；包括Label/内置纹理，删除即从驻留表移除。
 if(mode==='atlas-audit')await page.addInitScript(()=>{
  const live=new Map(),states=new WeakMap();let serial=0;
  const state=gl=>{let s=states.get(gl);if(!s){s={unit:0,bindings:new Map()};states.set(gl,s);}return s;};globalThis.__glTextures=live;
  for(const Type of [globalThis.WebGLRenderingContext,globalThis.WebGL2RenderingContext])if(Type){const p=Type.prototype;
   const wrap=(name,observe)=>{const old=p[name];if(!old)return;p[name]=function(...args){const result=old.apply(this,args);observe.call(this,args,result);return result;};};
   wrap('createTexture',(_a,t)=>live.set(t,{id:++serial,width:0,height:0}));
   wrap('activeTexture',function([unit]){state(this).unit=unit;});
   wrap('bindTexture',function([target,t]){const s=state(this);s.bindings.set(s.unit+':'+target,t);});
   wrap('deleteTexture',([t])=>live.delete(t));
   for(const name of ['texImage2D','texStorage2D'])wrap(name,function(a){const s=state(this),target=a[0]>=34069&&a[0]<=34074?34067:a[0],t=s.bindings.get(s.unit+':'+target),row=live.get(t);if(!row)return;
    if(target===34067)row.faces=6;
    if(name==='texStorage2D'){row.width=a[3];row.height=a[4];}else if(a[1]===0){const image=a[5];row.width=a.length===6?image.width:a[3];row.height=a.length===6?image.height:a[4];}
   });
   for(const name of ['texImage3D','texStorage3D'])wrap(name,function(a){const s=state(this),row=live.get(s.bindings.get(s.unit+':'+a[0]));if(row&&(name==='texStorage3D'||a[1]===0)){row.width=a[3];row.height=a[4];row.depth=a[5];}});
  }
 });
 if(process.argv.includes('--webgl1'))await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){return kind==='webgl2'?null:original.call(this,kind,...args);};});
 if(arg('render-dpr',''))await page.route(/\/(?:scripting\/engine\/bin\/\.cache\/dev\/preview|engine)\/bundled\/index\.js/,async route=>{
  // 只在本测试页模拟微信的满DPR画布；不改引擎文件、服务器或工程缩放路径。
  const response=await route.fetch(),body=await response.text(),pattern=/Math\.min\(\(_window\$devicePixelRa = window\.devicePixelRatio\)[^;]+?, 2\)/g;
  const matches=body.match(pattern);assert.equal(matches?.length,1,'无法定位网页引擎DPR上限，禁止冒充DPR3实验');
  await route.fulfill({response,body:body.replace(pattern,m=>m.replace(/, 2\)$/,`, ${Number(arg('render-dpr','2'))})`))});
 });page.on('pageerror',e=>report.errors.push(e.stack||e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});await page.goto(url+`&level=${level}${freeze===undefined?'':`&freeze=${freeze}`}`,{waitUntil:'domcontentloaded'});if(standalone){await page.waitForFunction(()=>globalThis.__sourceReady);await page.evaluate(()=>{const {Node,Component,Camera,Canvas,Layers,Color,ResolutionPolicy,view,_decorator}=cc;view.setDesignResolutionSize(375,812,ResolutionPolicy.SHOW_ALL);class Boot extends Component{update(dt){this.app?.update(dt);}}_decorator.ccclass('Boot')(Boot);const canvas=cc.director.getScene().getChildByName('Canvas'),boot=new Node('Boot');canvas.addChild(boot);boot.addComponent(Boot);const n=new Node('Camera');canvas.addChild(n);n.setPosition(0,0,1000);const camera=n.addComponent(Camera);camera.projection=Camera.ProjectionType.ORTHO;camera.orthoHeight=view.getVisibleSize().height/2;camera.near=0;camera.far=2000;camera.visibility=Layers.Enum.UI_2D;camera.clearColor=new Color('#1F2A44');canvas.getComponent(Canvas).cameraComponent=camera;});}else await page.waitForFunction(()=>globalThis.cc?.director.getScene()?.getChildByName('Canvas')?.getChildByName('Boot')?.getComponent('Boot')?.app?.ready);if(!standalone)await ev(page,a=>{a.frozen=true;cc.profiler.hideStats();});
 await page.evaluate(({root,imported})=>{globalThis.__auditAtlasRoot=root;globalThis.__importedSourceImages=imported;}, {root:arg('atlas-dir','cocos/assets/resources/atlas'),imported:process.argv.includes('--imported-source-images')});
 if(modules)await page.evaluate(async modules=>{
  const cc=await System.import('cc'),cache={};
  if(globalThis.__sourceReady){const atlasRoot=globalThis.__auditAtlasRoot||'cocos/assets/resources/atlas';const original=cc.resources.load.bind(cc.resources);cc.resources.load=function(name,type,done){if(name.startsWith('atlas/match')||(name.startsWith('atlas/')&&type===cc.ImageAsset&&!globalThis.__importedSourceImages)){cc.assetManager.loadRemote('/raw/'+atlasRoot+'/'+name.replace('atlas/','').replace('/texture','')+'.png',{ext:'.png'},(error,image)=>{if(error)return done(error);if(type===cc.ImageAsset)return done(null,image);const texture=new cc.Texture2D();texture.image=image;done(null,texture);});}else original(name,type,done);};}const load=id=>{if(cache[id])return cache[id].exports;const mod={exports:{}};cache[id]=mod;const localRequire=s=>{if(s==='cc')return cc;if(s==='cc/env')return {PREVIEW:true};const parts=id.split('/');parts.pop();for(const part of s.split('/')){if(part==='..')parts.pop();else if(part!=='.')parts.push(part);}let target=parts.join('/');if(!target.endsWith('.ts'))target+='.ts';return load(target);};new Function('require','module','exports',modules[id])(localRequire,mod,mod.exports);return mod.exports;};
  const boot=cc.director.getScene().getChildByName('Canvas').getChildByName('Boot').getComponent('Boot'),old=boot.app;boot.app=undefined;old?.destroy();if(old)await new Promise(resolve=>cc.director.once(cc.Director.EVENT_AFTER_DRAW,resolve));else await new Promise(requestAnimationFrame);const {AppView}=load('view/AppView.ts');
  // 仅源码验收页安装资源/时延仪器；不进入生产代码，不把浏览器内存当微信真机值。
  const {WorldAssets}=load('view/WorldAssets.ts'),device=cc.director.root.device,images=new Map(),events=[];
  const stats={events,sourceImages:[],initialHeap:performance.memory?.usedJSHeapSize,peakHeap:0,peakGfx:0,peakKnownCpu:0,rawBytes:0};globalThis.__loadAudit=stats;
  const sample=(event,extra={})=>{const decoded=[...images.values()].reduce((n,v)=>n+v,0),heap=performance.memory?.usedJSHeapSize||0,gpu=device.memoryStatus.textureSize;
   stats.peakHeap=Math.max(stats.peakHeap,heap);stats.peakGfx=Math.max(stats.peakGfx,gpu);stats.peakKnownCpu=Math.max(stats.peakKnownCpu,decoded+stats.rawBytes+(extra.cropBytes||0));events.push({event,ms:performance.now(),gpu,heap,decoded,raw:stats.rawBytes,...extra});};
  const loadResource=cc.resources.load,release=cc.assetManager.releaseAsset;
  cc.resources.load=function(name,type,done){return loadResource.call(this,name,type,(error,asset)=>{if(!error&&type===cc.ImageAsset){images.set(asset,asset.width*asset.height*4);stats.sourceImages.push({name,width:asset.width,height:asset.height});sample('image-loaded');}done(error,asset);});};
  cc.assetManager.releaseAsset=function(image){const result=release.call(this,image);if(images.delete(image)){stats.rawBytes=0;sample('image-released');}return result;};
  const originalMethods={};for(const name of ['copyTexImagesToTexture','copyTextureToBuffers','copyBuffersToTexture']){const original=device[name];originalMethods[name]=original;device[name]=function(...args){if(name==='copyTextureToBuffers')stats.rawBytes=args[1].reduce((n,b)=>n+b.byteLength,0);sample(name,{cropBytes:name==='copyBuffersToTexture'?args[0].reduce((n,b)=>n+b.byteLength,0):0});return original.apply(this,args);};}
  const assemble=WorldAssets.prototype.assembleMatch;if(assemble)WorldAssets.prototype.assembleMatch=async function(){const start=performance.now();try{return await assemble.call(this);}finally{stats.assembleMs=performance.now()-start;sample('assembly-complete');}};
  const start=performance.now();boot.app=new AppView(boot.node);await boot.app.start();stats.startMs=performance.now()-start;stats.sourcesRemaining=images.size;stats.finalGfx=device.memoryStatus.textureSize;sample('app-ready');boot.app.frozen=true;
  // 完成后恢复仪器；只在验收页保留数字和纹理读回，不污染性能窗口。
  cc.resources.load=loadResource;cc.assetManager.releaseAsset=release;for(const name in originalMethods)device[name]=originalMethods[name];if(assemble)WorldAssets.prototype.assembleMatch=assemble;
 },modules);
 report.loading=await page.evaluate(()=>globalThis.__loadAudit);report.device=await page.evaluate(()=>({api:cc.director.root.device.gfxAPI,renderer:cc.director.root.device.renderer}));return page;}
try{
 if(mode==='atlas-audit'){
  const page=await open(5,120);await page.addStyleTag({content:'#__vconsole{display:none!important}'});report.inventory=[];
  for(const screen of ['lobby','intro','play','result']){
   await ev(page,async(a,screen)=>{Math.random=()=>.5;a.real=2;if(screen==='lobby')a.showLobby();if(screen==='intro')await a.showIntro();if(screen==='play'){await a.startGame();a.frozen=true;a.real=2;a.world.real=2;a.world.render();a.render();}if(screen==='result'){for(let i=0;i<8000&&a.world.match.mode!=='over';i++)a.tick(1/60);a.real=125;a.render();}},screen);
   await page.waitForTimeout(300);await page.locator('#GameCanvas').screenshot({path:path.join(out,screen+'.png')});
   if(process.argv.includes('--isolate-ui')){
    await ev(page,a=>{const textures=new Set(['boss_idle','cashier_normal','designer_normal','director_idle','intern_normal','wok','nephew_normal','player_normal','pm_normal','tester_normal','veteran_normal','wife_idle'].map(name=>a.assets.spr[name]?.frame.texture));globalThis.__hiddenSprites=[];const walk=node=>{if(!node.activeInHierarchy)return;for(const sprite of node.getComponents(cc.Sprite))if(sprite.enabled&&textures.has(sprite.spriteFrame?.texture)&&node.name.startsWith('Draw-')){sprite.enabled=false;globalThis.__hiddenSprites.push(sprite);}for(const child of node.children)walk(child);};walk(a.parent);});
    await page.waitForTimeout(150);await page.locator('#GameCanvas').screenshot({path:path.join(out,screen+'-without-shared-sprites.png')});
    await page.evaluate(()=>{for(const sprite of globalThis.__hiddenSprites)sprite.enabled=true;delete globalThis.__hiddenSprites;});await page.waitForTimeout(100);
   }

   const row=await ev(page,a=>{const textures=[...globalThis.__glTextures.values()].filter(t=>t.width&&t.height).map(t=>({...t,bytes:t.width*t.height*4*(t.faces||t.depth||1)})),atlas=a.world?.painter?.nodes?.atlas;return {textures,gfxTextureBytes:cc.director.root.device.memoryStatus.textureSize,bytes:textures.reduce((n,t)=>n+t.bytes,0),textCache:atlas?{x:atlas.x,y:atlas.y,row:atlas.row,count:atlas.texts.size}:null,screen:a.screen,panel:a.panel};});// 逐个记录换源精灵的变换，差异分类使用实际节点，禁止用热图位置猜文字是否受影响。
   row.sprites=await ev(page,a=>{const rows=[];const walk=(node,path)=>{if(!node.activeInHierarchy)return;for(const sprite of node.getComponents(cc.Sprite)){const f=sprite.spriteFrame;if(f?.texture!==a.assets.matchTexture)continue;const t=node.getComponent(cc.UITransform),m=node.worldMatrix;rows.push({path:path+'/'+node.name,width:t.width,height:t.height,anchor:{x:t.anchorX,y:t.anchorY},rect:{x:f.rect.x,y:f.rect.y,width:f.rect.width,height:f.rect.height},matrix:{a:m.m00,b:m.m01,c:m.m04,d:m.m05,x:m.m12,y:m.m13}});}for(const child of node.children)walk(child,path+'/'+node.name);};walk(a.parent,'');return rows;});
   report.inventory.push({requested:screen,...row});console.log('INVENTORY',JSON.stringify({screen,bytes:row.bytes,textCache:row.textCache}));
  }
  if(process.argv.includes('--read-atlas'))report.atlas=await ev(page,async a=>{const texture=a.assets.matchTexture,bytes=new Uint8Array(texture.width*texture.height*4),region=new cc.gfx.BufferTextureCopy();region.texExtent.width=texture.width;region.texExtent.height=texture.height;cc.director.root.device.copyTextureToBuffers(texture.getGFXTexture(),[bytes],[region]);return {width:texture.width,height:texture.height,sha256:[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('')};});
  await page.close();
 }else if(mode==='effects'){
  const page=await open(5);await page.addStyleTag({content:'#__vconsole{display:none!important}'});report.effects=[];
  const cases=['shake','parry','sky-overlap','hot-reuse','hot-halo','explosion-0','explosion-12','explosion-30','crushed','praise-calm','praise-parry','praise-rankup','tutorial-1','tutorial-3','tutorial-4','revive','rescue'];
  for(const name of cases){
   const state=await ev(page,async(a,name)=>{
    Math.random=()=>.75;a.selected=4;a.params.delete('freeze');a.params.set('auto','1');await a.startGame();a.frozen=true;a.world.frozen=true;let w=a.world,m=w.match,P=m.S.player;
    if(name.startsWith('praise-'))await a.showTourStep({kind:'praise',name,level:1,seed:1001,praise:name.slice(7)});
    else if(name.startsWith('tutorial-'))await a.showTourStep({kind:'tutorial',name,level:1,seed:1001,step:Number(name.slice(9))});
    else if(name==='revive')await a.showTourStep({kind:'revive',name,level:2,seed:1001});
    else if(name==='rescue'){await a.showTourStep({kind:'result',name,level:2,seed:1001,result:'fail'});a.world.match.rescue();a.world.flush();}
    else {
     const x=P.sn.x,y=P.sn.y,hot={src:'fixture',phase:'fly',x,y,t:.5,warn0:1,target:P,hot:false,a:0,spin:0,life:10,label:'急件'};
     if(name==='shake')w.painter.event('shake',[8]);
     if(name==='parry'){m.S.throws=[{owner:m.S.bots[0],target:P,x:x-70,y,a:0,speed:900,pot:{label:'改方案',due:999},label:'改方案',hot:false,dist:0,range:500,bounces:0,spin:0,rolled:new Set()}];w.clock=.18;}
     if(name==='sky-overlap'){hot.phase='sky';m.S.flying=[hot];}
     if(name==='hot-reuse'){m.S.flying=[hot];w.render();hot.hot=true;}
     if(name==='hot-halo'){P.sn.segs=[{label:'急件',hot:true,due:m.S.t+2}];w.clock=.125;}
     if(name.startsWith('explosion-'))m.S.fx=[{name:'pot_explosion',x,y,size:160,t:Number(name.slice(10))/30,dur:1.1}];
     if(name==='crushed'){const b=m.S.bots[0];b.crushed=true;b.sn.x=x+60;b.sn.y=y;}
    }
    w=a.world;m=w.match;
    const snapshot=()=>{const seen=new Map();return JSON.stringify({state:m.S,mode:m.mode,progress:m.prog,input:m.inp,rng:m.E.rngState()},(_key,v)=>{if(typeof v==='function')return '<function>';if(v&&typeof v==='object'){if(seen.has(v))return {$ref:seen.get(v)};seen.set(v,seen.size);if(v instanceof Set)return {set:[...v]};}return v;});};
    const before=snapshot();w.render();a.render();if(snapshot()!==before)throw Error('画面层回写core: '+name);
    return {name,level:m.L.id,t:m.S.t,steps:w.steps,rng:m.E.rngState(),coreReadOnly:true,revived:m.S.revived,rescued:m.S.rescued,tutorial:m.S.tut?.i??null,fireCenter:w.controls.fireCenter(),rate:cc.game.frameRate,canvas:[cc.game.canvas.width,cc.game.canvas.height]};
   },name);
   await page.waitForTimeout(80);await page.locator('#GameCanvas').screenshot({path:path.join(out,name+'.png')});report.effects.push(state);console.log('EFFECT',JSON.stringify(state));
  }
  await page.close();
 }else if(mode==='inspect'){
  const page=await open(Number(arg('level','5')));await ev(page,async a=>{Math.random=()=>.5;await a.startGame();a.frozen=true;for(let i=0;i<600;i++)a.tick(1/60);});await page.waitForTimeout(300);
  report.nodes=await ev(page,a=>{const rows=[];const walk=(node,path)=>{if(!node.activeInHierarchy)return;for(const c of node.components||node._components||[]){if(c instanceof cc.Sprite||c instanceof cc.Label||c instanceof cc.Graphics){const r=c.renderData;rows.push({path:path+'/'+node.name,type:c.constructor.name,frame:c.spriteFrame?.rect,texture:c.spriteFrame?.texture?.getId(),textureHash:r?.textureHash,dataHash:r?.dataHash,buffer:r?.chunk?.bufferId,vertices:r?.vertexCount,material:c.getRenderMaterial(0)?.name,materialHash:c.getRenderMaterial(0)?.hash,shader:c.getRenderMaterial(0)?.passes[0]?.hash});}}for(const child of node.children)walk(child,path+'/'+node.name);};walk(a.parent,'');return rows;});await page.close();
 }else if(mode==='checkpoints'){
  // 固定步只用于独立测试页面；每次先逐帧回放到请求点，再按真实rAF采集同样数量的玩法帧。
  // 不延长关卡、不复活、不改数值；超过下班的请求点明确记录终态，不能冒充后期对局。
  report.checkpoints=[];
  const checkpoints=arg('checkpoints','10,60,100,150,170').split(',').map(Number),levels=arg('levels','1,5').split(',').map(Number);
  for(const level of levels)for(const requested of checkpoints){
   const page=await open(level),cdp=await page.context().newCDPSession(page);
   const firstPlayMs=await ev(page,async(a,requested)=>{a.audio.bgm(false);Math.random=()=>.5;const start=performance.now();await a.startGame();a.frozen=true;await new Promise(resolve=>cc.director.once(cc.Director.EVENT_AFTER_DRAW,resolve));const firstPlayMs=performance.now()-start;for(let i=0;i<Math.round(requested*60);i++){a.tick(1/60);if(a.world.match.mode==='over'){a.real=Math.max(a.real,requested);a.render();break;}}return firstPlayMs;},requested);
   const state=await ev(page,a=>({id:a.world.match.L.id,agents:a.world.match.S.agents.length,leaders:a.world.match.S.leaders.length,auto:a.world.match.auto,screen:a.screen,mode:a.world.match.mode,t:a.world.match.S.t,steps:a.world.steps,rng:a.world.match.E.rngState(),pots:a.world.match.S.agents.reduce((n,p)=>n+p.sn.segs.length,0),flying:a.world.match.S.flying.length,throws:a.world.match.S.throws.length,fx:a.world.match.S.fx.length,floats:a.world.match.S.floats?.length??null,canvas:{width:document.querySelector('#GameCanvas').width,height:document.querySelector('#GameCanvas').height},visible:cc.view.getVisibleSize(),dpr:cc.view.getDevicePixelRatio(),renderer:cc.director.root.device.renderer}));
   assert.equal(state.id,level);assert.equal(state.agents,level===5?8:level===3?7:4);assert.equal(state.leaders,level===5?3:level===3?2:1);assert.equal(state.auto,true);
   await page.addStyleTag({content:'#__vconsole{display:none!important}'});await page.waitForTimeout(200);
   await page.locator('#GameCanvas').screenshot({path:path.join(out,`level-${level}-at-${requested}.png`),scale:'device'});
   if(state.mode!=='play'){const entry={level,requested,state,summary:null,notAssessed:'请求点已自然结算，不作为对局性能样本'};report.checkpoints.push(entry);console.log('CHECKPOINT',JSON.stringify(entry));await cdp.detach();await page.close();continue;}
   await ev(page,(a,source)=>{const exports={};new Function('require','exports',source)(()=>cc,exports);a.__perf=new exports.PerfProbe(a,a.world.constructor.prototype,false);},probeSource);
   await cdp.send('Emulation.setCPUThrottlingRate',{rate:6});await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:1000});await cdp.send('Profiler.start');
   const sampleFrames=Number(arg(requested>=119?'frames-late':'frames',arg('frames',String(Math.round(seconds*60)))));
   const sampleWindow=await ev(page,async(a,count)=>{a.frameRate(60);a.__perf.reset();let completed=0;for(let i=0;i<count;i++){if(a.world.match.mode!=='play')break;a.tick(1/60);if(a.world.match.mode!=='play')break;await new Promise(requestAnimationFrame);completed++;}return {requestedFrames:count,completedFrames:completed,truncated:completed<count};},sampleFrames);
   const measurements=await ev(page,a=>({summary:a.__perf.summary(1e9),frames:a.__perf.frames,mode:a.world.match.mode,t:a.world.match.S.t,steps:a.world.steps,rng:a.world.match.E.rngState(),pools:a.world.surfaces.map(s=>s.stats())}));
   if(sampleWindow.truncated)measurements.summary=null;
   const {profile}=await cdp.send('Profiler.stop');await fs.writeFile(path.join(out,`level-${level}-at-${requested}.cpuprofile`),JSON.stringify(profile));
   const categories=await ev(page,a=>{
    // 定格后单独追踪一次画笔调用，不计入计时窗口；只统计请求数，不冒充GPU批次。
    const proto=a.world.surfaces[0].constructor.prototype,originals={},counts={};
    for(const method of ['drawImage','fillText','fill','stroke']){originals[method]=proto[method];proto[method]=function(...args){const stack=new Error().stack||'',name=['drawFloats','edgeHint','drawStatusFx','drawDueTag','drawPotBadge','drawShadow','drawHotPot','drawFlyingWok','drawWok','drawAims','drawTail','drawLeader','drawHead'].find(n=>stack.includes('at '+n+' ')||stack.includes('.'+n+' ('))||'other';const key=name+':'+method;counts[key]=(counts[key]||0)+1;return originals[method].apply(this,args);};}
    try{a.world.render();}finally{for(const method in originals)proto[method]=originals[method];}return counts;
   });
   let touchCheck;
   if(process.argv.includes('--touch-check')&&measurements.mode==='play'){
    const button=await ev(page,a=>a.world.ui.hud.actions.find(b=>b.action==='pause')),box=await page.locator('#GameCanvas').boundingBox(),size=await ev(page,a=>({width:a.surface.width,height:a.surface.height}));assert.ok(button);
    await ev(page,a=>{a.__tap=[];cc.input.once(cc.Input.EventType.TOUCH_START,e=>a.__tap.push({ui:e.getUILocation(),location:e.getLocation()}));});
    await page.touchscreen.tap(box.x+(button.x+button.w/2)*box.width/size.width,box.y+(button.y+button.h/2)*box.height/size.height);
    const attempt={button,box,size,...await ev(page,a=>({panel:a.panel,events:a.__tap,scale:[cc.view.getScaleX(),cc.view.getScaleY()],viewport:cc.view.getViewportRect(),screen:a.screen,mode:a.world.match.mode,paused:a.world.paused}))};report.touchAttempts??=[];report.touchAttempts.push(attempt);console.log('TOUCH',JSON.stringify(attempt));assert.equal(attempt.panel,'pause','DPR实验暂停触点错位');
    await ev(page,a=>a.render());const resume=await ev(page,a=>a.actions.find(b=>b.action==='resume'));assert.ok(resume);await page.touchscreen.tap(box.x+(resume.x+resume.w/2)*box.width/size.width,box.y+(resume.y+resume.h/2)*box.height/size.height);assert.equal(await ev(page,a=>a.panel),'','DPR实验继续触点错位');
    touchCheck=await ev(page,async a=>{let resizes=0;const listener=()=>resizes++,read=()=>({canvas:[document.querySelector('#GameCanvas').width,document.querySelector('#GameCanvas').height],visible:cc.view.getVisibleSize(),dpr:cc.view.getDevicePixelRatio()});cc.view.on('canvas-resize',listener);try{const before=read();a.frameRate(15);await new Promise(r=>setTimeout(r,150));const idle=read();a.frameRate(60);await new Promise(r=>setTimeout(r,150));return {pauseAndResume:true,before,idle,after:read(),resizes};}finally{cc.view.off('canvas-resize',listener);}});
    assert.deepEqual(touchCheck.before,touchCheck.idle);assert.deepEqual(touchCheck.before,touchCheck.after);assert.equal(touchCheck.resizes,0);
   }
   const entry={level,requested,firstPlayMs,loading:await page.evaluate(()=>globalThis.__loadAudit),state,...measurements,sampleWindow,categories,touchCheck,top20:top(profile)};report.checkpoints.push(entry);console.log('CHECKPOINT',JSON.stringify({level,requested,state,summary:measurements.summary}));
   await ev(page,a=>a.__perf.destroy());await cdp.detach();await page.close();
  }
 }else if(mode==='idle-rate'){
  const page=await open(5,120),cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:6});
  await ev(page,async(a,source)=>{await a.startGame();a.action('pause');a.frozen=true;a.world.render();a.world.render();const exports={};new Function('require','exports',source)(()=>cc,exports);a.__perf=new exports.PerfProbe(a,a.world.constructor.prototype,false);},probeSource);report.idleRateAB=[];
  // 相同节点、相同定格画面，仅切换引擎提交频率，不让auto轨迹差异混进节电收益。
  for(const fps of [60,15]){await ev(page,(a,fps)=>{a.frameRate(fps);},fps);await page.waitForTimeout(300);await ev(page,a=>a.__perf.reset());await page.waitForTimeout(2000);report.idleRateAB.push({fps,...await ev(page,async a=>({actualRate:(await System.import('cc')).game.frameRate,globalRate:cc.game.frameRate,appFrozen:a.frozen,...a.__perf.summary(1e9)}))});}
  await ev(page,a=>{a.__perf.destroy();cc.game.frameRate=60;});await cdp.detach();await page.close();console.log('IDLE RATE A/B',JSON.stringify(report.idleRateAB));
 }else if(mode==='startup'){
  assert.ok(sourceOverlay,'冷/热节点池因果实验仅用于本轮源码页面');report.startupAB=[];
  for(const level of [1,5]){const page=await open(level),cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:6});await ev(page,(a,source)=>{const exports={};new Function('require','exports',source)(()=>cc,exports);a.__perf=new exports.PerfProbe(a,a.world.constructor.prototype,false);},probeSource);
   for(const warm of [false,true])for(let run=0;run<5;run++){
    await ev(page,async(a,warm)=>{a.frozen=true;await a.showIntro();if(!warm)a.world.ready=false;},warm);
    const button=await ev(page,a=>a.actions.find(b=>b.action==='start')),canvas=await page.locator('#GameCanvas').boundingBox(),size=await ev(page,a=>({w:a.surface.width,h:a.surface.height}));assert.ok(button);
    await page.touchscreen.tap(canvas.x+(button.x+button.w/2)*canvas.width/size.w,canvas.y+(button.y+button.h/2)*canvas.height/size.h);await page.waitForTimeout(150);
    const entry=await ev(page,a=>({id:a.world.match.L.id,agents:a.world.match.S.agents.length,leaders:a.world.match.S.leaders.length,...a.__perf.starts.at(-1)}));assert.equal(entry.id,level);assert.ok(entry.firstSubmitted>=0);report.startupAB.push({level,warm,run,...entry});console.log('STARTUP',JSON.stringify({level,warm,run,...entry}));
   }
   await ev(page,a=>a.__perf.destroy());await cdp.detach();await page.close();
  }
 }else if(mode==='flow'){
  const page=await open(5,0);await page.addStyleTag({content:'#__vconsole{display:none!important}'});report.flow=[];
  await ev(page,a=>{a.showLobby();a.setPerformance(true);});await page.waitForTimeout(300);report.flow.push('lobby');
  await ev(page,async a=>{await a.showIntro();});report.flow.push('intro');
  await ev(page,async a=>{await a.startGame();});assert.equal(await ev(page,a=>a.world.match.L.id),5);report.flow.push('play');
  await page.waitForTimeout(500);await page.locator('#GameCanvas').screenshot({path:path.join(out,'performance-overlay-level5.png')});
  await ev(page,a=>{a.action('pause');a.frozen=false;a.world.frozen=false;});assert.equal(await ev(page,a=>a.panel),'pause');await page.waitForTimeout(800);assert.equal(await ev(page,()=>cc.game.frameRate),15);report.flow.push('pause-15fps');
  await ev(page,a=>{a.action('resume');if(cc.game.frameRate!==60)throw Error('继续游戏没有立即唤回60帧');for(let i=0;i<6000&&a.world.match.mode!=='over';i++)a.tick(1/30);});assert.equal(await ev(page,a=>a.panel),'result');report.flow.push('natural-result');
  await ev(page,a=>{a.action('menu');});assert.equal(await ev(page,a=>a.screen),'lobby');report.flow.push('return-lobby');
  await ev(page,a=>{a.setPerformance(false);});await page.waitForTimeout(100);assert.equal(await ev(page,a=>a.parent.getChildByName('DebugPerformance')!==null),false);await page.close();
 }else if(mode==='screens'){
  for(const level of [1,3,5]){const page=await open(level,120);await ev(page,async(a,level)=>{if(a.selected!==level-1)throw Error('选关失败');a.real=0;const random=Math.random;Math.random=()=>.5;try{await a.startGame();a.frozen=true;a.real=2;a.world.real=2;a.world.render();a.render();}finally{Math.random=random;}},level);await page.addStyleTag({content:'#__vconsole{display:none!important}'});await page.waitForTimeout(300);const state=await ev(page,a=>({id:a.world.match.L.id,agents:a.world.match.S.agents.length,leaders:a.world.match.S.leaders.length,steps:a.world.steps,t:a.world.match.S.t,rng:a.world.match.E.rngState(),screen:a.screen,canvas:{width:document.querySelector('#GameCanvas').width,height:document.querySelector('#GameCanvas').height}}));assert.equal(state.id,level);assert.equal(state.steps,120);const canvas=page.locator('#GameCanvas');await canvas.screenshot({path:path.join(out,`level-${level}-freeze-120.png`)});report.screens.push(state);console.log('SCREEN',JSON.stringify(state));await page.close();}
 }else{
  for(const level of [1,5]){
   const page=await open(level),cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:6});
   // 单变量因果实验仅存在本页面：模拟源码同值描边保护；必须单独标记，不能充当新预览验收。
   if(variant==='outline-guard')await page.evaluate(()=>{const property=Object.getOwnPropertyDescriptor(cc.Label.prototype,'outlineColor');Object.defineProperty(cc.Label.prototype,'outlineColor',{...property,set(value){if(!property.get.call(this).equals(value))property.set.call(this,value);}});});
   await ev(page,(a,source)=>{a.audio.bgm(false);const exports={};new Function('require','exports',source)(()=>cc,exports);a.__perf=new exports.PerfProbe(a,a.world.constructor.prototype,false);},probeSource);
   const intro=await ev(page,a=>({id:a.world.match.L.id,agents:a.world.match.S.agents.length,leaders:a.world.match.S.leaders.length}));assert.equal(intro.id,level);
   // 通过实际按钮命中触发；不是无参数startGame误入默认关。
   const button=await ev(page,a=>a.actions.find(b=>b.action==='start'));assert.ok(button,'缺少开始上班按钮');const canvas=await page.locator('#GameCanvas').boundingBox(),size=await ev(page,a=>({width:a.surface.width,height:a.surface.height}));await page.touchscreen.tap(canvas.x+(button.x+button.w/2)*canvas.width/size.width,canvas.y+(button.y+button.h/2)*canvas.height/size.height);await page.waitForFunction(()=>cc.director.getScene().getChildByName('Canvas').getChildByName('Boot').getComponent('Boot').app.screen==='play');await page.waitForTimeout(200);
   const start=await ev(page,a=>({id:a.world.match.L.id,agents:a.world.match.S.agents.length,leaders:a.world.match.S.leaders.length,auto:a.world.match.auto,startup:a.__perf.starts.at(-1),screen:a.screen,renderer:cc.director.root.device.renderer,vendor:cc.director.root.device.vendor,frameRate:cc.game.frameRate,dpr:cc.view.getDevicePixelRatio()}));assert.equal(start.screen,'play');assert.ok(start.startup?.firstSubmitted>=0,'没有首帧提交记录');assert.equal(start.id,level);assert.equal(start.agents,level===5?8:4);assert.equal(start.leaders,level===5?3:1);assert.equal(start.auto,true);console.log('ENTERED',JSON.stringify(start));
   // Profiler启停本身可能阻塞超过1秒：在冻结状态先启动，统计在停止之前原子读回。
   await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:1000});await cdp.send('Profiler.start');await ev(page,a=>{a.frozen=false;a.__perf.reset();});await page.waitForTimeout(seconds*1000);
   const measurements=await ev(page,a=>{a.frozen=true;return {summary:a.__perf.summary(1e9),last2Seconds:a.__perf.summary(),frames:a.__perf.frames,mode:a.world.match.mode,t:a.world.match.S.t,steps:a.world.steps,pools:a.world.surfaces.map(s=>s.stats())};});const {profile}=await cdp.send('Profiler.stop');
   await fs.writeFile(path.join(out,`level-${level}.cpuprofile`),JSON.stringify(profile));const result={level,intro,start,...measurements,top20:top(profile)};report.levels.push(result);console.log('METRICS',level,JSON.stringify(measurements.summary));console.table(result.top20);
   // 暂停/介绍/大厅每种静止状态各2秒，读真实重画次数与脚本耗时。
   result.idle={};for(const screen of ['pause','intro','lobby']){await ev(page,async(a,screen)=>{a.frozen=false;if(screen==='pause')a.action('pause');if(screen==='intro')await a.showIntro();if(screen==='lobby')a.showLobby();a.__perf.reset();},screen);await page.waitForTimeout(2000);result.idle[screen]=await ev(page,a=>({...a.__perf.summary(1e9),targetFrameRate:cc.game.frameRate}));}
   await ev(page,a=>{a.__perf.destroy();delete a.__perf;});await cdp.detach();await page.close();
  }
 }
 assert.deepEqual(report.errors,[]);
}catch(error){report.failure=error.stack;throw error;}finally{await browser.close();report.browserClosed=true;report.browserProcessesGone=report.browserPids.every(pid=>{try{process.kill(pid,0);return false;}catch{return true;}});await fs.writeFile(path.join(out,'evidence.json'),JSON.stringify(report,null,2));}
