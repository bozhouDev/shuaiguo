const Module=require('node:module');
const path=require('node:path');
// 内存数据库在事务时保存快照/回滚并串行提交；模拟并发调用而不是把业务结果写进mock。
function memoryDB(){
  const tables=new Map();let tail=Promise.resolve();let failRead=false;
  const clone=x=>JSON.parse(JSON.stringify(x));
  const db={command:{gt:n=>({gt:n}),lt:n=>({lt:n}),or:clauses=>({or:clauses})},tables,
    breakRead(v){failRead=v;},
    async createCollection(name){if(tables.has(name))throw Object.assign(Error('collection already exists'),{errCode:-1});tables.set(name,new Map());},
    collection(name){
      function match(row,query){if(query?.or)return query.or.some(q=>match(row,q));return Object.entries(query||{}).every(([key,n])=>n&&typeof n==='object'?('gt'in n?row[key]>n.gt:row[key]<n.lt):row[key]===n);}
      function query(where={},order=[],limit=Infinity){return {where:q=>query(q,order,limit),orderBy:(key,dir)=>query(where,[...order,[key,dir]],limit),limit:n=>query(where,order,n),async count(){return {total:[...(tables.get(name)||new Map()).values()].filter(r=>match(r,where)).length};},async get(){if(failRead)throw Error('network');const data=[...(tables.get(name)||new Map()).values()].filter(r=>match(r,where));data.sort((a,b)=>{for(const [k,d]of order){if(a[k]!==b[k])return(a[k]<b[k]?-1:1)*(d==='desc'?-1:1);}return 0;});return {data:clone(data.slice(0,limit))};}};}
      return {...query(),doc(id){return {async get(){if(failRead)throw Object.assign(Error('network'),{errCode:-502001});const row=tables.get(name)?.get(id);if(!row)return {data:null};return {data:clone(row)};},async set({data}){if(!tables.has(name))throw Error('collection not exists');tables.get(name).set(id,clone({...data,_id:id}));}};}};
    },
    async runTransaction(fn){const previous=tail;let release;tail=new Promise(r=>release=r);await previous;const before=clone([...tables].map(([k,v])=>[k,[...v]]));try{return await fn(db);}catch(e){tables.clear();for(const [k,rows]of before)tables.set(k,new Map(rows));throw e;}finally{release();}},
  };return db;
}
// 只mock外部SDK，生产index/runtime/生成的core规则均真实执行。
function load(name,db,openid='user-A'){
  const file=path.resolve(__dirname,'../../cloudfunctions',name,'index.js'),old=Module._load;
  for(const key of Object.keys(require.cache))if(key.startsWith(path.dirname(file)))delete require.cache[key];
  Module._load=function(id,...args){if(id==='wx-server-sdk')return {init(){},DYNAMIC_CURRENT_ENV:'mock',database:()=>db,getWXContext:()=>({OPENID:openid})};return old.call(this,id,...args);};
  try{return require(file).main;}finally{Module._load=old;}
}
module.exports={memoryDB,load};
