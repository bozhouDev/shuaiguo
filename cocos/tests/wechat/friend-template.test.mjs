import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),install='/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources';
const ts=require(install+'/resources/3d/engine/node_modules/typescript'),extra=require(install+'/resources/3d/engine/node_modules/fs-extra');
// 只读asar索引和实际hook源码；不启动编辑器，也不调用任何构建入口。
function hookSource() {
 const fd=fs.openSync(install+'/app.asar','r');
 try {const header=Buffer.alloc(16);fs.readSync(fd,header,0,16,0);const size=header.readUInt32LE(12),json=Buffer.alloc(size);fs.readSync(fd,json,0,size,16);let entry=JSON.parse(json);for(const key of 'platforms/internal/wechatgame/dist/hooks.js'.split('/'))entry=entry.files[key];const data=Buffer.alloc(entry.size);fs.readSync(fd,data,0,data.length,8+header.readUInt32LE(4)+Number(entry.offset));return data.toString();}finally{fs.closeSync(fd);}
}
test('3.8.8构建源码顺序及独立目录覆盖/JSON合并集成：自定义开放数据域每次覆盖默认模板',()=>{
 const source=hookSource(),ast=ts.createSourceFile('hooks.js',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),functions=new Map(ast.statements.filter(ts.isFunctionDeclaration).map(n=>[n.name.text,n.getText(ast)]));
 const init=functions.get('onAfterInit'),build=functions.get('_buildWeChatTemplate');
 assert.match(init,/buildOpenDataContextTemplate/);assert.match(init,/fs_extra_1\.copySync\(i,a\)/);assert.match(functions.get('onAfterBuild'),/_buildWeChatTemplate/);
 const copy='fs_extra_1.copySync(userTemplateDir,u.paths.dir)';assert.ok(build.indexOf(copy)>0);assert.ok(build.indexOf(copy)<build.indexOf('buildGameJson(n,'));
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'sg-friend-template-'));
 try {
  const out=path.join(root,'output'),stock=path.join(root,'stock'),template=new URL('../../build-templates/wechatgame/',import.meta.url).pathname;
  fs.mkdirSync(out);fs.mkdirSync(stock);fs.writeFileSync(path.join(stock,'game.json'),JSON.stringify({deviceOrientation:'portrait',other:'keep'}));
  // 执行实际hook中的同一个copySync语句和buildGameJson函数；模拟默认生成，绝不编译项目。
  const sandbox={fs_extra_1:extra,path_1:path,userTemplateDir:template,u:{paths:{dir:out}},OPEN_DATA_CONTEXT_ROOT:'openDataContext'};
  vm.runInNewContext(functions.get('buildGameJson'),sandbox);
  for(let i=0;i<2;i++){
   extra.outputFileSync(path.join(out,'openDataContext/index.js'),'default-'+i);
   vm.runInNewContext(copy,sandbox);
   sandbox.buildGameJson(stock,out,{packages:{wechatgame:{orientation:'portrait',separateEngine:false,buildOpenDataContextTemplate:false}}},{bundles:[]});
   assert.equal(fs.readFileSync(path.join(out,'openDataContext/index.js'),'utf8'),fs.readFileSync(path.join(template,'openDataContext/index.js'),'utf8'));
   const game=extra.readJSONSync(path.join(out,'game.json'));assert.equal(game.openDataContext,'openDataContext');assert.equal(game.other,'keep');
  }
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
