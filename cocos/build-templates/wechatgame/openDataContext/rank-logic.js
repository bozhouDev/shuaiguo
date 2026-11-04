// 好友KV只由有星结算写入；不从总账猜星数，不接受旧版、字符串或损坏数值。
function debtOf(list,level) {
  if(!Array.isArray(list))return null;
  const item=list.find(v=>v&&v.key==='sg_debt_v1_'+level);
  if(!item||typeof item.value!=='string')return null;
  try {const v=JSON.parse(item.value);return v&&v.v===1&&typeof v.debt==='number'&&Number.isFinite(v.debt)&&v.debt>=0?v.debt:null;}catch{return null;}
}
// KV没有局内的剩余锅数等比较字段；同总账用昵称字典序，再用身份打破同名平局。
function rankRows(data,level,selfId) {
  const rows=[],seen=new Set();
  for(const user of Array.isArray(data)?data:[]) {
    if(!user)continue;
    const debt=debtOf(user.KVDataList,level),id=user.openid||user.openId;
    if(debt===null||typeof id!=='string'||!id||seen.has(id))continue;
    seen.add(id);
    rows.push({id,name:String(user.nickname||user.nickName||'同事'),avatar:String(user.avatarUrl||''),debt,me:id===selfId});
  }
  const compare=(a,b)=>a<b?-1:a>b?1:0;
  return rows.sort((a,b)=>a.debt-b.debt||compare(a.name,b.name)||compare(a.id,b.id));
}
// 用系统画布的实际字宽裁剪；Array.from保留完整Unicode字符，避免小游戏宽松展开陷阱。
function truncate(text,width,measure) {
  if(measure(text)<=width)return text;
  if(measure('…')>width)return '';
  let out='';for(const ch of Array.from(text)){if(measure(out+ch+'…')>width)break;out+=ch;}return out+'…';
}
// 金银铜来自现有警告黄、禁用灰和木色；普通名次沿用墨水蓝。
function rankColor(rank) {return ['#C98A00','#9AA6C4','#A86030'][rank-1]||'#1F2A44';}
// 只接受本页的版本化协议，引擎viewport消息不触发数据请求。
function message(v) {
  if(!v||v.type!=='sg-friend-rank'||v.v!==1)return null;
  if(v.action==='hide')return {action:'hide'};
  if(v.action==='scroll')return Number.isFinite(v.delta)?{action:'scroll',delta:v.delta}:null;
  if(!Number.isInteger(v.level)||v.level<1||v.level>5)return null;
  if(v.action==='invalidate')return {action:'invalidate',level:v.level};
  if(v.action!=='show'||!Number.isFinite(v.width)||!Number.isFinite(v.height)||v.width<100||v.width>2000||v.height<50||v.height>3000)return null;
  return {action:'show',level:v.level,width:v.width,height:v.height};
}
module.exports={debtOf,rankRows,truncate,rankColor,message};
