import {wechatAPI} from './wechat-api';
export type PackageProgress = (name:string,progress:number) => void;
// 微信分包先用原生任务报告下载进度，再让Cocos注册Bundle；只自动重试一次。
export class WechatPackages {
  private ready=new Set<string>();
  private flights=new Map<string,Promise<void>>();
  private closed=false;
  private pending=new Set<()=>void>();
  constructor(private readonly register:(name:string)=>Promise<unknown>) {}
  // 成功包不重复下载，失败不会留在缓存；手动重试仍调用同一入口。
  load(name:string,progress:PackageProgress=()=>{}):Promise<void> {
    if(this.closed)return Promise.reject(Error('加载已取消'));
    if(this.ready.has(name)){progress(name,100);return Promise.resolve();}
    const existing=this.flights.get(name);if(existing)return existing;
    const flight=(async()=>{for(let attempt=0;attempt<2;attempt++){
      try {progress(name,0);await this.download(name,progress);if(this.closed)throw Error('加载已取消');await this.registerBounded(name);if(this.closed)throw Error('加载已取消');this.ready.add(name);progress(name,100);return;}
      catch(error){if(this.closed||attempt===1)throw error;}
    }})().finally(()=>this.flights.delete(name));this.flights.set(name,flight);return flight;
  }
  // Cocos注册也可能丢回调；失败后保留同样的重试入口，不永远挂在100%。
  private registerBounded(name:string):Promise<void> {
    return new Promise((resolve,reject)=>{
      let settled=false;
      const done=(ok:boolean)=>{if(settled)return;settled=true;clearTimeout(timer);this.pending.delete(cancel);ok?resolve():reject(Error('分包注册失败：'+name));};
      const cancel=()=>done(false),timer=setTimeout(cancel,30000);this.pending.add(cancel);
      try{void this.register(name).then(()=>done(true),cancel);}catch{cancel();}
    });
  }
  // SDK漏回调同样有界；回调迟到不会更新已销毁的加载页。
  private download(name:string,progress:PackageProgress):Promise<void> {
    return new Promise((resolve,reject)=>{
      let settled=false;
      const done=(ok:boolean)=>{if(settled)return;settled=true;clearTimeout(timer);this.pending.delete(cancel);ok?resolve():reject(Error('分包加载失败：'+name));};
      const cancel=()=>done(false),timer=setTimeout(cancel,30000);this.pending.add(cancel);
      try {const api=wechatAPI();if(!api.loadSubpackage){cancel();return;}const task=api.loadSubpackage({name,success:()=>done(true),fail:cancel});task?.onProgressUpdate?.(v=>{if(!settled&&!this.closed&&Number.isFinite(v.progress))progress(name,Math.max(0,Math.min(100,v.progress)));});}catch{cancel();}
    });
  }
  // 不试图关闭用户的全局微信任务，只取消本加载器等待及进度回调。
  dispose():void {this.closed=true;for(const cancel of [...this.pending])cancel();}
}
