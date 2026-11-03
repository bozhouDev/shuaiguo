import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// 可复用现有 Playwright，不强制给逻辑测试或游戏安装依赖。
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const tmp = fileURLToPath(new URL('../../port/tmp/', import.meta.url));
// 日常验证走已打开编辑器的预览，不启动服务或 Cocos；也可传入已有网页包地址。
const url = process.argv[2] || 'http://localhost:7456/?scene=3b08c73f-d17c-4dfc-a45e-854ddae97b2f';
const artifact = process.argv[3] || 'editor-preview';
assert.match(artifact, /^[a-zA-Z0-9_-]+$/);
await mkdir(tmp, { recursive: true });
const browser = await chromium.launch({ headless: true });
const result = { url, errors: [], warnings: [], logs: [], requests: [], checks: {} };
try {
  // 预览在移动浏览器中自动全屏，避免桌面工具栏占掉 48px 的游戏区域。
  const page = await browser.newPage({
    viewport: { width: 375, height: 812 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36',
  });
  page.setDefaultTimeout(30000);
  // 观察浏览器实际启动的非静音 PCM 音源；不代替手机扬声器听感验收。
  await page.addInitScript(() => {
    window.__p1Audio = [];
    const original = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      const samples = this.buffer?.getChannelData(0);
      const peak = samples ? samples.reduce((value, sample) => Math.max(value, Math.abs(sample)), 0) : 0;
      window.__p1Audio.push({ duration: this.buffer?.duration, peak, contextState: this.context.state });
      return original.apply(this, args);
    };
  });
  page.on('pageerror', (error) => result.errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') result.errors.push(message.text());
    else if (message.type() === 'warning') result.warnings.push(message.text());
    else result.logs.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400) result.errors.push(`${response.status()} ${response.url()}`);
    result.requests.push({ status: response.status(), url: response.url() });
  });
  await page.goto(url);
  await page.waitForFunction(() => window.cc?.director.getScene()?.getChildByName('Canvas')?.getChildByName('Boot')?.getChildByName('ClickButton'));
  await page.evaluate(async () => { window.__p1cc = await System.import('cc'); await document.fonts.ready; });
  // 直接读取实际运行节点与字体，不能用构建成功代替画面验收。
  result.checks = await page.evaluate(() => {
    const { director, UITransform, Label, Sprite, view, Texture2D } = window.__p1cc;
    const boot = director.getScene().getChildByName('Canvas').getChildByName('Boot');
    const sprite = boot.getChildByName('Player').getComponent(Sprite);
    const title = boot.getChildByName('Title').getComponent(Label);
    const body = boot.getChildByName('Body').getComponent(Label);
    const transform = boot.getChildByName('ClickButton').getComponent(UITransform);
    const center = transform.convertToWorldSpaceAR(new window.__p1cc.Vec3());
    return {
      visible: view.getVisibleSize(), playerHeight: sprite.node.getComponent(UITransform).height,
      nearest: sprite.spriteFrame.texture.getSamplerInfo().minFilter === Texture2D.Filter.NEAREST
        && sprite.spriteFrame.texture.getSamplerInfo().magFilter === Texture2D.Filter.NEAREST,
      fonts: [title, body].map((label) => ({ text: label.string, name: label.font?.name, nativeUrl: label.font?.nativeUrl, system: label.useSystemFont })),
      loadedFonts: [...document.fonts].map((font) => ({ family: font.family, status: font.status })),
      corners: ['TopLeft', 'TopRight', 'BottomLeft', 'BottomRight'].map((name) => ({ name, position: boot.getChildByName(name).position })),
      // 编辑器预览带工具栏，画布可缩放；用实际 CSS 边界将场景坐标换成鼠标坐标。
      button: (() => {
        const rect = document.querySelector('canvas').getBoundingClientRect();
        const size = view.getVisibleSize();
        return { x: rect.x + center.x / size.width * rect.width, y: rect.y + (1 - center.y / size.height) * rect.height };
      })(),
    };
  });
  assert.equal(result.checks.playerHeight, 70);
  assert.equal(result.checks.nearest, true);
  assert.equal(result.checks.visible.width, 375);
  assert.equal(result.checks.visible.height, 812);
  assert.ok(result.checks.fonts.every((font) => !font.system && font.nativeUrl.endsWith('.ttf')));
  assert.ok(result.logs.some((line) => line.includes('[P1] 画面就绪')));
  await page.screenshot({ path: `${tmp}${artifact}.png` });
  await page.mouse.click(result.checks.button.x, result.checks.button.y);
  await page.waitForFunction(() => {
    const boot = window.cc.director.getScene().getChildByName('Canvas').getChildByName('Boot');
    return boot.getComponent(window.__p1cc.AudioSource) !== null;
  });
  await page.waitForTimeout(300);
  result.audio = await page.evaluate(() => window.__p1Audio);
  assert.ok(result.logs.some((line) => line.includes('点击按钮：播放')));
  assert.ok(result.audio.some((audio) => audio.peak > 0 && audio.contextState === 'running'));
  assert.deepEqual(result.errors, []);
  console.log(`PASS ${url} 375×812：70 高角色、最近邻、两款 TTF、四角、点击日志、非静音音源；错误 0`);
} finally {
  await writeFile(`${tmp}${artifact}-check.json`, JSON.stringify(result, null, 2));
  await browser.close();
}
