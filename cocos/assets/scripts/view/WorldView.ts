import {Game, Layers, Node, UITransform, game, sys, view} from 'cc';
import {PREVIEW} from 'cc/env';
import {Match} from '../core/match';
import {CoreEvent} from '../core/types';
import {WebPlatform} from '../platform/WebPlatform';
import {WechatPlatform} from '../platform/WechatPlatform';
import {WorldAssets} from './WorldAssets';
import {DrawSurface} from './DrawSurface';
import {createWorldPainter} from './WorldPainter';
import {InputView} from './InputView';
import {METRICS} from './visual-data';

// Boot 直接开局；只读 core 状态、消费事件，主循环的顺序和原型相同。
export class WorldView {
  readonly match: Match;
  readonly assets = new WorldAssets();
  readonly surfaces: DrawSurface[] = [];
  ready = false; paused = false; hidden = false; frozen = false;
  steps = 0; clock = 0; skipFrame = false;
  private painter!: ReturnType<typeof createWorldPainter>;
  private controls!: InputView;
  private root: Node;
  private freezeAt: number | null = null;
  private events: CoreEvent[] = [];
  private alive = true;
  // 性能采样只在编辑器预览开启，不进入正式包。
  readonly timings: {dt: number; update: number; draw: number}[] = [];

  constructor(parent: Node) {
    const platform = sys.platform === sys.Platform.WECHAT_GAME ? new WechatPlatform() : new WebPlatform();
    const params = PREVIEW && platform.kind === 'web' && typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
    const level = params.has('level') ? Math.min(4, Math.max(0, Number(params.get('level')) || 0)) : 0;
    if (params.has('freeze')) this.freezeAt = Math.max(0, Math.floor(Number(params.get('freeze')) || 0));
    this.match = new Match({level, seed: params.has('seed') ? Number(params.get('seed')) : Date.now(), auto: params.get('auto') === '1',
      tutorial: false, onEvent: event => this.events.push(event)});
    this.root = new Node('World'); this.root.layer = Layers.Enum.UI_2D; parent.addChild(this.root);
    view.on('canvas-resize', this.resize, this);
    game.on(Game.EVENT_HIDE, this.hide, this); game.on(Game.EVENT_SHOW, this.show, this);
  }
  // 资源完整加载后再创建Label，避免首次纹理使用系统字体后未刷新。
  async start(): Promise<void> {
    await this.assets.load(); if (!this.alive) return;
    const size = view.getVisibleSize(); this.root.setPosition(-size.width / 2, size.height / 2);
    for (const name of ['Floor', 'Tea', 'Props', 'Actors', 'Controls']) {
      const node = new Node(name); node.layer = Layers.Enum.UI_2D; node.addComponent(UITransform); this.root.addChild(node);
      const surface = new DrawSurface(node, this.assets); surface.width = size.width; surface.height = size.height; surface.metrics = METRICS;
      surface.cull = name !== 'Floor' && name !== 'Props'; this.surfaces.push(surface);
    }
    this.painter = createWorldPainter(this.match, this.surfaces[3], this.surfaces[0], this.surfaces[2], this.surfaces[1], this.assets);
    this.controls = new InputView(this.match, this.surfaces[4], () => {this.paused = !this.paused; this.controls.clear();}, () => {this.paused = false;});
    this.ready = true;
    if (!this.match.S.player.crushed && this.match.potsOf(this.match.S.player)) this.match.frameAim();
    this.render();
    // 固定步截图也逐帧绘制，走路朝向/步伐和震屏衰减不会跳过历史。
    if (this.freezeAt !== null) {for (let i = 0; i < this.freezeAt; i++) this.tick(1 / 60); this.frozen = true;}
    console.log('[P3-1] 对局就绪', {level: this.match.L.id - 1, steps: this.steps, frozen: this.frozen});
  }
  // 重排只更新视口/操作区域，不推进玩法或重建静态地图。
  private resize(): void {
    if (!this.ready) return;
    const size = view.getVisibleSize(); this.root.setPosition(-size.width / 2, size.height / 2);
    for (const surface of this.surfaces) {surface.width = size.width; surface.height = size.height;}
    this.controls.clear(); this.render();
  }
  // 与原型外层循环一致：真实dt上限33ms，update→frameAim→draw，录像入口另用1/60。
  update(dt: number): void {
    if (!this.ready || this.hidden || this.frozen) return;
    if (this.skipFrame) {this.skipFrame = false; return;}
    if (this.paused) return;
    this.tick(Math.min(.033, dt));
  }
  // 提供编辑器预览的真实主循环单步，截图工具无需改写玩法状态。
  tick(dt: number): void {
    const start = performance.now(), m = this.match;
    if (m.mode !== 'play') m.inp.fire = 0;
    if (m.mode === 'play') {m.update(dt); if (m.S.over === 'time') m.startClosing(); else if (m.S.over) m.finish(m.S.over);}
    else if (m.mode === 'closing') m.updateClosing(dt, this.hidden);
    // 原型draw只在有锅且未压垮时pickAim，空手时保留旧目标，不额外改状态。
    if (!m.S.player.crushed && m.potsOf(m.S.player)) m.frameAim();
    m.updateBanners(m.mode === 'play' ? dt : 0);
    m.updateClosingNotice();
    for (const event of this.events) this.painter.event(event.kind, event.args); this.events.length = 0;
    this.painter.advance(dt); this.clock += dt; this.steps++;
    const afterUpdate = performance.now(); this.render();
    if (PREVIEW && this.freezeAt === null) this.timings.push({dt: dt * 1000, update: afterUpdate - start, draw: performance.now() - afterUpdate});
  }
  // 绘制只消费view自己的缓存，除frameAim外不修改core。
  render(): void {this.painter.draw(this.clock); this.controls.draw(this.clock);}
  private hide(): void {this.hidden = true; this.paused = true; this.controls?.clear();}
  // P3不建暂停弹窗；回来保持暂停，触摸世界或P/Esc继续，首帧丢弃后台时间。
  private show(): void {this.hidden = false; this.skipFrame = true;}
  // 销毁场景时解除监听，释放运行时帧和本任务节点。
  destroy(): void {this.alive = false; view.off('canvas-resize', this.resize, this); game.off(Game.EVENT_HIDE, this.hide, this); game.off(Game.EVENT_SHOW, this.show, this); this.controls?.destroy(); this.root.destroy(); this.assets.destroy();}
}
