import fs from 'node:fs';
import assert from 'node:assert/strict';
import {readJson,sha256} from './gradient-angle-static-flow.mjs';
const stem='research/text-autofit-native-',resource=readJson(stem+'resource.json');
const owners=readJson('research/font-size-format-owners.json');
const record=file=>({file,sha256:sha256(file),bytes:fs.statSync(file).size});
const external=[
 'research/gradient-angle-static-flow.mjs','research/gradient-angle-flow-init-cil.json',
 'research/scripts/inspect-rp-serialization.ps1',
 'research/font-size-format-evidence.md','research/font-size-format-evidence.json','research/font-size-format-owners.json',
 'research/font-size-runtime-evidence.md','research/font-size-runtime-evidence.json',
 'research/font-size-runtime-layout-writer-cil.json','research/font-size-runtime-rect-css-cil.json','research/font-size-runtime-rect-values-cil.json',
 'research/font-size-runtime-autofit-replay.json',
 'research/rotation-runtime-shape-writer-cil.json','research/shadow-format-form-cil.json',
 'research/font-size-browser-probe.json',
];
const replays=[stem+'replay.json',stem+'child-replay.json'].map(file=>({file,cases:readJson(file).results.length,sha256:sha256(file)}));
assert.deepEqual(replays.map(r=>r.cases),[4,10]);
const summary={
 scope:'Read-only static owner/text AutoFit CSS follow-up for pinned RP11.0.0.4150; no production or historical report edits.',
 assembly:record(resource.assembly),sample:record(owners.sample.file),
 owners:owners.owners.map(owner=>({packageId:owner.packageId,sourceId:owner.sourceId,text:owner.review.text,savedWidth:owner.review.width,savedHeight:owner.review.height,autoFitWidth:owner.rawObject.AutoFitWidth,autoFitHeight:owner.rawObject.AutoFitHeight})),
 conclusions:[
  {status:'static-and-controlled-replay',claim:'rNPL AutoFitWidth true emits white-space:nowrap; false emits word-wrap:break-word.',token:100699663,il:[929,1287,1320,1435,1462]},
  {status:'static-and-controlled-replay',claim:'TextPanel measurement precedes setting emitted text rectangle height=-1; hNKx omits height for that sentinel.',tokens:[100699663,100722054,100722053,100699265],il:[1787,1357,44,335,340,349]},
  {status:'static',claim:'Ordinary shape owner writers pass their supplied rectangle to SNLp with displayFlex true, independently of measured TextPanel geometry.',tokens:[100699654,100699656,100699217],il:[304,237]},
  {status:'static-and-controlled-replay',claim:'Owner child rule #owner .text emits position:absolute, align-self, box-sizing:border-box, padding, width:100%, with no height/overflow key in that rule.',tokens:[100699219,100699214,100699272]},
  {status:'static',claim:'Specific SNLp overflow assignment is skipped when argument9 scrollbars is zero, as in these owner/text calls. This is not an explicit overflow:visible declaration.',token:100699217,il:[452,454,488,510]},
  {status:'inference',claim:'If the emitted owner-descendant selector and text-ID selector match the same element with ordinary author cascade, #owner .text specificity can replace measured width with100%; complete generated DOM/CSS has not been obtained.'},
 ],
 boundedReplays:replays,totalReplayCases:14,focusedStaticChecks:7,
 unknowns:[
  'Original generated HTML and full base/style cascade, including effective owner/text overflow and clipping.',
  'Actual native graphics/font measurement; injected132x39/95x39 in replay is synthetic.',
  'Whole-document loading or another global synchronization path that could change explicit run21 to base15.',
  'Final original rendered pixels and whether another upstream layout hook changes owner bounds.',
 ],
 nextNarrowHook:{type:'BNCJ',method:'DNCg',token:100699506,callers:[{method:'nNPR',il:[395,988]},{method:'sNP3',il:[2538,3639]}],purpose:'Confirm emitted owner/text DOM attachment and inspect base stylesheet attachment/clipping declarations.'},
 implementationDecision:'No font divisor change, base-font substitution, owner resize, parser or renderer edit in this task. Separate text layer nowrap/auto-height direction is supported; final clipping is not yet proved.',
 sources:external.map(record),
};
fs.writeFileSync(stem+'evidence.json',JSON.stringify(summary,null,2)+'\n');
const files=fs.readdirSync('research').filter(name=>name.startsWith('text-autofit-native-')&&name!=='text-autofit-native-manifest.json').sort().map(name=>'research/'+name);
const manifest={scope:summary.scope,sources:[record(resource.assembly),...external.map(record)],samples:[record(owners.sample.file)],files:files.map(record)};
fs.writeFileSync(stem+'manifest.json',JSON.stringify(manifest,null,2)+'\n');
const all=[...manifest.sources,...manifest.samples,...manifest.files];
for(const item of all)assert.equal(sha256(item.file),item.sha256,item.file);
for(const file of [stem+'replay.json',stem+'child-replay.json',stem+'css-literals.json'])for(const source of readJson(file).sources)assert.equal(sha256(source.file),source.sha256,source.file);
console.log(JSON.stringify({recordsVerified:all.length,replayCases:14,staticChecks:7,summarySHA256:sha256(stem+'evidence.json'),manifestSHA256:sha256(stem+'manifest.json')},null,2));
