// 静态检查：微信小游戏没有这些浏览器 / 新版 JS 全局，Node 里有，所以 mock 测试抓不到。
// 2026-11-04 真机首启因 URLSearchParams 崩溃，之后加这道检查。
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {join} from 'node:path';

// 递归列出脚本目录下全部 .ts 文件。
function files(dir) {return readdirSync(dir).flatMap(n => {const p = join(dir, n); return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : [];});}

// 微信端不存在或旧 iOS（JavaScriptCore < 15.4）不支持的写法。
const FORBIDDEN = [/\bURLSearchParams\b/, /\bnew URL\(/, /\bstructuredClone\b/, /\bObject\.hasOwn\(/, /\bTextEncoder\b/, /\bTextDecoder\b/, /\bAbortController\b/, /\.replaceAll\(/, /\.findLast(Index)?\(/];

test('脚本不使用微信小游戏里没有的全局', () => {
  const bad = [];
  for (const f of files(new URL('../../assets/scripts', import.meta.url).pathname)) {
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      const code = line.replace(/\/\/.*$/, '');
      for (const re of FORBIDDEN) if (re.test(code)) bad.push(`${f}:${i + 1} ${re}`);
    });
  }
  assert.deepEqual(bad, []);
});
