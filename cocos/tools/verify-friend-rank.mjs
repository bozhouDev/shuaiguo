// 只连接已有7456预览；不启动编辑器、不构建，旧预览明确标成待刷新。
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=new URL('../../port/tmp/p6-2/',import.meta.url);await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true}),report={screens:[],errors:[]};
// 所有操作都落在本任务新建的浏览器上下文；不碰用户浏览器存档。
async function app(page,fn,arg){return page.evaluate(({fn,arg})=>(0,eval)('('+fn+')')(cc.director.getScene().getChildByName('Canvas').getChildByName('Boot').getComponent('Boot').app,arg),{fn:fn.toString(),arg});}
try {
 for(const [width,height]of [[375,812],[375,667],[360,780]]) {
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,isMobile:true,hasTouch:true}),row={width,height};
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  await page.goto('http://localhost:7456/?scene=3b08c73f-d17c-4dfc-a45e-854ddae97b2f&debug=1',{waitUntil:'domcontentloaded',timeout:15000});
  await page.waitForFunction(()=>window.cc?.director.getScene()?.getChildByName('Canvas')?.getChildByName('Boot')?.getComponent('Boot')?.app?.ready,{}, {timeout:30000});
  // 预览外壳的工具条隐藏后显式设置真实帧尺寸，避免812截图实际裁掉48px。
  await page.addStyleTag({content:'#__vconsole,#toolbar{display:none!important} #GameDiv{position:fixed!important;left:0!important;top:0!important;width:100vw!important;height:100vh!important}'});
  await page.evaluate(async({width,height})=>{const cc=await System.import('cc');cc.profiler.hideStats();cc.view.setFrameSize(width,height);cc.view.setDesignResolutionSize(width,height,cc.ResolutionPolicy.SHOW_ALL);},{width,height});
  row.fresh=await app(page,a=>{a.frozen=true;a.showLobby();a.render();return !!a.rank&&a.actions.some(v=>v.action==='rank');});
  row.visible=await page.evaluate(()=>({width:cc.view.getVisibleSize().width,height:cc.view.getVisibleSize().height}));
  assert.deepEqual(row.visible,{width,height});
  await page.waitForTimeout(120);row.lobby=`lobby-${width}x${height}${row.fresh?'':'-stale'}.png`;await page.screenshot({path:new URL(row.lobby,out).pathname});
  if(row.fresh){
   const click=async name=>{const b=await app(page,(a,n)=>a.actions.find(v=>v.action===n),name);assert.ok(b,name);await page.touchscreen.tap(b.x+b.w/2,b.y+b.h/2);await page.waitForTimeout(80);};
   await click('rank');row.rank=await app(page,a=>({screen:a.screen,actions:a.actions,selected:a.rank.selected,labels:a.root.getComponentsInChildren(cc.Label).filter(l=>l.node.activeInHierarchy).map(l=>l.string)}));
   assert.equal(row.rank.screen,'rank');assert.ok(row.rank.labels.includes('好友排行只能在微信里看'));assert.equal(row.rank.actions.filter(v=>v.action.startsWith('rank-pick:')).length,5);
   row.rankImage=`rank-${width}x${height}.png`;await page.screenshot({path:new URL(row.rankImage,out).pathname});
   await click('rank-pick:4');assert.equal(await app(page,a=>a.rank.selected),4);await click('rank-go');assert.equal(await app(page,a=>a.screen),'intro');await click('lobby');await click('rank');await click('rank-close');assert.equal(await app(page,a=>a.screen),'lobby');
   row.flow='PASS';
  }else row.pending=['刷新后复拍大厅入口','排行页、五日期、网页提示、关闭和去上班'];
  report.screens.push(row);await page.close();
 }
 assert.deepEqual(report.errors,[]);console.log(JSON.stringify(report,null,2));
}catch(e){report.failure=e.stack;console.error(e);process.exitCode=1;}finally{await fs.writeFile(new URL('preview.json',out),JSON.stringify(report,null,2));await browser.close();}
