import {AudioClip, AudioSource, Node, assetManager, tween} from 'cc';
import {Platform} from '../platform/Platform';
import {Settings} from './PlayerStore';
import {SFX} from './audio-data';
import {WechatAudio} from '../platform/WechatAudio';
export interface SoundOptions {vol?: number; rate?: number; delay?: number}
interface Track {name: string; src: AudioBufferSourceNode; gain: GainNode; offset: number; start: number}
// 网页用公开WebAudio实现原型的倍速/延迟/两总线；资源地址来自Cocos audio Bundle。
// 微信用原生InnerAudioContext小池，保留倍速、静音键和广告/来电/后台互斥。
export class AudioView {
  readonly calls: Record<string, number> = {}; readonly played: Record<string, number> = {};
  private context: AudioContext | null = null;
  private sfxBus?: GainNode; private musicBus?: GainNode;
  private buffers = new Map<string, AudioBuffer>(); private clips = new Map<string, AudioClip>();
  private failed = new Set<string>();
  private loads = new Map<string, Promise<AudioClip | null>>();
  private bundle?: Promise<import('cc').AssetManager.Bundle>;
  private last: Record<string, number> = {}; private positions: Record<string, number> = {};
  private current: Track | null = null; private want: string | null = null; private alive = true;
  private sources = new Set<AudioSource>(); private timers = new Set<ReturnType<typeof setTimeout>>();
  private nativeBgm: AudioSource | null = null; private nativeName = ''; private unlocked = false;
  private background = false; private synthStep = 0; private synthNext = 0;
  private scheduler?: ReturnType<typeof setInterval>;
  private active = new Set<AudioBufferSourceNode>();
  private wechat?: WechatAudio;
  private wechatUrls = new Map<string,string>();
  private offFocus?: () => void;
  constructor(readonly root: Node, readonly platform: Platform, readonly settings: Settings) {
    if(platform.kind==='wechat'){this.wechat=new WechatAudio();this.offFocus=platform.onAudioFocus?.((reason,on)=>this.wechat!.blocked(reason,on));}
  }
  // 音频包异步加载，不阻塞大厅，短音只在首次交互预载，BGM按需。
  private clip(id: string): Promise<AudioClip | null> {
    if (this.loads.has(id)) return this.loads.get(id)!;
    this.bundle ||= new Promise((resolve, reject) => assetManager.loadBundle('audio', (err, b) => err ? reject(err) : resolve(b)));
    // 微信只解析Bundle已登记的原生文件地址；b.load(AudioClip)会隐式创建播放器，破坏小池上限。
    if(this.wechat){const load=this.bundle.then(b=>{const info=b.getInfoWithPath(id,AudioClip);if(!info)throw Error('音频路径缺失：'+id);const url=assetManager.utils.getUrlWithUuid(info.uuid,{isNative:true,nativeExt:'.mp3'});if(this.alive){this.wechatUrls.set(id,url);this.sync();}return null;}).catch(error=>{this.failed.add(id);if(this.alive)console.warn('音频采样加载失败',id,error);return null;});this.loads.set(id,load);return load;}
    const load = this.bundle.then(b => new Promise<AudioClip>((resolve, reject) => b.load(id, AudioClip, (err, clip) => err ? reject(err) : resolve(clip))))
      .then(async clip => {if (!this.alive) return null; this.clips.set(id, clip); if (this.context) {const response = await fetch(clip.nativeUrl); if (!response.ok) throw new Error(String(response.status)); this.buffers.set(id, await this.context.decodeAudioData(await response.arrayBuffer()));} return clip;})
      .catch(error => {this.clips.delete(id);this.failed.add(id);if (this.alive) console.warn('音频采样加载失败', id, error); return null;});
    this.loads.set(id, load); return load;
  }
  // 只由实际触摸/按键调用；调试自动运行前不会发声。
  unlock(): void {
    if (!this.alive) return;
    if (!this.unlocked) {
      this.unlocked = true;
      if (this.platform.kind === 'web') {
        const Constructor = typeof window !== 'undefined' && (window.AudioContext || (window as unknown as {webkitAudioContext: typeof AudioContext}).webkitAudioContext);
        if (Constructor) {try {this.context = new Constructor();} catch {this.unlocked=false;return;} this.sfxBus = this.context.createGain(); this.sfxBus.gain.value = 1; this.sfxBus.connect(this.context.destination); this.musicBus = this.context.createGain(); this.musicBus.gain.value = .32; this.musicBus.connect(this.context.destination);}
      }
      for (const d of Object.values(SFX)) void this.clip(d.id);
      if(this.context)this.scheduler=setInterval(()=>this.synthMusic(),100);
    }
    if (!this.background && this.context?.state === 'suspended') void this.context.resume();
    this.sync();
  }
  // 实际音频时钟上同名50ms去重；延迟也计入比较，与原型一致。
  sfx(name: string, opt: SoundOptions = {}): void {
    this.calls[name] = (this.calls[name] || 0) + 1;
    if (!this.unlocked || !this.settings.sfx || !this.alive) return;
    const d = SFX[name], now = (this.context?.currentTime ?? performance.now() / 1000) + (opt.delay || 0);
    if (now - (this.last[name] ?? -1) < .05) return;
    this.last[name] = now;
    if (!d) return; // 未登记的音效保持静默。
    if(this.context&&!this.buffers.has(d.id)){if(opt.delay)this.later(opt.delay,()=>this.synth(d.fb||name));else this.synth(d.fb||name);return;}
    const volume = d.vol * (opt.vol ?? 1), rate = (d.rate || 1) * (opt.rate || 1);
    const play = (delay: number, speed: number) => {
      if(this.wechat){this.later(delay,()=>{if(this.settings.sfx&&!this.background&&this.wechatUrls.has(d.id)&&this.wechat!.sfx(this.wechatUrls.get(d.id)!,volume,speed))this.played[name]=(this.played[name]||0)+1;});return;}
      const buffer = this.buffers.get(d.id);
      if (this.context && buffer) {const source = this.context.createBufferSource(), gain = this.context.createGain(); source.buffer = buffer; source.playbackRate.value = speed; gain.gain.value = volume; source.connect(gain); gain.connect(this.sfxBus!); this.active.add(source);source.onended=()=>{this.active.delete(source);source.disconnect();gain.disconnect();};source.start(this.context.currentTime + delay); this.played[name] = (this.played[name] || 0) + 1;}
      else if (!this.context && this.clips.has(d.id)) this.later(delay, () => {const node = new Node('Sound-' + name); this.root.addChild(node); const source = node.addComponent(AudioSource); source.clip = this.clips.get(d.id)!; source.playOnAwake = false; source.volume = volume; source.play(); this.sources.add(source); source.node.once(AudioSource.EventType.ENDED, () => {this.sources.delete(source); node.destroy();}); this.played[name] = (this.played[name] || 0) + 1;});
    };
    play(opt.delay || 0, rate); if (d.twice) play((opt.delay || 0) + d.twice, rate * 1.12);
  }
  // 记录播放位置后淡出，正常停止.3秒，换曲.6秒。
  private stop(fade: number): void {const c = this.current, ctx = this.context; if (c && ctx) {this.positions[c.name] = (c.offset + ctx.currentTime - c.start) % c.src.buffer!.duration; c.gain.gain.cancelScheduledValues(ctx.currentTime); c.gain.gain.setValueAtTime(c.gain.gain.value, ctx.currentTime); c.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + fade); c.src.stop(ctx.currentTime + fade + .05); this.current = null;} if (this.nativeBgm) {const source=this.nativeBgm;this.positions[this.nativeName]=source.currentTime;tween(source).to(fade,{volume:0}).call(()=>{source.stop();source.destroy();}).start();this.nativeBgm=null;}}
  // clearing使用预渲染快1.15倍副本，保持所有平台1倍播放；新开局work/rush/clearing归零。
  // 暂停继续、返回大厅均接上次位置。
  bgm(name: string | boolean, fromStart = false): void {this.want = name === true ? 'work' : typeof name === 'string' ? name : null; if(fromStart&&this.wechat&&this.want)this.wechat.reset(this.want); if (fromStart && this.want) {if(this.want==='work'&&(this.current?.name==='rush'||this.current?.name==='clearing'||this.nativeName==='rush'||this.nativeName==='clearing'))this.stop(0);this.positions[this.want] = 0; if (this.want === 'work') {this.positions.rush = 0;this.positions.clearing = 0;}} this.sync();}
  // 加载完成再复查当前想放的歌，避免慢加载把旧场景音乐放出来。
  sync(): void {
    const name = this.settings.music ? this.want : null;
    if(this.wechat){const id=`bgm_${name}`,url=this.wechatUrls.get(id);if(name&&!url){this.wechat.bgm(null);if(!this.failed.has(id))void this.clip(id).then(v=>{if(v&&this.alive)this.sync();});return;}this.wechat.bgm(this.unlocked?name:null,url||'');return;}
    if (this.current?.name === name || this.nativeBgm?.clip?.name === `bgm_${name}`) return;
    if (this.current || this.nativeBgm) this.stop(name ? .6 : .3);
    if (!name || !this.unlocked || !this.alive) return;
    const id = `bgm_${name}`, clip = this.clips.get(id), buffer = this.buffers.get(id);
    if (!clip || this.context && !buffer) {void this.clip(id).then(result => {if (result && this.alive) this.sync();}); return;}
    if (this.context && buffer) {const ctx = this.context, src = ctx.createBufferSource(), gain = ctx.createGain(), offset = (this.positions[name] || 0) % buffer.duration; src.buffer = buffer; src.loop = true; gain.gain.setValueAtTime(0, ctx.currentTime); gain.gain.linearRampToValueAtTime(1, ctx.currentTime + .5); src.connect(gain); gain.connect(this.musicBus!); src.start(ctx.currentTime, offset); this.current = {name, src, gain, offset, start: ctx.currentTime};}
    else {const source = this.root.addComponent(AudioSource); source.playOnAwake = false; source.clip = clip!; source.loop = true; source.volume = 0; this.nativeName=name; source.currentTime = this.positions[name] || 0; source.play();tween(source).to(.5,{volume:.32}).start();this.nativeBgm = source;}
  }
  // 切后台整体挂起，回来恢复；游戏仍停在暂停页。
  hidden(hide: boolean): void {this.background=hide;if(this.wechat){this.wechat.blocked('background',hide);return;}if (this.context) {if (hide) void this.context.suspend(); else if (this.unlocked) void this.context.resume();} else {for (const source of this.sources) hide ? source.pause() : source.play(); if (this.nativeBgm) hide ? this.nativeBgm.pause() : this.nativeBgm.play();}}
  // 频率滑音兜底，连接同一音效总线。
  private tone(f0:number,f1:number,dur:number,type:OscillatorType='square',vol=.08,delay=0): void {
    const t0 = this.context!.currentTime + (delay || 0);
    const o = this.context!.createOscillator(), g = this.context!.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
    g.gain.setValueAtTime(vol || 0.08, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.sfxBus!);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  // 合成音预设（原型阶段的音效，现在只在采样缺失时兜底）
  private synth(name:string): void {
    switch (name) {
      case 'hit': this.tone(220, 90, 0.18, 'square', 0.09); break;
      case 'throw': this.tone(300, 900, 0.14, 'triangle', 0.1); break;
      case 'combo': this.tone(600, 1200, 0.1, 'triangle', 0.08); this.tone(900, 1600, 0.1, 'triangle', 0.07, 0.08); break;
      case 'back': this.tone(500, 120, 0.3, 'sawtooth', 0.07); break;
      case 'boss': this.tone(440, 440, 0.12, 'square', 0.07); this.tone(330, 330, 0.18, 'square', 0.07, 0.14); break;
      case 'warn': this.tone(880, 880, 0.06, 'sine', 0.05); break;
      case 'rankup': [523, 659, 784].forEach((f, i) => this.tone(f, f, 0.09, 'triangle', 0.07, i * 0.08)); break;
      case 'win': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, f, 0.16, 'triangle', 0.08, i * 0.12)); break;
      case 'lose': [392, 330, 262, 196].forEach((f, i) => this.tone(f, f * 0.98, 0.2, 'square', 0.06, i * 0.15)); break;
      case 'tick': this.tone(1200, 1200, 0.03, 'sine', 0.03); break;
      case 'tickUrgent': this.tone(1500, 1200, 0.06, 'square', 0.04); this.tone(1500, 1200, 0.06, 'square', 0.04, 0.1); break;
      case 'bell': this.tone(1046, 1046, 0.32, 'sine', 0.08); this.tone(1568, 1568, 0.24, 'sine', 0.04, 0.08); break;
      case 'whoosh': this.tone(700, 260, 0.12, 'sine', 0.07); break;
      case 'parry': this.tone(1400, 1400, 0.05, 'square', 0.07); this.tone(900, 1800, 0.12, 'triangle', 0.08, 0.04); break;
      case 'miss': this.tone(300, 200, 0.12, 'sine', 0.05); break;
      default: break;
    }
  }
  // 原型138BPM的32步方波/三角低音：仅采样明确加载失败时排音，后台不排。
  private synthMusic(): void {
    const ctx=this.context,name=this.settings.music&&this.want,id=`bgm_${name}`;
    if(!ctx||!name||this.background||this.buffers.has(id)||!this.loads.has(id)||this.clips.has(id)){this.synthNext=0;return;}
    // 加载中的采样保持安静，失败后使用同一旋律；clip失败会记录failed。
    if(!this.failed.has(id))return;
    const step=60/138/2,mel=[76,79,84,79,81,79,76,74,76,79,84,86,84,81,79,0,77,81,84,81,79,76,74,72,74,76,79,76,74,72,71,0],bass=[48,0,55,0,48,0,55,0,45,0,52,0,45,0,52,0,41,0,48,0,41,0,48,0,43,0,50,0,43,0,47,0];
    if(this.synthNext<ctx.currentTime)this.synthNext=ctx.currentTime+.05;
    while(this.synthNext<ctx.currentTime+.3){const i=this.synthStep%32;for(const [n,len,type,vol] of [[mel[i],step*.9,'square',.022],[bass[i],step*1.8,'triangle',.05]] as const){if(!n)continue;const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.setValueAtTime(440*2**((n-69)/12),this.synthNext);g.gain.setValueAtTime(vol,this.synthNext);g.gain.exponentialRampToValueAtTime(.0001,this.synthNext+len);o.connect(g);g.connect(ctx.destination);o.start(this.synthNext);o.stop(this.synthNext+len+.02);}this.synthStep++;this.synthNext+=step;}
  }
  // 定时任务只用于真实音频延迟，销毁时一并撤销。
  private later(delay: number, fn: () => void): void {const timer = setTimeout(() => {this.timers.delete(timer); if (this.alive) fn();}, delay * 1000); this.timers.add(timer);}
  // 释放音频连接，不保留全局监听或后台音乐。
  destroy(): void {this.alive = false;this.offFocus?.();this.wechat?.dispose();if(this.scheduler)clearInterval(this.scheduler);for(const source of this.active){source.stop();source.disconnect();}this.active.clear(); this.stop(0); for (const t of this.timers) clearTimeout(t); this.timers.clear(); for (const source of this.sources) source.destroy(); this.sources.clear(); if (this.context) void this.context.close();}
}
