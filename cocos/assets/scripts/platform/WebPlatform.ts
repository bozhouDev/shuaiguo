import type { Platform, TopAvoidance } from './Platform';

// 网页存档沿用原型键名；广告、分享等仍留给后续任务。
export class WebPlatform implements Platform {
  readonly kind = 'web';
  // 网页没有胶囊，和原型一样从0开始布局。
  topAvoidance(): TopAvoidance { return {top: 0}; }
  // 未接入时返回无数据。
  getStorage(key: string): string | null { try { return localStorage.getItem(key); } catch { return null; } }
  // 后续接 localStorage，键名沿用原型。
  setStorage(key: string, value: string): void { try { localStorage.setItem(key, value); } catch { /* 原型同样容忍存储禁用。 */ } }
  // 未接入广告时明确不可用。
  async showRewardedAd(): Promise<boolean> { return false; }
  // 分享功能留给平台任务。
  share(): void {}
  // 震动功能留给平台任务。
  vibrate(): void {}
}
