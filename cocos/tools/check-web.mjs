// 日常只读预览检查：沿用已打开编辑器，不启动Cocos或开发服务器。
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const tmp=fileURLToPath(new URL('../../port/tmp/',import.meta.url));
const base=process.argv[2]||'http://localhost:7456/?scene=3b08c73f-d17c-4dfc-a45e-854ddae97b2f';
const artifact=process.argv[3]||'editor-preview';assert.match(artifact,/^[a-zA-Z0-9_-]+$/);await mkdir(tmp,{recursive:true});
const browser=await chromium.launch({headless:true});const result={errors:[],warnings:[],checks:{}};
try {
 const page=await browser.newPage({viewport:{width:375,height:812},deviceScaleFactor:1,isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36'});
 page.on('pageerror',e=>result.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')result.errors.push(m.text());if(m.type()==='warning')result.warnings.push(m.text());});
 // 调试参数仅在编辑器web预览生效，普通网页包传入后仍按真实主循环运行。
 const url=new URL(base);url.searchParams.set('level','4');url.searchParams.set('seed','1001');url.searchParams.set('auto','1');url.searchParams.set('freeze','120');await page.goto(url.href);
 await page.waitForFunction(()=>window.cc?.director.getScene()?.getChildByName('Canvas')?.getChildByName('Boot')?.getComponent('Boot')?.app?.ready,{},{timeout:60000});
 await page.evaluate(async()=>{const a=cc.director.getScene().getChildByName('Canvas').getChildByName('Boot').getComponent('Boot').app;await a.startGame();a.frozen=true;});
 await page.waitForFunction(()=>window.cc?.director.getScene()?.getChildByName('Canvas')?.getChildByName('Boot')?.getComponent('Boot')?.world?.ready,{},{timeout:60000});
 result.checks=await page.evaluate(async()=>{const cc=await System.import('cc');cc.profiler.hideStats();const w=cc.director.getScene().getChildByName('Canvas').getChildByName('Boot').getComponent('Boot').world;
 const textures=[...new Set(Object.values(w.assets.spr).map(p=>p.frame.texture))];return {visible:cc.view.getVisibleSize(),steps:w.steps,characters:w.match.S.agents.length,leaders:w.match.S.leaders.length,sprites:Object.keys(w.assets.spr).length,nearest:textures.every(t=>t.getSamplerInfo().minFilter===cc.Texture2D.Filter.NEAREST&&t.getSamplerInfo().magFilter===cc.Texture2D.Filter.NEAREST),fonts:[w.assets.title,w.assets.body700,w.assets.body900].map(f=>({name:f.name,url:f.nativeUrl})),labels:cc.director.getScene().getComponentsInChildren(cc.Label).length,pools:w.surfaces.map(s=>s.stats())};});
 assert.equal(result.checks.visible.width,375);assert.equal(result.checks.visible.height,812);assert.equal(result.checks.nearest,true);assert.equal(result.checks.fonts.length,3);assert.ok(result.checks.sprites>=225);assert.ok(result.checks.labels>0);assert.deepEqual(result.errors,[]);
 await page.addStyleTag({content:'#__vconsole{display:none!important}'});await page.screenshot({path:`${tmp}${artifact}.png`});console.log('PASS 375×812：对局世界、图集最近邻、三款TTF、文字池；console errors 0');
} finally {await writeFile(`${tmp}${artifact}-check.json`,JSON.stringify(result,null,2));await browser.close();}
