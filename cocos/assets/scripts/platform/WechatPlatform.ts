import {WechatCloud} from './WechatCloud';
import type {Platform, TopAvoidance, Lifecycle, ShareRequest, AudioFocus} from './Platform';
import {DEFAULT_SHARE, REWARDED_AD_UNIT_ID} from './ad-config';
import {wechatAPI, RewardedVideo} from './wechat-api';

// P5：真实微信能力封装；所有奖励只从一次有效的完整观看回调产生。
export class WechatPlatform implements Platform {
  readonly kind = 'wechat';
  readonly cloud = new WechatCloud();
  private readonly wx = wechatAPI();
  private closed = false;
  private lifecycle = new Set<Lifecycle>();
  private audio = new Set<AudioFocus>();
  private audioReasons = new Set<'ad'|'interruption'>();
  private ad?: RewardedVideo;
  private cancelAd?: () => void;
  private sharing = false;
  // 微信默认全局单例，三种奖励共用一个广告位；用途只由App的当前结算决定。
  constructor(private readonly adUnitId = REWARDED_AD_UNIT_ID) {
    this.wx.onHide?.(this.hide); this.wx.onShow?.(this.show);
    this.wx.onAudioInterruptionBegin?.(this.interrupt); this.wx.onAudioInterruptionEnd?.(this.uninterrupt);
    try {this.wx.showShareMenu?.({menus:['shareAppMessage','shareTimeline'],fail:()=>{}});this.wx.onShareAppMessage?.(this.defaultShare);this.wx.onShareTimeline?.(this.defaultTimeline);}catch{/* 旧版本无朋友圈接口时仍可主动分享。 */}
  }
  // 菜单只发送固定标题/图，不读取存档中的称呼。
  private defaultShare = () => ({...DEFAULT_SHARE});
  // 朋友圈预览也用固定图，避免默认截取含本地自定义称呼的当前画面。
  private defaultTimeline = () => ({...DEFAULT_SHARE,imagePreviewUrl:DEFAULT_SHARE.imageUrl});
  private hide = (): void => {if(!this.closed)for(const listener of this.lifecycle)listener.hide();};
  private show = (): void => {if(!this.closed)for(const listener of this.lifecycle)listener.show();};
  private interrupt = (): void => {this.focus('interruption',true);};
  private uninterrupt = (): void => {this.focus('interruption',false);};
  // 多个订阅者共用wx监听；销毁单个World不影响App或其他订阅者。
  onLifecycle(listener:Lifecycle): () => void {this.lifecycle.add(listener);return ()=>this.lifecycle.delete(listener);}
  onAudioFocus(listener:AudioFocus): () => void {this.audio.add(listener);for(const reason of this.audioReasons)listener(reason,true);return ()=>this.audio.delete(listener);}
  // 广告/来电各自持锁，某一个结束不能提前恢复另一种打断中的音乐。
  private focus(reason:'ad'|'interruption',blocked:boolean): void {if(this.closed||this.audioReasons.has(reason)===blocked)return;if(blocked)this.audioReasons.add(reason);else this.audioReasons.delete(reason);for(const listener of this.audio)listener(reason,blocked);}
  setUserCloudStorage(data: {key:string;value:string}[]): Promise<boolean> {return this.cloud.setUserCloudStorage(data);}
  // 只放行明确的开发/体验环境，未知、异常、正式版关闭。
  debugEnabled(): boolean {try {const env=wechatAPI().getAccountInfoSync?.().miniProgram?.envVersion;return env==='develop'||env==='trial';}catch{return false;}}
  // 每局一次设备快照，只取性能分析白名单；缺接口/失败留空，不阻塞开局。
  performanceDevice(): {brand:string;model:string;system:string;platform:string;sdkVersion:string;benchmarkLevel:number|null;modelLevel:number|null} {
    const out={brand:'',model:'',system:'',platform:'',sdkVersion:'',benchmarkLevel:null as number|null,modelLevel:null as number|null};
    try{const info=this.wx.getDeviceInfo?.();for(const key of ['brand','model','system','platform'] as const)if(typeof info?.[key]==='string')out[key]=info[key]!.slice(0,96);}catch{/* 缺省为空。 */}
    try{out.sdkVersion=(this.wx.getAppBaseInfo?.().SDKVersion||this.wx.getSystemInfoSync?.().SDKVersion||'').slice(0,32);}catch{/* 旧基础库无接口。 */}
    try{this.wx.getDeviceBenchmarkInfo?.({success:v=>{for(const key of ['benchmarkLevel','modelLevel'] as const)if(typeof v[key]==='number'&&Number.isFinite(v[key]))out[key]=v[key]!;},fail:()=>{}});}catch{/* 不支持时保留null。 */}
    return out;
  }
  // 读取启动脚本的实际状态，避免把下次启动的本地设置当作本局生效值。
  resolutionCapped():boolean{return this.wx.__sgRenderResolution?.capped===true;}
  // wx窗口/胶囊都是逻辑像素；FIXED_WIDTH设计宽375，不乘DPR，保留真实胶囊矩形供HUD换行。
  topAvoidance(): TopAvoidance {
    const fallback={top:44,capsule:{x:281,y:50,w:87,h:32}};
    try {
      const win=this.wx.getWindowInfo?.();if(!win||!Number.isFinite(win.windowWidth)||win.windowWidth<=0)return fallback;
      const scale=375/win.windowWidth,top=win.safeArea?.top;
      const rect=this.wx.getMenuButtonBoundingClientRect?.();
      if(!rect||![rect.left,rect.top,rect.width,rect.height].every(Number.isFinite)||rect.width<=0||rect.height<=0||rect.left<0||rect.top<0||rect.left+rect.width>win.windowWidth)return {top:Number.isFinite(top)?Math.max(0,top!)*scale:44,capsule:fallback.capsule};
      return {top:Number.isFinite(top)?Math.max(0,top!)*scale:44,capsule:{x:rect.left*scale,y:rect.top*scale,w:rect.width*scale,h:rect.height*scale}};
    }catch{return fallback;}
  }
  // 原键名/JSON字节原样读写；普通写入由PlayerStore静默，改名/清档保留失败提示能力。
  getStorage(key:string): string|null {try {const value=wechatAPI().getStorageSync?.(key);return typeof value==='string'?value:null;}catch{return null;}}
  setStorage(key:string,value:string): void {const wx=wechatAPI();if(!wx.setStorageSync)throw Error('微信存储不可用');wx.setStorageSync(key,value);}
  removeStorage(key:string): void {const wx=wechatAPI();if(!wx.removeStorageSync)throw Error('微信存储不可用');wx.removeStorageSync(key);}
  // load→show→onClose；空位/创建/拉取/展示/中断关闭都不给奖，超时回收实例隔离迟到事件。
  showRewardedAd(_onTick?:(remaining:number|null)=>void): Promise<boolean> {
    if(this.closed||this.cancelAd||!this.adUnitId.trim()||!this.wx.createRewardedVideoAd)return Promise.resolve(false);
    try {this.ad ||= this.wx.createRewardedVideoAd({adUnitId:this.adUnitId});}catch{return Promise.resolve(false);}
    const ad=this.ad;if(!ad)return Promise.resolve(false);
    return new Promise(resolve=>{
      let done=false,showing=false;
      const finish=(ok:boolean,broken=false)=>{
        if(done)return;done=true;clearTimeout(timer);ad.offClose(close);ad.offError(error);this.cancelAd=undefined;
        if(broken){try{ad.destroy();}catch{/* 平台已释放时忽略。 */}if(this.ad===ad)this.ad=undefined;}
        this.focus('ad',false);resolve(ok&&!this.closed);
      };
      const close=(result?:{isEnded?:boolean})=>finish(showing&&result?.isEnded===true);
      const error=()=>finish(false,true);
      // 防止SDK丢回调把界面永远锁在广告页；销毁旧实例后下次才允许重新创建。
      const timer=setTimeout(error,120000);this.cancelAd=error;
      try {ad.onClose(close);ad.onError(error);void Promise.resolve(ad.load()).then(()=>{
        if(done||this.closed)return;showing=true;this.focus('ad',true);return ad.show();
      }).catch(error);}catch{error();}
    });
  }
  // 导图只影响配图；失败退固定图，切局/销毁的迟到结果不唤起旧局分享。
  share(request:ShareRequest={}): void {
    if(this.closed||this.sharing)return;this.sharing=true;
    void (async()=>{let imageUrl=DEFAULT_SHARE.imageUrl;try{const image=await request.image?.();if(image)imageUrl=image;}catch{/* 导图失败用主包默认图。 */}
      if(!this.closed&&request.valid?.()!==false){try{this.wx.shareAppMessage?.({title:request.title||DEFAULT_SHARE.title,imageUrl});}catch{/* 分享失败不发奖励也不改变结算。 */}}
    })().finally(()=>{this.sharing=false;});
  }
  // 微信只有15ms短震/400ms长震：<50轻，50–69中，70–149重，>=150长，用强度保留相对反馈。
  vibrate(ms:number): void {if(this.closed||!Number.isFinite(ms)||ms<=0)return;try{if(ms>=150)this.wx.vibrateLong?.({fail:()=>{}});else this.wx.vibrateShort?.({type:ms<50?'light':ms<70?'medium':'heavy',fail:()=>{}});}catch{/* 设备无震动能力时静默。 */}}
  // 只解除本实例注册的回调，不调用不带callback的全局off。
  dispose(): void {if(this.closed)return;this.cancelAd?.();this.closed=true;try{this.ad?.destroy();}catch{/* 已销毁。 */}this.ad=undefined;this.cloud.dispose();this.wx.offHide?.(this.hide);this.wx.offShow?.(this.show);this.wx.offAudioInterruptionBegin?.(this.interrupt);this.wx.offAudioInterruptionEnd?.(this.uninterrupt);this.wx.offShareAppMessage?.(this.defaultShare);this.wx.offShareTimeline?.(this.defaultTimeline);this.lifecycle.clear();this.audio.clear();this.audioReasons.clear();}
}
