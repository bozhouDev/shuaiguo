import { _decorator, Camera, Canvas, Color, Component, Layers, Node, ResolutionPolicy, view } from 'cc';
import {WorldView} from './view/WorldView';

const { ccclass } = _decorator;

// 唯一场景脚本：按移植计划只在代码中创建相机和画面节点。
@ccclass('Boot')
export class Boot extends Component {
  world?: WorldView;
  private camera?: Camera;
  // 固定宽度为 375；长屏增加可见高度，原型像素数值无需换算。
  onLoad(): void {
    view.setDesignResolutionSize(375, 812, ResolutionPolicy.FIXED_WIDTH);
    const cameraNode = new Node('Camera');
    this.node.parent!.addChild(cameraNode);
    cameraNode.setPosition(0, 0, 1000);
    const camera = cameraNode.addComponent(Camera);
    this.camera = camera;
    camera.projection = Camera.ProjectionType.ORTHO;
    camera.orthoHeight = view.getVisibleSize().height / 2;
    camera.near = 0;
    camera.far = 2000;
    camera.visibility = Layers.Enum.UI_2D;
    camera.clearColor = new Color('#1F2A44');
    this.node.parent!.getComponent(Canvas)!.cameraComponent = camera;
    view.on('canvas-resize', this.resizeCamera, this);
  }

  // 长屏重排后相机同步正交高度，避免节点与触点坐标错位。
  private resizeCamera(): void {if (this.camera) this.camera.orthoHeight = view.getVisibleSize().height / 2;}

  // 资源导入或加载失败要保留错误，不能把空白画面当构建通过。
  start(): void {
    this.world = new WorldView(this.node);
    this.world.start().catch(error => console.error('[P3-1] 画面加载失败', error));
  }
  // Cocos调用每帧逻辑，不再另开定时器或第二个循环。
  update(dt: number): void {this.world?.update(dt);}
  // 场景关闭时解除全局输入和后台监听。
  onDestroy(): void {view.off('canvas-resize', this.resizeCamera, this); this.world?.destroy();}
}
