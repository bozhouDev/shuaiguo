// 网址参数的最小替身：微信小游戏没有 URLSearchParams，启动时直接 new 会崩。
// 只实现项目用到的 get / has / set / delete；网页传入 location.search 解析，微信传空串。
export class QueryParams {
  private map = new Map<string, string>();
  // 解析 "?a=1&b=2" 形式的查询串；无法解码的片段按原文保存。
  constructor(search = '') {
    for (const part of search.replace(/^\?/, '').split('&')) {
      if (!part) continue;
      const i = part.indexOf('='), k = i < 0 ? part : part.slice(0, i), v = i < 0 ? '' : part.slice(i + 1);
      this.map.set(QueryParams.decode(k), QueryParams.decode(v));
    }
  }
  // 与 URLSearchParams 一致：+ 当空格，%xx 解码，失败退回原文。
  private static decode(text: string): string {try {return decodeURIComponent(text.replace(/\+/g, ' '));} catch {return text;}}
  // 读取参数，没有时返回 null。
  get(key: string): string | null {return this.map.has(key) ? this.map.get(key)! : null;}
  // 是否带了这个参数。
  has(key: string): boolean {return this.map.has(key);}
  // 写入参数（调试面板改 auto / seed 用）。
  set(key: string, value: string): void {this.map.set(key, value);}
  // 删除参数。
  delete(key: string): void {this.map.delete(key);}
}
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
