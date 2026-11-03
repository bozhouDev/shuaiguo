// 仅在内存转译真实TS源码（包括既有参数属性），不启动编辑器、不写temp或library。
const {registerHooks}=require('node:module');
const {readFileSync}=require('node:fs');
const ts=require('/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources/resources/3d/engine/node_modules/typescript');
registerHooks({
  resolve(specifier,context,next){if(context.parentURL?.includes('/assets/scripts/')&&/^\.\.?\//.test(specifier)&&! /\.[a-z]+$/i.test(specifier))return next(specifier+'.ts',context);return next(specifier,context);},
  load(url,context,next){if(url.includes('/assets/scripts/')&&url.endsWith('.ts'))return {format:'commonjs',source:ts.transpileModule(readFileSync(new URL(url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,shortCircuit:true};return next(url,context);},
});
