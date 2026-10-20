import fs from 'node:fs';
import assert from 'node:assert/strict';
import {readJson,sha256} from './gradient-angle-static-flow.mjs';
const stem='research/text-autofit-style-';
const rec=file=>({file,sha256:sha256(file),bytes:fs.statSync(file).size});
const predecessors=['research/text-autofit-native-manifest.json','research/text-autofit-dom-manifest.json'];
const priorRecords=new Map();
for(const file of predecessors){const m=readJson(file);for(const r of [...(m.sources??[]),...(m.samples??[]),...(m.files??[])]){assert.equal(sha256(r.file),r.sha256,r.file);priorRecords.set(r.file,r)}}
const replay=readJson(stem+'replay.json'),literals=readJson(stem+'literals.json');
assert.equal(replay.checks.length,6);assert.equal(replay.cases.length,19);
for(const input of [...replay.sources,...literals.sources])assert.equal(sha256(input.file),input.sha256,input.file);
const owners=readJson('research/font-size-format-owners.json');
assert.equal(sha256(owners.sample.file),owners.sample.sha256);
const dependencies=[...new Set([
 ...predecessors,...priorRecords.keys(),...replay.sources.map(x=>x.file),...literals.sources.map(x=>x.file),
 'research/font-size-runtime-textrect-layout-cil.json','research/font-size-runtime-richpanel-layout-cil.json',
 'research/font-size-runtime-autofit-cil.json','research/font-size-runtime-round-cil.json',
 'research/text-autofit-base-css-evidence.md','research/text-autofit-base-css-evidence.json',
 'research/gradient-angle-static-flow.mjs','research/gradient-angle-zero-cil.json',
 'research/scripts/inspect-rp-serialization.ps1','research/rich-text-format-html-style-cil.json',
 'research/font-style-format-css-cil.json','research/font-size-format-owners.json'
])].filter(f=>!f.startsWith(stem)).sort();
const summary={
 scope:'Read-only ordinary RP11 VectorShape text caller/mode/class/CSS closure; supersedes prior false-flag interpretation without editing frozen reports.',
 target:rec(readJson('research/text-autofit-native-resource.json').assembly),sample:rec(owners.sample.file),
 sourceAssertions:6,composedCilCases:19,realSourceRecords:4,
 findings:[
  {status:'proved-static-and-controlled-CIL-replay',claim:'Ordinary vNPI passes true to fNPD then rNPL argument5; text CSS rectangle becomes four NaNs. SNLp enters but skips TNKD entirely.',tokens:[100699653,100699662,100699663,100699217,100722088,100722161]},
  {status:'proved-static-and-controlled-CIL-replay',claim:'Ordinary text rule has border-width0 plus nowrap or break-word; no direct position,left,top,width,height or overflow. The separate owner descendant rule supplies absolute positioning, vertical align-self, border-box padding,width100%.'},
  {status:'proved-static',claim:'Normal writer xNKd/nNKZ are false; nullable item context/CSS class mode belongs to repeater generation, not AutoFit flags.'},
  {status:'proved-static',claim:'Default/named style CSS writer emits typography/decorations/color only; outline:none suffix does not impose sizing or clipping.'},
  {status:'corrected-prior-scope',claim:'Previous false-argument fixture emits finite text coordinates with height omitted. It is not the actual ordinary VectorShape caller.'},
  {status:'corrected-prior-scope',claim:'Horizontal padding correction in rNPL is gated to SelectionButton; ordinary VectorShape does not execute it.'},
 ],
 ordinaryContract:{owner:'Preserve saved owner bounds and display:flex.',text:'Separate absolute flex item with align-self/padding/border-box/width100%, automatic height, no explicit coordinates.',autoFitWidthTrue:'white-space:nowrap',autoFitWidthFalse:'word-wrap:break-word',autoFitHeight:'Does not select an initial fixed text height in this traced ordinary path.',overflow:'No explicit overflow in the traced ordinary owner/text/class writers; no original computed style or pixels observed.'},
 unknowns:['Original generated UX HTML and complete live CSS cascade/pixels.','Native font measurement and any other global load/style sync.','Raw run LF to HTML encoding: next exact run writer KNiN100699555 from ONiF100699551.','Full class-name collision suffix enumeration; source identity and CSS key restrictions are proved independently.','Nonzero relative text rotation/shadow/casing, non-ordinary form and selection-button callers are outside these composed fixtures.'],
 realOwners:owners.owners.map(o=>({packageId:o.packageId,sourceId:o.sourceId,text:o.review.text,width:o.review.width,height:o.review.height,autoFitWidth:o.rawObject.AutoFitWidth,autoFitHeight:o.rawObject.AutoFitHeight})),
 frozenPredecessors:predecessors.map(rec),frozenPredecessorUniqueRecordsVerified:priorRecords.size,
 sources:dependencies.map(rec),noProductEdits:true,noHistoricalEdits:true,
};
fs.writeFileSync(stem+'evidence.json',JSON.stringify(summary,null,2)+'\n');
const files=fs.readdirSync('research').filter(n=>n.startsWith('text-autofit-style-')&&n!=='text-autofit-style-manifest.json').sort().map(n=>'research/'+n);
const manifest={scope:summary.scope,sources:dependencies.map(rec),samples:[rec(owners.sample.file)],files:files.map(rec),checks:{sourceAssertions:6,composedCilCases:19,frozenPredecessorUniqueRecords:priorRecords.size}};
fs.writeFileSync(stem+'manifest.json',JSON.stringify(manifest,null,2)+'\n');
const records=[...manifest.sources,...manifest.samples,...manifest.files];
for(const r of records)assert.equal(sha256(r.file),r.sha256,r.file);
console.log(JSON.stringify({sourceAssertions:6,replayCases:19,manifestRecords:records.length,priorRecordsUnchanged:priorRecords.size,evidenceSHA256:sha256(stem+'evidence.json'),manifestSHA256:sha256(stem+'manifest.json')},null,2));
