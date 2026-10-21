// Report only. No target assembly, browser, product or old evidence writes.
import fs from 'node:fs'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''))
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex')
const record=path=>({path,sha256:hash(path)})
const dll='C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/AxureRP11.dll'
assert.equal(hash(dll),'dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7')
const groups=[
 ['geometry','research/selection-layout-border-geometry-probes.json',45],
 ['selection-text-css','research/selection-layout-border-text-padding-probes.json',6],
 ['asset-padding-helper','research/selection-layout-border-padding-probes.json',9],
]
const sources=new Set([dll,'research/native-layers-format-extract.ps1','research/selection-layout-render-writer-cil.json','research/selection-layout-render-evidence.md','research/selection-layout-render-evidence.json','research/selection-layout-render-manifest.json','research/selection-layout-indicator-evidence.md','research/selection-layout-indicator-evidence.json','research/selection-layout-indicator-manifest.json','research/selection-layout-indicator-radio-cil.json','research/selection-layout-indicator-draw-cil.json','research/selection-layout-indicator-glyph-probes.json','research/selection-layout-indicator-literals.mjs','research/line-style-svg-writer-cil.json','research/line-style-svg-pen-cil.json','research/line-style-svg-pen-base-cil.json'])
const summary=[]
for(const [name,path,count]of groups){
 const r=read(path);assert.equal(r.passed,count);assert.equal(r.failed,0)
 for(const s of r.sources){const p=s.path??s.file;assert.equal(hash(p),s.sha256,`Changed successful probe dependency: ${p}`);sources.add(p)}
 summary.push({name,path,sha256:hash(path),passed:count,failed:0,kind:'bounded-retained-CIL-records-with-declared-facades'})
}
const prefix='selection-layout-border-'
const own=fs.readdirSync('research').filter(f=>f.startsWith(prefix)&&!['selection-layout-border-evidence.json','selection-layout-border-manifest.json'].includes(f)).map(f=>'research/'+f).sort()
for(const p of own.filter(p=>p.endsWith('-cil.json')||p.endsWith('array.json')))sources.add(p)
const report={
 stage:'selection-layout-border',target:'Axure RP 11.0.0.4150',kind:'static PE/CIL and bounded retained-instruction interpretation',
 noVendorDllExecution:true,noOriginalGui:true,noNewBrowserRun:true,noProductEdits:true,
 distributionSha256:'f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e7e987687865b876dfe0',
 extractionEvidenceId:'ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7',
 summary:{passed:60,failed:0,groups:summary},
 findings:[
  {id:'SLB-01',claim:'Selection TIdc uses effective b and border width, local b-square and explicit BoxModel0; Shape0 dispatches R5A7, Shape15 L5vW.',tokens:[100702041,100722468,100722472]},
  {id:'SLB-02',claim:'Narrow solid full-border radius0 contract: stroke inset=w/2, fill inset=0, checkbox four closed segments.',tokens:[100722473,100722475,100722630,100722633],oracle:groups[0][1]},
  {id:'SLB-03',claim:'Radio uses four cubic segments from the 12-point .22/.78 unit template; it is not an ideal SVG circle.',tokens:[100720186,100722477,100722484,100722487,100722608,100722612],oracle:groups[0][1]},
  {id:'SLB-04',claim:'Initial radio dot fills a b/2 square inset by b/4; no owner border pen. r57L uses .56-radius cubic handles. Generated class stroke/btn_check is a later-runtime selector, not initial stroke-width proof.',tokens:[100701393,100710704,100719853,100723564,100720709]},
  {id:'SLB-05',claim:'Selection owner nNLd rule applies real TRBL padding, absolute position, align-self and border-box, with no width100%. TB is not forced zero.',tokens:[100699219,100695593,100699217],oracle:groups[1][1]},
  {id:'SLB-06',claim:'UJ0a padding helper includes border and shadow expansion; final SVG asset viewBox has not been composed.',tokens:[100695435,100722439,100722159,100695273],oracle:groups[2][1]},
 ],
 implementationContract:{
  domain:'ordinary checkbox/radio; b>w>=0; solid opaque fill/border; full sides; radius0; no image/shadow',
  fillRect:'[0,0,b,b]',strokeRect:'[w/2,w/2,b-w,b-w]',
  circleUnitPoints:[[.5,0],[.78,0],[1,.21999999999999997],[1,.5],[1,.78],[.78,1],[.5,1],[.21999999999999997,1],[0,.78],[0,.5],[0,.21999999999999997],[.21999999999999997,0]],
  radioDot:{rect:'[b/4,b/4,b/2,b/2]',paint:'fill only',stroke:'none',initialOnly:true},
  independentViewportPolicy:'0 0 b b plus overflow visible is a product policy, not complete original asset bounds equivalence',
  text:{x:'panel.x-L',y:'panel.y',width:'panel.width+L+R',height:'omitted',padding:'T R B L',boxSizing:'border-box',position:'absolute',noWidth100Percent:true},
 },
 boundaries:[
  'No target DLL/GUI execution and no newly generated original page; no native screenshot or full pixel parity.',
  'Geometry replay uses declared collection/property/matrix/record-construction facades. The radio original method slice stops after fill/stroke production at IL270.',
  'Native fonts and TextPanel measurement remain external inputs; the CSS contract does not invent measurement snapshots.',
  'Asset padding helper is not the final SVG width/height/viewBox. Document-version BoxModel mapping is not established.',
  'Complex corners, partial borders, pattern none, oversized width, gradients/images, shadows, additional transforms and full state-asset selection remain outside the narrow renderer domain.',
  'Initial selected mark is distinct from later original _applySvg mutations. Do not infer initial stroke from the generated stroke class.',
 ],
 failureProvenance:{
  files:['research/selection-layout-border-failure-1.json','research/selection-layout-border-failure-2.json','research/selection-layout-border-failure-3.json','research/selection-layout-border-first-observations.json'].map(record),
  classification:'interpreter binding/arity and missing point dereference, not vendor behavior or product errors',
  historicalProbeBytes:'Only captured hashes are retained for these early probe versions; no reconstructed-source claim.',
  validReplacement:record(groups[2][1]),
 },
 sources:[...sources].sort().map(record),
 evidence:own.map(record),
 tests:summary.map(({path,sha256})=>({path,sha256})),
 implementation:[],screenshots:[],
}
fs.writeFileSync('research/selection-layout-border-evidence.json',JSON.stringify(report,null,2)+'\n')
const manifest={stage:report.stage,scope:'new border research plus read-only reused retained sources',evidenceIds:report.findings.map(v=>v.id),summary:report.summary,files:[...new Set([...sources,...own,'research/selection-layout-border-evidence.json'])].sort().map(record)}
fs.writeFileSync('research/selection-layout-border-manifest.json',JSON.stringify(manifest,null,2)+'\n')
for(const f of manifest.files)assert.equal(hash(f.path),f.sha256)
console.log(JSON.stringify({passed:60,files:manifest.files.length,report:record('research/selection-layout-border-evidence.json'),manifest:record('research/selection-layout-border-manifest.json')}))
