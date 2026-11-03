import {WechatCloud} from './WechatCloud';
import type { Platform, TopAvoidance } from './Platform';

// 微信存储与云能力已接入；广告/分享/震动/安全区留给P5，正式版不得放行调试。
export class WechatPlatform implements Platform {
  readonly kind = 'wechat';
  readonly cloud = new WechatCloud();
  // 本卡只接好友榜主域写入，开放数据域留给后续界面任务。
  setUserCloudStorage(data: {key:string;value:string}[]): Promise<boolean> {return this.cloud.setUserCloudStorage(data);}
  dispose(): void {this.cloud.dispose();}
  // 只放行已确认的开发/体验版；接口缺失、异常或未知环境一律关闭。
  debugEnabled(): boolean {
    try {const wx = (globalThis as unknown as {wx?: {getAccountInfoSync(): {miniProgram: {envVersion: string}}}}).wx;
      const env = wx?.getAccountInfoSync().miniProgram.envVersion; return env === 'develop' || env === 'trial';
    } catch {return false;}
  }
  // P5使用wx.getMenuButtonBoundingClientRect及safeArea，换算设计坐标后返回。
  topAvoidance(): TopAvoidance { return {top: 0}; }
  // 同步读取原键名；损坏/不可用时由PlayerStore采用默认进度。
  getStorage(key: string): string | null {try {const wx=(globalThis as unknown as {wx?: {getStorageSync(k:string): unknown}}).wx;const value=wx?.getStorageSync(key);return typeof value==='string'?value:null;}catch{return null;} }
  // 本地存储沿用原型键名；写入异常交给既有存档调用方静默处理。
  setStorage(key: string, value: string): void {const wx=(globalThis as unknown as {wx?: {setStorageSync(k:string,v:string):void}}).wx;if(!wx?.setStorageSync)throw new Error('微信存储不可用');wx.setStorageSync(key,value);}
  // 清档只删除指定键；接口缺失或失败时向界面报告，不能假装成功。
  removeStorage(key: string): void {const wx=(globalThis as unknown as {wx?: {removeStorageSync(key: string): void}}).wx;if(!wx?.removeStorageSync)throw new Error('微信存储尚未接入');wx.removeStorageSync(key);}
  // 未接入广告时明确不可用。
  async showRewardedAd(_onTick?: (remaining: number | null) => void): Promise<boolean> { return false; }
  // 分享功能留给平台任务。
  share(): void {}
  // 震动功能留给平台任务。
  vibrate(_ms: number): void {}
}
