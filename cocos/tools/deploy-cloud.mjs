import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {prepareCloud,root,names} from './prepare-cloud.mjs';
// 仅使用开发者工具已登录会话，不读取/生成密钥；--paths不依赖已构建的小游戏包。
const requested=process.argv.slice(2),selected=requested.length?requested:names;
if(selected.some(n=>!names.includes(n)))throw Error('函数名只能是 config save track rank');
prepareCloud();
const args=['cloud','functions','deploy','--env','cloud1-d3gio6bskae9e684b','--appid','wx15e416b0643d90af','--paths',...selected.map(n=>path.join(root,'cloudfunctions',n)),'--remote-npm-install','true'];
console.log('部署：',args.join(' '));
const result=spawnSync(process.env.WECHAT_CLI||'/Applications/wechatwebdevtools.app/Contents/MacOS/cli',args,{encoding:'utf8',timeout:180000,maxBuffer:4*1024*1024});
process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');
// 开发者工具可能部署失败却返回0；显式识别它的终态错误，不把创建成功当作代码部署成功。
const failed=/\[error\]|✖ deploy cloudfunctions|fail to deploy cloudfunction/i.test((result.stdout||'')+(result.stderr||''));
if(result.error)console.error(result.error.message);process.exitCode=failed?1:result.status??1;
