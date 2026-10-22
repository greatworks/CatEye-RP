import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const prefix='research/selection-input-keys-';
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const item=path=>({path,sha256:sha(path)});
const main=read(prefix+'probes.json'),resize=read(prefix+'resize-probes.json');
assert.deepEqual(main.summary,{total:139,passed:139,failed:0});
assert.deepEqual(resize.summary,{total:80,passed:80,failed:0,frames:240,controlFrames:240});
for(const r of [main,resize])for(const s of r.sources)assert.equal(sha(s.path),s.sha256,s.path);
const previous=read('research/selection-pointer-modifiers-manifest.json');
for(const f of previous.files)assert.equal(sha(f.path),f.sha256,f.path);
const dll='C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/AxureRP11.dll';
assert.equal(sha(dll),'dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7');
for(const mask of ['0x37d9e47fefde7fbf','0x37d9ec7fefde7fbf'])assert.equal(BigInt(mask)&1099511627776n,0n);
const sources=[...new Set([dll,...main.sources.map(s=>s.path),...resize.sources.map(s=>s.path),
 'research/native-layers-format-extract.ps1','research/selection-pointer-modifiers-callers.ps1',
 'research/selection-pointer-modifiers-platform-metadata.json','research/selection-pointer-modifiers-key-enum.json',
 'research/layer-resize-capability-getters-cil.json','research/layer-resize-capability-metadata.json','research/layer-resize-capability-evidence.json',
 'research/selection-pointer-modifiers-manifest.json',prefix+'metadata.ps1',prefix+'metadata.json',prefix+'callers.json'])].map(item);
const evidence=['evidence.md','probes.json','resize-probes.json','failure-1.json','probe-failed-1.mjs','probe-first-green.mjs','probes-first-green.json'].map(s=>item(prefix+s));
const tests=['probe.mjs','resize-probe.mjs','freeze.mjs'].map(s=>item(prefix+s));
const report={schemaVersion:1,stage:'selection-input-keys',kind:'static PE/CIL plus bounded original-instruction replay with explicit platform/snap/geometry/history facades',
 originalDllExecuted:false,originalGuiCompared:false,productEdited:false,
 target:{...item(dll),version:'11.0.0.4150',distributionSha256:'f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e7e987687865b876dfe0',extractionEvidenceId:'ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7'},
 summary:{dispatch:main.summary,resizeDifferential:resize.summary,previousManifestFilesVerified:previous.files.length,sourceMismatches:0},
 contracts:[
  {id:'SIK-01',status:'source-bound-replayed-gate',finding:'Windows NIoi=Alt262144; all Alt combinations bypass snap; settings select optional snap on each move.',methods:[{token:100726560,il:[7,12]},{token:100708657,il:[7,17]},{token:100726654,il:[0,6]},{token:100726649,il:[42,48]},{token:100682868,il:[265,580]}]},
  {id:'SIK-02',status:'source-bound-replayed-mode-assignment',finding:'Exact Control-only plus count>1 selects rotation; single SelectionButton Rotation capability=false; modifiers combinations select resize.',selectionCapability:{decimal:'4024498980168564671',hex:'0x37d9e47fefde7fbf',rotationBit:'1099511627776',intersection:'0'},checkboxCapability:{getter:100699783,hex:'0x37d9ec7fefde7fbf',rotationBit:'1099511627776',intersection:'0',kind:'retained exact Int64 constant bit check; separate from SelectionButton replay'},methods:[{token:100686235},{token:100691312},{token:100691331},{token:100702019},{token:100725016},{token:100686243,il:[1112,1137]}]},
  {id:'SIK-03',status:'source-bound-complete-resize-differential',finding:'Mode stays captured during moves; ordinary resize path at same post-snap delta equals Shift-only after removing Control/Alt. Does not admit multi Control-only press rotation.',methods:[{token:100686248,il:[106,118]},{token:100686246}],cases:80,frames:240,controlFrames:240},
  {id:'SIK-04',status:'source-bound-release-dispatch-with-terminal-history-sink',finding:'Release can compute a distinct snap delta, but Selection Moved calls terminal EbNf and no geometry planner; its base Moved is exact no-op.',methods:[{token:100682822},{token:100686261},{token:100686117},{token:100686262},{token:100686263}]}
 ],
 facadeBoundaries:main.facadeBoundaries.concat(resize.boundaries),
 unknowns:['key-only recompute/synthetic mouse event','grid/guide/object snap numerical algorithms belong to separate research','real screen/DPI/platform events','rotation-mode numerical behavior not replayed','complex Layer/Panel/contained selections','actual editor history or GUI pixels'],
 failures:[{kind:'harness missing direct concrete g3GS binding',record:item(prefix+'failure-1.json'),snapshot:item(prefix+'probe-failed-1.mjs'),resolved:true}],
 historicalSources:[{record:item(prefix+'probes-first-green.json'),originalPath:prefix+'probe.mjs',snapshot:item(prefix+'probe-first-green.mjs'),note:'Initial green source used explicit base-call sink. Final source executes retained base no-op with correct call/callvirt dispatch; numerical/event observations unchanged.'}],
 sources,evidence,tests};
fs.writeFileSync(prefix+'evidence.json',JSON.stringify(report,null,2)+'\n');
const files=[...new Set([...sources,...evidence,...tests].map(x=>x.path).concat(prefix+'evidence.json'))].map(item);
const manifest={schemaVersion:1,stage:report.stage,kind:'final retained byte manifest',summary:report.summary,files};
fs.writeFileSync(prefix+'manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({summary:report.summary,files:files.length,evidence:item(prefix+'evidence.json'),manifest:item(prefix+'manifest.json')}));
