import type { Platform, TopAvoidance } from './Platform';

// 微信适配空壳：不调用 wx、云开发或广告接口。
export class WechatPlatform implements Platform {
  readonly kind = 'wechat';
  // P5使用wx.getMenuButtonBoundingClientRect及safeArea，换算设计坐标后返回。
  topAvoidance(): TopAvoidance { return {top: 0}; }
  // 未接入时返回无数据。
  getStorage(_key: string): string | null { return null; }
  // 后续接微信本地存储，键名沿用原型。
  setStorage(_key: string, _value: string): void {}
  // 未接入广告时明确不可用。
  async showRewardedAd(): Promise<boolean> { return false; }
  // 分享功能留给平台任务。
  share(): void {}
  // 震动功能留给平台任务。
  vibrate(): void {}
}
