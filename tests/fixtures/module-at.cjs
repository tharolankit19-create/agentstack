const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
module.exports=function moduleAt(path,mocks={},extra={}) {
 const js=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const exports={};
 vm.runInNewContext(js,{exports,require:name=>{if(name==='server-only')return {};if(name in mocks)return mocks[name];if(['zod','node:crypto'].includes(name))return require(name);throw Error('Unexpected import '+name);},Response,Request,URL,Buffer,Date,Error,console,AbortController,AbortSignal,process:{env:{}},...extra},{filename:path});
 return exports;
};
