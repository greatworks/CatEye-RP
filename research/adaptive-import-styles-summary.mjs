import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const census=read('research/adaptive-import-styles-census.json');
const probe=read('research/adaptive-import-styles-probe.json');
assert.equal(probe.totals.failed,0);assert.equal(census.totals.owners,25);assert.equal(census.totals.targets,75);
const assemblySha='dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7';
const assembly='C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/AxureRP11.dll';
assert.equal(sha(assembly),assemblySha);
const sections=[];
function retain(file,token,from,to,label){
 const d=read(file);assert.equal(d.SHA256,assemblySha);
 const m=d.Types.flatMap(t=>t.Methods??[]).find(m=>m.Token===token);assert.ok(m);
 const instructions=m.Instructions.filter(i=>i.Offset>=from&&i.Offset<=to);assert.ok(instructions.length);
 sections.push({source:{path:file,sha256:sha(file)},method:m.Name,token,offsetUnit:'decimal IL bytes',from,to,label,instructions});return m;
}
const widget=retain('research/selected-style-filter-widget-entry.json',100694305,1131,1442,'Adaptive view key mapping, clone, fit panel size and ordinary writer');
const entry=retain('research/selected-style-filter-json-entry.json',100694319,67,93,'Special font writer then all-properties OD filter');
const writer=retain('research/selected-style-filter-json-entry.json',100694323,7,19,'General property dispatcher filters local eligible records');
retain('research/selected-style-filter-json-entry.json',100694323,396,455,'PLACED Boolean negation before JSON Boolean output');
retain('research/selected-style-filter-json-entry.json',100694323,959,1052,'State collection recursively writes styles with null font provider');
assert.ok(widget.Instructions.some(i=>i.Offset===1385&&i.Operand===100694319));
assert.ok(widget.Instructions.some(i=>i.Offset===1417&&i.Operand===100694319));
assert.ok(entry.Instructions.some(i=>i.Offset===85&&i.Operand===100717059));
assert.ok(writer.Instructions.some(i=>i.Offset===14&&i.Operand===100717059));
assert.ok(writer.Instructions.some(i=>i.Offset===1039&&i.Op==='ldnull'));
const metadata=read('research/samples/metadata-PName.json');assert.equal(metadata.SHA256,assemblySha);
const names=Object.fromEntries(metadata.Types.flatMap(t=>t.Fields??[]).filter(f=>f.Constant?.length===8).map(f=>[Buffer.from(f.Constant,'hex').readInt32LE(),f.Name]));
for(const [id,name]of [[101,'LOCATION'],[105,'SIZE'],[110,'VISIBLE'],[111,'PLACED'],[21,'IX_STYLES'],[11,'PADDING_LEFT'],[12,'PADDING_TOP'],[13,'PADDING_RIGHT'],[14,'PADDING_BOTTOM'],[50,'ROTATION'],[51,'TEXT_ROTATION'],[1401,'TRANSFORM'],[1402,'TRANSFORM_ORIGIN']])assert.equal(names[id],name);
fs.writeFileSync('research/adaptive-import-styles-cil.json',JSON.stringify({method:'Narrow retained static metadata/CIL excerpts and structural assertions only. No DLL execution or independent CIL simulation.',assembly,assemblySha256:assemblySha,sections,propertyNames:Object.fromEntries([0,1,2,5,6,7,8,9,10,11,12,13,14,15,16,17,20,21,50,51,70,71,72,73,74,80,81,95,101,105,110,111,1001,1002,1401,1402].map(k=>[k,names[k]??null]))},null,2)+'\n');
const evidence=[
 'research/adaptive-import-styles-evidence.md','research/adaptive-import-styles-census.mjs','research/adaptive-import-styles-census.json',
 'research/adaptive-import-styles-probe.mjs','research/adaptive-import-styles-probe.json','research/adaptive-import-styles-cil.json','research/adaptive-import-styles-summary.mjs','research/adaptive-import-styles-review.json',
 'research/selected-style-filter-evidence.md','research/selected-style-filter-evidence.json','research/selected-style-filter-generator-IJeq.json',
 'research/selected-style-filter-widget-entry.json','research/selected-style-filter-json-entry.json','research/selected-style-filter-predicates.json','research/selected-style-filter-flag-helpers.json',
 'research/adaptive-behavior-format-evidence.md','research/adaptive-behavior-state-evidence.md','research/adaptive-transition-evidence.md',
 'research/adaptive-import-sets-metadata.json','research/adaptive-import-sets-bridge.json','research/samples/metadata-PName.json',
 ...census.sources.map(s=>s.path)];
const files=[...new Set(evidence)].map(p=>{assert.ok(fs.existsSync(p),p);return{path:p,sha256:sha(p)};});
const report={schema:1,capturedAt:new Date().toISOString(),identity:{version:'11.0.0.4150',distributionSha256:census.sourceIdentity.distributionSha256,extractionEvidenceId:census.sourceIdentity.extractionEvidenceId,assemblySha256:assemblySha},
 methods:['Pure frozen raw-object JSON joins','58 exact retained JavaScript NodeVM cases with explicit data/DOM/paint sinks','Retained static CIL structural assertions; no assembly execution'],
 totals:{...census.totals,exactSourceVm:probe.totals,sourceSampleChanges:0},
 findings:{ordinaryEmptyIsNotStateBarrier:true,all75RawLocalListsEmpty:true,localEligibility:'Overridden AND Determined',stateMap:'nearest whole map',normalOverlay:'ancestor to leaf shallow merge',
  pageAdaptiveProperties:['page-style','AdaptiveStyles'],nonemptyPageMaps:0,cursor:'player device presentation, distinct from breakpoint selection',
  unsupported:['limbo','partial padding tuple','unproved local corner geometry','general transform and text rotation','Normal state','unknown named style provenance','adaptive page style fields without model representation','unproved repeater/master override configuration']},
 integrity:{originalSamplesRehashedBeforeAndAfter:true,noHistoricalEvidenceChanged:true,noProductChanges:true,currentImportCountDeltaMeasured:false},
 sources:[{path:assembly,sha256:assemblySha},...probe.sources,...census.originalSources],evidence:files,
 implementation:[],tests:[],screenshots:[],
 notes:['Probe files are research harnesses, not product regression tests.','No screenshot or generated native page comparison is claimed.','The independent reader review identified MouseOver/MouseDown casing as a protocol integration check; product-owned changes and tests remain parent-owned.']};
fs.writeFileSync('research/adaptive-import-styles-evidence.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({ok:true,exactSourceVm:probe.totals,retainedEvidenceFiles:files.length,rawOwners:25,rawTargets:75,sourceSampleChanges:0},null,2));
