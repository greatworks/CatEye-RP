import fs from 'node:fs';import path from'node:path';import assert from'node:assert/strict';import{createHash}from'node:crypto';
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex'),read=file=>JSON.parse(fs.readFileSync(file,'utf8')),record=file=>({file:file.replaceAll('\\','/'),sha256:sha(file)});
const audit=read('research/native-layers-format-import-audit.json'),census=read('research/native-layers-format-census.json'),metadata=read('research/native-layers-format-metadata.json');
const tests=['research/scripts/read-rp-layer.test.mjs','tests/import-rp-layer.test.ts',...['dropdown','input-types','error-hint','interaction-styles','native-caption','native-pills','rotation','vectors'].map(name=>`tests/import-rp-${name}.test.ts`)];
const imports=read('research/native-layers-format-import-final.json'),legacy=read('research/native-layers-format-legacy-green.json');
assert.equal(imports.numFailedTests,0);assert.equal(legacy.numFailedTests,0);assert(fs.readFileSync('research/native-layers-format-reader-final.tap','utf8').includes('pass 23'));assert.equal(audit.totals.layers,182);assert(audit.samples.every(s=>s.priorDocumentExactAfterRemovingNewLayers));
const sources=[metadata.assembly,...audit.sources.filter(s=>!s.file.endsWith('-baseline.json')).map(s=>s.file),...tests,'research/native-layers-runtime-evidence.md','research/native-layers-runtime-evidence.json','research/native-layers-runtime-import-events-review.json'];
for(const s of census.samples)assert.equal(sha(s.file),s.sha256);
for(const s of audit.sources)assert.equal(sha(s.file),s.sha256,`Audit source drift: ${s.file}`);
const cases=audit.samples.flatMap(s=>s.addedEvents.map(e=>({file:s.file,sha256:s.sha256,...e})));
const evidence={stage:'native-layers-format',originalAssemblyExecuted:false,originalAxureGuiCompared:false,sourceVersion:'11.0.0.4150',
 sources:[...new Set(sources)].map(record),samples:census.samples.map(s=>({file:s.file,sha256:s.sha256})),
 contract:{nativeType:'Axure:DiagramObject:Layer',memberField:'DiagramObjects',runtimeMemberField:'objs',propagateField:'Propagate',coordinateSpace:'nearest diagram (Page/PanelState/repeater), no Layer rebasing',model:"Widget type='layer', layer:{widgets,propagate}",atomicAdmission:'all direct members; rejected wrapper retains previously admitted members',partialParentProof:'membershipReferences, not wrapper admission',version:[11,0,0,0]},
 anchors:[
  {file:'research/native-layers-format-object-cil.json',tokens:[100701072,100701073,100701040,100701037,100701017,100701018,100701035]},
  {file:'research/native-layers-format-generator-cil.json',tokens:[100694305,100694310]},
  {file:'research/native-layers-format-base-cil.json',tokens:[100695457]},
  {file:'research/native-layers-format-bounds-dispatch-cil.json',tokens:[100695406,100695407,100695413]},
  {file:'research/native-layers-format-rect-union-cil.json',tokens:[100720525]},
  {file:'research/native-layers-format-leaf-iterator-cil.json',tokens:[100695807]},
 ],
 census:census.summary,admission:audit.totals,priorDocumentExact:audit.samples.map(s=>({file:s.file,value:s.priorDocumentExactAfterRemovingNewLayers})),newCases:cases,
 checks:{reader:23,newMapper:26,relatedMapper:83,legacyMapper:legacy.numPassedTests,typecheck:0},
 limitations:['No original DLL execution or GUI parity comparison.','Pins/fixed-size source values retained in diagnostic, author constraint behavior unimplemented.','No Layer-local nonempty adaptive witness; unsupported rather than inferred.','Six named selection-group Layer wrappers unsupported.','Four repeatable-diagram Layers and incomplete parent/member graphs remain outside admission.','Layer rotation/general transform storage not admitted; source corpus has none.'],
 historicalBaseline:{file:'research/native-layers-format-baseline.json',sha256:sha('research/native-layers-format-baseline.json'),note:'Immutable preimplementation docs/reports and historical source hashes; current source refs above are separate.'}};
fs.writeFileSync('research/native-layers-format-evidence.json',JSON.stringify(evidence,null,2)+'\n');
const files=fs.readdirSync('research').filter(f=>f.startsWith('native-layers-format-')&&!f.endsWith('-manifest.json')).map(f=>`research/${f}`).filter(f=>fs.statSync(f).isFile());
const manifest={stage:evidence.stage,originalAssemblyExecuted:false,originalAxureGuiCompared:false,sources:evidence.sources,samples:evidence.samples,files:[...new Set([...files,...tests])].sort().map(record),checks:evidence.checks,admission:evidence.admission};
fs.writeFileSync('research/native-layers-format-manifest.json',JSON.stringify(manifest,null,2)+'\n');
for(const r of [...manifest.sources,...manifest.samples,...manifest.files])assert.equal(sha(r.file),r.sha256);
console.log(JSON.stringify({verifiedHashes:manifest.sources.length+manifest.samples.length+manifest.files.length,manifest:record('research/native-layers-format-manifest.json'),evidence:record('research/native-layers-format-evidence.json'),audit:record('research/native-layers-format-import-audit.json'),checks:manifest.checks,admission:manifest.admission}));
