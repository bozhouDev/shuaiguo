import type { Platform, TopAvoidance } from './Platform';

// 微信其余能力仍为P5空壳；环境判断和按键清档先接平台接口，正式版不得放行调试。
export class WechatPlatform implements Platform {
  readonly kind = 'wechat';
  // 只放行已确认的开发/体验版；接口缺失、异常或未知环境一律关闭。
  debugEnabled(): boolean {
    try {const wx = (globalThis as unknown as {wx?: {getAccountInfoSync(): {miniProgram: {envVersion: string}}}}).wx;
      const env = wx?.getAccountInfoSync().miniProgram.envVersion; return env === 'develop' || env === 'trial';
    } catch {return false;}
  }
  // P5使用wx.getMenuButtonBoundingClientRect及safeArea，换算设计坐标后返回。
  topAvoidance(): TopAvoidance { return {top: 0}; }
  // 未接入时返回无数据。
  getStorage(_key: string): string | null { return null; }
  // 后续接微信本地存储，键名沿用原型。
  setStorage(_key: string, _value: string): void {}
  // 清档只删除指定键；接口缺失或失败时向界面报告，不能假装成功。
  removeStorage(key: string): void {const wx=(globalThis as unknown as {wx?: {removeStorageSync(key: string): void}}).wx;if(!wx?.removeStorageSync)throw new Error('微信存储尚未接入');wx.removeStorageSync(key);}
  // 未接入广告时明确不可用。
  async showRewardedAd(_onTick?: (remaining: number | null) => void): Promise<boolean> { return false; }
  // 分享功能留给平台任务。
  share(): void {}
  // 震动功能留给平台任务。
  vibrate(_ms: number): void {}
}
