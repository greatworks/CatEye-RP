import fs from 'node:fs';
import assert from 'node:assert/strict';
import {readJson,sha256} from './gradient-angle-static-flow.mjs';
const dll='C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/AxureRP11.dll';
const expected='dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7';
assert.equal(sha256(dll),expected);
const retained=[
 'research/scripts/inspect-rp-serialization.ps1',
 'research/gradient-angle-static-flow.mjs','research/gradient-angle-flow-init-cil.json',
 'research/adaptive-behavior-format-state-author-cil.json',
 'research/adaptive-behavior-format-state-map-cil.json',
 'research/adaptive-behavior-format-metadata.json',
 'research/adaptive-behavior-format-census.json',
 'research/adaptive-behavior-format-evidence.md',
 'research/adaptive-placement-authoring-owner-cil.json',
 'research/adaptive-placement-authoring-evidence.md',
 'research/runtime-text-autofit-bridge-evidence.md',
 'research/rp-vector-path-evidence.md','research/rp-vector-census.md',
];
const rec=file=>({file,sha256:sha256(file),bytes:fs.statSync(file).size});
const census=readJson('research/adaptive-behavior-format-census.json');
assert.equal(census.samples.length,11);assert.equal(census.adaptiveStyles.length,25);
assert.equal(census.adaptiveStyleTargets.length,75);
for(const r of census.adaptiveStyleTargets){
 const props=new Map(r.target.properties.$map);assert.deepEqual(props.get('PropList'),[]);
}
const replay=readJson('research/adaptive-all-views-effects-replay.json');
const first=readJson('research/adaptive-all-views-effects-first-state-replay.json');
assert.equal(replay.passed,15);assert.equal(first.passed,2);
const evidence={
 title:'Affect All Views state-map granularity and shared-content boundaries',
 target:{file:dll,sha256:expected,version:'11.0.0.4150'},
 method:'Static ECMA-335 CIL plus 17 bounded stored-instruction cases. Original DLL, application and GUI were not executed.',
 productChanges:false,
 conclusions:{
  genericAllViews:'Actual overridden key21 in sJp1 removes whole local P21 across adaptive styles before writing Base; not a per-state/per-field clear.',
  existingMap:'YrgK uses a requested FtXa map plus Htfh sentinel for unchanged states. P21 GetEdit retains other current states and replaces the target state as a whole.',
  firstEffect:'If every effective state is null, YrgK directly writes a one-state P21 through ordinary current provider, even with EditAllAdaptive true. No generic sibling-view clear occurs in this inspected branch.',
  missingLocalStyle:'AdaptiveStyle(Guid) creates the current view Style if absent; first-add does not select an ancestor merely because the leaf had no local record.',
  emptyState:'An entry with an empty Style is non-null, so is not first-effect; empty FtXa with no states is all-null by enumerable All.',
  fit:'Stored AutoFitWidth/Height are shared object fields; effective getters can still depend on adaptive transforms.',
  shape:'Shape kind is a shared object field with type/default/geometry side effects; not a local visual PName.',
  rich:'Raw attributed content is shared; displayed/synchronized rich formatting also passes through current style providers. Not all rich format operations are proven generic style edits.',
 },
 anchors:[
  {token:100677647,type:'xrgg',method:'YrgK',firstAddIL:[128,139,33,46],existingMapIL:[224,293,164,168]},
  {token:100718048,type:'c5b1',method:'GetEdit',states:[1,2,8,64,32,4,16],il:[133,225]},
  {token:100718050,type:'c5b1',method:'M5bg',capabilityIL:[530,538],retainSentinelIL:[675,682,392,401],replaceIL:[426,435]},
  {token:100695567,type:'KJm7',method:'sJp1'},
  {token:100695539,type:'KJm7',method:'WJpV'},
  {token:100717821,type:'jtoq',method:'N5VF',key:21,il:[33,37]},
  {token:100717638,type:'QtAY<T>',method:'ltAo',writeIL:132,notifyIL:63},
  {token:100695533,type:'KJm7',method:'AdaptiveStyle(Guid)',createCurrentIL:[46,104]},
  {token:100695797,type:'AxStyles iterator',method:'MoveNext'},
  {token:100716683,type:'dtZ8',method:'etYY',flagWriteIL:66},
  {token:100702790,type:'VectorShape',method:'set_Shape',fieldWriteIL:388},
  {token:100702343,type:'RichTextObject',method:'set_AutoFitWidth',fieldWriteIL:95},
  {token:100702367,type:'TextRectObject',method:'set_AutoFitHeight',fieldWriteIL:101},
  {token:100701879,type:'RichTextPanel',method:'set_AttrString',fieldWriteIL:36},
  {token:100701886,type:'RichTextPanel',method:'LNOI',styleProjectionIL:[35,40]},
  {token:100701892,type:'RichTextPanel',method:'SyncStyleToAttrString',providerWriteIL:210},
 ],
 corpus:{source:rec('research/adaptive-behavior-format-census.json'),samples:11,nonemptyAdaptiveStyleOwnerMaps:25,referencedAdaptiveStyles:75,emptyPropList:75,adaptiveP21:0,otherRawP21Records:census.stateProperties.length,realAdaptiveEffectEditWitnesses:0},
 verification:{stateEditCases:15,firstEffectCases:2,total:17,notOriginalGui:true,files:[rec('research/adaptive-all-views-effects-replay.json'),rec('research/adaptive-all-views-effects-first-state-replay.json')]},
 limitations:[
  'The first-add replay supplies an ordinary current provider, with property/cache/notification dependency stubs; not original GUI execution.',
  'Arbitrary native property equality is not simulated: only simple exact equal/unequal property lists are tested.',
  'Individual effect-color/font editor construction of the requested target-state property list has not been comprehensively traced.',
  'Contained owners, temporary effect-preview chains, and other specialized author entry points are not generalized.',
  'Global event-subscriber search is limited to direct static calls in the pinned assembly; no claim about reflection/extensions.',
  'No font measurement, pixels, UI undo history, or native writeback validation.',
 ],
 retainedSources:retained.map(rec),
 samples:census.samples.map(s=>({file:s.file,sha256:s.sha256})),
};
fs.writeFileSync('research/adaptive-all-views-effects-evidence.json',JSON.stringify(evidence,null,2)+'\n');
const files=fs.readdirSync('research').filter(n=>n.startsWith('adaptive-all-views-effects-')&&n!=='adaptive-all-views-effects-manifest.json').sort().map(n=>'research/'+n);
const manifest={target:{file:dll,sha256:expected},sources:retained.map(rec),files:files.map(rec),samples:evidence.samples};
for(const r of [...manifest.sources,...manifest.files,...manifest.samples])assert.equal(sha256(r.file),r.sha256);
fs.writeFileSync('research/adaptive-all-views-effects-manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({files:files.length,sources:retained.length,samples:manifest.samples.length,verifiedHashes:files.length+retained.length+manifest.samples.length+1,evidenceSha256:sha256('research/adaptive-all-views-effects-evidence.json'),manifestSha256:sha256('research/adaptive-all-views-effects-manifest.json')}));
