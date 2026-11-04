// 本卡使用的微信边界，保持Node可加载，不引用Cocos或全量SDK。
export interface RewardedVideo {
  load(): Promise<unknown>; show(): Promise<unknown>; destroy(): void;
  onClose(fn: (result?: {isEnded?: boolean}) => void): void; offClose(fn: (result?: {isEnded?: boolean}) => void): void;
  onError(fn: () => void): void; offError(fn: () => void): void;
}
export interface InnerAudio {
  src: string; volume: number; loop: boolean; autoplay: boolean; obeyMuteSwitch: boolean; playbackRate: number;
  currentTime: number; duration: number; startTime: number;
  play(): void; pause(): void; stop(): void; seek(seconds: number): void; destroy(): void;
  onEnded(fn: () => void): void; onError(fn: () => void): void;
}
export interface WxCanvas {
  width: number; height: number;
  getContext(type: '2d'): {createImageData(w: number,h: number): {data: Uint8ClampedArray}; putImageData(image: unknown,x: number,y: number): void};
  toTempFilePathSync(options: {x:number;y:number;width:number;height:number;destWidth:number;destHeight:number;fileType:'png'}): string;
}
export interface WechatAPI {
  getDeviceInfo?(): {brand?:string;model?:string;system?:string;platform?:string};
  getAppBaseInfo?(): {SDKVersion?:string};
  getSystemInfoSync?(): {SDKVersion?:string};
  getDeviceBenchmarkInfo?(options:{success:(v:{benchmarkLevel?:number;modelLevel?:number})=>void;fail:()=>void}):void;
  __sgRenderResolution?: {capped:boolean;nativeDpr:number|null};
  getOpenDataContext?(): {postMessage(message: unknown): void};
  getStorageSync?(key:string): unknown; setStorageSync?(key:string,value:string): void; removeStorageSync?(key:string): void;
  getAccountInfoSync?(): {miniProgram?: {envVersion?: string}};
  getWindowInfo?(): {windowWidth: number; windowHeight: number; safeArea?: {top:number}; pixelRatio?:number};
  getMenuButtonBoundingClientRect?(): {left:number;top:number;width:number;height:number};
  createRewardedVideoAd?(options:{adUnitId:string}): RewardedVideo;
  showShareMenu?(options:{menus:string[];fail:()=>void}): void;
  onShareAppMessage?(fn:()=>{title:string;imageUrl:string}): void; offShareAppMessage?(fn:()=>unknown): void;
  onShareTimeline?(fn:()=>{title:string;imageUrl:string}): void; offShareTimeline?(fn:()=>unknown): void;
  shareAppMessage?(options:{title:string;imageUrl:string}): void;
  vibrateShort?(options:{type:'light'|'medium'|'heavy';fail:()=>void}): void; vibrateLong?(options:{fail:()=>void}): void;
  onHide?(fn:()=>void): void; offHide?(fn:()=>void): void; onShow?(fn:()=>void): void; offShow?(fn:()=>void): void;
  onAudioInterruptionBegin?(fn:()=>void): void; offAudioInterruptionBegin?(fn:()=>void): void;
  onAudioInterruptionEnd?(fn:()=>void): void; offAudioInterruptionEnd?(fn:()=>void): void;
  createInnerAudioContext?(): InnerAudio; createCanvas?(): WxCanvas;
  loadSubpackage?(options:{name:string;success:()=>void;fail:()=>void}): {onProgressUpdate?(fn:(v:{progress:number})=>void):void};
}
// 运行时取真实wx，缺接口由各功能按任务卡降级。
export function wechatAPI(): WechatAPI {return (globalThis as unknown as {wx?:WechatAPI}).wx || {};}
