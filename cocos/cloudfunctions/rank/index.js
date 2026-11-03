const {createHash}=require('crypto');
const {db,handler,readDoc,invalid}=require('./runtime.cjs');
const {LEVELS}=require('./levels.js');
const C=require('./config.js');
const {isBetterBest}=require('./progress.js');
const {sanitizeConfig,levelForMatch,REMOTE_BOUNDS}=require('./remote-config.js');
// 从关卡和白名单配置推导校验范围：只防明显伪造，不能证明客户端真的打过这一局。
function validateScore(v,lv){
  const people=1+lv.bots.filter(k=>k!=='nephew'||lv.nephewRanked===true).length,pass=lv.passRank||3;
  if(!v||!Number.isInteger(v.rank)||v.rank<1||v.rank>people||v.rank>pass)invalid();
  if(v.stars!==(lv.passStars??4-v.rank)||!Number.isFinite(v.duration)||v.duration<lv.duration-0.04||v.duration>lv.duration+0.1)invalid();
  // 每次甩锅最多产生3次护短/抓现行背锅；每次到期锅也按急件3倍，附带教/复活保守余量。
  const durationMax=REMOTE_BOUNDS.duration[1],maxBlames=Math.ceil(durationMax/C.THROW_CD)*C.P0_BLAME+Math.ceil(durationMax/Math.min(lv.potLife||C.DUE_DEFAULT,C.P0_LIFE))*C.MAX_POTS*C.P0_BLAME;
  if(!Number.isInteger(v.blames)||v.blames<0||v.blames>maxBlames||!Number.isFinite(v.debt)||v.debt<v.blames||v.debt>v.blames+(C.MAX_POTS-1)*C.P0_BLAME*C.CARRY_W||v.debt*2%1)invalid();
  return {rank:v.rank,stars:v.stars,duration:v.duration,blames:v.blames,debt:v.debt};
}
// 公开响应永不暴露openid/内部文档ID或自定义文字。
function publicRow(row){return {name:row.name,level:row.level,stars:row.stars,debt:row.debt,blames:row.blames,rank:row.rank};}
exports.main=handler(async(event,openid)=>{
  const index=LEVELS.findIndex(l=>l.id===event.level);if(index<0||!['submit','top'].includes(event.action))invalid();
  const col=db.collection('ranks'),id=createHash('sha256').update(openid+':'+event.level).digest('hex');
  if(event.action==='submit'){
    // 接受本局启动时使用的旧缓存版本：客户端提交该局白名单字段，服务端只用它的合法时长。
    // 时长来自包内默认或当前/历史缓存允许区间；其余数值不参与最好成绩比较。
    const current=sanitizeConfig(await readDoc(db.collection('config').doc('current'))),lv=levelForMatch(index,current);
    let score;
    try{score=validateScore(event.score,lv);}catch(e){
      const cached=sanitizeConfig({version:0,levels:{[event.level]:{duration:event.score?.duration}}});
      if(!cached.levels[event.level]?.duration)throw e;
      score=validateScore(event.score,levelForMatch(index,cached));
    }
    return db.runTransaction(async tx=>{
      const ref=tx.collection('ranks').doc(id),old=await readDoc(ref);
      if(!isBetterBest(score,old))return {updated:false,best:publicRow(old)};
      const row={...score,level:event.level,openid,name:'打工人#'+createHash('sha256').update(openid).digest('hex').slice(-4),updatedAt:Date.now()};
      await ref.set({data:row});return {updated:true,best:publicRow(row)};
    });
  }
  const rows=(await col.where({level:event.level}).orderBy('stars','desc').orderBy('debt','asc').orderBy('_id','asc').limit(50).get()).data;
  const mine=await readDoc(col.doc(id));let myRank=null;
  if(mine){const _=db.command;const ahead=await col.where(_.or([{level:event.level,stars:_.gt(mine.stars)},{level:event.level,stars:mine.stars,debt:_.lt(mine.debt)}])).count();myRank=ahead.total+1;}
  // 同星同账共享名次，列表顺序用_id稳定；即使我不在前50也返回真实全服名次。
  const top=[];let last=null,place=0;
  rows.forEach((row,i)=>{if(!last||last.stars!==row.stars||last.debt!==row.debt)place=i+1;top.push({...publicRow(row),position:place});last=row;});
  return {top,myRank,mine:mine?publicRow(mine):null};
});
