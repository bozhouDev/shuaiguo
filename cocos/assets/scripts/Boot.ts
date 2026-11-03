import { _decorator, Camera, Canvas, Color, Component, Layers, Node, ResolutionPolicy, view } from 'cc';
import { showSmokeView } from './view/SmokeView';

const { ccclass } = _decorator;

// 唯一场景脚本：按移植计划只在代码中创建相机和画面节点。
@ccclass('Boot')
export class Boot extends Component {
  // 固定宽度为 375；长屏增加可见高度，原型像素数值无需换算。
  onLoad(): void {
    view.setDesignResolutionSize(375, 812, ResolutionPolicy.FIXED_WIDTH);
    const cameraNode = new Node('Camera');
    this.node.parent!.addChild(cameraNode);
    cameraNode.setPosition(0, 0, 1000);
    const camera = cameraNode.addComponent(Camera);
    camera.projection = Camera.ProjectionType.ORTHO;
    camera.orthoHeight = view.getVisibleSize().height / 2;
    camera.near = 0;
    camera.far = 2000;
    camera.visibility = Layers.Enum.UI_2D;
    camera.clearColor = new Color('#FFFDF5');
    this.node.parent!.getComponent(Canvas)!.cameraComponent = camera;
  }

  // 资源导入或加载失败要保留错误，不能把空白画面当构建通过。
  start(): void {
    showSmokeView(this.node).catch((error) => console.error('[P1] 画面加载失败', error));
  }
}
