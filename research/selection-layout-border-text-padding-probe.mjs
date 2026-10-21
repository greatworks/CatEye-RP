// Bounded retained-CIL replay; no vendor assembly execution or DOM/font measurement.
import fs from 'node:fs'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
const sha256 = p => createHash('sha256').update(fs.readFileSync(p)).digest('hex')
const adapter = 'research/text-autofit-native-child-replay.mjs'
let code = fs.readFileSync(adapter, 'utf8').split('const results=[];')[0]
  .replace("'./gradient-angle-static-flow.mjs'", JSON.stringify(pathToFileURL('research/gradient-angle-static-flow.mjs').href))
  .replace("'./text-autofit-native-literals.mjs'", JSON.stringify(pathToFileURL('research/text-autofit-native-literals.mjs').href))
  .replace("i.Resolved.endsWith('VectorShape')&&value.type==='vector'?value:null",
    "(i.Resolved.endsWith('VectorShape')&&value.type==='vector')||(i.Resolved.endsWith('SelectionButton')&&value.type==='selection')?value:null")
  .replace("if(callee==='kJm2.KJm7::OJOl')", "if(callee==='kJm2.KJm7::WJpE'){s.push(pop().padding);continue}\nif(callee==='kJm2.KJm7::OJOl')")
code += '\nexport { replay, sources };'
const api = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))
const results = []
for (const align of ['near', 'center', 'far']) for (const padding of [[0,0,0,0],[1,7,3,5]]) {
  const actual = api.replay('nNLd', [{}, 'u1', { type:'selection', padding, align }, false])
  assert.equal(actual.selector,'#u1 .text')
  assert.deepEqual(actual.style,{position:'absolute','align-self':align==='near'?'flex-start':align==='center'?'center':'flex-end',padding:padding.map(v=>v+'px').join(' '),'box-sizing':'border-box'})
  results.push({align,padding,...actual,passed:true})
}
const priorOwnerCalls=JSON.parse(fs.readFileSync('research/selection-layout-indicator-dom-detail-probes.json','utf8')).results.map(r=>({kind:r.kind,call:r.dom.find(v=>v.kind==='owner-css-call'&&v.args[0]==='u1')}))
for(const {call}of priorOwnerCalls){assert.equal(call.args[10],1);assert.ok(call.args[4]);}
const report = {
  kind:'bounded-retained-CIL-instructions',
  boundary:'WJpE effective padding and OJOl alignment are supplied values. CSS writer and string decoding execute retained instruction records; no native GUI, final cascade, browser or font measurement.',
  sources:[adapter, ...api.sources, 'research/gradient-angle-flow-init-cil.json', 'research/text-autofit-native-literals.mjs','research/selection-layout-border-padding-color-cil.json','research/selection-layout-indicator-dom-detail-probes.json','research/font-size-runtime-layout-writer-cil.json', import.meta.filename].map(path=>({path,sha256:sha256(path)})),
  passed:results.length,failed:0,results,priorOwnerCalls,
}
fs.writeFileSync('research/selection-layout-border-text-padding-probes.json',JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify(results.map(({align,padding,selector,style})=>({align,padding,selector,style})),null,2))
