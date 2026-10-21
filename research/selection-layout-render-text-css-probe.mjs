// Replays the SelectionButton branch of retained rNPL; measured panel supplied.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const source='research/text-autofit-native-replay.mjs';
let code=fs.readFileSync(source,'utf8').split('const results=[];')[0]
 .replace("'./gradient-angle-static-flow.mjs'",JSON.stringify(pathToFileURL('research/gradient-angle-static-flow.mjs').href))
 .replace("'./text-autofit-native-literals.mjs'",JSON.stringify(pathToFileURL('research/text-autofit-native-literals.mjs').href))
 .replace('function replay(autoFitWidth,hideText=false){','export function replay(autoFitWidth,hideText=false){')
 .replace("type:'vector'","type:'selection'")
 .replace('paddingLeft:0,paddingRight:0','paddingLeft:5,paddingRight:7')
 .replace('rect:{x:0,y:0,width:95,height:27},owner','rect:{x:18,y:3,width:80,height:20},owner')
 .replace("i.Resolved.endsWith('VectorShape')||i.Resolved.endsWith('RichTextObject')?v:null","i.Resolved.endsWith('RichTextObject')||i.Resolved.endsWith('SelectionButton')?v:null");
process.on('uncaughtException',error=>{
 const message=String(error.stack).replace(/data:text\/javascript;base64,[A-Za-z0-9+/=]+/g,'<retained-text-CSS-adapter>');
 let n=1;while(fs.existsSync(`research/selection-layout-render-text-css-failure-${n}.json`))n++;
 fs.writeFileSync(`research/selection-layout-render-text-css-failure-${n}.json`,JSON.stringify({message},null,2)+'\n');
 console.error(message);process.exitCode=1;
});
const api=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const results=[];
for(const fit of [false,true])for(const hidden of [false,true]){
 const actual=api.replay(fit,hidden);
 assert.equal(actual.output.style['white-space'],fit?'nowrap':undefined);
 assert.equal(actual.output.style['word-wrap'],fit?undefined:'break-word');
 results.push({fit,hidden,actual,passed:true});
}
fs.writeFileSync('research/selection-layout-render-text-css-probes.json',JSON.stringify({
 method:'Retained rNPL SelectionButton branch CIL replay; supplied premeasured TextPanel and style/zero-rotation providers, not original font or DOM pixels.',
 sources:[source,'research/shadow-format-form-cil.json','research/gradient-angle-flow-init-cil.json','research/text-autofit-native-literals.mjs','research/selection-layout-render-text-css-probe.mjs'].map(path=>({path,sha256:sha(path)})),
 summary:{total:results.length,passed:results.length,failed:0},results},null,2)+'\n');
console.log(JSON.stringify({total:results.length,passed:results.length}));
