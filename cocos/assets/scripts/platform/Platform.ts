// 平台边界先定接口；存储、广告、分享、震动、云开发留给后续任务。
export interface Platform {
  readonly kind: 'web' | 'wechat';
  getStorage(key: string): string | null;
  setStorage(key: string, value: string): void;
  showRewardedAd(): Promise<boolean>;
  share(): void;
  vibrate(): void;
}
