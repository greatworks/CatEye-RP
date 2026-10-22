import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const read=path=>JSON.parse(fs.readFileSync(path,'utf8').replace(/^\uFEFF/,''));
const sha=path=>createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const record=path=>({path,sha256:sha(path),bytes:fs.statSync(path).size});
const dll='C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/AxureRP11.dll';
assert.equal(sha(dll),'dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7');
const probePaths=['research/selection-rotation-controller-probes.json','research/selection-rotation-controller-composed-probes.json'];
const probes=probePaths.map(read);for(const p of probes){assert.equal(p.summary.failed,0);for(const s of p.sources)assert.equal(sha(s.path),s.sha256,s.path);}
const sources=[...new Set([dll,...probes.flatMap(p=>p.sources.map(s=>s.path)),
 'research/native-layers-format-extract.ps1','research/selection-author-properties-evidence.md',
 'research/selection-rotation-input-evidence.md','research/selection-rotation-input-evidence.json','research/selection-rotation-input-manifest.json',
 'research/selection-pointer-snapshot-history-cil.json'])].map(record);
const bindings=[
 {id:'SRC01',method:'obNM.CbNX',token:100686248,offsets:'106-414; common lazy capture 68-101',claim:'Mode 2 multi-selection pivot/angular delta, original snapshots, ordered targets; no resize/fit branch'},
 {id:'SRC02',method:'obNM.IbNU',token:100686255,offsets:'212-277 locked gate; 278-339 original center projection; 73-99 Rotation; 181-187 Location; 244 notification',claim:'Skip locked; Rotation request then Location false,true,null; no Size'},
 {id:'SRC03',method:'f5wV.K5wb',token:100721956,claim:'atan2 difference in degrees; +90 constant'},
 {id:'SRC04',method:'obNM.abNY',token:100686257,offsets:'121-150 nearest15; 81-96 live Shift; 33-80 abs residual<=5',claim:'Default magnetic snapping versus Shift quantization'},
 {id:'SRC05',method:'f5wV.c5wd/Wbe7.abe0/op_Multiply',tokens:[100722000,100688896,100721995],claim:'Actual retained pivot matrix construction/composition/point multiplication replay'},
 {id:'SRC06',method:'Selection/Checkbox capabilities, Rotation gate and kJ0t',tokens:[100702019,100699783,100725016,100695382],claim:'Exact Int64 capability carriers deny individual Rotation; member orbit continues'},
 {id:'SRC07',method:'xJ0B/pJ0V/point equality',tokens:[100695349,100695350,100721976,100721975,100721978,100721980,100721982,100688812],claim:'Both-axis strict 1e-5 equality; current-view ordinary provider; same-value no property notification'},
 {id:'SRC08',method:'SelectionButton.MIue/TextRectObject.MIue',tokens:[100702033,100702383],claim:'Separate exact [101] notification skips text layout; not a complete provider graph replay'},
];
const evidence={schemaVersion:1,status:'frozen',kind:'retained-CIL-static-and-bounded-instruction-replay',originalDllExecuted:false,originalGuiCompared:false,fullAxureParity:false,
 artifact:{...record(dll),distributionVersion:'11.0.0.4150',distributionSha256:'f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e7e987687865b876dfe0',extractionEvidenceId:'ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7'},
 summary:{total:276,passed:276,failed:0,controllerSessions:47,controllerFrames:125,numericChecks:189,composedSessions:32,composedFrames:128,locationNotificationCases:8},
 contract:{supportedDomain:'ordinary same-diagram initially unrotated multiple Checkbox/Radio mode 2',effect:'current-view Location only; sizes, own rotation, fit flags and text panel unchanged',pivot:'captured PbSc.center',angularPoint:'actual down YbSE plus corrected delta (absolute corrected point minus logical DFQ8)',snap:'nearest15 away-from-zero; default residual<=5; Shift unconditional',locationEquality:'each axis abs difference <1e-5',locked:'included in captured union; all member effects skipped',snapshots:'lazy first CbNX geometry/angle; persistent accepted live location for equality',history:'Do not infer data changes from editor refresh; no complete native undo/exception implementation claimed'},
 bindings,sources,tests:probePaths.map(record),evidence:[record('research/selection-rotation-controller-evidence.md'),record('research/selection-rotation-controller-development.json')],
 limitations:['BCL trig/round/collections and normal provider/graphics/history services are explicit substitutes; not original CLR execution or GUI pixels','No single rotatable object, Connector/Layer/general transform/contained context implementation contract','Original key-only, guides/object snapping and full history/exception rollback remain unproved','Grid 8 and uniform zoom are controlled inputs, not native defaults','Initial harness byref defect and missing facade are recorded, with no retrospective claim of old byte snapshots']};
fs.writeFileSync('research/selection-rotation-controller-evidence.json',JSON.stringify(evidence,null,2)+'\n');
const own=fs.readdirSync('research').filter(p=>p.startsWith('selection-rotation-controller-')&&!p.endsWith('-manifest.json')).map(p=>'research/'+p);
const files=[...new Set([...sources.map(s=>s.path),...own])].sort().map(record);
const manifest={schemaVersion:1,status:'frozen',purpose:'source-bound selection mode2 controller contract',evidence:record('research/selection-rotation-controller-evidence.json'),files};
fs.writeFileSync('research/selection-rotation-controller-manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({evidence:record('research/selection-rotation-controller-evidence.json'),manifest:record('research/selection-rotation-controller-manifest.json'),files:files.length,summary:evidence.summary},null,2));
