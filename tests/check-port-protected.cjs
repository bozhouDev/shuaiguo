// 验证冻结原型、旧录像及本卡禁止触碰的 Cocos 目录，按 Git blob 内容哈希逐文件检查。
const fs = require('node:fs'),
  path = require('node:path'),
  crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const roots = [
  'js',
  'css',
  'assets',
  'index.html',
  'cocos/assets/scripts/view',
  'cocos/assets/scripts/platform',
  'cocos/assets/scenes',
  'cocos/assets/resources'
];
const entries = execFileSync('git', ['ls-tree', '-rz', 'HEAD', '--', ...roots, 'tests/golden'], { cwd: root })
  .toString()
  .split('\0')
  .filter(Boolean);
const expected = new Set();
let checked = 0;
for (const entry of entries) {
  const [head, file] = entry.split('\t');
  if (
    file.startsWith('tests/golden/') &&
    !/^tests\/golden\/(level-\d-seed-\d+\.json\.gz|manifest\.json)$/.test(file)
  )
    continue;
  expected.add(file);
  const data = fs.readFileSync(path.join(root, file));
  const actual = crypto.createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex');
  if (actual !== head.split(' ')[2]) throw Error('受保护文件内容变化：' + file);
  checked++;
}
// 目录内的增删同样失败，不把未跟踪的新资源漏掉。
// 递归核对目录清单，文件删除由上面的读取报错，新增在这里报错。
function walk(dir) {
  for (const name of fs.readdirSync(path.join(root, dir))) {
    const file = dir + '/' + name;
    if (fs.statSync(path.join(root, file)).isDirectory()) walk(file);
    else if (!expected.has(file)) throw Error('受保护目录新增文件：' + file);
  }
}
for (const dir of roots.filter((p) => p !== 'index.html')) walk(dir);
console.log(`PASS 受保护文件 ${checked} 个，内容变化 0，保护目录无增删（相对 HEAD）`);
