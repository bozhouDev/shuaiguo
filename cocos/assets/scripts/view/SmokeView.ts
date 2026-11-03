import {
  Asset, AudioClip, AudioSource, Button, Color, Graphics, Label, Layers, Node,
  Sprite, SpriteFrame, Texture2D, TTFFont, UITransform, resources, sys, view,
} from 'cc';

const INK = new Color('#1F2A44');
const PAPER = new Color('#FFFDF5');
const NOTE = new Color('#FFD84D');

// 仅加载验证用资源；资源失败要显式报错，不以系统字体掩盖加载失败。
function load<T extends Asset>(path: string, type: new (...args: any[]) => T): Promise<T> {
  return new Promise((resolve, reject) => {
    resources.load(path, type, (error, asset) => error ? reject(error) : resolve(asset));
  });
}

// 所有可见节点均由代码创建，场景中不维护业务布局。
function node(parent: Node, name: string, width: number, height: number, x = 0, y = 0): Node {
  const result = new Node(name);
  result.layer = Layers.Enum.UI_2D;
  result.addComponent(UITransform).setContentSize(width, height);
  parent.addChild(result);
  result.setPosition(x, y);
  return result;
}

// 用语义色画矩形，不引入额外图标或渐变。
function block(parent: Node, name: string, width: number, height: number, x: number, y: number, color: Color): Node {
  const result = node(parent, name, width, height, x, y);
  const graphics = result.addComponent(Graphics);
  graphics.fillColor = color;
  graphics.rect(-width / 2, -height / 2, width, height);
  graphics.fill();
  return result;
}

// 指定真实 TTF 资源，保证两款中文字形分别走自定义字体。
function text(parent: Node, name: string, content: string, font: TTFFont, size: number, y: number): void {
  const label = node(parent, name, 340, 52, 0, y).addComponent(Label);
  label.font = font;
  label.useSystemFont = false;
  label.fontSize = size;
  label.lineHeight = size + 8;
  label.color = INK;
  label.string = content;
  label.horizontalAlign = Label.HorizontalAlign.CENTER;
  label.verticalAlign = Label.VerticalAlign.CENTER;
}

// 骨架验收：70 高角色、中文字体、用户手势音效和四角适配标记。
export async function showSmokeView(parent: Node): Promise<void> {
  const [frame, titleFont, bodyFont, click] = await Promise.all([
    load('player_normal/spriteFrame', SpriteFrame),
    load('title', TTFFont),
    load('body', TTFFont),
    load('ui_click', AudioClip),
  ]);
  frame.texture.setFilters(Texture2D.Filter.NEAREST, Texture2D.Filter.NEAREST);
  frame.texture.setMipFilter(Texture2D.Filter.NONE);
  const size = view.getVisibleSize();
  block(parent, 'Paper', size.width, size.height, 0, 0, PAPER);
  text(parent, 'Title', '这锅你来背', titleFont, 32, 170);
  const player = node(parent, 'Player', 70 * frame.originalSize.width / frame.originalSize.height, 70, 0, 65);
  const sprite = player.addComponent(Sprite);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  sprite.spriteFrame = frame;
  sprite.trim = false;
  text(parent, 'Body', '背锅 3+1.5', bodyFont, 24, -15);
  const button = block(parent, 'ClickButton', 180, 56, 0, -110, NOTE);
  button.addComponent(Button);
  text(button, 'ButtonText', '点一下', titleFont, 26, 0);
  const audio = parent.addComponent(AudioSource);
  button.on(Button.EventType.CLICK, () => {
    audio.playOneShot(click);
    console.log('[P1] 点击按钮：播放 ui_click.mp3');
  });
  for (const [name, x, y, color] of [
    ['TopLeft', -1, 1, NOTE], ['TopRight', 1, 1, new Color('#E8504A')],
    ['BottomLeft', -1, -1, new Color('#2F9E6B')], ['BottomRight', 1, -1, new Color('#5E6A84')],
  ] as const) {
    block(parent, name, 12, 12, x * (size.width / 2 - 6), y * (size.height / 2 - 6), color);
  }
  console.log('[P1] 画面就绪', {
    visible: { width: size.width, height: size.height }, safeArea: sys.getSafeAreaRect(),
    playerHeight: 70, nearest: true, fonts: [titleFont.name, bodyFont.name],
  });
}
