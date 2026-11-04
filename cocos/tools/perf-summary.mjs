import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
// 支持云控制台JSON数组、{data:[]}和逐行JSON；只汇总性能白名单，不输出身份字段。
export function parseExport(text){try{const v=JSON.parse(text);return Array.isArray(v)?v:Array.isArray(v.data)?v.data:[v];}catch{return text.split(/\r?\n/).filter(s=>s.trim()).map(s=>JSON.parse(s));}}
export function summarize(rows){
 const groups=new Map(),seen=new Set();
 for(const row of rows){if(row.type!=='perf'||row.v!==1||!Array.isArray(row.segments))continue;
  const id=row._id||row.id;if(id&&seen.has(id))continue;if(id)seen.add(id);
  for(const s of row.segments){
   const key=[row.device?.brand||'未知',row.device?.model||'未知',row.level,s.kind,Number(s.start).toFixed(2),Number(s.end).toFixed(2),s.dpr,row.capEnabled].join('|');
   let g=groups.get(key);if(!g){g={brand:row.device?.brand||'未知',model:row.device?.model||'未知',level:row.level,kind:s.kind,start:s.start,end:s.end,dpr:s.dpr,cap:row.capEnabled,runs:0,frames:0,sums:{},weights:{}};groups.set(key,g);}
   if(!Number.isFinite(s.frames)||s.frames<=0)continue;g.runs++;g.frames+=s.frames;
   for(const field of ['interval','worst5','logic','draw','drawCalls','pots','graphics','sprites','labels','targetFps','width','height'])if(typeof s[field]==='number'&&Number.isFinite(s[field])){
    // 最差5%均值按每段慢帧数加权；其余时耗按帧数，段末快照按局数。
    const weight=field==='worst5'?Math.ceil(s.frames*.05):['pots','graphics','sprites','labels','targetFps','width','height'].includes(field)?1:s.frames;
    g.sums[field]=(g.sums[field]||0)+s[field]*weight;g.weights[field]=(g.weights[field]||0)+weight;
   }
  }
 }
 return Array.from(groups.values()).sort((a,b)=>a.model.localeCompare(b.model)||a.level-b.level||a.start-b.start||a.kind.localeCompare(b.kind)).map(g=>({...g,metrics:Object.fromEntries(Object.keys(g.sums).map(k=>[k,g.sums[k]/g.weights[k]]))}));
}
export function table(groups){
 const fields=['interval','worst5','logic','draw','drawCalls','pots','graphics','sprites','labels','targetFps','width','height'];
 const lines=['| 品牌 / 机型 | 关卡 | 段 | 起止秒 | DPR / 封顶 | 记录数 | 帧数 | 平均间隔ms | 最差5%ms | 逻辑ms | 绘制ms | draw call | 锅数 | Graphics | Sprite | Label | 目标FPS | 宽px | 高px |','|'+Array(19).fill('---').join('|')+'|'];
 const safe=v=>String(v).replace(/[|\r\n]/g,' ');
 for(const g of groups)lines.push('| '+[`${safe(g.brand)} / ${safe(g.model)}`,g.level,g.kind,`${g.start.toFixed(2)}–${g.end.toFixed(2)}`,`${g.dpr} / ${g.cap?'是':'否'}`,g.runs,g.frames,...fields.map(k=>g.metrics[k]===undefined?'N/A':g.metrics[k].toFixed(2))].join(' | ')+' |');
 return lines.join('\n');
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 if(!process.argv[2]){console.error('用法：node cocos/tools/perf-summary.mjs 导出.json [导出2.json ...]');process.exitCode=1;}
 else {const rows=process.argv.slice(2).flatMap(file=>parseExport(fs.readFileSync(file,'utf8')));console.log(table(summarize(rows)));console.log('\n重叠的 first / period / last 各自汇总；最差5%是各段慢帧的加权均值，不能重建跨局分位数。');}
}
