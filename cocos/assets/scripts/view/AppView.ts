import {Color, EditBox, EventKeyboard, EventMouse, EventTouch, Game, Graphics, Input, KeyCode, Label, Layers, Mask, Node, UITransform, game, input, sys, view} from 'cc';
import {Match} from '../core/match';
import {LEVELS} from '../core/levels';
import {BUFFS, LEADER_TYPES} from '../core/config';
import {CoreEvent} from '../core/types';
import {Platform, TopAvoidance} from '../platform/Platform';
import {WebPlatform} from '../platform/WebPlatform';
import {WechatPlatform} from '../platform/WechatPlatform';
import {CloudServices} from '../platform/CloudServices';
import {mergeProgress} from '../core/progress';
import {WorldView} from './WorldView';
import {WorldAssets} from './WorldAssets';
import {DrawSurface, guardLabelText} from './DrawSurface';
import {ScreenPaint, ScreenAction} from './ScreenPaint';
import {LobbyDebug, LobbyView} from './LobbyView';
import {IntroView} from './IntroView';
import {ResultView, Result} from './ResultView';
import {ShareView} from './ShareView';
import {PraiseView} from './PraiseView';
import {PlayerStore, Settings} from './PlayerStore';
import {AudioView, SoundOptions} from './AudioView';
import {MessageView} from './MessageView';
import {Box} from './UiPaint';
import {DEBUG_PANEL, uiEase} from './ui-data';
type Panel = ''|'pause'|'settings'|'rules'|'boss'|'result'|'share'|'assets'|'ad'|'debug'|'debug-clear'|'debug-edit';
interface Pane {mask: Node; root: Node; surface: DrawSurface; p: ScreenPaint}
// 原型外围流程的唯一组织器：游戏数据由core拥有，所有页面/音频/存储走view/platform。
export class AppView {
  readonly assets = new WorldAssets();
  readonly platform: Platform = sys.platform === sys.Platform.WECHAT_GAME ? new WechatPlatform() : new WebPlatform();
  readonly store = new PlayerStore(this.platform);
  readonly cloud = new CloudServices(this.platform,this.store);
  private cloudTutorialStep = -1;
  // 环境在启动时读取一次，避免大厅逐帧调用微信同步接口。
  readonly debugEnabled = this.platform.debugEnabled();
  readonly params = this.debugEnabled && this.platform.kind === 'web' && typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
  readonly debug = new LobbyDebug();
  private debugField: 'seed'|'runs' = 'seed';
  private debugTimer?: ReturnType<typeof setTimeout>;
  readonly root: Node; readonly audio: AudioView;
  world?: WorldView;
  screen: 'loading'|'lobby'|'intro'|'play' = 'loading'; panel: Panel = ''; selected = 0;
  ready = false; real = 0; frozen = false; result: Result | null = null;
  private surface: DrawSurface; private paint: ScreenPaint; private lobby: LobbyView; private intro: IntroView;
  private panes: Pane[]; private messages: MessageView; private praise: PraiseView; private loading: Node;
  private alive = true; private serial = 0; private settingsResume = false; private panelAt = 0;
  private resultScroll=0; private resultAt=0; private layingOut=false;
  private heights: Partial<Record<Panel,number>> = {}; scroll = 0; private maxScroll = 0; actions: ScreenAction[] = [];
  private touch: {id:number;x:number;y:number;lastX:number;lastY:number;distance:number;tabs:boolean;horizontal:boolean} | null = null;
  private rulesBossName = '老板';
  private focus = -1; private focusVisible=false; private edit: EditBox | null = null; private cachedEdit: EditBox | null = null; private adRemaining: number | null = null;
  constructor(readonly parent: Node) {
    this.root = this.node('AppUI',parent); this.surface = new DrawSurface(this.root,this.assets); this.surface.cull=false; this.paint=new ScreenPaint(this.surface);this.lobby=new LobbyView(this.paint);this.intro=new IntroView(this.paint);this.panes=[this.pane('Panel'),this.pane('Share')];this.messages=new MessageView(this.paint);
    this.audio=new AudioView(this.root,this.platform,this.store.settings);this.praise=new PraiseView(this.paint,name=>this.audio.sfx(name),ms=>this.buzz(ms));
    this.debug.auto=this.params.get('auto')==='1';this.debug.seed=this.params.get('seed')||'';
    this.loading=this.loadingCard();this.resize();
    input.on(Input.EventType.TOUCH_START,this.down,this);input.on(Input.EventType.TOUCH_MOVE,this.move,this);input.on(Input.EventType.TOUCH_END,this.up,this);input.on(Input.EventType.TOUCH_CANCEL,this.cancel,this);
    input.on(Input.EventType.KEY_DOWN,this.key,this);input.on(Input.EventType.MOUSE_WHEEL,this.wheel,this);
    view.on('canvas-resize',this.resize,this);game.on(Game.EVENT_HIDE,this.hide,this);game.on(Game.EVENT_SHOW,this.show,this);
    if(this.platform.kind==='web'&&typeof window!=='undefined'){window.addEventListener('pointerdown',this.unlock,{capture:true,passive:true});window.addEventListener('keydown',this.unlock,{capture:true,passive:true});}
  }
  // 所有UI节点使用UI_2D层，左上原点由父节点统一转换。
  private node(name: string,parent:Node): Node {const n=new Node(name);n.layer=Layers.Enum.UI_2D;n.addComponent(UITransform);parent.addChild(n);return n;}
  // 卡片Mask固定边框区域，内容按scroll移动；不让长结算文字覆盖卡外按钮。
  private pane(name:string): Pane {const mask=this.node(name+'Mask',this.root);mask.addComponent(Mask).type=Mask.Type.GRAPHICS_RECT;mask.getComponent(UITransform)!.setAnchorPoint(0,1);const root=this.node(name+'Content',mask),surface=new DrawSurface(root,this.assets);surface.cull=false;return {mask,root,surface,p:new ScreenPaint(surface)};}
  // 最先显示加载卡，不依赖任何尚未下载的字体或贴图；字体就绪后由正式画面接管。
  private loadingCard(): Node {const n=this.node('Loading',this.root),surface=new DrawSurface(n,this.assets),paint=new ScreenPaint(surface);surface.begin();surface.fillStyle='#6C7483';surface.fillRect(-view.getVisibleSize().width/2,-view.getVisibleSize().height/2,view.getVisibleSize().width,view.getVisibleSize().height);paint.box({x:-170,y:-64,w:340,h:128});surface.end();for(const [text,y,fs] of [['加载中…',20,34],['正在把锅摆好',-28,13]] as const){const child=this.node('LoadingText',n),label=child.addComponent(Label);label.useSystemFont=true;label.string=text;label.fontSize=fs;label.color=new Color(text==='加载中…'?'#1F2A44':'#5E6A84');label.horizontalAlign=Label.HorizontalAlign.LEFT;child.getComponent(UITransform)!.setContentSize(300,fs*1.4);child.setPosition(0,y);}return n;}

