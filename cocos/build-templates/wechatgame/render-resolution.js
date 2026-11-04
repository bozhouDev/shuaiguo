// 必须先于web-adapter和PAL复制wx接口；只覆盖返回副本的pixelRatio，不改逻辑坐标。
const KEY='shuaiguo_render_dpr';
function install(wx) {
  if(wx.__sgRenderResolution)return;
  // 泊舟定（2026-11-04）：默认原生分辨率，不为性能牺牲清晰度；只有调试面板显式选了 2 倍才封顶，用于真机对比测量。
  let capped=false;try{capped=wx.getStorageSync(KEY)==='2';}catch{/* 存储不可用按原生分辨率。 */}
  const status={capped,nativeDpr:null};
  for(const key of ['getWindowInfo','getSystemInfoSync']){
    if(typeof wx[key]!=='function')continue;
    const original=wx[key];
    wx[key]=function(...args){const info=original.apply(wx,args),ratio=info.pixelRatio;
      if(Number.isFinite(ratio)&&ratio>0){status.nativeDpr=ratio;return Object.assign({},info,{pixelRatio:capped?Math.min(ratio,2):ratio});}
      return info;
    };
  }
  // 只记录启动时生效值；面板改存储后不能误报本局已经切换。
  wx.__sgRenderResolution=status;
}
module.exports={install};
