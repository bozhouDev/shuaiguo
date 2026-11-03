import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const cli = process.env.WECHAT_CLI || '/Applications/wechatwebdevtools.app/Contents/MacOS/cli';
const root = fileURLToPath(new URL('../', import.meta.url));
const project = path.resolve(root, process.argv[3] || 'build/wechatgame-001');
const tmp = fileURLToPath(new URL('../../port/tmp/', import.meta.url));
const action = process.argv[2];
mkdirSync(tmp, { recursive: true });
// 只使用本机已登录状态；登录或服务端口受阻时保留 CLI 原始错误。
const args = action === 'open' ? ['open', '--project', project]
  : action === 'preview' ? ['preview', '--project', project, '--qr-format', 'image', '--qr-output', `${tmp}preview-qr.png`]
  : action === 'close' ? ['close', '--project', project] : null;
if (!args) throw new Error('需要指定 open、preview 或 close');
const result = spawnSync(cli, args, { stdio: 'inherit' });
if (result.error) console.error(result.error);
process.exitCode = result.status ?? 1;
