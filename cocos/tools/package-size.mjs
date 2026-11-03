import { readdir, readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const project = fileURLToPath(new URL('../', import.meta.url));
const root = path.resolve(project, process.argv[2] || 'build/wechatgame-001');
const main = JSON.parse(await readFile(path.join(root, 'assets/main/config.json'), 'utf8'));
if (!Object.hasOwn(main.scenes, 'db://assets/scenes/Boot.scene')) throw new Error('构建产物缺少 Boot 场景，不能作为有效主包统计');
// 按磁盘原始字节统计；当前没有远程包或分包，整个目录均作为主包上界。
async function bytes(dir) {
  let sum = 0;
  for (const name of await readdir(dir)) {
    const target = path.join(dir, name);
    const info = await stat(target);
    sum += info.isDirectory() ? await bytes(target) : info.size;
  }
  return sum;
}
const total = await bytes(root);
const engine = await bytes(path.join(root, 'cocos-js'));
const assets = await bytes(path.join(root, 'assets/resources'));
const builtin = await bytes(path.join(root, 'assets/internal'));
// 列出一级目录，方便下次编辑器构建后比较；不是微信上传压缩包的计费或审核体积。
const entries = {};
for (const name of await readdir(root)) {
  const target = path.join(root, name);
  const info = await stat(target);
  entries[name] = info.isDirectory() ? await bytes(target) : info.size;
}
console.log(JSON.stringify({ directory: root, basis: '未压缩目录字节；无分包时作为主包上界，微信上传体积待开发者工具验证', unit: 'bytes', total, engine, validationAssets: assets, builtinAssets: builtin, adaptersSceneAndOther: total - engine - assets - builtin, MiB: total / 1024 ** 2, withinTask4MiBBudget: total <= 4 * 1024 ** 2, entries }, null, 2));
