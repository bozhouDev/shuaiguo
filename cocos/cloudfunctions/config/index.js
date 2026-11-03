const {db,handler,readDoc}=require('./runtime.cjs');
const {sanitizeConfig}=require('./remote-config.js');
// 管理端可维护current文档；空集合返回版本0、无覆盖，绝不写默认调参文档。
exports.main=handler(async()=>sanitizeConfig(await readDoc(db.collection('config').doc('current'))));
