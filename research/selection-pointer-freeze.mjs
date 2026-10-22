// Freeze new evidence only. Never runs the vendor assembly or writes product files.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const dll='C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/AxureRP11.dll';
assert.equal(sha(dll),'dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7');
const reports=['control','numeric','session'].map(p=>'research/selection-pointer-'+p+'-probes.json');
const inputs=new Set([dll,'research/native-layers-format-extract.ps1']);
const summary=reports.map(path=>{const d=read(path);assert(d.cases.every(c=>c.passed));for(const s of d.sources??[]){assert.equal(sha(s.path),s.sha256);inputs.add(s.path);}return {path,sha256:sha(path),cases:d.cases.length,passed:d.cases.length};});
const owned=['callers.ps1','callers.json','control-probe.mjs','numeric-probe.mjs','session-probe.mjs','freeze.mjs',
 'base-motion-cil.json','dependencies-cil.json','handles-cil.json','history-scope-cil.json','input-cil.json','modifier-cil.json',
 'single-cil.json','snapshot-history-cil.json','vector-rotation-cil.json','evidence.md',
 'control-failure-1.json','control-failure-2.json','control-incomplete-parent-facade.json',
 'numeric-failure-1.json','numeric-incomplete-reference-facade.json','session-failure-1.json','session-failure-2.json',
 'session-failure-3.json','session-slice-probes.json'].map(x=>'research/selection-pointer-'+x);
for(const f of owned){assert(fs.existsSync(f),f);inputs.add(f);}for(const r of reports)inputs.add(r);
const output={kind:'static PE/CIL records and bounded JavaScript instruction interpretation',originalDllExecuted:false,originalGuiCompared:false,productCodeExecuted:false,
 assembly:{path:dll,sha256:sha(dll)},summary:{total:summary.reduce((n,x)=>n+x.cases,0),passed:summary.reduce((n,x)=>n+x.passed,0),scenarios:summary,
 sessionCbNxCalls:read(reports[2]).cases.reduce((n,c)=>n+c.actual.length,0)},
 evidenceIds:['SP-01','SP-02','SP-03','SP-04','SP-05','SP-06'],
 contracts:{singleVisibleHandles:[1,4],multiVisibleHandles:[1,2,3,4,6,8,9,12],allLockedVisibleHandles:[],
  singleSolver:{token:100686258,minimum:{width:1,height:1},dimensionDeltaRounding:'AwayFromZero zero digits',anchor:'opposite handle',pinInfo:null},
  multiSolver:{entry:100686248,root:100686249,numeric:100703557,pinInfo:null,respectFixedFields:false},
  flags:'current effective AFW; abs(dx)<1e-5 only while currently true and horizontal freedom; no return-to-origin restore',
  geometry:'initial unrounded snapshot; live TextPanel and flags persist; Size then final requested Location',allViews:false},
 limitations:['No original DLL/GUI execution or original pointer pixel validation','Font measurement and graphics unit conversion explicitly supplied',
 'History/notifications/overlay and constructor carrier facade do not reproduce entire editor','Ordinary page-scope Selection only; no general transform or VectorShape single branch',
 'Mouse snapping/modifier delivery not reproduced','Earlier failure bytes are not all retained; final current bytes are hash-bound'],
 sources:[...inputs].sort().map(path=>({path,sha256:sha(path)}))};
const out='research/selection-pointer-evidence.json';fs.writeFileSync(out,JSON.stringify(output,null,2)+'\n');
const paths=[...inputs,out];fs.writeFileSync('research/selection-pointer-manifest.json',JSON.stringify({kind:'new selection-pointer evidence freeze',files:paths.sort().map(path=>({path,sha256:sha(path)}))},null,2)+'\n');
console.log(JSON.stringify({total:output.summary.total,passed:output.summary.passed,frames:output.summary.sessionCbNxCalls,files:paths.length,evidence:sha(out),manifest:sha('research/selection-pointer-manifest.json')}));
