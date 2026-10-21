import fs from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const prefix='research/selection-pointer-modifiers-';
const sha=path=>createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const read=path=>JSON.parse(fs.readFileSync(path,'utf8').replace(/^\uFEFF/,''));
const item=path=>({path,sha256:sha(path)});
const probes=read(prefix+'probes.json');
assert.deepEqual(probes.summary,{total:55,passed:55,failed:0,frames:163});
assert.equal(sha(prefix+'probes.json'),'47faed383b225239f16db1cd323e1a5648a6822b4680cca2c5afcd4cde89cbef');
for(const source of probes.sources)assert.equal(sha(source.path),source.sha256,source.path);
const dll='C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/AxureRP11.dll';
assert.equal(sha(dll),'dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7');
const staticSuffixes=[
 'entry-cil.json','key-tests-cil.json','key-enum.json','upstream-cil.json','snap-entry-cil.json',
 'platform-cil.json','platform-dispatch-cil.json','platform-key-cil.json','key-final-cil.json',
 'platform-metadata.json','platform-metadata.ps1','signatures.json','signatures.ps1',
 'keyboard-handler-cil.json','keyboard-callers.json','mouse-chain-callers.json','callers.ps1',
 'callers.json','key-payload-cil.json','key-handlers-cil.json','key-events-cil.json',
 'key-dispatch-callers.json','key-tail-cil.json'
];
const references=[...new Set([dll,...probes.sources.map(x=>x.path),
 ...staticSuffixes.map(s=>prefix+s),'research/native-layers-format-extract.ps1',
 'research/selection-pointer-manifest.json','research/selection-pointer-evidence.md'])].map(item);
const evidence=[prefix+'evidence.md',prefix+'probes.json',prefix+'missing-binding-failure.json',prefix+'session-failed.mjs'].map(item);
const tests=[prefix+'probe.mjs',prefix+'session.mjs',prefix+'freeze.mjs'].map(item);
const report={
 schemaVersion:1,stage:'selection-pointer-modifiers',
 kind:'static PE metadata/CIL plus bounded retained-instruction interpretation with declared facades',
 originalGuiCompared:false,originalDllExecuted:false,productEdited:false,
 distribution:{version:'11.0.0.4150',sha256:'f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e7e987687865b876dfe0',extractionEvidenceId:'ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7'},
 summary:{...probes.summary,verifiedProbeSourceHashes:probes.sources.length,sourceHashMismatches:0},
 findings:[
  {id:'SPM-01',status:'source-bound-and-replayed',contract:'AxKeys Shift=65536; QJGS(mask,65536) bit inclusion; hInw reads current platform mask once per invocation.',methods:[{token:100691307,il:[7,13]},{token:100691309,il:[7,18]},{token:100686246,il:[33,55]}]},
  {id:'SPM-02',status:'bounded-source-replay',contract:'Single horizontal has aspect=false; multi uses Shift plus orthogonal visible/non-DbNv handle. Immutable original geometry and live panel/fit state persist; original freedom governs fit setters.',methods:[{token:100686248,il:[419,469]},{token:100686225}],fixture:prefix+'probes.json'},
  {id:'SPM-03',status:'static-only-upstream-boundary',contract:'Supplied delta is downstream of optional native snap. Four corner Shift snap tail constrains the other correction axis by rect height/width. NIoi key binding and full snap consumers remain unexecuted.',methods:[{token:100682868,il:[265,580]},{token:100682729,il:[1833,1848]},{token:100682731,il:[2018,2309]}]},
  {id:'SPM-04',status:'unknown-key-only',contract:'Selected command-key/callback direct calls do not establish a resize recompute; indirect platform-synthesized mouse events not ruled out. No conclusion that original must, or must not, update with stationary pointer.',methods:[{token:100682936},{token:100682937},{token:100682928},{token:100682889},{token:100682927}]}
 ],
 platformBridge:{kind:'static-not-invoked',g3GS:100726677,keyReader:100727662,getKeyState:{token:100731465,module:'user32',name:'GetKeyState',virtualKeys:[16,17,18]},pressedBit:{token:100731360,bit:32768},note:'GetKeyState and GUI callbacks were not executed; replay injects platform key masks.'},
 controlledServices:['platform key mask per hInw call','graphics/measurement and units inherited from frozen transaction harness','selected object/provider/notification facade','finite minimum-size provider injected as 1x1 for these fixtures'],
 concreteFixture:{name:'shared-530x20-right-shift-106',initial:[{x:100,y:100,width:240,height:20},{x:450,y:100,width:180,height:20}],selectionRect:{x:100,y:100,width:530,height:20},delta:{x:106,y:0},mask:65536,measuredHeightFacade:20,final:[{x:100,y:98,width:288,height:20},{x:520,y:98,width:216,height:20}]},
 failures:[{kind:'harness-missing-call-binding',path:prefix+'missing-binding-failure.json',summary:{total:55,passed:0,failed:55,frames:163},error:'100686246 IL 55: unproved call 100686248 .obNM::CbNX',script:prefix+'session-failed.mjs',resolution:'Register exact CbNX method in interpreter call table; no original CIL instruction changed.'}],
 rejectedSearchLeads:[{paths:['key-payload-cil.json','key-handlers-cil.json','key-dispatch-callers.json'].map(s=>prefix+s),reason:'bI8J/PI8N carry eSYM drag/drop payload, not AxKeys; not used to establish keyboard behavior.'},{path:prefix+'key-tail-cil.json',reason:'Initial token selection 100682915..917 does not select gFnq; replaced by exact key-final-cil.json tokens 100682889/927, without overwriting the search record.'}],
 unknowns:['key-only platform synthesis/recompute','NIoi concrete key configuration','full native grid/guide/object snapping','Ctrl/Alt upstream drag effects','Space modifier behavior','rotation/DPI input pipeline','original font/graphics service pixels'],
 sources:references,evidence,tests
};
fs.writeFileSync(prefix+'evidence.json',JSON.stringify(report,null,2)+'\n');
const files=[...new Set([...references,...evidence,...tests].map(x=>x.path).concat(prefix+'evidence.json'))].map(item);
const manifest={schemaVersion:1,stage:report.stage,kind:'final source/evidence byte manifest; does not regenerate frozen probes',files,summary:report.summary};
fs.writeFileSync(prefix+'manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({summary:report.summary,files:files.length,evidence:item(prefix+'evidence.json'),manifest:item(prefix+'manifest.json')}));
