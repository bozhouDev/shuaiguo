import type {CloudAPI, CloudResult} from './Platform';
export const CLOUD_ENV = 'cloud1-d3gio6bskae9e684b';
// 只描述本卡用到的微信边界；不依赖Cocos或全局SDK类型。
export interface CloudWx {
  cloud?: {init(options: {env: string}): unknown; callFunction(options: {name: string; data: unknown; success: (v: {result: unknown}) => void; fail: () => void}): unknown};
  setUserCloudStorage?: (options: {KVDataList: {key: string; value: string}[]; success: () => void; fail: () => void}) => void;
}
// 每次动态取wx，缺接口和异常都按不可用处理。
export function cloudWx(): CloudWx {return (globalThis as unknown as {wx?: CloudWx}).wx || {};}
// callback和Promise双路径共用一次结算；超时、销毁都释放计时器，迟到结果不进入游戏。
export class WechatCloud implements CloudAPI {
  private ready = false;
  private closed = false;
  private pending = new Set<() => void>();
  // 微信init通常同步完成，也兼容返回Promise的mock/版本；初始化同样限时。
  async init(): Promise<boolean> {
    if (this.closed) return false;
    if (this.ready) return true;
    const result = await this.bounded<boolean>((done) => {
      const api = cloudWx().cloud; if (!api) {done({ok:false,error:'unavailable'}); return;}
      Promise.resolve(api.init({env:CLOUD_ENV})).then(()=>done({ok:true,data:true}),()=>done({ok:false,error:'unavailable'}));
    },3000);
    this.ready = result.ok; return this.ready;
  }
  // 本地超时不会取消服务端执行，因此服务端put/submit/track都必须支持安全重试。
  async call<T>(name: string, data: unknown, timeoutMs = 3000): Promise<CloudResult<T>> {
    if (!this.ready || this.closed) return {ok:false,error:'unavailable'};
    return this.bounded<T>(done=>{
      const api=cloudWx().cloud; if(!api){done({ok:false,error:'unavailable'});return;}
      const success=(v:{result:unknown})=>{
        const r=v?.result as CloudResult<T>;
        done(r && typeof r.ok==='boolean' ? r : {ok:false,error:'unavailable'});
      };
      const fail=()=>done({ok:false,error:'unavailable'});
      const p=api.callFunction({name,data,success,fail});
      if(p && typeof (p as Promise<unknown>).then==='function') (p as Promise<{result:unknown}>).then(success,fail);
    },timeoutMs);
  }
  // 好友存储也有超时；只上传每关数字总账，不含任何自定义称呼。
  async setUserCloudStorage(KVDataList: {key:string;value:string}[]): Promise<boolean> {
    const r=await this.bounded<boolean>(done=>{
      const api=cloudWx().setUserCloudStorage;if(!api){done({ok:false,error:'unavailable'});return;}
      api({KVDataList,success:()=>done({ok:true,data:true}),fail:()=>done({ok:false,error:'unavailable'})});
    },3000);return r.ok;
  }
  // 所有等待统一有界，抛错不会逃出平台层。
  private bounded<T>(invoke:(done:(result:CloudResult<T>)=>void)=>void,timeoutMs:number):Promise<CloudResult<T>> {
    if(this.closed)return Promise.resolve({ok:false,error:'unavailable'});
    return new Promise(resolve=>{
      let settled=false;
      const cancel=()=>done({ok:false,error:'unavailable'});
      const done=(r:CloudResult<T>)=>{if(settled)return;settled=true;clearTimeout(timer);this.pending.delete(cancel);resolve(r);};
      const timer=setTimeout(cancel,Number.isFinite(timeoutMs)?Math.max(1,Math.min(10000,timeoutMs)):3000);
      this.pending.add(cancel);try{invoke(done);}catch{cancel();}
    });
  }
  // 释放本平台全部等待，不触碰用户或其他页面的资源。
  dispose():void {this.closed=true;this.ready=false;for(const cancel of Array.from(this.pending))cancel();}
}
