// 只在本地浏览器内读取冻结原型的合成器，不修改原型；导出同一贴纸的像素和定位表。
import fs from 'node:fs/promises';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({headless: true});
try {
 const p = await browser.newPage();
 await p.route('**/js/engine.js', async r => {let source = await fs.readFile('js/engine.js', 'utf8'); source = source.replace('  const PRAISE_TIME =', '  window.__sticker = buildSticker;\n  const PRAISE_TIME ='); await r.fulfill({body: source, contentType: 'application/javascript'});});
 await p.goto('http://127.0.0.1:8765/'); await p.waitForFunction(() => window.E && document.querySelector('#lobby .lb-go'));
 await p.evaluate(() => E.preparePraise());
 const values = await p.evaluate(() => Object.fromEntries(['calm','parry','rankup'].map(k => [k,__sticker(k,2)])));
 await fs.mkdir('cocos/assets/resources/ui', {recursive: true});
 for (const [kind, value] of Object.entries(values)) {await fs.writeFile(`cocos/assets/resources/ui/praise-${kind}.png`, Buffer.from(value.url.split(',')[1], 'base64')); delete value.url;}
 await fs.writeFile('cocos/assets/scripts/view/praise-data.ts', '// 由prepare-praise.mjs从冻结原型合成器导出，全部尺寸为CSS像素。\nexport const PRAISE = ' + JSON.stringify(values) + ';\n');
 console.log('PASS 三种贴纸原型像素与定位表已导出');
} finally {await browser.close();}
