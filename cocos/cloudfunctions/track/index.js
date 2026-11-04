const {createHash}=require('crypto');
const {db,handler,readDoc,invalid}=require('./runtime.cjs');
const {LEVELS}=require('./levels.js');
const {cleanPerf}=require('./perf.cjs');
const LIMIT=20,RATE=120;
// 按字段类型白名单截断，拒收自由文本和任何用户自定义称呼。
function clean(v){
  if(!v||!['start','finish','tutorial','ad_show','ad_result','share','perf'].includes(v.type)||typeof v.id!=='string'||! /^[a-zA-Z0-9_-]{1,64}$/.test(v.id))return null;
  if(!LEVELS.some(l=>l.id===v.level)||!Number.isSafeInteger(v.at)||v.at<0||v.at>Date.now()+60000)return null;
  const out={id:v.id,type:v.type,at:v.at,level:v.level};
  if(v.type==='perf'){const perf=cleanPerf(v);return perf?{...out,...perf}:null;}
  for(const key of ['tutorial','crushed','revived','rescued','success'])if(typeof v[key]==='boolean')out[key]=v[key];
  for(const key of ['rank','stars','debt','blames','crushedAt','duration','step'])if(typeof v[key]==='number'&&Number.isFinite(v[key])&&v[key]>=0&&v[key]<=100000)out[key]=v[key];
  if(['trip','gold','news','legs',null].includes(v.buff))out.buff=v.buff;
  if(['revive','rescue','buff','send'].includes(v.action))out.action=v.action;
  return out;
}
exports.main=handler(async(event,openid)=>{
  if(!Array.isArray(event.events))invalid();
  const batch=event.events.slice(0,LIMIT).map(clean).filter(Boolean),now=Date.now(),window=Math.floor(now/60000);
  return db.runTransaction(async tx=>{
    const ref=tx.collection('saves').doc(openid),doc=await readDoc(ref)||{},rate=doc.track?.window===window?doc.track:{window,count:0};
    let accepted=0,duplicates=0;
    for(const ev of batch){
      if(rate.count>=RATE)break;
      const id=createHash('sha256').update(openid+':'+ev.id).digest('hex'),entry=tx.collection(ev.type==='perf'?'perf':'events').doc(id);
      if(await readDoc(entry)){duplicates++;continue;}
      // perf只保留设备性能白名单；上下文身份用于鉴权/限频/哈希去重，不落入性能集合。
      await entry.set({data:{...ev,...(ev.type==='perf'?{}:{openid}),receivedAt:now}});rate.count++;accepted++;
    }
    const {_id,...rest}=doc;await ref.set({data:{...rest,track:rate}});
    return {accepted,duplicates,dropped:event.events.length-accepted-duplicates};
  });
});
