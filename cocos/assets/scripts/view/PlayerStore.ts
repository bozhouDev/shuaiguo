import {Platform} from '../platform/Platform';
import {Progress} from '../core/types';
export interface Settings {music: boolean; sfx: boolean; vibrate: boolean}
// 原型loadProgress/settings的同键同字段读写，不做版本迁移或重命名。
export class PlayerStore {
  // 只属于本会话的显示失效标记，云端回写也经save；不进入存档或玩法。
  revision=0;
  settings: Settings = {music: true, sfx: true, vibrate: true};
  constructor(readonly platform: Platform) {try {Object.assign(this.settings, JSON.parse(platform.getStorage('shuaiguo_settings') || 'null') || {});} catch { /* 损坏用默认。 */ }}
  // 读取失败按原型返回空进度，旧best没有debt也原样保留。
  read(): Progress {try {return JSON.parse(this.platform.getStorage('shuaiguo_v3') || 'null') || {unlocked: 1, best: {}};} catch {return {unlocked: 1, best: {}};}}
  // 普通过关保存失败静默；名称编辑可根据返回值给原型提示。
  save(progress: Progress): boolean {try {this.platform.setStorage('shuaiguo_v3', JSON.stringify(progress)); this.revision++; return true;} catch {return false;}}
  // 调试清档只移除进度键（含称呼、教学、成就），保留声音设置和其他应用数据。
  clear(): boolean {try {this.platform.removeStorage('shuaiguo_v3'); this.revision++; return true;} catch {return false;}}
  // 三个开关立即写入，持久化被禁用时不影响本次设置。
  set(key: keyof Settings, on: boolean): void {this.settings[key] = !!on; try {this.platform.setStorage('shuaiguo_settings', JSON.stringify(this.settings));} catch { /* 原型同样忽略。 */ }}
}
