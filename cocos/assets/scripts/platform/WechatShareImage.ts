import {wechatAPI} from './wechat-api';
// RenderTexture读回是自底向上；只翻转行，不对像素做缩放/重绘，避免分享图倒置。
export function sharePixelsToFile(pixels:Uint8Array,width:number,height:number):string {
  if(pixels.length!==width*height*4)throw Error('分享图像素不完整');
  const canvas=wechatAPI().createCanvas?.();if(!canvas)throw Error('分享画布不可用');canvas.width=width;canvas.height=height;
  const context=canvas.getContext('2d'),image=context.createImageData(width,height),row=width*4;
  for(let y=0;y<height;y++)image.data.set(pixels.subarray((height-y-1)*row,(height-y)*row),y*row);
  context.putImageData(image,0,0);
  const path=canvas.toTempFilePathSync({x:0,y:0,width,height,destWidth:width,destHeight:height,fileType:'png'});if(!path)throw Error('分享临时图生成失败');return path;
}
