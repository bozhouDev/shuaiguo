import {Camera, Color, Director, Node, RenderRoot2D, RenderTexture, UITransform, director} from 'cc';
import {WorldAssets} from './WorldAssets';
import {DrawSurface} from './DrawSurface';
import {ScreenPaint} from './ScreenPaint';
import {ShareView} from './ShareView';
import type {Result} from './ResultView';
import {sharePixelsToFile} from '../platform/WechatShareImage';
// 独立2D根和专用层，主相机不见分享节点；复用ShareView.picture的画面与原有精灵。
export class WechatShareCapture {
  private cancel?:()=>void;
  // 一次只生成一张；等待两帧让Label纹理上传，再读500×400的5:4 RenderTexture。
  capture(parent:Node,assets:WorldAssets,info:Result['shareInfo']):Promise<string> {
    this.dispose();
    return new Promise((resolve,reject)=>{
      let root:Node|undefined,cameraNode:Node|undefined,texture:RenderTexture|undefined,camera:Camera|undefined,frames=0,finished=false;
      // 建节点/分配GPU目标也可能失败，与读回失败走同一清理出口。
      const finish=(error?:Error,value='')=>{if(finished)return;finished=true;clearTimeout(timer);director.off(Director.EVENT_AFTER_DRAW,after);this.cancel=undefined;if(camera)camera.targetTexture=null;cameraNode?.destroy();root?.destroy();texture?.destroy();error?reject(error):resolve(value);};
      const after=()=>{if(++frames<2)return;try{const pixels=texture?.readPixels();if(!pixels||!pixels.some((value,i)=>i%4===3&&value>0))throw Error('分享图读取失败');finish(undefined,sharePixelsToFile(pixels,500,400));}catch(error){finish(error instanceof Error?error:Error(String(error)));}};
      const timer=setTimeout(()=>finish(Error('分享图生成超时')),2500);this.cancel=()=>finish(Error('分享图已取消'));
      try {
        const layer=1<<20,scene=parent.scene;root=new Node('ShareCapture');cameraNode=new Node('ShareCamera');texture=new RenderTexture();scene.addChild(root);scene.addChild(cameraNode);
        root.layer=layer;root.addComponent(UITransform).setContentSize(220,176);root.addComponent(RenderRoot2D);root.setPosition(10000,10000);
        const content=new Node('SharePicture');content.layer=layer;root.addChild(content);content.addComponent(UITransform);content.setPosition(-110,88);
        const c=new DrawSurface(content,assets);c.cull=false;c.width=220;c.height=176;c.begin();new ShareView(new ScreenPaint(c)).picture(info,{x:0,y:0,w:220,h:176});c.end();
        // DrawSurface默认UI_2D；仅当前离屏树切到专用层，不修改共享资源或主画面。
        const setLayer=(node:Node)=>{node.layer=layer;for(const child of node.children)setLayer(child);};setLayer(root);
        texture.reset({width:500,height:400});cameraNode.setPosition(10000,10000,1000);camera=cameraNode.addComponent(Camera);camera.projection=Camera.ProjectionType.ORTHO;camera.orthoHeight=88;camera.near=0;camera.far=2000;camera.visibility=layer;camera.clearColor=new Color('#FFF8E6');camera.targetTexture=texture;
        director.on(Director.EVENT_AFTER_DRAW,after);
      }catch(error){finish(error instanceof Error?error:Error(String(error)));}
    });
  }
  // 切局/退出时立即取消监听与超时，不等旧图回来再触发分享。
  dispose():void {this.cancel?.();}
}
