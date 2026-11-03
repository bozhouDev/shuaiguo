// 只读已有包；资源可位于assets或微信subpackages，不触发构建。
import {readdir,readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const project=fileURLToPath(new URL('../',import.meta.url)),root=path.resolve(project,process.argv[2]||'build/wechatgame-001');
const main=JSON.parse(await readFile(path.join(root,'assets/main/config.json'),'utf8'));
if(!Object.hasOwn(main.scenes,'db://assets/scenes/Boot.scene'))throw new Error('构建产物缺少Boot场景');
// 未压缩目录字节只作估算依据，不能冒充本轮新包或微信上传体积。
async function bytes(dir){let sum=0;for(const entry of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);sum+=entry.isDirectory()?await bytes(file):(await stat(file)).size;}return sum;}
const total=await bytes(root),subpackages={};
try{for(const entry of await readdir(path.join(root,'subpackages'),{withFileTypes:true}))if(entry.isDirectory())subpackages[entry.name]=await bytes(path.join(root,'subpackages',entry.name));}catch(error){if(error.code!=='ENOENT')throw error;}
const subBytes=Object.values(subpackages).reduce((a,b)=>a+b,0),engine=await bytes(path.join(root,'cocos-js'));
console.log(JSON.stringify({directory:root,basis:'只读已有构建，未压缩目录字节；修改后未构建，上传体积未验证',builtFileMtime:(await stat(path.join(root,'game.js'))).mtime.toISOString(),unit:'bytes',total,main:total-subBytes,subpackages,engine,mainWithin4MiB:total-subBytes<=4*1024**2},null,2));
