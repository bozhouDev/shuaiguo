// 录像缓存契约：完整 JSON 哈希、清单只读，以及错误哈希不能写成新基准。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const { recordHash } = require('./record-extra.cjs');

// 键顺序不影响哈希；原始浮点、数组顺序和逐帧摘要之外的数据仍必须受到保护。
test('完整录像哈希规范化对象键，保留原始数值和全部字段', () => {
  const record = { inputs: [[true, 0.123456, 1, 0]], frames: [{ hash: 'same' }], progress: { unlocked: 1 } };
  assert.equal(
    recordHash(record),
    recordHash({ progress: { unlocked: 1 }, frames: [{ hash: 'same' }], inputs: record.inputs })
  );
  for (const changed of [
    { ...record, inputs: [[true, 0.123457, 1, 0]] },
    { ...record, progress: { unlocked: 2 } },
    { ...record, events: [] }
  ])
    assert.notEqual(recordHash(record), recordHash(changed));
  assert.notEqual(recordHash([1, 2]), recordHash([2, 1]));
});

// 两个真实 CLI 都重放原型；故意提供错误清单哈希，确认失败发生在写缓存之前。
for (const script of ['record-extra.cjs', 'verify-extra.cjs']) {
  test(`${script} 拒绝错误哈希，保留清单且不写入缺失录像或覆盖坏缓存`, () => {
    const root = path.resolve(__dirname, '../..'),
      scratchRoot = path.join(root, 'port/tmp');
    fs.mkdirSync(scratchRoot, { recursive: true });
    const scratch = fs.mkdtempSync(path.join(scratchRoot, 'p2-2-hash-test-'));
    const file = `tutorial/${path.basename(scratch)}.json.gz`,
      target = path.join(__dirname, file);
    const manifestFile = path.join(scratch, 'manifest.json');
    const manifest = JSON.stringify({
      cases: [
        {
          config: { kind: 'tutorial', level: 0, seed: 3002, aim: true, skip: true },
          file,
          sha256: '0'.repeat(64)
        }
      ]
    });
    fs.writeFileSync(manifestFile, manifest);
    try {
      const result = spawnSync(process.execPath, [path.join(__dirname, script), '--manifest', manifestFile], {
        cwd: root,
        encoding: 'utf8'
      });
      assert.equal(result.status, 1, result.stderr);
      assert.match(result.stderr, /录像 SHA-256 不一致/);
      assert.equal(fs.readFileSync(manifestFile, 'utf8'), manifest);
      assert.equal(fs.existsSync(target), false);

      // 已存在的错误缓存同样不能复用，也不能悄悄用重录覆盖。
      const corrupt = zlib.gzipSync(JSON.stringify({ corrupted: true }));
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, corrupt);
      const cached = spawnSync(
        process.execPath,
        [path.join(__dirname, script), '--manifest', manifestFile, '--resume'],
        {
          cwd: root,
          encoding: 'utf8'
        }
      );
      assert.equal(cached.status, 1, cached.stderr);
      assert.match(cached.stderr, /录像 SHA-256 不一致/);
      assert.equal(fs.readFileSync(manifestFile, 'utf8'), manifest);
      assert.deepEqual(fs.readFileSync(target), corrupt);
    } finally {
      fs.rmSync(target, { force: true });
      fs.rmSync(scratch, { recursive: true, force: true });
    }
  });
}
