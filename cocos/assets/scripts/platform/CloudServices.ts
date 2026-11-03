import type {Platform, CloudResult} from './Platform';
import type {Progress, Level} from '../core/types';
import {mergeProgress} from '../core/progress';
import {sanitizeConfig, levelForMatch} from '../core/remote-config';
import type {RemoteConfig} from '../core/remote-config';
export interface CloudStore {read(): Progress; save(value: Progress): boolean}
export interface TrackEvent {id: string; type: string; at: number; level: number; [key: string]: unknown}
export interface RankScore {rank: number; stars: number; debt: number; blames: number; duration: number}
export interface RankRow {name: string; level: number; stars: number; debt: number; blames: number; rank: number; position?: number}
export interface RankTop {top: RankRow[]; myRank: number|null; mine: RankRow|null}
const CONFIG_KEY='shuaiguo_cloud_config',QUEUE_KEY='shuaiguo_cloud_events',FRIEND_KEY='shuaiguo_friend_debt';
export const CLOUD_QUEUE_LIMIT=200,CLOUD_BATCH_SIZE=20;
// 移植计划§5数据层：没有节点/弹窗/画面依赖；所有失败只保留本地状态。
export class CloudServices {
  private config: RemoteConfig;
  private queue: TrackEvent[]=[];
  private friends: Record<string,number>={};
  private alive=true;
  private ready=false;
  private saveTimer?: ReturnType<typeof setTimeout>;
  private saveFlight?: Promise<void>;
  private flushFlight?: Promise<void>;
  private friendFlight?: Promise<void>;
  private dirty=false;
  private sequence=0;
  // 埋点ID只用于重试去重，不是身份；session前缀不消费core随机数。
  private session=Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10);
  constructor(readonly platform:Platform,readonly store:CloudStore){
    this.config=sanitizeConfig(this.read(CONFIG_KEY));
    if(platform.kind==='wechat'){
      const q=this.read(QUEUE_KEY);if(Array.isArray(q))this.queue=q.filter(v=>v&&typeof v.id==='string'&&typeof v.type==='string').slice(-CLOUD_QUEUE_LIMIT);
      const f=this.read(FRIEND_KEY);if(f&&typeof f==='object')for(const [id,n]of Object.entries(f))if(/^\d+$/.test(id)&&typeof n==='number'&&Number.isFinite(n)&&n>=0)this.friends[id]=n;
    }
  }
  // 启动调用不await；磁盘缓存已同步加载，初始化/远端等待与进大厅完全独立。
  async start():Promise<void>{
    if(this.platform.kind!=='wechat')return;
    this.ready=await this.platform.cloud.init();if(!this.ready||!this.alive)return;
    await Promise.all([this.fetchConfig(),this.pullSave(),this.flush(),this.syncFriends()]);
  }
  // 每次开局从缓存生成独立深拷贝；不会持有已开始对局的引用。
  level(index:number):Level{return levelForMatch(index,this.config);}
  // 只接受非回退版本；空配置也可以用更高版本撤回覆盖。
  private async fetchConfig():Promise<void>{
    const r=await this.platform.cloud.call<unknown>('config',{});if(!this.alive||!r.ok)return;
    const config=sanitizeConfig(r.data);if(config.version<this.config.version)return;
    this.config=config;this.write(CONFIG_KEY,config);
  }
  // 拉取后再次读本地，避免网络等待时新结算/改名丢失；随后put让多设备也获得合并结果。
  private async pullSave():Promise<void>{
    const r=await this.platform.cloud.call<Progress>('save',{action:'get'});if(!this.alive||!r.ok)return;
    try{this.store.save(mergeProgress(this.store.read(),r.data));this.progressChanged();}catch{/* 损坏远端数据不影响本地。 */}
  }
  // 本地已经保存才通知云；防抖合并结算、成就和带教连续事件。
  progressChanged():void{if(!this.alive||this.platform.kind!=='wechat')return;this.dirty=true;if(this.saveTimer)clearTimeout(this.saveTimer);this.saveTimer=setTimeout(()=>{this.saveTimer=undefined;void this.syncSave();},400);}
  // 同时只允许一个上传；响应回来后仍与最新本地合并，不能覆盖等待期间的进度。
  async syncSave():Promise<void>{
    if(!this.alive||!this.ready||!this.dirty)return;
    if(this.saveFlight)return this.saveFlight;
    this.dirty=false;let uploaded=false;
    this.saveFlight=(async()=>{
      const r=await this.platform.cloud.call<Progress>('save',{action:'put',progress:this.store.read()});
      if(!this.alive)return;if(!r.ok){this.dirty=true;return;}
      try{this.store.save(mergeProgress(r.data,this.store.read()));uploaded=true;}catch{this.dirty=true;}
    })();
    try{await this.saveFlight;}finally{this.saveFlight=undefined;if(uploaded&&this.dirty&&this.alive)this.progressChanged();}
  }
  // 字段由调用点提供，服务端再做白名单；网页/simulate根本不调用队列。
  track(type:string,level:number,fields:Record<string,unknown>={}):void{
    if(!this.alive||this.platform.kind!=='wechat')return;
    this.queue.push({...fields,id:this.session+'_'+(++this.sequence),type,level,at:Date.now()});
    this.queue=this.queue.slice(-CLOUD_QUEUE_LIMIT);this.write(QUEUE_KEY,this.queue);
    if(this.queue.length>=CLOUD_BATCH_SIZE)void this.flush();
  }
  // 一次只发一个批次；精确按ID删已确认项，发送中新增事件和失败队列不会丢。
  async flush():Promise<void>{
    if(!this.alive||!this.ready||!this.queue.length)return;
    if(this.flushFlight)return this.flushFlight;
    this.flushFlight=(async()=>{
      // 每次触发至多排空当前有界队列，不启用后台轮询或无限重试。
      const batches=Math.ceil(this.queue.length/CLOUD_BATCH_SIZE);
      for(let i=0;i<batches&&this.queue.length&&this.alive;i++){
        const batch=this.queue.slice(0,CLOUD_BATCH_SIZE),ids=new Set(batch.map(e=>e.id));
        const r=await this.platform.cloud.call('track',{events:batch});if(!this.alive||!r.ok)return;
        this.queue=this.queue.filter(e=>!ids.has(e.id));this.write(QUEUE_KEY,this.queue);
      }
    })();try{await this.flushFlight;}finally{this.flushFlight=undefined;}
  }
  // 每次有星结算送排行；最好成绩更新由服务端事务保证。好友只写曾获得的最小总账。
  settled(level:number,score:RankScore):void{
    if(!this.alive||this.platform.kind!=='wechat'||score.stars<=0)return;
    void this.platform.cloud.call('rank',{action:'submit',level,score});
    this.friends[level]=Math.min(this.friends[level]??Infinity,score.debt);this.write(FRIEND_KEY,this.friends);void this.syncFriends();
  }
  // 读取留给后续排行榜界面，失败时返回不可用，不抛异常。
  top(level:number):Promise<CloudResult<RankTop>>{return this.platform.cloud.call<RankTop>('rank',{action:'top',level});}
  // 每次写全部关卡最小值，失败保留磁盘；重启时从本地best补历史数据。
  private async syncFriends():Promise<void>{
    if(!this.alive||this.platform.kind!=='wechat')return;if(this.friendFlight)return this.friendFlight;
    const best=this.store.read().best;
    for(const [id,b]of Object.entries(best))if(b.stars>0&&Number.isFinite(b.debt))this.friends[id]=Math.min(this.friends[id]??Infinity,b.debt!);
    this.write(FRIEND_KEY,this.friends);
    const data=Object.entries(this.friends).map(([id,debt])=>({key:'sg_debt_v1_'+id,value:JSON.stringify({v:1,debt})}));
    if(!data.length)return;
    this.friendFlight=(async()=>{await this.platform.setUserCloudStorage(data);})();try{await this.friendFlight;}finally{this.friendFlight=undefined;}
  }
  // 结算/切后台/回前台触发下一次同步；断网时保留本地，绝不定时轰炸网络。
  background():void{if(this.saveTimer){clearTimeout(this.saveTimer);this.saveTimer=undefined;}void this.syncSave();void this.flush();}
  foreground():void{if(!this.alive)return;void this.start();}
  // 本地缓存损坏时视作无数据，不能影响游戏启动。
  private read(key:string):unknown{try{return JSON.parse(this.platform.getStorage(key)||'null');}catch{return null;}}
  // 存储额度/权限失败仅影响跨启动恢复，本次会话继续使用内存。
  private write(key:string,value:unknown):void{try{this.platform.setStorage(key,JSON.stringify(value));}catch{/* 容量满时仍有本次会话内存兜底。 */}}
  // 不在销毁后写回远端响应；停止防抖等待，不创建长驻进程。
  dispose():void{this.alive=false;if(this.saveTimer)clearTimeout(this.saveTimer);this.saveTimer=undefined;}
}
