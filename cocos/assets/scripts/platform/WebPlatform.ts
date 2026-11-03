import type { Platform } from './Platform';

// 网页适配空壳：本任务不读写真实存档，也不模拟广告成功。
export class WebPlatform implements Platform {
  readonly kind = 'web';
  // 未接入时返回无数据。
  getStorage(_key: string): string | null { return null; }
  // 后续接 localStorage，键名沿用原型。
  setStorage(_key: string, _value: string): void {}
  // 未接入广告时明确不可用。
  async showRewardedAd(): Promise<boolean> { return false; }
  // 分享功能留给平台任务。
  share(): void {}
  // 震动功能留给平台任务。
  vibrate(): void {}
}
