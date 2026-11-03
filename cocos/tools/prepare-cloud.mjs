import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const require=createRequire(import.meta.url);
const ts=require('/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources/resources/3d/engine/node_modules/typescript');
export const root=fileURLToPath(new URL('../',import.meta.url));
export const names=['config','save','track','rank'];
// 共享逻辑只有core一个来源；编译为云函数Node可执行的CommonJS，无运行时TS/Cocos依赖。
export function prepareCloud(check=false){
  for(const name of names){const dir=path.join(root,'cloudfunctions',name);mkdirSync(dir,{recursive:true});
    const files={'runtime.cjs':readFileSync(path.join(root,'cloudfunctions/runtime.cjs'),'utf8')};
    for(const module of ['levels','config','progress','remote-config'])files[module+'.js']= '// 自动生成：npm run cloud:prepare；勿手改。\n'+ts.transpileModule(readFileSync(path.join(root,'assets/scripts/core',module+'.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2019,module:ts.ModuleKind.CommonJS}}).outputText;
    for(const [file,content]of Object.entries(files)){const target=path.join(dir,file);if(check){if(readFileSync(target,'utf8')!==content)throw Error(`云共享文件过期：${name}/${file}`);}else writeFileSync(target,content);}
  }
}
if(process.argv[1]===fileURLToPath(import.meta.url)){prepareCloud(process.argv.includes('--check'));console.log('PASS 云共享逻辑'+(process.argv.includes('--check')?'未漂移':'已生成'));}
