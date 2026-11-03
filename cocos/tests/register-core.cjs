// 只补 Node 对 Cocos 无扩展名 TS 导入的解析；源码由 Node 23 自带 strip-types 执行，不转译或修正状态。
const { registerHooks } = require('node:module');
const { pathToFileURL } = require('node:url');
const { resolve } = require('node:path');
const core = pathToFileURL(resolve(__dirname, '../assets/scripts/core') + '/').href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.startsWith(core) && /^\.\.?\//.test(specifier) && !/\.[a-z]+$/i.test(specifier)) {
      return nextResolve(specifier + '.ts', context);
    }
    return nextResolve(specifier, context);
  },
});
