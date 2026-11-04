// 四个函数的公共运行层；prepare-cloud生成每函数内的副本，部署包没有目录外依赖。
const cloud=require('wx-server-sdk');
cloud.init({env:cloud.DYNAMIC_CURRENT_ENV});
const db=cloud.database({throwOnNotFound:false});
let ready;
// 仅忽略确实已存在的集合；网络、权限错误必须返回不可用，不伪装初始化成功。
async function ensureCollections(){
  if(!ready)ready=Promise.all(['saves','events','ranks','config','perf'].map(async name=>{
    try{await db.createCollection(name);}catch(e){
      // 已存在的错误码在SDK/后端版本间不同，用服务端只读查询确认存在，避免误吞权限/网络错误。
      try{await db.collection(name).limit(1).get();}catch{throw e;}
    }
  })).catch(e=>{ready=undefined;throw e;});
  await ready;
}
// 文档不存在与真实数据库故障分开，避免故障时把旧存档当作空档覆盖。
async function readDoc(ref){return (await ref.get()).data||null;}
// 每次调用只信SDK上下文；日志只记错误码，不记玩家存档或身份。
function handler(fn){return async(event)=>{
  try{
    const openid=cloud.getWXContext().OPENID;
    if(typeof openid!=='string'||!openid)return {ok:false,error:'unauthenticated'};
    if(!event||typeof event!=='object'||Array.isArray(event))return {ok:false,error:'invalid_argument'};
    await ensureCollections();return {ok:true,data:await fn(event,openid)};
  }catch(e){if(e.message==='invalid_argument')return {ok:false,error:'invalid_argument'};console.error('[cloud]',e.errCode||'unavailable');return {ok:false,error:'unavailable'};}
};}
function invalid(){throw Error('invalid_argument');}
module.exports={db,handler,readDoc,invalid};
