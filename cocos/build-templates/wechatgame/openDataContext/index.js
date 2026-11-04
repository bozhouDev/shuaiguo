// 自定义原生Canvas入口；无需默认minigame-canvas-engine或任何网络依赖。
const {createRankContext}=require('./rank-renderer');
const rank=createRankContext(wx,wx.getSharedCanvas());
wx.onMessage(rank.receive);
