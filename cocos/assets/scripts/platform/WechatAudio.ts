import {wechatAPI, InnerAudio} from './wechat-api';
// 音效和音乐都遵循iOS静音键；产品如需改策略只改这里。
export const OBEY_MUTE_SWITCH = true;
const SFX_POOL_SIZE=6;
interface Voice {audio:InnerAudio;busy:boolean;at:number}
interface Music {audio:InnerAudio;name:string;url:string;volume:number}
// 六路音效+最多两路淡入淡出BGM，避免事件密集时无限创建原生音频实例。
export class WechatAudio {
  private voices:Voice[]=[];
  private tracks:Music[]=[];
  private current:Music|null=null;
  private positions:Record<string,number>={};
  private blocks=new Set<string>();
  private want:{name:string;url:string}|null=null;
  private closed=false;
  private sequence=0;
  private fades=new Map<InnerAudio,ReturnType<typeof setTimeout>>();
  // 创建失败即静音降级；不使用AudioSource绕开倍速或静音键策略。
  private create():InnerAudio|null {try {const a=wechatAPI().createInnerAudioContext?.();if(!a)return null;a.autoplay=false;a.obeyMuteSwitch=OBEY_MUTE_SWITCH;return a;}catch{return null;}}
  // 池满时复用最早的音效；每次重置src、音量、倍速和播放位置。
  sfx(url:string,volume:number,rate:number):boolean {
    if(this.closed||this.blocks.size)return false;
    let voice=this.voices.find(v=>!v.busy);
    if(!voice&&this.voices.length<SFX_POOL_SIZE){const audio=this.create();if(!audio)return false;voice={audio,busy:false,at:0};this.voices.push(voice);const released=()=>{voice!.busy=false;};audio.onEnded(released);audio.onError(released);}
    voice ||= this.voices.reduce((a,b)=>a.at<b.at?a:b);
    try {const a=voice.audio;a.stop();a.src=url;a.volume=Math.max(0,Math.min(1,volume));a.loop=false;a.playbackRate=Math.max(.5,Math.min(2,rate));a.startTime=0;voice.at=++this.sequence;voice.busy=true;a.play();return true;}catch{voice.busy=false;return false;}
  }
  // 新局即使采样还未载入也清除历史位置。
  reset(name:string):void {if(name==='work'&&(this.current?.name==='rush'||this.current?.name==='clearing'))this.stop(0);this.positions[name]=0;if(name==='work'){this.positions.rush=0;this.positions.clearing=0;}if(this.current?.name===name)this.stop(0);this.positions[name]=0;}
  // 同曲不重启；新局清空work/rush/clearing的位置，旧曲位置由原生currentTime记录。
  bgm(name:string|null,url='',fromStart=false):void {
    if(this.closed)return;
    if(fromStart&&name)this.reset(name);
    this.want=name?{name,url}:null;this.sync();
  }
  // 广告、来电和后台独立持锁；关闭其中一个不解开其他原因。
  blocked(reason:string,on:boolean):void {
    if(this.closed||this.blocks.has(reason)===on)return;
    if(on)this.blocks.add(reason);else this.blocks.delete(reason);
    if(this.blocks.size){for(const v of this.voices){v.audio.stop();v.busy=false;}for(const t of this.tracks){this.cancelFade(t.audio);t.audio.pause();}}
    else {for(const t of this.tracks)if(t!==this.current)t.audio.stop();if(this.current&&this.want?.name===this.current.name){this.current.audio.play();this.fade(this.current,.32,.5);}this.sync();}
  }
  // 仅在目标改变时换曲；断音期间记住目标，回前台不会重复创建BGM。
  private sync():void {
    if(this.blocks.size)return;
    const target=this.want;if(this.current?.name===target?.name)return;
    this.stop(target ? .6 : .3);if(!target?.url)return;
    let t=this.tracks.find(v=>v!==this.current&&!this.fades.has(v.audio));
    if(!t&&this.tracks.length<2){const audio=this.create();if(!audio)return;t={audio,name:'',url:'',volume:0};this.tracks.push(t);audio.onError(()=>{this.cancelFade(audio);if(this.current===t)this.current=null;});}
    if(!t)t=this.tracks[0];
    this.cancelFade(t.audio);t.audio.stop();t.name=target.name;t.url=target.url;t.volume=0;const a=t.audio;
    try {a.src=target.url;a.loop=true;a.volume=0;a.playbackRate=1;a.startTime=this.positions[t.name]||0;a.play();this.current=t;this.fade(t,.32,.5);}catch{this.current=null;}
  }
  // 保存位置后淡出，淡出完成stop；池仍保留两个实例供下次切曲复用。
  private stop(seconds:number):void {const t=this.current;if(!t)return;this.current=null;this.positions[t.name]=Number.isFinite(t.audio.currentTime)?t.audio.currentTime:0;this.fade(t,0,seconds,()=>t.audio.stop());}
  // 有限时长淡入淡出，不创建常驻轮询；暂停和销毁会清理所有计时器。
  private fade(track:Music,target:number,seconds:number,done?:()=>void):void {
    this.cancelFade(track.audio);const start=performance.now(),from=track.volume;
    const step=()=>{if(this.closed)return;const k=seconds?Math.min(1,(performance.now()-start)/(seconds*1000)):1;track.volume=from+(target-from)*k;track.audio.volume=track.volume;if(k>=1){this.fades.delete(track.audio);done?.();}else this.fades.set(track.audio,setTimeout(step,25));};step();
  }
  private cancelFade(audio:InnerAudio):void {const timer=this.fades.get(audio);if(timer!==undefined)clearTimeout(timer);this.fades.delete(audio);}
  // 销毁实例一并释放其回调，不调用全局音频中断off。
  dispose():void {if(this.closed)return;this.closed=true;for(const v of this.voices)v.audio.destroy();for(const t of this.tracks){this.cancelFade(t.audio);t.audio.destroy();}this.voices=[];this.tracks=[];this.current=null;}
}
