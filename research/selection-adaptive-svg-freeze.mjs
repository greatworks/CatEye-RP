import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const prefix='research/selection-adaptive-svg-',read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const digest=path=>createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const main=read(prefix+'probes-final.json'),verified=read(prefix+'verification.json'),numeric=read(prefix+'numerics-probes.json'),rounding=read(prefix+'rounding-controls.json'),midpoint=read(prefix+'midpoint-controls.json'),css=read(prefix+'css-controls.json');
const numericChecks=[];
for(const result of numeric.results){
 let applications=0;
 for(const row of result.actual){assert.equal(row.error,undefined);for(let i=0;i<row.trace.length;i++)if(row.trace[i].kind==='adaptive-enter'){
  const entry=row.trace[i],exit=row.trace.slice(i+1).find(t=>t.kind==='adaptive-exit'),size=entry.args[1].size;
  if(!size)continue;applications++;
  const old=[entry.before.sourceComputedMatrix.m11,entry.before.sourceComputedMatrix.m22],base=entry.before.fullBase.size;
  const raw=[size.width/base.width*old[0],size.height/base.height*old[1]];
  if(raw.some((v,i)=>v!==old[i])){
   assert.equal(exit.after.screenCTM.a,Math.fround(raw[0]));assert.equal(exit.after.screenCTM.d,Math.fround(raw[1]));
   assert.equal(exit.after.sourceComputedMatrix.m11,Number(Math.fround(raw[0]).toPrecision(6)));
   assert.equal(exit.after.sourceComputedMatrix.m22,Number(Math.fround(raw[1]).toPrecision(6)));
  }else assert.deepEqual(exit.after.sourceComputedMatrix,entry.before.sourceComputedMatrix);
 }}
 numericChecks.push({name:result.input.name,type:result.input.type,applications,passed:true});
}
const numericVerification={method:'Independent source-expression validation against recorded WebKitCSSMatrix and screenCTM. float32 then six significant digits is bounded to these finite Chromium fixtures; no product function is imported.',sources:[{path:prefix+'numerics-probes.json',sha256:digest(prefix+'numerics-probes.json')},{path:import.meta.filename,sha256:digest(import.meta.filename)}],summary:{sequences:numericChecks.length,passed:numericChecks.length,failed:0},checks:numericChecks};
fs.writeFileSync(prefix+'numerics-verification.json',JSON.stringify(numericVerification,null,2)+'\n',{flag:'wx'});
const svgCalls=numeric.results.reduce((n,r)=>n+r.actual.reduce((s,a)=>s+a.trace.filter(t=>t.kind==='svg').length,0),0);
const contract={target:'Axure RP 11.0.0.4150 ordinary uncontained noncompound Checkbox/Radio inline SVG, original JavaScript in controlled Edge',environment:main.environment,
 summary:{main:main.summary,verified:verified.summary,numeric:{...numeric.summary,svgCalls,passed:numericChecks.length},cssControls:{originSnapshots:2,assignmentCases:css.assignments.length},roundingControls:rounding.summary,midpointControls:midpoint.summary},
 gates:{baseInitialization:'No view change and no helper call; separate state initialization is outside this probe.',namedInitialization:'One actual switch and adaptive helper call per ordinary object.',sameNamedView:'Public setAdaptiveView returns without helper or SVG call.',differentNamedView:'Reset owner and immediate children, clear prior adaptive paint, add new view class, compute sparse state/adaptive overrides, invoke helper.',returnBase:'Clear adaptive paint and old class, but no setAdaptiveStyle call; nested SVG transform and origin survive.',directApplyView:'Invokes helper again even for the same view; unlike public same-view setter.'},
 arithmetic:{denominator:'computeFullStyle(id, NORMAL, emptyViewId).size; not SVG viewport or live owner size',operation:'rawX=(argumentSize.width/baseSize.width)*oldComputedMatrix.m11; rawY analogously',origin:'Every truthy size sets inline transformOrigin top left before reading the current computed matrix.',writeGate:'Write Scale(rawX, rawY) only when either raw component differs from its old computed component.',readback:'Observed finite float32-range Chromium: float32 value serialized to six significant digits with ties-to-even. JavaScript toPrecision(6) matches the non-midpoint module fixtures but is NOT equivalent at exact midpoint controls. Keep raw submit values separately for DOM paint.',nonfinite:'Invalid Infinity/NaN CSS scale text is rejected as a pair, preserving prior transform after origin update.',extremeFinite:'Observed 1e40 and 1e308 are accepted and clamped to float32 maximum, not rejected; generic unbounded equivalence not claimed.'},
 boundaries:['CSS absolute positions and body geometry are declared carriers; native CSS envelope and DOM ancestry are independently cited.','Native generator emission of sparse half-axis JSON size is not established; product companion-axis reconstruction is a schema bridge.','Hidden/unplaced/inactive-panel/master/repeater-combined lifecycle and queued Resize animations were not executed.','No original GUI, vendor DLL execution, product code import, product/configuration edit, or full-page native export comparison.'],
 data:{main:prefix+'probes-final.json',numerics:prefix+'numerics-probes.json',rounding:prefix+'rounding-controls.json',midpoint:prefix+'midpoint-controls.json',css:prefix+'css-controls.json'}};
fs.writeFileSync(prefix+'evidence.json',JSON.stringify(contract,null,2)+'\n',{flag:'wx'});
const extra=['research/selection-state-dispatch-probe-extended.mjs','research/selection-state-assets-evidence.md','research/selection-state-assets-manifest.json','research/selection-layout-render-dom-probes.json','research/selection-layout-indicator-dom-detail-probes.json','research/selection-svg-bounds-evidence.md','research/selection-svg-bounds-probes.json','research/selection-svg-bounds-manifest.json'];
const artifactPaths=fs.readdirSync('research').filter(name=>name.startsWith('selection-adaptive-svg-')&&!name.endsWith('manifest.json')).map(name=>'research/'+name);
const all=[...new Set([...main.sources.map(s=>s.path),...numeric.sources.map(s=>s.path),...extra,...artifactPaths])];
const manifest={schemaVersion:1,target:contract.target,counts:contract.summary,files:all.map(path=>({path,bytes:fs.statSync(path).size,sha256:digest(path)}))};
fs.writeFileSync(prefix+'manifest.json',JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
for(const file of manifest.files){assert.equal(fs.statSync(file.path).size,file.bytes);assert.equal(digest(file.path),file.sha256,file.path);}
console.log(JSON.stringify({mainSequences:main.summary.sequences,numericSequences:numericChecks.length,totalOriginalSvgCalls:main.summary.svgCalls+svgCalls,files:manifest.files.length,manifestSha256:digest(prefix+'manifest.json')}));
