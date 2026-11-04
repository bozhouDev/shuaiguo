// 只使用现有7456预览引擎；可选内存源码覆盖，不操作编辑器、不改服务器/构建文件。
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),ts=require('/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources/resources/3d/engine/node_modules/typescript');
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const quick=process.argv.includes('--quick');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=path.join(root,'port/tmp/p7-1',quick?'web-tour-quick':'web-tour');await fs.mkdir(out,{recursive:true});
const overlay=process.argv.includes('--source-overlay'),proof={overlay,quick,errors:[],steps:[],states:[],fresh:false};
const browser=await chromium.launch({headless:true});
// 读取当前完整TS图，只在本任务页面内存转译。此证据不是Creator编译产物验收。
async function sourceModules(dir,base=dir){const result={};for(const entry of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())Object.assign(result,await sourceModules(file,base));else if(entry.name.endsWith('.ts')&&entry.name!=='Boot.ts')result[path.relative(base,file)]=ts.transpileModule(await fs.readFile(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;}return result;}
try {
 const page=await browser.newPage({viewport:{width:375,height:812},deviceScaleFactor:1,isMobile:true,hasTouch:true});page.setDefaultTimeout(60000);
 page.on('pageerror',error=>proof.errors.push(error.message));
 page.on('console',m=>{if(m.type()==='error')proof.errors.push(m.text());if(m.text().startsWith('[SG TOUR]'))console.log(m.text());});
 await page.addInitScript(()=>{
   globalThis.__SG_TOUR='all';globalThis.__tourSteps=[];globalThis.__tourStates=[];globalThis.__tourDone=false;globalThis.__tourBefore=JSON.stringify({...localStorage});
   const log=console.log.bind(console);console.log=(...values)=>{log(...values);if(values[0]==='[SG TOUR]'){const a=globalThis.cc.director.getScene().getChildByName('Canvas').getChildByName('Boot').getComponent('Boot').app;globalThis.__tourSteps.push({number:values[1],name:values[2],screen:a.screen,panel:a.panel,selected:a.selected,stars:a.result?.stars,tutorial:a.world?.match.S.tut?.i,revived:a.world?.match.S.revived,at:performance.now()});}if(values[0]==='[SG TOUR STATE]')globalThis.__tourStates.push(values.slice(1));if(values[0]==='[SG TOUR] done')globalThis.__tourDone=true;};
 });
 await page.goto('http://localhost:7456/?scene=3b08c73f-d17c-4dfc-a45e-854ddae97b2f&debug=1');
 await page.waitForFunction(()=>globalThis.cc?.director.getScene()?.getChildByName('Canvas')?.getChildByName('Boot')?.getComponent('Boot')?.app?.ready);
 proof.fresh=await page.evaluate(()=>typeof cc.director.getScene().getChildByName('Canvas').getChildByName('Boot').getComponent('Boot').app.showTourStep==='function');
 await fs.writeFile(path.join(out,'freshness.json'),JSON.stringify({fresh:proof.fresh,overlay},null,2));
 if(!proof.fresh&&!overlay)throw Error('7456未加载巡检源码，需要刷新编辑器；未用旧预览冒充通过');
 if(overlay){
  const modules=await sourceModules(path.join(root,'cocos/assets/scripts'));
  await page.evaluate(async ({modules,quick})=>{
    const cc=await System.import('cc'),cache={};
    // 相对模块名在脚本目录内解析，Cocos边界使用预览中正在运行的真实引擎。
    const load=id=>{if(cache[id])return cache[id].exports;const mod={exports:{}};cache[id]=mod;const localRequire=s=>{if(s==='cc')return cc;if(s==='cc/env')return {PREVIEW:true};const parts=id.split('/');parts.pop();for(const part of s.split('/')){if(part==='..')parts.pop();else if(part!=='.')parts.push(part);}let target=parts.join('/');if(!target.endsWith('.ts'))target+='.ts';return load(target);};new Function('require','module','exports',modules[id])(localRequire,mod,mod.exports);return mod.exports;};
    const boot=cc.director.getScene().getChildByName('Canvas').getChildByName('Boot').getComponent('Boot');const old=boot.app;boot.app=undefined;old.destroy();await new Promise(requestAnimationFrame);
    if(quick)globalThis.__SG_TOUR=load('view/Tour.ts').readTour(true,()=>'all').map(s=>({...s,hold:.3}));
    const {AppView}=load('view/AppView.ts');boot.app=new AppView(boot.node);await boot.app.start();cc.profiler.hideStats();
  },{modules,quick});
 }
 await page.addStyleTag({content:'#__vconsole{display:none!important}'});
 // 默认4秒全部走完；没有鼠标/键盘操作。每页截图只作流程证据，不进行原型差异验收。
 let count=0;const deadline=Date.now()+240000;
 while(!await page.evaluate(()=>globalThis.__tourDone===true)){
   if(Date.now()>deadline)throw Error('巡检超过240秒仍未结束');
   if(proof.errors.length)throw Error(proof.errors.join('\n'));
   const steps=await page.evaluate(()=>globalThis.__tourSteps||[]);
   if(steps.length>count){count=steps.length;const s=steps.at(-1);if([1,10,13,20,24,26].includes(s.number))await page.screenshot({path:path.join(out,s.name+'.png')});}
   await page.waitForTimeout(200);
 }
 proof.steps=await page.evaluate(()=>globalThis.__tourSteps);proof.states=await page.evaluate(()=>globalThis.__tourStates);
 assert.equal(proof.steps.length,26);assert.deepEqual(proof.steps.map(s=>s.number),Array.from({length:26},(_,i)=>i+1));
 assert.equal(proof.steps.find(s=>s.name==='result-3star').stars,3);assert.equal(proof.steps.find(s=>s.name==='result-1star').stars,1);
 assert.equal(proof.steps.find(s=>s.name==='result-failed').stars,0);assert.equal(proof.steps.find(s=>s.name==='result-crushed').stars,0);
 assert.equal(proof.steps.find(s=>s.name==='result-friday-cert').stars,3);assert.equal(proof.steps.find(s=>s.name==='revived').revived,true);
 assert.equal(proof.steps.at(-1).screen,'rank');assert.equal(await page.evaluate(()=>globalThis.__tourBefore===JSON.stringify({...localStorage})),true);
 proof.release=await page.evaluate(async()=>{
   const boot=cc.director.getScene().getChildByName('Canvas').getChildByName('Boot').getComponent('Boot'),Constructor=boot.app.constructor;
   const previous=boot.app;boot.app=undefined;previous.destroy();await new Promise(requestAnimationFrame);history.replaceState(null,'',location.pathname+'?debug=0');let reads=0;
   Object.defineProperty(globalThis,'__SG_TOUR',{configurable:true,get(){reads++;throw Error('关闭debug后读取了巡检全局');}});
   boot.app=new Constructor(boot.node);await boot.app.start();return {reads,active:boot.app.tourActive,screen:boot.app.screen};
 });
 assert.deepEqual(proof.release,{reads:0,active:false,screen:'lobby'});
 assert.deepEqual(proof.errors,[]);proof.pass=true;console.log('PASS 26/26巡检步骤、真实引擎绘制、固定夹具、无本地写入、console errors 0；source-overlay='+overlay);
} catch(error){proof.failure=error.stack;console.error(error);process.exitCode=1;}finally{await fs.writeFile(path.join(out,'evidence.json'),JSON.stringify(proof,null,2));await browser.close();}
