const {debtOf,rankRows,truncate,rankColor,message}=require('./rank-logic');
const ROW=58;
// 独立开放数据域：只有这里接触好友身份、昵称和头像，绝不post回主域。
function createRankContext(wx,canvas,timers={setTimeout,clearTimeout}) {
  const ctx=canvas.getContext('2d'),cache=new Map(),images=new Map();
  let visible=false,level=1,width=300,height=400,identity=null;
  // 平台拒绝、缺接口、抛错、无回调均收敛成页面文案；请求不打印私人数据。
  function request(method,options) {
    return new Promise((resolve,reject)=>{
      let done=false;
      const finish=(ok,value)=>{if(done)return;done=true;timers.clearTimeout(timer);ok?resolve(value):reject(new Error('unavailable'));};
      const timer=timers.setTimeout(()=>finish(false),8000);
      try {if(typeof wx[method]!=='function')finish(false);else wx[method](Object.assign({},options,{success:v=>finish(true,v),fail:()=>finish(false)}));}catch{finish(false);}
    });
  }
  // 每次进入仅请求一次本人身份；失败清缓存，下次重新进入可在授权后恢复。
  function self() {
    if(!identity)identity=request('getUserInfo',{openIdList:['selfOpenId'],lang:'zh_CN'}).then(r=>{
      const user=r&&r.data&&r.data[0];if(!user||!(user.openid||user.openId))throw new Error('unavailable');return user;
    }).catch(e=>{identity=null;throw e;});
    return identity;
  }
  // 只缓存本会话各关榜单与滚动位置；切关不重复拉，结算失效时丢弃对应关。
  function fetch(id) {
    if(cache.has(id))return;
    const state={status:'loading',rows:[],offset:0};cache.set(id,state);
    const keyList=['sg_debt_v1_'+id];
    Promise.all([request('getFriendCloudStorage',{keyList}),request('getUserCloudStorage',{keyList}),self()]).then(([friends,mine,user])=>{
      const data=Array.isArray(friends.data)?friends.data.slice():[];
      const selfId=user.openid||user.openId;
      // 好友接口可能含本人；本人成绩以独立KV读取为准，不按同分或同名猜自己。
      const others=data.filter(v=>v&&(v.openid||v.openId)!==selfId);
      if(debtOf(mine.KVDataList,id)!==null)others.push(Object.assign({},user,{KVDataList:mine.KVDataList}));
      state.rows=rankRows(others,id,selfId);state.status='ready';
    }).catch(()=>{state.status='error';}).then(()=>{if(cache.get(id)===state&&visible&&level===id)draw();});
  }
  // 头像只在可见行首次需要时加载；失败保留纯色方块，隐藏后回调不再绘制。
  function avatar(url) {
    if(!url)return null;
    if(images.has(url))return images.get(url);
    const item={image:null};images.set(url,item);
    try {const img=wx.createImage();img.onload=()=>{item.image=img;if(visible)draw();};img.onerror=()=>{item.image=null;};img.src=url;}catch{/* 方块兜底。 */}
    return item;
  }
  // 使用640×960固定共享画布，逆向坐标映射抵消主域节点的宽高伸缩。
  function draw() {
    if(!visible)return;
    ctx.setTransform(canvas.width/width,0,0,canvas.height/height,0,0);ctx.clearRect(0,0,width,height);
    ctx.fillStyle='#FFFDF5';ctx.fillRect(0,0,width,height);ctx.textBaseline='middle';
    const state=cache.get(level);
    if(!state||state.status!=='ready'||!state.rows.length) {
      const text=!state||state.status==='loading'?'正在翻同事的账…':state.status==='error'?'好友榜没拿到，稍后再来':'还没有同事打过这一关';
      ctx.font='14px sans-serif';ctx.fillStyle='#5E6A84';ctx.textAlign='center';ctx.fillText(text,width/2,height/2);return;
    }
    state.offset=Math.max(0,Math.min(Math.max(0,state.rows.length*ROW-height),state.offset));
    const first=Math.floor(state.offset/ROW),last=Math.min(state.rows.length,Math.ceil((height+state.offset)/ROW));
    for(let i=first;i<last;i++) {
      const row=state.rows[i],y=i*ROW-state.offset;
      ctx.fillStyle=row.me?'#FFD84D':'#FFFDF5';ctx.fillRect(0,y,width,ROW);
      ctx.fillStyle='#D5DAE3';ctx.fillRect(8,y+ROW-1,width-16,1);
      ctx.font='bold 19px sans-serif';ctx.textAlign='center';ctx.fillStyle=rankColor(i+1);ctx.fillText(String(i+1),22,y+ROW/2);
      ctx.fillStyle='#9AA6C4';ctx.fillRect(44,y+11,36,36);const image=avatar(row.avatar)?.image;if(image)ctx.drawImage(image,44,y+11,36,36);
      ctx.textAlign='left';ctx.font='bold 15px sans-serif';ctx.fillStyle='#1F2A44';ctx.fillText(truncate(row.name,width-166,s=>ctx.measureText(s).width),90,y+ROW/2);
      ctx.textAlign='right';ctx.fillText(String(row.debt),width-12,y+ROW/2);
    }
    if(state.rows.length*ROW>height){const h=Math.max(18,height*height/(state.rows.length*ROW));ctx.fillStyle='#9AA6C4';ctx.fillRect(width-3,(height-h)*state.offset/(state.rows.length*ROW-height),3,h);}
  }
  // 滚动只在列表内部发起；迟到请求始终写自己的关卡缓存，不会覆盖当前页。
  function receive(raw) {
    const m=message(raw);if(!m)return;
    if(m.action==='hide'){visible=false;return;}
    if(m.action==='invalidate'){cache.delete(m.level);if(visible&&level===m.level){fetch(level);draw();}return;}
    if(m.action==='scroll'){const state=cache.get(level);if(visible&&state){state.offset+=m.delta;draw();}return;}
    const entering=!visible;visible=true;level=m.level;width=m.width;height=m.height;
    if(entering&&cache.get(level)?.status==='error')cache.delete(level);
    fetch(level);draw();
  }
  return {receive};
}
module.exports={createRankContext};
