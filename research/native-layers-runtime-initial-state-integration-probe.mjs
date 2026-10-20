import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import {createOfflineRuntime} from '../src/runtime/export-runtime.ts';
import {evaluateExpression} from '../src/runtime/expressions.ts';
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex'),bound=p=>({path:p,sha256:hash(p)});
const oracleFile='research/native-layers-runtime-initial-state-matrix-probes.json',oracle=JSON.parse(fs.readFileSync(oracleFile,'utf8'));
const inputs=[oracleFile,'src/runtime/export-runtime.ts','src/runtime/expressions.ts'].map(bound),results=[];
const style={fill:'#fff',stroke:'#000',strokeWidth:0,radius:0,fontFamily:'Arial',fontSize:13,fontWeight:'normal',color:'#000',textAlign:'left',verticalAlign:'top',opacity:1};
const box=id=>({id,type:'box',name:id,x:100,y:100,width:20,height:20,rotation:0,style:{...style},interactions:[{id:id+'-selected',name:'Selected',event:'selectedChange',enabled:true,conditions:[],conditionMode:'all',actions:[{id:id+'-trace',type:'setVariable',targetId:'Trace',value:'[[Trace]]'+id+';'}]}]});
for(const test of oracle.results)for(const portable of [false,true]){
 const {rootSelected,rootDisabled,childSelected,childDisabled}=test.input;
 const child={...box('a'),selected:childSelected,disabled:childDisabled},layer={...box('g'),type:'layer',selected:rootSelected,disabled:rootDisabled,layer:{widgets:[child]}};
 const doc={format:'rea-prototype',version:1,id:'doc',name:'Initial Layer matrix',caseSelection:'never',pages:[{id:'page',name:'Page',width:1200,height:900,background:'#fff',widgets:[layer],notes:'',adaptiveViews:[],interactions:[]}],components:[],variables:{Trace:''},styles:[]};
 const factory=portable?runInNewContext('('+createOfflineRuntime.toString()+')',{structuredClone,Date,setTimeout,clearTimeout}):createOfflineRuntime;
 const runtime=factory(doc,undefined,evaluateExpression);let observed,error;
 try{
  await runtime.start();const g=runtime.widget(layer),a=runtime.widget(child);
  observed={root:{selected:!!g.selected,disabled:!!g.disabled},child:{selected:!!a.selected,disabled:!!a.disabled},selectedEvents:runtime.state().variables.Trace};
 }catch(e){error=String(e.stack)}finally{runtime.dispose()}
 const expected={...test.expected,selectedEvents:test.observed.events.map(x=>x.id+';').join('')};
 results.push({input:test.input,portable,observed,expected,passed:!error&&JSON.stringify(observed)===JSON.stringify(expected),...(error?{error}:{})});
}
const out=process.argv[2]??'research/native-layers-runtime-initial-state-integration-probes.json';assert.ok(!fs.existsSync(out),'Preserve '+out);
const report={capturedAt:new Date().toISOString(),kind:'Actual module/serialized runtime start compared with frozen exact-source 16-case initialization oracle. Synthetic selected-change event count follows retained events.js 1688–1693; no original GUI/browser.',inputs,inputStable:inputs.every(x=>hash(x.path)===x.sha256),script:bound(import.meta.filename),summary:{total:results.length,passed:results.filter(x=>x.passed).length,failed:results.filter(x=>!x.passed).length},results};
fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({summary:report.summary,inputStable:report.inputStable,failures:results.filter(x=>!x.passed)},null,2));
