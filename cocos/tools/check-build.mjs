import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.resolve(root, process.argv[2] || 'build/wechatgame-001');

// 3.8.8 CLI 构建会触发 importer 注册竞态并损坏 meta，清缓存也不能保证规避。
// 只由泊舟在已打开的编辑器构建；本脚本只读验包，绝不启动 Cocos 或删除缓存。
async function checkMetas(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) await checkMetas(target);
    else if (entry.name.endsWith('.meta')) {
      const meta = JSON.parse(await readFile(target, 'utf8'));
      assert.notEqual(meta.importer, '*', `meta 已损坏：${target}；恢复正确 importer/版本并保留 UUID`);
    }
  }
}
await checkMetas(path.join(root, 'assets'));
const main = JSON.parse(await readFile(path.join(output, 'assets/main/config.json'), 'utf8'));
const resources = JSON.parse(await readFile(path.join(output, 'assets/resources/config.json'), 'utf8'));
assert.ok(Object.hasOwn(main.scenes, 'db://assets/scenes/Boot.scene'), '缺少 Boot 场景');
for (const name of ['player_normal', 'title', 'body', 'ui_click']) {
  assert.ok(Object.values(resources.paths).some((entry) => entry[0] === name), `资源缺失：${name}`);
}
if (path.basename(output).startsWith('wechatgame')) {
  const config = JSON.parse(await readFile(path.join(output, 'project.config.json'), 'utf8'));
  assert.equal(config.appid, 'wx15e416b0643d90af', '微信包 AppID 不符');
  assert.equal(config.compileType, 'game', '必须为小游戏工程');
}
// 压缩后函数名可能消失，运行证据交给浏览器和开发者工具检查。
console.log(`PASS ${output}：meta 健康，Boot 场景、角色、两款字体、音效齐全，平台配置通过`);
