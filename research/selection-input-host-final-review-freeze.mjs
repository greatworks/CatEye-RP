import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const prefix='research/selection-input-host-final-review';
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const item=p=>({path:p,sha256:sha(p)});
const product=read(prefix+'-probes.json'),keys=read('research/selection-input-host-review-keys-probes.json');
assert.deepEqual(product.summary,{total:3,passed:3,failed:0});
assert.deepEqual(keys.summary,{total:16,passed:16,failed:0});
for(const s of [...product.sources,...product.evidence,...keys.sources])assert.equal(sha(s.path),s.sha256,s.path);
assert.equal(sha('research/selection-input-keys-manifest.json'),'503129b5d74ff1a7a1c9325b66c76f6e208e137ce5780a9434cc744ed84dd12b');
assert.equal(sha('research/selection-pointer-modifiers-manifest.json'),'57841c8baf99ffd5ec149f00086292782dd5394198aebc3b13a61d2d0bd71cfc');
const previous=['research/selection-input-keys-manifest.json','research/selection-pointer-modifiers-manifest.json'].map(p=>{
 const m=read(p);for(const f of m.files)assert.equal(sha(f.path),f.sha256,f.path);return {...item(p),filesVerified:m.files.length};
});
const snapshotDir=prefix+'-source';fs.mkdirSync(snapshotDir,{recursive:true});
const implementation=product.sources.map(s=>{
 const target=snapshotDir+'/'+s.path.replaceAll('/','_');
 if(!fs.existsSync(target))fs.copyFileSync(s.path,target);
 assert.equal(sha(target),s.sha256,target);
 return {...s,snapshot:item(target)};
});
const findings=[
 {id:'SIHR-01',severity:'resolved-boundary',title:'The Windows platform mask can append a separate SpaceModifier',
  native:[{token:100727662},{token:100726677,il:[26,32,90,98]},{token:100726678,il:[0,6]},{token:100691312}],
  productLocations:[{path:'src/App.tsx',line:112},{path:'src/App.tsx',line:776},{path:'src/App.tsx',line:791}],
  resolution:'Host rejects/cancels observed browser Space/Meta; not a claim about native physical Space binding or key-only behavior',
  intermediateFailingProductBytesCaptured:false,finalVerified:'read-only final App bytes plus 16 source-record cases'},
];
const evidenceFiles=[prefix+'.md',prefix+'-probes.json','research/selection-input-host-review-keys-probes.json',
 'research/selection-input-keys-evidence.json','research/selection-input-grid-evidence.md','research/selection-input-grid-evidence.json',
 'research/selection-input-grid-live-session-probes.json'];
const tests=[prefix+'-probe.mjs',prefix+'-freeze.mjs','research/selection-input-host-review-keys-probe.mjs'].map(item);
const sources=[...new Set(keys.sources.map(s=>s.path).concat(product.evidence.map(s=>s.path)))].map(item);
const report={schemaVersion:1,stage:'selection-input-host-final-review',status:'no-unresolved-blocking-findings-in-reviewed-domain',
 kind:'read-only host review and bounded actual-product SSR checks against frozen original-CIL observations',
 originalDllExecuted:false,originalGuiCompared:false,browserStarted:false,productEdited:false,
 summary:{originalKeyFacadeCases:keys.summary,actualProductCompositionCases:product.summary,unresolvedBlockingFindings:0},
 findings,implementation,sources,evidence:evidenceFiles.map(item),tests,previousManifestsVerified:previous,
 checks:[
  'Initial modifier capture and immutable mode/settings before asynchronous preparation',
  'Absolute diagram point and event-time keys copied into ordered queue',
  'Every frame projects against preceding accepted owner bounds; resize geometry snapshot remains separate',
  'Ctrl/Alt consumed in input; Shift passed to prior resize model without weakening its direct guard',
  'Release finishes history without another layout frame',
  'Current document/context ownership and failure/cancel rollback',
  'Locked owners retained in union and skipped by layout',
  'Space/Meta protection at press, move and active keydown; stopImmediatePropagation on cancellation'],
 limitations:[
  'App event handlers are read-only reviewed, not executed by the Node probe',
  'Physical Space-to-n1Nh mapping, Mac behavior and key-only recompute remain unclosed',
  'Rotation-mode gestures remain rejected; unrotated ordinary Selection roots only',
  'Fonts/minimum/inset/measurement are explicit composition services, not original graphics execution',
  'Guides/object snapping and arbitrary nested/rotated scope transforms are outside this review',
  'Grid8 and uniform tolerance5/zoom are explicit host policies/services',
  'No intermediate failing-product snapshot was captured for the extra-modifier observation'],
 sourceStableDuringProductProbe:product.sourceStable};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n');
const files=[...new Set([...sources,...report.evidence,...tests,...implementation,...implementation.map(x=>x.snapshot),
 ...previous].map(x=>x.path).concat(prefix+'.json'))].map(item);
const manifest={schemaVersion:1,stage:report.stage,summary:report.summary,files};
fs.writeFileSync(prefix+'-manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({summary:report.summary,files:files.length,report:item(prefix+'.json'),manifest:item(prefix+'-manifest.json')}));
