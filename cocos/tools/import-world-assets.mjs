// 从冻结原型生成裁图表并复制源图；可重复运行，不启动编辑器、不写 meta。
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const sandbox={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'js/atlas.js'),'utf8'),sandbox);
const atlas=sandbox.window.ATLAS;
for(const kind of ['atlas','fx']) {
 const dest=path.join(root,'cocos/assets/resources',kind);fs.mkdirSync(dest,{recursive:true});
 for(const name of fs.readdirSync(path.join(root,'assets',kind))) fs.copyFileSync(path.join(root,'assets',kind,name),path.join(dest,name));
}
// 只复制图集和爆炸序列，不再复制与图集重复的单图后备。
for(const sh of atlas.sheets)sh.file='atlas/'+sh.file.split('?')[0].replace(/\.png$/,'');
fs.writeFileSync(path.join(root,'cocos/assets/scripts/view/atlas-data.ts'),`// 由 tools/import-world-assets.mjs 从 js/atlas.js 生成；矩形坐标以左上角为原点。\nexport const ATLAS: {sheets: {file: string; frames: Record<string, [number, number, number, number]>}[]} = ${JSON.stringify(atlas,null,2)};\n`);
console.log(`复制 ${atlas.sheets.length} 张图集及 fx 全目录，生成 atlas-data.ts；不生成单图后备`);
