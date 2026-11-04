import type { Platform, TopAvoidance, CloudAPI } from './Platform';
import { QueryParams } from './Platform';

// 网页存档沿用原型键名；广告、分享等仍留给后续任务。
export class WebPlatform implements Platform {
  readonly kind = 'web';
  // 网页明确不接云，不排网络请求。
  readonly cloud: CloudAPI = {async init(){return false;},async call(){return {ok:false,error:'unavailable'};}};
  async setUserCloudStorage(): Promise<boolean> {return false;}
  // 网页必须显式带debug=1；没有地址环境时保持关闭。
  debugEnabled(): boolean {return typeof location !== 'undefined' && new QueryParams(location.search).get('debug') === '1';}
  // 网页没有胶囊，和原型一样从0开始布局。
  topAvoidance(): TopAvoidance { return {top: 0}; }
  // 未接入时返回无数据。
  getStorage(key: string): string | null { try { return localStorage.getItem(key); } catch { return null; } }
  // 写入异常交给调用方：普通进度静默，名称编辑显示原型的失败提示。
  setStorage(key: string, value: string): void { localStorage.setItem(key, value); }
  // 仅删除指定游戏键，异常交给清档界面显示。
  removeStorage(key: string): void {localStorage.removeItem(key);}
  private ads = new Map<ReturnType<typeof setTimeout>, () => void>();
  // 网页忠实fakeAd：3/2/1各650ms，结束才发奖；销毁时取消，不发奖励。
  showRewardedAd(onTick?: (remaining: number | null) => void): Promise<boolean> {
    return new Promise(resolve => {
      let n = 3;
      const tick = () => {if (n <= 0) {onTick?.(null); resolve(true); return;} onTick?.(n--); const timer = setTimeout(() => {this.ads.delete(timer); tick();}, 650); this.ads.set(timer, () => {onTick?.(null); resolve(false);});}; tick();
    });
  }
  // 释放本任务未完成的假广告计时器。
  dispose(): void {for (const [timer, cancel] of this.ads) {clearTimeout(timer); cancel();} this.ads.clear();}
  // 分享功能留给平台任务。
  share(): void {}
  // 震动功能留给平台任务。
  vibrate(ms: number): void {const activation = (navigator as Navigator & {userActivation?: {hasBeenActive: boolean}}).userActivation; if (!navigator.vibrate || activation && !activation.hasBeenActive) return; try {navigator.vibrate(ms || 30);} catch { /* 不支持时静默。 */ }}
}
