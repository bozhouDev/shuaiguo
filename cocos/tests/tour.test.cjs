// 巡检步骤与计时契约：不启动编辑器、不使用真实时钟或存档。
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const ts = require('/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources/resources/3d/engine/node_modules/typescript');
const file = path.resolve(__dirname,'../assets/scripts/view/Tour.ts'), mod={exports:{}};
new Function('exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(mod.exports);
const {readTour,TourRunner,prepareTourResult}=mod.exports;

test('正式环境不读取巡检全局；all有固定种子和全部所需画面',()=>{
  assert.deepEqual(readTour(false,()=>{throw Error('release读取了全局');}),[]);
  const steps=readTour(true,()=>'all');
  assert.equal(steps.length,26);
  assert.deepEqual(steps.filter(s=>s.kind==='intro').map(s=>s.level),[1,2,3,4,5]);
  assert.deepEqual(steps.filter(s=>s.kind==='tutorial').map(s=>s.step),[1,3]);
  assert.deepEqual(steps.filter(s=>s.kind==='match').map(s=>[s.level,s.seconds]),[[3,60],[5,150]]);
  assert.equal(steps.every(s=>s.seed===1001&&s.hold===4),true);
  assert.deepEqual(steps.filter(s=>s.kind==='result').map(s=>s.result),['three','one','fail','crush','three']);
  assert.deepEqual(steps.filter(s=>s.kind==='praise').map(s=>s.praise),['calm','parry','rankup']);
  steps[0].hold=10;assert.equal(readTour(true,()=>'all')[0].hold,4);
});
test('自定义步骤规范化，非法名称/时间/关卡不开始巡检',()=>{
  assert.deepEqual(readTour(true,()=>[{kind:'intro',level:5,hold:.2,seed:0}]),[{kind:'intro',level:5,hold:.2,seed:0,name:'intro-5'}]);
  for(const input of ['nope',[{kind:'other'}],[{kind:'lobby',hold:0}],[{kind:'intro',level:6}],[{kind:'tutorial',step:2}],[{kind:'result',result:'unknown'}]])assert.throws(()=>readTour(true,()=>input));
});
test('页面异步就绪才记录步骤和开始hold；不重入、不积累加载时间，末步停满才done',async()=>{
  const steps=readTour(true,()=>[{kind:'lobby',hold:1},{kind:'intro',level:5,hold:2}]);
  const shown=[],logs=[];let ready;
  const runner=new TourRunner(steps,s=>{shown.push(s.name);return new Promise(r=>{ready=r;});},(...v)=>logs.push(v));
  const start=runner.start();await runner.advance(20);assert.deepEqual(logs,[]);ready();await start;
  assert.deepEqual(logs,[['[SG TOUR]',1,'lobby']]);await runner.advance(.99);assert.equal(shown.length,1);
  const next=runner.advance(.01);await runner.advance(20);assert.equal(shown.length,2);ready();await next;
  await runner.advance(1.99);assert.equal(runner.done,false);await runner.advance(.01);
  assert.equal(runner.done,true);assert.deepEqual(logs.at(-1),['[SG TOUR] done']);await runner.advance(20);assert.equal(shown.length,2);
});
test('销毁取消异步页面；失败不假报done、不继续后续步骤',async()=>{
  let ready;const logs=[];
  const runner=new TourRunner(readTour(true,()=>'all'),()=>new Promise(r=>{ready=r;}),(...v)=>logs.push(v));
  const pending=runner.start();runner.stop();ready();await pending;await runner.advance(20);assert.deepEqual(logs,[]);
  const broken=new TourRunner(readTour(true,()=>'all'),()=>{throw Error('加载失败');},(...v)=>logs.push(v));
  await assert.rejects(broken.start(),/加载失败/);assert.equal(broken.done,false);await broken.advance(20);assert.deepEqual(logs,[]);
});
test('结算夹具复用P4-1数值，真实core计算三星/一星/失败/压垮/证书与复活',()=>{
  require('./register-core.cjs');const {Match}=require('../assets/scripts/core/match.ts');
  for(const [result,level,stars,kind]of [['three',0,3,'brag'],['one',0,1,'brag'],['fail',1,0,'blame'],['crush',1,0,'blame'],['three',4,3,'cert']]){
    const m=new Match({level,seed:1001,auto:true});prepareTourResult(m,result);const r=m.calculateResult(result==='crush'?'crushed':'time');
    assert.equal(r.stars,stars);assert.equal(r.shareInfo.kind,kind);
    if(result==='crush'){assert.equal(m.potsOf(m.S.player),12);m.revive();assert.equal(m.potsOf(m.S.player),6);assert.equal(m.S.revived,true);}
  }
});
