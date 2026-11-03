export type CloudResult<T = unknown> = {ok: true; data: T} | {ok: false; error: string};
export interface CloudAPI {init(): Promise<boolean>; call<T = unknown>(name: string, data: unknown, timeoutMs?: number): Promise<CloudResult<T>>}
// 微信逻辑像素换算为375宽设计坐标；capsule是右上不可遮挡矩形。
export interface TopAvoidance {top: number; capsule?: {x: number; y: number; w: number; h: number}}
export interface Lifecycle {hide(): void; show(): void}
export type AudioFocus = (reason:'ad'|'interruption',blocked:boolean) => void;
export interface ShareRequest {title?:string; image?:()=>Promise<string>; valid?:()=>boolean}
// 平台边界：玩法不直接依赖微信API，网页继续使用原有实现。
export interface Platform {
  readonly kind: 'web' | 'wechat';
  readonly cloud: CloudAPI;
  setUserCloudStorage(data: {key:string;value:string}[]): Promise<boolean>;
  debugEnabled(): boolean;
  topAvoidance(): TopAvoidance;
  getStorage(key: string): string | null;
  setStorage(key: string, value: string): void;
  removeStorage(key: string): void;
  showRewardedAd(onTick?: (remaining: number | null) => void): Promise<boolean>;
  share(request?: ShareRequest): void;
  onLifecycle?(listener: Lifecycle): () => void;
  onAudioFocus?(listener: AudioFocus): () => void;
  vibrate(ms: number): void;
  dispose?(): void;
}
