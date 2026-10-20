import fs from 'node:fs';
import assert from 'node:assert/strict';
import {readJson,sha256} from './gradient-angle-static-flow.mjs';
const stem='research/text-autofit-dom-';
const oldFile='research/text-autofit-native-manifest.json',old=readJson(oldFile);
const prior=[...old.sources,...old.samples,...old.files];
for(const item of prior)assert.equal(sha256(item.file),item.sha256,`Frozen dependency changed: ${item.file}`);
const resource=readJson('research/text-autofit-native-resource.json');
const record=file=>({file,sha256:sha256(file),bytes:fs.statSync(file).size});
const sources=[
 'research/gradient-angle-static-flow.mjs','research/gradient-angle-flow-init-cil.json',
 'research/scripts/inspect-rp-serialization.ps1',
 oldFile,'research/text-autofit-native-evidence.md','research/text-autofit-native-literals.mjs',
 'research/text-autofit-native-text-callers-cil.json','research/rotation-runtime-shape-writer-cil.json',
 'research/font-size-runtime-layout-writer-cil.json','research/font-size-format-owners.json',
 'research/text-autofit-base-css-evidence.md','research/text-autofit-base-css-evidence.json',
];
const replay=readJson(stem+'replay.json'),args=readJson(stem+'arguments.json'),literals=readJson(stem+'literals.json');
assert.equal(replay.results.length,16);assert.equal(args.records.length,4);
for(const report of [replay,literals])for(const source of report.sources)assert.equal(sha256(source.file),source.sha256,source.file);
assert.equal(sha256(args.source.file),args.source.sha256);
for(const name of ['DNCg','zNPc'])assert.ok(!literals.records.filter(r=>r.method===name).some(r=>r.text.toLowerCase().includes('overflow')));
const summary={
 scope:'Read-only narrow original DNCg and ordinary shape/text DOM attachment evidence; no production or historical artifact changes.',
 assembly:record(resource.assembly),
 findings:[
  {status:'static-and-bounded-replay',claim:'DNCg always opens div, writes id/class and optional label/title/selectiongroup. Slot7 controls immediate closing.',token:100699506},
  {status:'static-and-bounded-replay',claim:'DNCg synthesizes only display/visibility inline styles; no overflow. Generic dictionary forwarding is separately considered, not assumed safe/absent.'},
  {status:'static-and-bounded-replay',claim:'zNPc conditionally adds width/height and optional left/top; no overflow. xNKd writer-mode meaning remains unresolved.',token:100699659},
  {status:'static',claim:'The four requested calls comprise image/div owners, closed background child and compound vector-piece child; they are not all owners.',callSites:args.records.map(({method,token,callIL,kind})=>({method,token,callIL,kind}))},
  {status:'static-and-bounded-replay',claim:'Controlled ordinary GenerateAsDiv path: open owner, open/close background child, open text child, rich payload, close text, close owner. vNPI call order uses real CIL; complete child image/CSS generation is a documented sink.',tokens:[100699653,100699656,100699662,100699507]},
  {status:'static-and-bounded-replay',claim:'fNPD uses same generated owner ID plus _text, class text plus optional ID class, and attributes=null. Its text div therefore matches the previously decoded owner .text rule.',token:100699662,il:[181,211,513,564,355,360,255]},
 ],
 boundedReplayCases:16,callSiteSlices:4,priorManifestRecordsVerified:prior.length,
 unknowns:[
  'Complete original generated page, style-derived owner class string, per-page/base stylesheet cascade and computed overflow.',
  'Native graphics/font measurement and final rendered pixels for the four UX titles.',
  'Formal writer-mode meaning of xNKd/nNKZ; output modes are kept conditional.',
  'Full SVG payload generation and whole-project run/base style synchronization.',
 ],
 nextNarrowHook:'xNxg.rNxD class mapping and writer xNKd/nNKZ context, then emitted project stylesheet; intentionally not expanded in this task.',
 noProductChange:true,sources:sources.map(record),
};
fs.writeFileSync(stem+'evidence.json',JSON.stringify(summary,null,2)+'\n');
const files=fs.readdirSync('research').filter(name=>name.startsWith('text-autofit-dom-')&&name!=='text-autofit-dom-manifest.json').sort().map(name=>'research/'+name);
const manifest={scope:summary.scope,sources:[record(resource.assembly),...sources.map(record)],files:files.map(record),frozenPredecessor:{...record(oldFile),recordsVerified:prior.length}};
fs.writeFileSync(stem+'manifest.json',JSON.stringify(manifest,null,2)+'\n');
const entries=[...manifest.sources,...manifest.files];for(const item of entries)assert.equal(sha256(item.file),item.sha256,item.file);
console.log(JSON.stringify({replayCases:16,newManifestRecords:entries.length,priorRecordsUnchanged:prior.length,summarySHA256:sha256(stem+'evidence.json'),manifestSHA256:sha256(stem+'manifest.json')},null,2));
