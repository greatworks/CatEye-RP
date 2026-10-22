// Hash and verify only this investigation's new evidence. No product/old evidence writes.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const sha=path=>createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const read=path=>JSON.parse(fs.readFileSync(path,'utf8').replace(/^\uFEFF/,''));
const row=path=>({path,sha256:sha(path)});
const prefix='research/selection-author-properties-';
const probes=read(prefix+'probes.json');
assert.equal(probes.passed,84);assert.equal(probes.total,84);
for(const source of probes.sources)assert.equal(sha(source.path),source.sha256,source.path);
const assembly='C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/AxureRP11.dll';
assert.equal(sha(assembly),'dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7');
const extra=[
 'research/native-layers-format-extract.ps1','research/adaptive-all-views-metadata.json',
 'research/adaptive-all-views-authoring-evidence.md','research/adaptive-all-views-authoring-evidence.json',
 'research/adaptive-all-views-effects-provider-type.json','research/adaptive-all-views-effects-notification-cil.json',
 'research/adaptive-all-views-effects-provider-notify-cil.json','research/adaptive-all-views-effects-provider-hook-cil.json',
 'research/selection-author-services-evidence.md','research/selection-author-services-probes.json',
 'research/selection-layout-border-size-static-cil.json','research/selection-author-verification.json'
];
const sourcePaths=[...new Set([assembly,...probes.sources.map(x=>x.path),...extra])];
const files=['baseline.json','entry-cil.json','panel-cil.json','rich-cil.json','style-refresh-cil.json','write-cil.json',
 'key-setters-cil.json','provider-cil.json','replay.mjs','first-probes.json','probes.json','evidence.md','freeze.mjs'].map(x=>prefix+x);
const baseline=read(prefix+'baseline.json');
assert.equal(baseline.checks.length,14);assert(baseline.checks.every(x=>x.expected===x.actual));
const evidence={
 schemaVersion:1,stage:'selection-author-properties',
 sourceVersion:'Axure RP 11.0.0.4150',method:'Static PE/CIL inspection and bounded retained-CIL-record interpretation; no vendor DLL/GUI execution',
 extractionEvidenceId:'ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7',
 distributionSha256:'f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e7e987687865b876dfe0',
 baseline:{path:prefix+'baseline.json',sha256:sha(prefix+'baseline.json'),matchedAtTaskStart:14,currentParallelProductFreezeClaim:false},
 results:{passed:84,total:84,initialExpectationFailure:{path:prefix+'first-probes.json',passed:7,total:31,reason:'Assertions initially counted guarded OI8Z reentry as completed layout; original trace preserved',firstScriptBytesRetained:false}},
 findings:[
 {id:'SAPROP-01',tokens:[100702383,100702385,100701893,100701874,100701895],contract:'Ordinary noncontained notifying style changes except exactly [101] refresh true then layout false; editing/pNOC suppress only the inner vNOg refresh; guarded layout callbacks return'},
 {id:'SAPROP-02',tokens:[100702033,100695567,100717643,100717644],contract:'P94 preflight uses already-effective value and precedes base MIue gates; writes size(b+oldPanelWidth,oldHeight,false,true); generic property write/allViews path separately inspected statically'},
 {id:'SAPROP-03',tokens:[100702333,100702335,100702337,100701890,100701884,100701880,100701907],contract:'Text writes attributed value first; ordinary RNO1 suppression scope restores before iIyW(false)/OI8Z(true), then independent VJm0; sync/provider/inline-link internals remain explicit sinks'},
 {id:'SAPROP-04',tokens:[100717328,100717330,100717332],contract:'Thirty native setter carrier IDs replayed; empty changed-key list is admitted by TextRect MIue, distinct from Location-only [101]'}
 ],
 boundaries:['No original UI/pixel observation','No native font measurement','No complete rich-text/provider or inline-link service replication','No general nested diagram/transform/graphics-unit claim','Positive nonempty controlled geometry uses prior declared union facade','Pure product textChanged tail is a bounded post-sync design, not the complete RNO1 mutation'],
 sources:sourcePaths.map(row),evidence:files.map(row),implementation:[],tests:[],screenshots:[]
};
fs.writeFileSync(prefix+'evidence.json',JSON.stringify(evidence,null,2)+'\n');
const manifestPaths=[...new Set([...sourcePaths,...files,prefix+'evidence.json'])];
const manifest={schemaVersion:1,kind:'sha256 source/evidence manifest',files:manifestPaths.map(row)};
for(const source of manifest.files)assert.equal(sha(source.path),source.sha256);
fs.writeFileSync(prefix+'manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({passed:84,manifestFiles:manifest.files.length,report:row(prefix+'evidence.md'),evidence:row(prefix+'evidence.json'),manifest:row(prefix+'manifest.json')}));
