// 顶部物理像素已换算成设计坐标；capsule是右上不可遮挡矩形，微信P5接真实API。
export interface TopAvoidance {top: number; capsule?: {x: number; y: number; w: number; h: number}}
// 平台边界先定接口；存储、广告、分享、震动、云开发留给后续任务。
export interface Platform {
  readonly kind: 'web' | 'wechat';
  topAvoidance(): TopAvoidance;
  getStorage(key: string): string | null;
  setStorage(key: string, value: string): void;
  showRewardedAd(): Promise<boolean>;
  share(): void;
  vibrate(): void;
}
