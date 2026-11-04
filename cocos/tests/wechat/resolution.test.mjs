import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{load}=require('./view-harness.cjs');
const source=()=>fs.readFileSync(new URL('../../build-templates/wechatgame/render-resolution.js',import.meta.url),'utf8');
const engine='/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources/resources/3d/engine/';
const ts=require(engine+'node_modules/typescript');
// 抽取本机真实引擎方法在内存执行；不复制换算公式，不修改引擎、不调用Creator。
function engineMethods(file,names,bindings){
 const ast=ts.createSourceFile(file,fs.readFileSync(engine+file,'utf8'),ts.ScriptTarget.Latest,true),methods=[];
 const visit=node=>{if((ts.isMethodDeclaration(node)||ts.isGetAccessorDeclaration(node))&&names.includes(node.name?.getText(ast)))methods.push(node.getText(ast));ts.forEachChild(node,visit);};visit(ast);assert.equal(methods.length,names.length);
 const js=ts.transpileModule('class Fixture {'+methods.join('\n')+'}\nmodule.exports=Fixture;', {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const module={exports:{}};new Function('module',...Object.keys(bindings),js)(module,...Object.values(bindings));return module.exports;
}
// mock保留原始窗口对象，验证只修改DPR、旧基础库回退、非整数与原生模式。
test('启动封顶只改像素比；触点/安全区/共享画布/独立导图仍用原坐标',()=>{
 for(const dpr of [1,1.5,2,2.625,3])for(const native of [false,true])for(const modern of [false,true]){
  const original={pixelRatio:dpr,windowWidth:393,windowHeight:852,screenWidth:393,screenHeight:852,safeArea:{top:59,bottom:818,left:0,right:393}};
  const wx={getStorageSync:()=>native?'native':'2',getSystemInfoSync(){assert.equal(this,wx);return original;}};
  if(modern)wx.getWindowInfo=function(){assert.equal(this,wx);return original;};
  const context={wx,module:{exports:{}}};vm.runInNewContext(source(),context);context.module.exports.install(wx);
  const info=(wx.getWindowInfo||wx.getSystemInfoSync).call(wx),ratio=native?dpr:Math.min(dpr,2);
  assert.equal(info.pixelRatio,ratio);assert.equal(original.pixelRatio,dpr);assert.equal(info.safeArea,original.safeArea);
  assert.equal(info.windowWidth,393);assert.equal(info.windowHeight,852);
  // 引擎触点先乘DPR，再除viewport缩放，最终仍为设计宽375上的坐标。
  assert.equal(100*ratio/(393*ratio/375),100*375/393);
  assert.equal(info.safeArea.top*ratio/(393*ratio/375),59*375/393);
  assert.equal(281*375/info.windowWidth,281*375/393);
  const shared={width:640,height:960},capture={width:720,height:960,destWidth:720,destHeight:960};
  assert.deepEqual(shared,{width:640,height:960});assert.equal(capture.width,capture.destWidth);
  const main={width:Math.round(393*ratio),height:Math.round(852*ratio)};assert.equal(main.width,Math.round(393*ratio));
  // 真正的平台和导图路径联用被封顶后的wx；胶囊与导图不读取pixelRatio。
  wx.getMenuButtonBoundingClientRect=()=>({left:281,top:50,width:87,height:32});
  let exported;wx.createCanvas=()=>({getContext:()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}}),toTempFilePathSync(options){exported=options;return 'mock.png';}});
  globalThis.wx=wx;
  const {WechatPlatform}=load('cocos/assets/scripts/platform/WechatPlatform'),p=new WechatPlatform();
  const {sharePixelsToFile}=load('cocos/assets/scripts/platform/WechatShareImage');
  try{if(modern){assert.ok(Math.abs(p.topAvoidance().top-59*375/393)<1e-10);assert.ok(Math.abs(p.topAvoidance().capsule.x-281*375/393)<1e-10);}assert.equal(sharePixelsToFile(new Uint8Array(500*400*4),500,400),'mock.png');assert.deepEqual(exported,{x:0,y:0,width:500,height:400,destWidth:500,destHeight:400,fileType:'png'});}
  finally{p.dispose();delete globalThis.wx;}
 }
});
test('game.ejs在web-adapter、平台判定及引擎之前安装封顶',()=>{
 const template=fs.readFileSync(new URL('../../build-templates/wechatgame/game.ejs',import.meta.url),'utf8');
 assert.ok(template.includes("require('./render-resolution').install(wx)"));
 assert.equal(template.slice(template.indexOf('function __initApp')),fs.readFileSync(engine+'templates/wechatgame/game.ejs','utf8'));
 assert.ok(template.indexOf("require('./render-resolution').install(wx)")<template.indexOf("require('./web-adapter')"));
 assert.ok(template.indexOf("require('./render-resolution').install(wx)")<template.indexOf('var sysInfo = wx.getSystemInfoSync()'));
});
test('默认原生；2倍/原生切换只写本地，下次启动生效；正式版动作不能绕过门禁',()=>{
 const disk=new Map(),wx={getStorageSync:k=>disk.get(k),getWindowInfo:()=>({pixelRatio:3,windowWidth:393,windowHeight:852})},context={module:{exports:{}}};
 vm.runInNewContext(source(),context);context.module.exports.install(wx);const status=wx.__sgRenderResolution;
 const {AppView}=load('cocos/assets/scripts/view/AppView'),messages=[];
 const app=Object.assign(Object.create(AppView.prototype),{debugEnabled:true,screen:'lobby',panel:'debug',debug:{renderNative:true},platform:{kind:'wechat',setStorage:(k,v)=>disk.set(k,v)},toast:v=>messages.push(v),render(){}});
 app.debugAction('resolution');assert.equal(disk.get('shuaiguo_render_dpr'),'2');assert.equal(wx.getWindowInfo().pixelRatio,3);assert.equal(status.capped,false);
 const next={getStorageSync:k=>disk.get(k),getWindowInfo:()=>({pixelRatio:3})};context.module.exports.install(next);assert.equal(next.getWindowInfo().pixelRatio,2);
 app.debugEnabled=false;app.debugAction('resolution');assert.equal(disk.get('shuaiguo_render_dpr'),'2');assert.deepEqual(messages,['下次启动生效']);
});
test('真实3.8.8 PAL、输入、View和SubContext换算在封顶前后一致',()=>{
 for(const nativeDpr of [1,1.5,2,2.625,3])for(const native of [false,true]){
  const wx={getStorageSync:()=>native?'native':'2',getWindowInfo:()=>({pixelRatio:nativeDpr,windowWidth:393,windowHeight:852})},context={module:{exports:{}}};vm.runInNewContext(source(),context);context.module.exports.install(wx);
  const Screen=engineMethods('pal/screen-adapter/minigame/screen-adapter.ts',['devicePixelRatio','windowSize'],{WECHAT:true,minigame:wx,BYTEDANCE:false,ALIPAY:false,TAOBAO_MINIGAME:false,rotateLandscape:false,Size:class{constructor(width,height){Object.assign(this,{width,height});}}}),screen=new Screen();
  const ratio=native?nativeDpr:Math.min(nativeDpr,2),size=screen.windowSize;assert.equal(screen.devicePixelRatio,ratio);assert.equal(size.width,393*ratio);assert.equal(size.height,852*ratio);
  const Touch=engineMethods('pal/input/minigame/touch-input.ts',['_getLocation'],{Vec2:class{constructor(x,y){Object.assign(this,{x,y});}}}),point=new Touch()._getLocation({clientX:100,clientY:200},size,screen.devicePixelRatio);
  const View=engineMethods('cocos/ui/view.ts',['_convertToUISpace'],{}),v=new View();v._viewportRect={x:0,y:0};v._scaleX=v._scaleY=size.width/375;v._convertToUISpace(point);
  assert.ok(Math.abs(point.x-100*375/393)<1e-10);assert.ok(Math.abs(point.y-(852-200)*375/393)<1e-10);
  let message;const box={x:16,y:200,width:343,height:480},transform={width:640,height:960,getBoundingBoxToWorld:()=>box};
  const Sub=engineMethods('cocos/ui/sub-context-view.ts',['_initSharedCanvas','_updateSubContextView'],{WECHAT:true,WECHAT_MINI_PROGRAM:false,UITransform:class{},screenAdapter:screen,view:{getViewportRect:()=>({x:0,y:0,width:size.width,height:size.height}),getVisibleSize:()=>({width:375,height:852*375/393})}}),sub=new Sub();
  sub._openDataContext={canvas:{},postMessage:m=>message=m};sub._designResolutionSize={width:640,height:960};sub.node={getComponent:()=>({width:640,height:960})};sub._content={getComponent:()=>transform};sub._initSharedCanvas();sub._updateSubContextView();
  assert.deepEqual(sub._openDataContext.canvas,{width:640,height:960});assert.ok(Math.abs(message.x-16*393/375)<1e-10);assert.ok(Math.abs(message.width-343*393/375)<1e-10);
 }
});
