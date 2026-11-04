// 检查展开写法：Cocos 打微信包时 Babel 用宽松模式，[...x] 会被编成 [].concat(x)。
// x 是数组时结果正确；是字符串、Set、Map、迭代器时会变成"只有一个元素"，
// 2026-11-04 微信版所有文字宽度因此只算一个字，排版全部错位。这里用类型检查器找出非数组展开。
const path = require('node:path');
const ts = require(process.env.COCOS_TS || '/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources/resources/3d/engine/node_modules/typescript');
const root = path.resolve(__dirname, '..');
const config = ts.getParsedCommandLineOfConfigFile(path.join(root, 'tsconfig.json'), {}, {...ts.sys, onUnRecoverableConfigFileDiagnostic() {}});
const program = ts.createProgram(config.fileNames.filter(f => f.includes('/assets/scripts/')), config.options);
const checker = program.getTypeChecker();

// 类型是否是数组或元组（联合类型要求每一支都是）。
function arrayLike(type) {
  if (type.isUnion()) return type.types.every(arrayLike);
  return checker.isArrayType(type) || checker.isTupleType(type) || (type.flags & ts.TypeFlags.Any) !== 0;
}

const bad = [];
for (const file of program.getSourceFiles()) {
  if (!file.fileName.includes('/assets/scripts/')) continue;
  // 递归遍历语法树，只看数组字面量和函数调用参数里的展开。
  (function walk(node) {
    if (ts.isSpreadElement(node) && !arrayLike(checker.getTypeAtLocation(node.expression))) {
      const {line} = file.getLineAndCharacterOfPosition(node.getStart());
      bad.push(`${path.relative(root, file.fileName)}:${line + 1} ...${node.expression.getText().slice(0, 40)}（${checker.typeToString(checker.getTypeAtLocation(node.expression))}）`);
    }
    // 宽松模式下 const [a, b] = x 会编成 x[0]、x[1]，x 是 Set / Map / 迭代器时拿到 undefined。
    if (ts.isVariableDeclaration(node) && ts.isArrayBindingPattern(node.name) && node.initializer) {
      const type = checker.getTypeAtLocation(node.initializer);
      if (!arrayLike(type) && !(type.flags & ts.TypeFlags.StringLike)) {
        const {line} = file.getLineAndCharacterOfPosition(node.getStart());
        bad.push(`${path.relative(root, file.fileName)}:${line + 1} 解构 ${node.initializer.getText().slice(0, 40)}（${checker.typeToString(type)}）`);
      }
    }
    ts.forEachChild(node, walk);
  })(file);
}
if (bad.length) { console.error('FAIL 以下展开不是数组，微信包里会出错，改用 Array.from：\n' + bad.join('\n')); process.exit(1); }
console.log('PASS 展开写法全部作用于数组');
