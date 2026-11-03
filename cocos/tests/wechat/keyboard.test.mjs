import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
// 只读取本机3.8.8实际适配器，在VM里运行，不启动CocosCreator。
test('Cocos3.8.8真实小游戏EditBox适配器调用showKeyboard、单行done、confirm完成中文输入后解除监听',()=>{
 const source=fs.readFileSync('/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources/resources/3d/engine/platforms/minigame/common/engine/Editbox.js','utf8');const callbacks={},shown=[],order=[];
 const EditBox={KeyboardReturnType:{DONE:1},InputMode:{ANY:0},_EditBoxImpl:function(){}};
 const adapter={showKeyboard:o=>shown.push(o),hideKeyboard(){},onKeyboardInput:f=>callbacks.input=f,onKeyboardConfirm:f=>callbacks.confirm=f,onKeyboardComplete:f=>callbacks.complete=f,offKeyboardInput:()=>delete callbacks.input,offKeyboardConfirm:()=>delete callbacks.confirm,offKeyboardComplete:()=>delete callbacks.complete};
 const cc={internal:{EditBox},js:{extend:(Type,Base)=>Object.setPrototypeOf(Type.prototype,Base.prototype)},sys:{platform:'wechat',Platform:{WECHAT_MINI_PROGRAM:'program'}}};vm.runInNewContext(source,{cc,__globalAdapter:adapter,setTimeout,clearTimeout});
 const delegate={string:'老板',_string:'老板',maxLength:100,inputMode:1,returnType:1,_editBoxEditingDidBegan(){order.push('begin');},_editBoxTextChanged(value){this.string=this._string=value;order.push('input');},_editBoxEditingReturn(){order.push('return');},_editBoxEditingDidEnded(){order.push('end');}};
 const edit=new EditBox._EditBoxImpl();edit.init(delegate);edit.beginEditing();assert.equal(shown[0].maxLength,100);assert.equal(shown[0].multiple,false);assert.equal(shown[0].confirmType,'done');callbacks.input({value:'王'});callbacks.confirm({value:'王掌柜'});assert.equal(delegate.string,'王掌柜');assert.deepEqual(order,['begin','input','return','input','end']);assert.equal(callbacks.input,undefined);assert.equal(callbacks.confirm,undefined);
});
