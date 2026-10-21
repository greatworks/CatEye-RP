import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const adapter='research/text-autofit-style-css-replay.mjs';
let code=fs.readFileSync(adapter,'utf8')
 .replace("'./gradient-angle-static-flow.mjs'",JSON.stringify(pathToFileURL('research/gradient-angle-static-flow.mjs').href))
 .replace("'./text-autofit-native-literals.mjs'",JSON.stringify(pathToFileURL('research/text-autofit-native-literals.mjs').href))
 .replace("const methods=new Map(sources", "sources.push('research/selection-layout-render-writer-cil.json');\nconst methods=new Map(sources")
 .replace("if(callee==='uNL7.JNLP::xNKi'){const prior=pop(),opacity=pop();pop();assert.equal(prior,null);assert.equal(opacity,1);continue}",
 "if(callee==='uNL7.JNLP::xNKi'){replay('xNKi',s.splice(s.length-3,3),output);continue}")
 .replace("throw Error(`Out-of-scope call ${callee} at ${i.Offset}`);",String.raw`
 if(callee==='Ebxh.rbx2::qbxO'){const epsilon=pop(),b=pop(),a=pop();s.push(Math.abs(a-b)<epsilon);continue}
 if(callee==='Ebxh.rbx2::pbxZ'){const epsilon=pop(),a=pop();s.push(Math.abs(a-1)<epsilon);continue}
 if(callee==='cbDk.ebDE::kbLB'){s.push(String(pop()));continue}
 throw Error('Out-of-scope call '+callee+' at '+i.Offset);`)
 + '\nexport const sourceFiles=sources;';
process.on('uncaughtException',error=>{
 const message=String(error.stack).replace(/data:text\/javascript;base64,[A-Za-z0-9+/=]+/g,'<retained-css-adapter>');
 let n=1;while(fs.existsSync(`research/selection-layout-indicator-css-failure-${n}.json`))n++;
 fs.writeFileSync(`research/selection-layout-indicator-css-failure-${n}.json`,JSON.stringify({message,sourceHash:sha(import.meta.filename)},null,2)+'\n');
 console.error(message);process.exitCode=1;
});
const api=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const results=[];
for(const opacity of [0,1,.5]){
 const actual=api.replay('SNLp',[{TNKT:{}},'u_input',{x:0,y:0,width:0,height:0},0,opacity,null,null,null,false,0,false,false,false]);
 assert.equal(actual.rules[0].style['border-width'],'0px');
 assert.equal(actual.rules[0].style.position,'absolute');
 for(const key of ['left','top','width','height'])assert.equal(actual.rules[0].style[key],'0px');
 results.push({name:`input-css-opacity-${opacity}`,actual,passed:true});
}
const label=api.replay('kNLm',[{TNKT:{}},'u']);
assert.deepEqual(label.rules,[{selector:'#u label',style:{width:'100%',height:'100%',left:'0px'}}]);
results.push({name:'label-rule',actual:label,passed:true});
fs.writeFileSync('research/selection-layout-indicator-css-probes.json',JSON.stringify({
 method:'Retained SNLp/TNKD/hNKx/xNKi/kNLm instructions with explicit CSS dictionary and decimal-format sinks. No DLL or original generated page.',
 sources:[...new Set([...api.sourceFiles,adapter,'research/native-point-commit-evidence-epsilon-cil.json','research/gradient-angle-static-flow.mjs','research/gradient-angle-flow-init-cil.json','research/text-autofit-native-literals.mjs',import.meta.filename])].map(path=>({path,sha256:sha(path)})),
 summary:{total:results.length,passed:results.length,failed:0},
 sinks:['No transformed/master/adaptive CSS context. Zero rotation call has audited identity sink.','mSiO geometry bookkeeping stores explicit values; no native font measurements.','Numeric CSS formatting is supplied for finite exact fixture values.'],results
},null,2)+'\n');
console.log({passed:results.length});
