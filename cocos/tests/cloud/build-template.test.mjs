import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
// 只模拟官方JSON模板合并，读取现有包；不构建、不启动Creator、不改现有产物。
test('每次微信构建模板合并后保持AppID，云函数相对路径解析到源码目录',()=>{
  const template=JSON.parse(readFileSync(path.join(root,'build-templates/wechatgame/project.config.json'),'utf8'));
  const project=path.join(root,'build/wechatgame-001');
  // 干净检出没有build也可跑：本机存在旧产物时额外使用实际配置作合并基底。
  const built=path.join(project,'project.config.json');
  const existing=existsSync(built)?JSON.parse(readFileSync(built,'utf8')):{appid:'wx15e416b0643d90af',compileType:'game'};
  const merged={...existing,...template};
  assert.equal(merged.appid,'wx15e416b0643d90af');assert.equal(merged.compileType,'game');
  const functions=path.resolve(project,merged.cloudfunctionRoot);assert.equal(functions,path.join(root,'cloudfunctions'));
  for(const n of ['config','save','track','rank'])for(const f of ['index.js','package.json','runtime.cjs','progress.js','remote-config.js','levels.js','config.js'])assert.equal(existsSync(path.join(functions,n,f)),true,n+'/'+f);
});
