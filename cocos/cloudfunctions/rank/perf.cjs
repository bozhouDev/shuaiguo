// 性能记录单条最多16KiB/16段；拒绝非法数值，输出只含明确白名单。
function cleanPerf(v){
  if(Buffer.byteLength(JSON.stringify(v),'utf8')>16384||v.v!==1||!['finish','crushed','exit','restart','background','destroy'].includes(v.reason)||typeof v.capEnabled!=='boolean')return null;
  const number=(n,max=100000)=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=max;
  if(!number(v.start,240)||!number(v.end,240)||v.end<v.start||!v.device||typeof v.device!=='object'||!Array.isArray(v.segments)||v.segments.length>16)return null;
  const device={};
  for(const key of ['brand','model','system','platform','sdkVersion'])device[key]=typeof v.device[key]==='string'?v.device[key].slice(0,key==='sdkVersion'?32:96):'';
  for(const key of ['benchmarkLevel','modelLevel'])device[key]=number(v.device[key])||v.device[key]===-1?v.device[key]:null;
  const segments=[];
  for(const s of v.segments){
    if(!s||!['first','period','last'].includes(s.kind)||!number(s.start,240)||!number(s.end,240)||s.start<v.start||s.end>v.end||s.end<s.start)return null;
    const out={kind:s.kind,start:s.start,end:s.end};
    for(const key of ['frames','pots','interval','worst5','logic','draw','graphics','sprites','labels','targetFps','dpr','width','height']){if(!number(s[key]))return null;out[key]=s[key];}
    if(s.frames<1||!Number.isInteger(s.frames)||s.targetFps>60||s.dpr<=0||s.dpr>10||!s.width||!s.height)return null;
    if(s.drawCalls!==null&&!number(s.drawCalls))return null;out.drawCalls=s.drawCalls;
    segments.push(out);
  }
  return {v:1,reason:v.reason,start:v.start,end:v.end,capEnabled:v.capEnabled,device,segments};
}
module.exports={cleanPerf};
