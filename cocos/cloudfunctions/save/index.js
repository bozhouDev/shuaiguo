const {db,handler,readDoc,invalid}=require('./runtime.cjs');
const {mergeProgress}=require('./progress.js');
const {LEVELS}=require('./levels.js');
// 客户端数据只接受存档字段；丢弃伪造身份、未知关卡和任意嵌套数据。
function sanitize(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||!value.best||typeof value.best!=='object')invalid();
  if(!Number.isInteger(value.unlocked)||value.unlocked<1||value.unlocked>Math.max(...LEVELS.map(l=>l.id))+1)invalid();
  const out={unlocked:value.unlocked,best:{}};
  for(const lv of LEVELS){const b=value.best[lv.id];if(!b)continue;
    const allowed=lv.passStars?[lv.passStars]:Array.from({length:lv.passRank||3},(_,i)=>3-i);
    if(!allowed.includes(b.stars))invalid();const best={stars:b.stars};
    for(const key of ['debt','blames'])if(b[key]!==undefined){if(!Number.isFinite(b[key])||b[key]<0||b[key]>100000||b[key]*(key==='debt'?2:1)%1)invalid();best[key]=b[key];}
    out.best[lv.id]=best;
  }
  if(typeof value.tutDone==='boolean')out.tutDone=value.tutDone;
  if(value.achievements&&typeof value.achievements==='object'){
    out.achievements={};for(const [key,val]of Object.entries(value.achievements).slice(0,32))if(/^[a-zA-Z][a-zA-Z0-9_]{0,31}$/.test(key)&&typeof val==='boolean')out.achievements[key]=val;
  }
  if(value.bossName!==undefined){if(typeof value.bossName!=='string')invalid();out.bossName=Array.from(value.bossName.replace(/[\u0000-\u001f\u007f-\u009f]/g,'').trim()).slice(0,6).join('');out.bossNameAt=Number.isSafeInteger(value.bossNameAt)&&value.bossNameAt>=0?value.bossNameAt:0;}
  return out;
}
exports.main=handler(async(event,openid)=>{
  if(!['get','put'].includes(event.action))invalid();
  if(event.action==='get'){const doc=await readDoc(db.collection('saves').doc(openid));return doc?.progress||{unlocked:1,best:{}};}
  const incoming=sanitize(event.progress);
  // 同账号多设备并发时重试事务，永远先读最新存档再合并；不覆盖埋点限频字段。
  const result=await db.runTransaction(async tx=>{
    const ref=tx.collection('saves').doc(openid),doc=await readDoc(ref)||{};
    const progress=mergeProgress(doc.progress||{unlocked:1,best:{}},incoming);
    const {_id,...rest}=doc;await ref.set({data:{...rest,progress,updatedAt:Date.now()}});return progress;
  });return result;
});