  // 资源顺序沿用P3图集/爆炸，追加确定性贴纸；音频完全不阻塞首屏。
  async start(): Promise<void> {
    void this.cloud.start();
    await this.assets.load(()=>{if(!this.alive)return;for(const label of this.loading.getComponentsInChildren(Label)){label.font=label.fontSize===34?this.assets.title:this.assets.body400;label.useSystemFont=false;}});if(!this.alive)return;this.loading.active=false;
    const prog=this.store.read(),q=Number(this.params.get('level'));this.selected=q&&LEVELS.some(l=>l.id===q)?q-1:Math.max(0,LEVELS.filter(l=>l.id<=prog.unlocked).length-1);
    if(q&&LEVELS.some(l=>l.id===q)&&prog.unlocked<q){prog.unlocked=q;this.store.save(prog);}
    this.ready=true;this.exposeDebug();if(q&&LEVELS.some(l=>l.id===q))await this.showIntro();else this.showLobby();this.render();
    console.log('[P4-1] 外围流程就绪',{screen:this.screen,level:this.selected+1});
  }
  // 大厅销毁对局，和原型S=null相同；当前选择关保留。
  showLobby(): void {this.debug.resetTaps();this.serial++;this.world?.destroy();this.world=undefined;this.screen='lobby';this.closePanel();this.result=null;this.praise.reset();this.lobby.heroUntil=0;this.lobby.select(this.selected,this.store.read());this.audio.bgm('lobby');this.messages.event('clearBanners',[],this.real);this.render();}
  // 关卡介绍后台生成普通对局，但不推进玩法；正式开始再单独创建。
  async showIntro(): Promise<void> {this.screen='intro';this.closePanel();this.result=null;this.audio.bgm('lobby');this.intro.select(this.selected);await this.createWorld(false,null);if(!this.alive)return;this.render();this.focus=this.actions.findIndex(a=>a.action==='intro-pick:'+this.selected);}
  // 同一份已加载图集/字体跨场景复用，切换时只释放节点和派生状态。
  private async createWorld(tutorial:boolean,buff:string|null,playing=false): Promise<void> {
    const serial=++this.serial;this.world?.destroy();this.praise.reset();this.cloudTutorialStep=-1;
    const w=new WorldView(this.parent,()=>{void this.startGame();},true,{platform:this.platform,params:this.params,level:this.selected,levelParams:playing?this.cloud.level(this.selected):undefined,tutorial,progress:this.store.read(),buff,assets:this.assets,onEvent:e=>this.event(e),onAction:name=>this.action(name),blocked:()=>this.screen!=='play'||!!this.panel,onHidden:hidden=>this.audio.hidden(hidden)});this.world=w;this.root.setSiblingIndex(this.parent.children.length-1);await w.start();if(!this.alive||serial!==this.serial)return;w.paused=this.screen!=='play';
  }
  // forceTut只消费本次；广告增益不跨局，带教则不带增益。
  async startGame(forceTut=false,buff:string|null=null): Promise<void> {this.audio.unlock();this.screen='play';this.closePanel();this.result=null;const tutorial=!!LEVELS[this.selected].tutorial&&this.params.get('auto')!=='1'&&(forceTut||this.params.get('tut')==='1'||!this.store.read().tutDone);this.params.delete('tut');await this.createWorld(tutorial,buff,true);if(!this.alive)return;this.cloud.track('start',this.world!.match.L.id,{buff:this.world!.match.S.buff,tutorial});this.audio.bgm('work',true);if(this.world?.match.S.buff){this.toast(`带着「${BUFFS[this.world.match.S.buff].name}」上班`,1800);this.audio.sfx('buff');}if(this.params.has('freeze')){this.world!.frozen=true;const frames=Math.max(0,Math.floor(Number(this.params.get('freeze'))||0));for(let i=0;i<frames;i++)this.tick(1/60);this.frozen=true;}this.render();}
  // 真实页面每帧；冻结入口仍可显式tick做同种子截图，普通网页不改固定步长。
  update(dt:number): void {if(!this.ready||this.frozen)return;this.real+=Math.min(.033,dt);if(this.screen==='play')this.world?.update(dt);this.render();}
  // 调试单步使用真实WorldView.tick，禁止复制一份玩法算法。
  tick(dt:number): void {this.real+=dt;if(this.screen==='play'&&!this.panel)this.world?.tick(dt);this.render();}
  // 同一事件同时交给已有HUD和外围；只有进度事件写入平台。
  private event(e:CoreEvent): void {const m=this.world?.match;if(m&&!m.simulating&&e.kind==='showHint'&&m.S.tut&&this.cloudTutorialStep!==m.S.tut.i){this.cloudTutorialStep=m.S.tut.i;this.cloud.track('tutorial',m.L.id,{step:m.S.tut.i});}if(e.kind==='sfx')this.audio.sfx(String(e.args[0]),e.args[1] as SoundOptions);if(e.kind==='bgm')this.audio.bgm(e.args[0] as string|boolean,e.args[1] as boolean);if(e.kind==='buzz')this.buzz(e.args[0] as number);if(e.kind==='progress'){this.store.save(mergeProgress(this.store.read(),e.args[0] as ReturnType<PlayerStore['read']>));this.cloud.progressChanged();}if(e.kind==='toast')this.messages.event('toast',e.args,this.real);if(e.kind==='finish'){this.result=e.args[0] as Result;this.cloudResult(this.result);this.open('result');}if(e.kind==='hidePanel')this.closePanel();if(e.kind==='praise'&&this.world)this.praise.show(String(e.args[0]),this.world.match,this.real,this.occupied(),this.reduced(),!!this.panel);}
  // 只在真实结算出口采集纯数字，不发送老板称呼、复盘台词或任何自由文本。
  private cloudResult(r:Result):void {const m=this.world?.match;if(!m||m.simulating)return;const score={rank:r.myRank,stars:r.stars,debt:r.myDebt,blames:m.S.player.blames,duration:Math.max(0,m.workT())};this.cloud.track('finish',m.L.id,{...score,crushed:r.crushed,crushedAt:r.crushed?score.duration:0,revived:m.S.revived,rescued:m.S.rescued});this.cloud.settled(m.L.id,score);this.cloud.background();}
  // 震动总开关在画面边界生效，ms原样传平台。
  private buzz(ms:number): void {if(this.store.settings.vibrate)this.platform.vibrate(ms);}
  private toast(text:string,ms=1600): void {this.messages.event('toast',[text,ms],this.real);}
  private unlock=(): void => {this.audio.unlock();};
  // 打开任何卡片立即清理贴纸；暂停不修改core.mode。
  // 玩法弹窗打开时解析一次称呼，避免大厅每帧为读名字重建对局与寻路网格。
  private open(panel:Panel): void {if(panel.startsWith('debug')&&(!this.debugEnabled||this.screen!=='lobby'))return;if(this.debug?.busy)this.cancelDebugRun();this.debug?.resetTaps();if(panel==='rules')this.rulesBossName=(this.world?.match||new Match({seed:0,progress:this.store.read()})).bossName();this.praise.clear();this.panel=panel;this.scroll=0;this.focus=-1;this.panelAt=this.real;this.world?.clearInput();if(this.world)this.world.paused=true;this.removeEdit();}
  private closePanel(): void {if(this.debug?.busy)this.cancelDebugRun();this.debug?.resetTaps();this.panel='';this.scroll=0;this.focus=-1;this.removeEdit();if(this.world)this.world.paused=this.screen!=='play';}
  // 所有按钮动作统一音效分类，广告/开关/主角按原型安静。
  action(name:string): void {
    if(!this.ready||this.panel==='ad')return;
    // 工牌不作普通按钮反馈；关闭门禁时连计数、音效和存储也不触发。
    if(name==='debug-badge'){if(this.debugEnabled&&this.screen==='lobby'&&!this.panel){if(this.debug.tap(performance.now()/1000)){this.debug.level=this.selected;this.open('debug');this.render();}}else this.debug.resetTaps();return;}
    if(name.startsWith('debug:')){this.debugAction(name.slice(6));return;}
    this.audio.unlock();const quiet=['hero','revive','rescue','buff'];if(!quiet.includes(name)&&!name.startsWith('toggle:'))this.audio.sfx(['menu','lobby','close','back','share-close'].includes(name)?'uiBack':'click');
    const m=this.world?.match;
    if(name.startsWith('pick:')){this.selected=Number(name.split(':')[1]);this.showLobby();}
    else if(name.startsWith('intro-pick:')){this.selected=Number(name.split(':')[1]);void this.showIntro();}
    else if(name==='go')void this.showIntro();else if(name==='lobby'||name==='menu'||name==='back')this.showLobby();
    else if(name==='start'&&m?.coachLocked()){m.startWork();this.world?.clearInput();this.world?.flush();}
    else if(name==='start'||name==='retry'||name==='restart')void this.startGame();else if(name==='tut')void this.startGame(true);
    else if(name==='skip'){m?.startWork();this.world?.flush();}
    else if(name==='hero'){this.lobby.poke(this.real);this.audio.sfx('throw');}
    else if(name==='pause'){if(this.screen==='play'&&m?.mode==='play'&&!this.panel&&!m.coachLocked()){this.audio.bgm(false);this.open('pause');}}
    else if(name==='resume'){this.closePanel();this.audio.bgm(m?.S.rush?'rush':'work');}
    else if(name==='settings'){this.settingsResume=this.screen==='play'&&m?.mode==='play';if(this.settingsResume)this.audio.bgm(false);this.open('settings');}
    else if(name==='close'){const resume=this.panel==='settings'&&this.settingsResume;this.closePanel();if(resume)this.audio.bgm(m?.S.rush?'rush':'work');}
    else if(name==='rules')this.open('rules');else if(name==='boss-name'){this.open('boss');this.ensureEdit();}
    else if(name==='cancel')this.closePanel();else if(name==='save')this.saveName();
    else if(name.startsWith('toggle:')){const key=name.split(':')[1] as keyof Settings,on=!this.store.settings[key];this.store.set(key,on);this.audio.sync();this.audio.sfx('toggle');if(key==='vibrate'&&on)this.buzz(40);}
    else if(name==='next'&&this.result?.next){this.selected=LEVELS.indexOf(this.result.next);void this.showIntro();}
    else if(name==='share'||name==='share-blame'){this.resultScroll=this.scroll;this.resultAt=this.panelAt;this.open('share');}else if(name==='share-close'){this.open('result');this.scroll=this.resultScroll;this.panelAt=this.resultAt;}
    else if(name==='send'){this.cloud.track('share',m?.L.id||this.selected+1,{action:'send'});this.platform.share();this.open('result');this.scroll=this.resultScroll;this.panelAt=this.resultAt;if(this.platform.kind==='web')this.toast('Demo：正式版这里会打开微信，选好友或群发送',2200);}
    else if(['revive','rescue','buff'].includes(name))void this.ad(name);this.render();
  }
  // 面板动作再次核对平台和当前面板，不能绕过工牌在正常界面清档或开局。
  private debugAction(name:string): void {
    if(!this.debugEnabled||this.screen!=='lobby'||!this.panel.startsWith('debug')||this.debug.busy)return;
    const d=this.debug;
    if(this.panel==='debug-clear'){
      if(name==='cancel-clear')this.open('debug');
      else if(name==='confirm-clear'){if(!this.store.clear()){this.toast('清空失败，请重试');return;}this.selected=d.level=0;this.showLobby();this.open('debug');this.toast('存档已清空');}
    }else if(this.panel==='debug-edit'){
      if(name==='cancel-edit')this.open('debug');
      else if(name==='save-edit'){
        const value=(this.edit?.string||'').trim();
        if(this.debugField==='seed'){const old=d.seed;d.seed=value;if(!d.validSeed()){d.seed=old;this.toast('种子需为 0～4294967295 的整数');return;}}
        else {if(!/^\d+$/.test(value)||Number(value)<1||Number(value)>DEBUG_PANEL.maxRuns){this.toast(`局数需为 1～${DEBUG_PANEL.maxRuns} 的整数`);return;}d.runs=Number(value);}
        this.open('debug');
      }
    }else if(this.panel==='debug'){
      if(name.startsWith('level:')){const level=Number(name.slice(6));if(!Number.isInteger(level)||!LEVELS[level])return;d.level=level;if(!LEVELS[level].tutorial)d.tutorial=false;d.summary='';d.result=null;}
      else if(name==='auto'){d.auto=!d.auto;if(d.auto)d.tutorial=false;}
      else if(name==='tutorial'){d.tutorial=!d.tutorial;if(d.tutorial){d.level=LEVELS.findIndex(l=>!!l.tutorial);d.auto=false;}}
      else if(name==='seed'||name==='runs'){this.debugField=name;this.open('debug-edit');this.ensureEdit();this.edit!.string=name==='seed'?d.seed:String(d.runs);}
      else if(name==='clear')this.open('debug-clear');
      else if(name==='start'){
        if(!d.validSeed()){this.toast('种子需为 0～4294967295 的整数');return;}
        this.selected=d.level;const prog=this.store.read();if(prog.unlocked<LEVELS[d.level].id){prog.unlocked=LEVELS[d.level].id;this.store.save(prog);}
        this.params.set('auto',d.auto?'1':'0');this.params.delete('tut');this.params.delete('freeze');
        if(d.seed==='')this.params.delete('seed');else this.params.set('seed',d.seed);
        void this.startGame(d.tutorial).catch(()=>{if(!this.alive)return;this.showLobby();this.open('debug');this.toast('开局失败，请重试');this.render();});
      }
      else if(name==='simulate')this.runDebugSimulation();
    }
    this.render();
  }
  // 独立Match跑原有simulate，不复用活动对局，避免清横幅或消费当前随机流。
  private runDebugSimulation(): void {
    const d=this.debug;if(!d.validSeed()||!Number.isInteger(d.runs)||d.runs<1||d.runs>DEBUG_PANEL.maxRuns){this.toast('请检查种子和局数');return;}
    const level=d.level,runs=d.runs,seed=d.seed===''?Date.now()>>>0:Number(d.seed),serial=this.serial;
    d.busy=true;d.summary='模拟中…';d.result=null;
    // 先让忙碌状态绘制一帧；重复点击不排第二个任务，关闭和销毁取消尚未运行的任务。
    this.debugTimer=setTimeout(()=>{this.debugTimer=undefined;if(!this.alive||serial!==this.serial||this.panel!=='debug'){d.busy=false;return;}
      try {const m=new Match({level,seed,progress:this.store.read()}),r=m.simulate(level,runs,seed);d.result=r;
        d.summary=`第${level+1}关 · ${runs}局 · 种子 ${seed}\n过关 ${r.passed}/${r.runs}（${(r.passRate*100).toFixed(1)}%）\n名次 ${Object.entries(r.rankHist).map(([rank,n])=>`${rank}名:${n}`).join(' / ')}\n玩家压垮 ${r.crushedPlayer} · 同事压垮 ${r.crushedBots}\n平均背锅 ${Object.entries(r.avgBlame).map(([who,n])=>`${who}:${n}`).join(' / ')}\n平均爆炸 ${r.avgBooms} · 天降 ${r.avgSkies}`;
      }catch{d.summary='模拟失败，请重试';}finally{d.busy=false;if(this.alive)this.render();}
    },32);
  }
  // 清理本面板唯一的延迟任务；不会留下后台模拟或全局计时器。
  private cancelDebugRun(): void {if(this.debugTimer!==undefined)clearTimeout(this.debugTimer);this.debugTimer=undefined;this.debug.busy=false;this.debug.summary='模拟已取消';}
  // 假广告的3×650ms由平台计时；微信不可用保留结算，不扣次数、不发奖励、不自创降级。
  private async ad(action:string): Promise<void> {const r=this.result,m=this.world?.match;if(!r||!m)return;this.cloud.track('ad_show',m.L.id,{action});this.open('ad');const serial=this.serial,ok=await this.platform.showRewardedAd(n=>{this.adRemaining=n;if(this.alive)this.render();});if(!this.alive||serial!==this.serial)return;this.cloud.track('ad_result',m.L.id,{action,success:ok});if(!ok){this.open('result');this.toast('广告不可用');return;}if(action==='buff'){await this.startGame(false,r.diag!.buff);return;}this.closePanel();if(action==='revive'){this.result=null;this.world!.ui.result=null;this.world!.ui.closing.notice={hidden:true};m.revive();this.world!.flush();}else{m.rescue();this.world!.flush();}this.render();}
  // 名称EditBox用纯文本；长度按Unicode检查后调用core清理函数，存储失败保留输入。
  private saveName(): void {const value=this.edit?.string||'',m=this.world?.match||new Match({seed:0,progress:this.store.read()});if([...value.trim()].length>6){this.toast('最多 6 个字',1500);return;}const prog=this.store.read();prog.bossName=m.cleanBossName(value);prog.bossNameAt=Math.max(Date.now(),(prog.bossNameAt||0)+1);if(!this.store.save(prog)){this.toast('保存失败，请重试',1500);return;}this.cloud.progressChanged();this.showLobby();}
  // Cocos EditBox负责系统键盘，网页不另造HTML输入框；允许超过6字后显示原型校验提示。
  private ensureEdit(): void {if(this.edit)return;if(this.cachedEdit){this.edit=this.cachedEdit;this.cachedEdit=null;this.edit.string=this.store.read().bossName||'老板';this.edit.node.active=true;this.positionEdit();this.edit.focus();return;}const n=this.node('BossNameEditBox',this.root);n.active=false;const edit=n.addComponent(EditBox),labelNode=this.node('Text',n),label=labelNode.addComponent(Label);guardLabelText(label);label.useSystemFont=true;label.fontSize=18;label.color=new Color('#1F2A44');label.horizontalAlign=Label.HorizontalAlign.LEFT;labelNode.getComponent(UITransform)!.setContentSize(260,40);edit.textLabel=label;edit.inputMode=EditBox.InputMode.SINGLE_LINE;edit.returnType=EditBox.KeyboardReturnType.DONE;edit.maxLength=-1;edit.string=this.store.read().bossName||'老板';this.edit=edit;this.positionEdit();n.on(EditBox.EventType.EDITING_DID_BEGAN,()=>{if(this.platform.kind==='web')queueMicrotask(()=>{if(!this.alive||this.edit!==edit)return;const field=document.activeElement;if(field instanceof HTMLInputElement||field instanceof HTMLTextAreaElement)field.select();});});n.active=true;edit.focus();}
  // 种子/局数复用同一个原生单行输入框；重排时不丢未保存的输入。
  private positionEdit(): void {if(!this.edit)return;const w=Math.min(340,this.surface.width-32),h=this.heights[this.panel]||300,y=(this.surface.height-Math.min(h,(this.surface.height-32)*.92))/2;this.edit.node.setPosition(this.surface.width/2,-(y+140-this.scroll));this.edit.node.getComponent(UITransform)!.setContentSize(w-40,48);}
  // 复用同一EditBox：Cocos安卓键盘有延迟scrollIntoView，立即销毁会读到空DOM。
  private removeEdit(): void {if(this.edit){this.edit.blur();this.edit.node.active=false;this.cachedEdit=this.edit;this.edit=null;}}
  // 系统减少动态偏好只作用动画，不改变玩法时钟。
  private reduced(): boolean {return typeof matchMedia!=='undefined'&&matchMedia('(prefers-reduced-motion: reduce)').matches;}
  private avoid(): TopAvoidance {return this.params.get('capsule')==='1'?{top:44,capsule:{x:this.surface.width-94,y:50,w:87,h:32}}:this.platform.topAvoidance();}
  private occupied(): Box[] {const ui=this.world?.ui;if(!ui)return [];return [ui.messages.hintOn?ui.messages.hintBox:null,ui.messages.msgOn?ui.messages.msgBox:null,!ui.closing.notice.hidden?{x:0,y:ui.hud.bottom+10,w:this.surface.width,h:this.surface.width*296/1204}:null].filter((b):b is Box=>!!b);}
  // Modal的内容与背景分层；Mask保持可视框固定，长排名表/规则可拖动与滚轮滚动。
  private modal(kind:Panel,index=0): void {
    const pane=this.panes[index],c=pane.surface,p=pane.p,W=this.surface.width,H=this.surface.height,w=Math.min(kind==='share'?320:340,W-32),content=this.heights[kind]||500,h=Math.min((H-32)*.92,content),x=(W-w)/2,baseY=(H-h)/2,t=kind==='result'&&!this.reduced()?Math.min(1,Math.max(0,(this.real-(this.panel==='share'?this.resultAt:this.panelAt))/.22)):1,ease=uiEase(t,0,0,.58,1),y=baseY+8*(1-ease),b={x,y:y-this.scroll,w,h:content};this.maxScroll=Math.max(0,content-h);
    this.surface.save();this.surface.globalAlpha=ease;this.paint.box({x,y,w,h});this.surface.restore();pane.mask.active=true;pane.mask.setPosition(x,-y);pane.mask.getComponent(UITransform)!.setContentSize(w,h);pane.root.setPosition(-x,y);this.surface.insertLayer(pane.mask);c.width=W;c.height=H;c.begin();c.globalAlpha=ease;p.actions=[];
    let total=0;const m=this.world?.match;
    if(kind==='result'&&m&&this.result)total=new ResultView(p).draw(m,this.result,b);
    else if(kind==='debug')total=this.debug.draw(p,b);
    else if(kind==='debug-clear'){p.heading('清空存档','',b);p.paragraph('进度、称呼、带教和成就都会清空，声音设置保留。确定清空？',{x:x+20,y:b.y+80,w:w-40,h:0},16,'#E8504A');p.button('debug:confirm-clear','确定清空',{x:x+20,y:b.y+172,w:w-40,h:54});p.button('debug:cancel-clear','取消',{x:x+20,y:b.y+242,w:w-40,h:34},'link');total=300;}
    else if(kind==='debug-edit'){const seed=this.debugField==='seed';p.heading(seed?'指定种子':'模拟局数','',b);p.text(seed?'留空按当前时间起种':`输入 1～${DEBUG_PANEL.maxRuns} 局`,x+20,b.y+80,14,'#5E6A84','body-400');c.fillStyle='#FFFDF5';c.fillRect(x+20,b.y+116,w-40,48);c.strokeStyle='#1F2A44';c.lineWidth=2;c.strokeRect(x+20,b.y+116,w-40,48);p.button('debug:save-edit','保存',{x:x+20,y:b.y+196,w:w-40,h:54});p.button('debug:cancel-edit','取消',{x:x+20,y:b.y+264,w:w-40,h:34},'link');total=320;this.positionEdit();}
    else if(kind==='share'&&this.result)total=new ShareView(p).draw(this.result.shareInfo,b);
    else if(kind==='pause'){p.heading('休息一下','pause',b);p.center('本局已暂停',x+20,b.y+72,w-40,15,'#5E6A84','body-700');p.contain('wok',{x:x+w/2-70,y:b.y+106,w:140,h:108});p.rays({x:x+w/2-55,y:b.y+106,w:110,h:108},true);p.text('甩锅',x+w/2-8,b.y+164,15,'#1F2A44','body-900');p.button('resume','继续游戏',{x:x+20,y:b.y+221,w:w-40,h:68});p.button('retry','重新开始',{x:x+20,y:b.y+299,w:w-40,h:56},'ghost');p.button('menu','返回首页',{x:x+20,y:b.y+366,w:w-40,h:32},'link');total=420;}
    else if(kind==='settings'){p.heading('游戏设置','gear',b,'close');(['music','sfx','vibrate'] as const).forEach((key,i)=>{const yy=b.y+81+i*62,on=this.store.settings[key];p.icon(['music','sound','vibrate'][i],x+28,yy+6,32);p.text(['音乐','音效','震动'][i],x+78,yy+11,20,'#1F2A44','body-700');const tx=x+w-136;c.fillStyle=on?'#FFD84D':'#C3CEE0';c.strokeStyle='#1F2A44';c.lineWidth=3;c.beginPath();c.moveTo(tx+22,yy);c.lineTo(tx+86,yy);c.arc(tx+86,yy+22,22,-Math.PI/2,Math.PI/2);c.lineTo(tx+22,yy+44);c.arc(tx+22,yy+22,22,Math.PI/2,Math.PI*1.5);c.closePath();c.fill();c.stroke();c.fillStyle='#FFFFFF';c.beginPath();c.arc(tx+(on?84:24),yy+22,15,0,Math.PI*2);c.fill();c.stroke();p.text(on?'开':'关',tx+(on?14:66),yy+10,20,'#1F2A44','body-900');p.hit('toggle:'+key,key,{x:tx,y:yy,w:108,h:44});});c.fillStyle='#D3DBE8';c.fillRect(x+20,b.y+273,w-40,3);p.button('close','完成',{x:x+20,y:b.y+292,w:w-40,h:62});total=368;}
    else if(kind==='boss'){p.heading('老板名称','',b);p.text('给老板起个称呼',x+20,b.y+80,16,'#1F2A44','body-400');c.fillStyle='#FFFDF5';c.fillRect(x+20,b.y+116,w-40,48);c.strokeStyle='#1F2A44';c.lineWidth=2;c.strokeRect(x+20,b.y+116,w-40,48);p.text('最多 6 个字，留空恢复“老板”',x+20,b.y+179,13,'#5E6A84','body-400');p.button('save','保存称呼',{x:x+20,y:b.y+212,w:w-40,h:62});p.button('cancel','取消',{x:x+20,y:b.y+286,w:w-40,h:32},'link');total=340;this.positionEdit();}
    else if(kind==='rules'){
      const lv=LEVELS[this.selected],leaders=lv.leaders.map(d=>d.type==='boss'?this.rulesBossName:LEADER_TYPES[d.type].name).join('、');
      // 只复用已导入图集；摇杆、视野、账单与反甩没有专用小图，用锅/警告/书/撞击反馈表达。
      const rules=[
        {icon:'ui_clock',text:`每口锅都有截止时间（${lv.potLife||30} 秒），甩来甩去不重置；到点在谁身上，谁背锅`},
        {icon:'ui_wok',text:'左下角摇杆控制方向，右下角「甩」把最急的那口锅扔出去'},
        {icon:'ui_warning',text:`${leaders}面前的红色扇形是视野，在里面甩锅会被抓现行：锅不走，还要背锅`},
        {icon:'ui_book',text:'18:00 算总账：炸了的锅一口算 1，身上没甩掉的锅一口算 ½'},
      ];
      if(!lv.basic)rules.push(
        {icon:'wok_flying',text:`天降锅只砸你，躲不掉；${leaders}的普通锅看到红线就躲`},
        {icon:'fx_impact',text:'锅朝你飞来时按「甩」能弹回去；急件只有 10 秒，炸了背锅 +3'},
        {icon:'ui_warning',text:'身上堆满 12 口锅当场压垮，直接失败'},
      );
      c.fillStyle='#E8504A';c.fillRect(x+20,b.y+14,48,20);p.text('玩法',x+28,b.y+17,12,'#FFFFFF','body-400');p.text('怎么甩锅',x+20,b.y+35,34,'#1F2A44');let yy=b.y+80;
      yy+=p.paragraph(`背锅越少，排名越前；进${lv.passRank===2?'前两名':'前三'}准点下班`,{x:x+20,y:yy,w:w-40,h:0},13,'#5E6A84','body-900');yy+=14;
      for(const row of rules){p.contain(row.icon,{x:x+20,y:yy,w:22,h:22});yy+=p.paragraph(row.text,{x:x+52,y:yy,w:w-72,h:0},14,'#1F2A44','body-900');yy+=8;}
      p.button('close','知道了',{x:x+20,y:yy+8,w:w-40,h:68});total=yy-b.y+98;
    }
    else if(kind==='assets'){p.heading('新同事素材','',b);const names=Object.keys(this.assets.spr).filter(n=>/^(nephew_|cashier_|pie$|fx_hype$)/.test(n));names.forEach((name,i)=>{const xx=x+20+i%3*90,yy=b.y+80+Math.floor(i/3)*94;p.contain(name,{x:xx,y:yy,w:80,h:64});p.text(name,xx,yy+66,9,'#1F2A44','body-400');});total=110+Math.ceil(names.length/3)*94;p.button('back','返回大厅',{x:x+20,y:b.y+total-24,w:w-40,h:50},'ghost');total+=50;}
    this.heights[kind]=total||content;c.end();this.actions.push(...p.actions.filter(a=>a.y+a.h>=y&&a.y<=y+h));
  }
  // 场景/HUD由WorldView画；外围面板始终置顶，不改变core对象。
  render(): void {if(!this.ready)return;const previousHeight=this.heights[this.panel];const c=this.surface,p=this.paint;c.begin();p.actions=[];this.actions=[];for(const pane of this.panes)pane.mask.active=false;
    if(this.screen==='lobby')this.lobby.draw(this.selected,this.store.read(),this.real,this.avoid(),this.reduced(),this.debugEnabled);else if(this.screen==='intro'&&this.world?.ready)this.intro.draw(this.world.match,this.store.read());
    if(this.screen==='play'&&this.world?.ready&&!this.panel){this.praise.rank(this.world.match,this.real,this.occupied(),this.reduced(),this.world.paused);this.praise.draw(this.real,this.occupied(),this.world.match.rankWords());}
    this.actions.push(...p.actions);
    if(this.panel){c.fillStyle=this.panel==='ad'?'#111111':'rgba(15,22,40,.5)';c.fillRect(0,0,c.width,c.height);this.actions=[];if(this.panel==='ad'){p.center('激励视频广告位',0,c.height/2-80,c.width,16,'#FFFFFF','body-400');p.center(String(this.adRemaining??3),0,c.height/2-35,c.width,64,'#FFFFFF','title');p.paragraph('正式版在这里播放 15～30 秒广告，看完才发奖励',{x:(c.width-260)/2,y:c.height/2+50,w:260,h:0},13,'#999999');}else{if(this.panel==='share'){const saved=this.scroll;this.scroll=this.resultScroll;this.modal('result',0);this.scroll=saved;c.fillStyle='rgba(15,22,40,.6)';c.fillRect(0,0,c.width,c.height);this.actions=[];this.modal('share',1);}else this.modal(this.panel);}}
    if(this.params.get('capsule')==='1'){const a=this.avoid();if(a.capsule){const b=a.capsule;c.strokeStyle='#E8504A';c.lineWidth=3;c.strokeRect(b.x,b.y,b.w,b.h);p.text('87×32',b.x+10,b.y+8,14,'#E8504A');}}
    if(this.focusVisible&&this.focus>=0&&this.actions[this.focus]){const a=this.actions[this.focus];c.strokeStyle='#E8504A';c.lineWidth=3;c.strokeRect(a.x-2,a.y-2,a.w+4,a.h+4);}
    this.messages.drawToast(this.real);c.end();this.root.setSiblingIndex(this.parent.children.length-1);
    // 首帧测得卡片内容高度后立即重排，避免输入框与保存键暂时重叠。
    if(!this.layingOut&&this.panel&&previousHeight!==this.heights[this.panel]){this.layingOut=true;this.render();this.layingOut=false;}
  }
  // 横竖屏重排只更新可视坐标；保持当前关卡、输入值和对局。
  private resize(): void {const size=view.getVisibleSize();this.root.setPosition(-size.width/2,size.height/2);this.surface.width=size.width;this.surface.height=size.height;this.loading?.setPosition(size.width/2,-size.height/2);this.positionEdit();if(this.ready)this.render();}
  // 手指滑条与按钮点击互斥；超过8px判滑动，不误触选关。
  private down(e:EventTouch): void {this.audio.unlock();this.focusVisible=false;if(!this.ready||this.panel==='ad'||this.touch)return;const pos=e.getUILocation(),x=pos.x,y=this.surface.height-pos.y;if(this.edit){const pos=this.edit.node.position,size=this.edit.node.getComponent(UITransform)!.contentSize;if(Math.abs(x-pos.x)<=size.width/2&&Math.abs(y+pos.y)<=size.height/2)return;}const strip=this.screen==='lobby'?this.lobby.strip:this.screen==='intro'?this.intro.strip:null;const tabs=!!strip&&x>=strip.x&&x<=strip.x+strip.w&&y>=strip.y&&y<=strip.y+strip.h;this.touch={id:e.getID()!,x,y,lastX:x,lastY:y,distance:0,tabs,horizontal:tabs};}
  private move(e:EventTouch): void {const t=this.touch;if(!t||e.getID()!==t.id)return;const pos=e.getUILocation(),x=pos.x,y=this.surface.height-pos.y,dx=x-t.lastX,dy=y-t.lastY;t.distance=Math.max(t.distance,Math.hypot(x-t.x,y-t.y));t.lastX=x;t.lastY=y;if(this.panel)this.scroll=Math.max(0,Math.min(this.maxScroll,this.scroll-dy));else if(this.screen==='lobby'&&t.tabs)this.lobby.swipe(dx);else if(this.screen==='intro')this.intro.swipe(dx,dy,t.tabs);this.render();}
  private up(e:EventTouch): void {const t=this.touch;if(!t||e.getID()!==t.id)return;this.touch=null;if(t.distance>=8){if(this.screen==='lobby'&&t.tabs)this.lobby.swipe(0,true);return;}const a=[...this.actions].reverse().find(a=>t.x>=a.x&&t.x<=a.x+a.w&&t.y>=a.y&&t.y<=a.y+a.h);if(a)this.action(a.action);}
  private cancel(): void {this.touch=null;}
  // 滚轮和键盘仅作用外围菜单；对局按键继续由InputView处理。
  private wheel(e:EventMouse): void {if(this.panel){this.scroll=Math.max(0,Math.min(this.maxScroll,this.scroll-e.getScrollY()*.25));this.render();}else if(this.screen==='intro'){this.intro.swipe(0,e.getScrollY()*.25,false);this.render();}}
  private key(e:EventKeyboard): void {this.audio.unlock();if(this.edit)return;if((e.keyCode===KeyCode.KEY_P||e.keyCode===KeyCode.ESCAPE)&&this.panel==='pause')return;if(e.keyCode===KeyCode.TAB){this.focusVisible=true;this.focus=(this.focus+1)%Math.max(1,this.actions.length);this.render();}else if((e.keyCode===KeyCode.ENTER||e.keyCode===KeyCode.SPACE)&&this.focus>=0&&this.actions[this.focus])this.action(this.actions[this.focus].action);}
  private hide(): void {this.cloud.background();this.debug.resetTaps();this.touch=null;this.audio.hidden(true);if(this.screen==='play'&&this.world?.match.mode==='play'&&!this.panel){this.audio.bgm(false);this.open('pause');this.render();}}
  private show(): void {this.cloud.foreground();this.audio.hidden(false);}
  // 网页入口只挂在window，不在微信创建浏览器全局；simulate复用core不碰真实存档。
  private exposeDebug(): void {if(!this.debugEnabled||this.platform.kind!=='web'||typeof window==='undefined')return;const app=this;(window as unknown as {SG_DEBUG:unknown}).SG_DEBUG={simulate(level=0,runs=20,seed?:number){const m=new Match({level,seed:seed??Date.now(),progress:app.store.read()});return m.simulate(level,runs,seed);},previewAssets(){app.open('assets');app.render();},praise(kind:string){if(!app.world)return false;return app.praise.show(kind,app.world.match,app.real,app.occupied(),app.reduced(),!!app.panel);},state:()=>app.screen==='lobby'?null:app.world?.match.S};}
  // 清理只针对本任务创建的节点、事件、计时器与音频；保留用户编辑器。
  destroy(): void {this.cancelDebugRun();this.alive=false;this.serial++;this.world?.destroy();this.audio.destroy();this.cloud.dispose();this.platform.dispose?.();this.removeEdit();this.praise.clear();view.off('canvas-resize',this.resize,this);game.off(Game.EVENT_HIDE,this.hide,this);game.off(Game.EVENT_SHOW,this.show,this);input.off(Input.EventType.TOUCH_START,this.down,this);input.off(Input.EventType.TOUCH_MOVE,this.move,this);input.off(Input.EventType.TOUCH_END,this.up,this);input.off(Input.EventType.TOUCH_CANCEL,this.cancel,this);input.off(Input.EventType.KEY_DOWN,this.key,this);input.off(Input.EventType.MOUSE_WHEEL,this.wheel,this);if(typeof window!=='undefined'){window.removeEventListener('pointerdown',this.unlock,true);window.removeEventListener('keydown',this.unlock,true);delete (window as unknown as {SG_DEBUG?:unknown}).SG_DEBUG;}this.root.destroy();this.assets.destroy();}
}
