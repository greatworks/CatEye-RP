import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const prefix='research/native-corners-format-',read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,'')),sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex'),pin=file=>({file,sha256:sha(file)});
const census=read(prefix+'census.json'),audit=read(prefix+'import-audit.json');
for(const record of [...census.sources,...audit.sources,...census.samples])assert.equal(sha(record.file),record.sha256,`Stale source: ${record.file}`);
assert.equal(audit.unexpectedChanges.length,0);assert.equal(audit.totals.addedWidgets,0);assert.equal(audit.totals.addedEvents,6);assert.equal(audit.totals.addedActions,6);
const outside=census.widgets.filter(w=>w.shape===0&&!w.pathDerivedCornerRadii),pills=outside.filter(w=>w.sample==='Sample form patterns.rplib'&&w.vertices?.length===1&&w.vertices[0]===6),unresolved=census.widgets.filter(w=>w.shape===0&&w.comparison===undefined&&w.pathDerivedCornerRadii);
assert.equal(pills.length,28);assert.equal(outside.length,41);assert.equal(unresolved.length,2);
const unchangedIds=new Set(outside.map(w=>`rp-w-${w.packageId}-${w.id}`));
assert.equal(audit.samples.flatMap(s=>s.changes??[]).filter(w=>unchangedIds.has(w.id)).length,0,'Out-of-domain Shape0 snapshots must remain unchanged');
const states=audit.samples.flatMap(s=>(s.stateChanges??[]).map(w=>({sample:s.file,sha256:s.sha256,...w}))),selected=states.filter(w=>w.initialSelectedNonCornerPaintPreserved);
assert.equal(states.length,6);assert.equal(selected.length,2);
const nodeLog=fs.readFileSync('.build/native-corners-format-reader-final.log','utf8'),vitestLog=fs.readFileSync('.build/native-corners-format-import-final.log','utf8');
const nodeCount=Number(nodeLog.match(/tests (\d+)/)?.[1]),vitestCount=Number(vitestLog.match(/Tests\s+(\d+) passed/)?.[1]);
assert.equal(nodeCount,121);assert.equal(vitestCount,133);assert.match(nodeLog,/fail 0/);
const dll='C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/AxureRP11.dll';
assert.equal(sha(dll),'dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7');
const staticFiles=['property','provider','json','css'].map(s=>prefix+s+'-cil.json');
const evidence={
 stage:'native-corners-format',status:'focused-tests-and-native-corpus-audit-passed',capturedAt:new Date().toISOString(),
 target:{file:dll,sha256:sha(dll),version:'11.0.0.4150'},
 method:{nativeDllExecuted:false,originalGuiCompared:false,sampleBytesModified:false,description:'Static managed metadata/CIL plus self-written native container/object readers and strict pure conversion; no original application or native renderer execution.'},
 protocol:{
  radius:{nativePName:71,carrier:'System.Double',model:'WidgetStyle.radius',bounds:[0,10000],boundsOrigin:'Independent product validation, not an original UI limit'},
  cornerVisibility:{nativePName:81,carrier:'Axure.Platform.Position enum integer',model:'WidgetStyle.cornerVisibility',order:['topLeft','topRight','bottomRight','bottomLeft'],bits:[1,2,4,8],validMask:[0,15]},
  independence:'P71 and P81 are separate native properties. A state/adaptive patch may contain either alone. Explicit zero/all-false/all-true are retained.',
  baseGate:'Complete unique default+matched cache chain, determined P71 and P81 with valid carriers; direct object/state entries must also be Overridden. Strict existing Shape0 rectangular saved path or proven ordinary input/textarea/select surface.',
  stateGate:'Existing local OD filtering and atomic per-state rejection; complete supported base corner pair required. Unknown active values and unresolved inheritance still reject the state.',
  adaptiveGate:'Explicit local P71/P81 only, complete supported base pair required before local substitution; independent raw source/projection comparison by TS importer. No real adaptive corner-property witnesses in this corpus.',
  fallback:'Keep saved vector path and existing derived cornerRadii snapshot when parameters cannot be proven. Do not invent cornerVisibility or consume unknown P71/P81.',
  noNewPersistentGeometryField:true,
 },
 cil:[
  {file:staticFiles[0],token:100717378,name:'ituB.TtyS',anchors:'IL35 key71; IL38 box System.Double; IL44 YtTy'},
  {file:staticFiles[0],token:100717428,name:'ituB.StyA',anchors:'IL34 key81; IL37 box Axure.Platform.Position; IL43 YtTy'},
  {file:staticFiles[1],token:100717786,name:'jtoq.f5Bi',anchors:'Effective radius reads ttz2(100717703)'},
  {file:staticFiles[1],token:100717836,name:'jtoq.s5VE',anchors:'Effective corner mask reads C5GW(100717728)'},
  {file:'research/selected-style-filter-json-entry.json',token:100694323,name:'wJe6.rJeU',anchors:'OD property filter; IL1407 Position Prop type; IL1423 Position unbox; IL1429 cJeZ'},
  {file:staticFiles[2],token:100694324,name:'wJe6.cJeZ',anchors:'Same Position string formatter for P80 and P81; four bit helpers hSdT/nSdu/lSdl/VSd8'},
  {file:staticFiles[3],token:100699253,name:'JNLP.cNK1',anchors:'IL696 ttz2 OD check ->719 f5Bi->724 FNKB; IL735 C5GW OD check ->791 s5VE->796 lNKV'},
 ],
 observations:{...census.totals,rawPropertyOccurrences:census.occurrences.length,defaultStyleAll11:{radius:0,cornerMask:15,determined:true,overridden:true},strictKnownPairComparisons:1345,strictPathMissingPair:2,outsideStrictPathDomain:41,deferredPills:28},
 deferred:outside.map(w=>({sample:w.sample,sha256:w.sourceSha256,packageId:w.packageId,sourcePartSha256:w.sourcePartSha256,sourceId:w.id,vertices:w.vertices,size:w.size,radius:w.effective[71]?.value,mask:w.effective[81]?.value,disposition:'No new corner parameter recovery; retain prior saved-path snapshot or prior rejection'})),
 incomplete:unresolved.map(w=>({sample:w.sample,sha256:w.sourceSha256,packageId:w.packageId,sourcePartSha256:w.sourcePartSha256,sourceId:w.id,disposition:'Strict saved path exists but effective radius/mask cache pair is unresolved'})),
 import:{...audit.totals,maxCompactBytes:audit.maximumCompactBytes,workerCapBytes:32*1024*1024,unexpectedChanges:0,samples:audit.samples.map(s=>({file:s.file,sha256:s.sha256,compactBytes:s.compactBytes,import:s.import,delta:s.delta,corners:s.corners?.length,importError:s.importError}))},
 newBehavior:states.map(w=>({id:w.id,pageId:w.pageId,name:w.name,sourcePartSha256:w.sourcePartSha256,sample:w.sample,sha256:w.sha256,event:'click',action:{type:'setSelected',targetId:w.id,value:'true'},selected:w.sourceSelection.selected,selectedStyle:w.sourceSelection.selectedStyle,mouseOverStyle:w.sourceMouseOver.style,initialSelectedNonCornerPaintPreserved:w.initialSelectedNonCornerPaintPreserved??false,initialSelectedCornerCorrection:w.initialSelectedCornerCorrection})),
 validation:{newNodeTests:23,newImporterTests:20,focusedNode:nodeCount,focusedVitest:vitestCount,typecheck:true,completeSuitesRunByThisAgent:false,
  corrections:[
   'Initial real Tab oracle expected radius3; immutable matching cache actually stores5. Corrected independent expected value to5, not production behavior.',
   'First audit duplicated child changes through parent objects and treated two initial selected base/snapshot splits as unexplained. Audit now compares child identities separately and explicitly proves non-corner selected paint equality.',
   'One initial importer test run exposed an own(raw) typo; repaired to own(style) before final focused passes.',
   'Legacy Required/Tab cornerRadii assertions replaced only for actual native records by explicit P71 radius and P81 mask; legacy snapshot tests unchanged.',
   'Legacy adaptive P71/P81 unknown-property negatives replaced by valid exact independent zero projections plus malformed negatives; unknown transform and extra-paint negatives retained. Missing projected fields still rejected.',
  ]},
 boundaries:[
  '1345 proven comparisons are not all Shape0 owners. 28 six-vertex pills, 9 other eight-vertex shapes, 4 unknown-geometry Default records remain outside the strict path domain; two recognized paths still have incomplete caches.',
  'No real adaptive P71/P81 declarations; these pathways have explicitly synthetic coverage only.',
  'Base regenerated parameter geometry can intentionally differ from saved snapshot under active Selected state; only non-corner initial paint is proven conserved for two owners.',
  'Native static path builder recomputes fill and stroke radius ceilings separately; shipped dynamic JS can reuse the stroke ceiling for fill. Oversized-radius rendering is not asserted pixel-identical across those paths.',
  'Image/general-vector/ellipse/panel/contained surfaces gain no new native corner parameter mapping. General provider inheritance, unknown caches and unmapped geometry remain bounded.',
  'Original GUI, generated original project HTML and pixel equivalence were not measured by this format investigation.',
 ],
 sources:[...staticFiles,'research/selected-style-filter-json-entry.json','research/native-corners-metadata.json','research/native-corners-owner-cil.json','research/native-corners-evidence.md','research/native-corners-evidence.json','research/native-corners-css-literals.json',prefix+'census.json',prefix+'import-audit.json'].map(pin),
};
fs.writeFileSync(prefix+'evidence.json',JSON.stringify(evidence,null,2)+'\n');
const table=audit.samples.map(s=>`| ${path.basename(s.file)} | ${s.corners?.length??'—'} | ${s.delta?.eventsImported??'—'} | ${s.compactBytes.toLocaleString('en-US')} |`).join('\n');
fs.writeFileSync(prefix+'evidence.md',`# Native corner radius and visibility: format/import evidence

Target: Axure RP 11.0.0.4150; DLL SHA-256 \`${sha(dll)}\`. This investigation uses static metadata/CIL and self-written file readers, not original DLL execution or GUI comparison. Original sample bytes remain unchanged.

## Proven carrier and bounded implementation

P71 is a boxed Double uniform radius; P81 is an Axure.Platform.Position bitmask. The setters \`ituB.TtyS\` (100717378, IL35/38/44) and \`ituB.StyA\` (100717428, IL34/37/43) write separate property keys. Effective getters are \`jtoq.f5Bi\` (100717786) and \`s5VE\` (100717836). The generator's OD-filtered \`rJeU\` (100694323) Position branch at IL1407/1423/1429 calls \`cJeZ\` (100694324), shared by P80 and P81. CSS writer \`cNK1\` (100699253) checks the radius and mask independently before \`FNKB\` and \`lNKV\`. Exact CIL records and hashes are in the JSON companion.

Corner order is **TL/TR/BR/BL = bits1/2/4/8**. It differs from border-side TRBL bit order. All eleven actual document DefaultStyle records store determined/overridden radius0 and mask15; this is observed default-cache evidence, not a fallback invented when a runtime key is missing. The independently frozen [runtime/static evidence](native-corners-evidence.md) records the four CSS corner names and the original rendering gates.

The reader emits the actual scalar \`radius\` and explicit \`cornerVisibility\`, even when all true or all false. It requires a unique complete default/matched cache pair, valid determined values, local OD values, and the existing strict saved Shape0 rectangle or proven ordinary form surface. A saved ControlPoints path identifies the admitted family; its maximum radius does not substitute for P71. The prior four-radius snapshot remains only when native parameters cannot be proven. Unknown P71/P81 are retained in the report rather than consumed.

Selected/other effects and local adaptive declarations retain P71/P81 independently, including zero and false resets. They must begin from a fully proven native base pair; supplying both fields in an override cannot manufacture missing base evidence. Unsupported active state fields remain atomically rejected. TS conversion revalidates type, scalar/tuple bounds, path identity, property identities and adaptive raw-source/projection agreement. Radius0..10000 is a product safety bound, not a claim about the native UI. No extra persisted geometry flag was introduced.

## Corpus coverage and deliberate exclusions

The inventory contains 1,388 Shape0 records. Existing strict path recognition accepts1,347; **1,345** have known P71/P81 and match uniform-radius×mask saved corner radii; **2** have unresolved cache pairs. This does not describe every Shape0. The remaining **41** are **28 six-vertex Form pills**, **9 other eight-vertex saved paths**, and **4 Default records lacking known geometry**. None receives new corner metadata in this stage. Their full source IDs, package hashes and native parameter values are in the JSON companion. The28 pills retain prior saved-path behavior; the domain was not widened to make the count larger.

Raw records contain592 direct-MyStyle P71 entries and55 P81 entries. There are18 active OD state corner properties across6 Form owners (12 radius and6 mask declarations). **No original adaptive corner-property declaration was observed** in these11 files; adaptive tests are explicitly synthetic. Full occurrence counts, raw DOA flags, exact cache identity and per-field provenance remain in [the census](native-corners-format-census.json).

Fresh import/save/readback yields **1,256** owners with native corner parameters, **52** partial masks and **460** positive radii. Added/removed widgets:0/0. Six previously omitted Form Click cases now import, each with exactly one \`setSelected(true)\` action targeting itself (not toggle). Form totals become86 events/86 cases/92 actions; other files' interaction counts remain unchanged. The two initially-selected owners preserve their prior **non-corner** active paint when new base and Selected style are composed. Their corners intentionally correct the old base snapshot[4,0,0,4] to native Selected radius5/all corners. This is functional recovery, not an assertion of unchanged initial pixels.

| File | Native corner owners | Added events | Compact semantic bytes |
|---|---:|---:|---:|
${table}

Icons remains rejected at the pre-existing page-count limit. Every prior imported identity and page/document structure is retained; the exhaustive scoped difference audit has0 unexplained changes. Maximum compact semantic output is **${audit.maximumCompactBytes.toLocaleString('en-US')} bytes**, below the actual desktop worker's32MiB result cap.

## Validation and frozen boundaries

New focused suites:23 Node tests and20 importer tests. With relevant existing suites, **${nodeCount}/${nodeCount} Node**, **${vitestCount}/${vitestCount} Vitest**, and typecheck pass. Tests cover all16 masks, independent resets, scalar radius above half-size, malformed/nonfinite/outside-bit values, missing/unknown bases, wrong/open/edited paths, unsupported surfaces, source disagreement, real Tab Menu cache radius5/mask3 and save/readback. Original source hashes are checked before/after reads. Full-suite/build/package/browser validation belongs to the parent task and is not claimed here.

Retained first-failure logs distinguish a mistaken Tab test oracle3→5, an importer typo repaired before final tests, and audit double-counting/initial-selected attribution corrections. The final old-test changes only replace demonstrably obsolete native cornerRadii/unknown-P71-P81 expectations; legacy snapshots and unknown transform/paint rejection assertions remain.

The shipped dynamic JS and native static geometry builder differ for some oversized fill/stroke corner ceilings; see [the runtime evidence](native-corners-evidence.md). No broad image/vector/ellipse/panel/contained corner support, generic provider inheritance, original generated HTML or native GUI pixel equivalence is claimed. New and old source/evidence/sample hashes are pinned in \`native-corners-format-manifest.json\`.

Refresh only this stage, in order:

\`node research/native-corners-format-census.mjs\`

\`node --disable-warning=ExperimentalWarning research/native-corners-format-import-audit.mjs\`

\`node research/native-corners-format-freeze.mjs\`
`);
const logs=['reader-red','reader-first','reader-green','reader-final','import-red','import-first','import-second','import-final','typecheck-final','import-audit-final'].map(s=>`.build/native-corners-format-${s}.log`).filter(fs.existsSync);
const fileNames=[...new Set([
 ...['census.mjs','census.json','fixture.mjs','import-audit.mjs','import-audit.json','freeze.mjs','evidence.md','evidence.json'].map(s=>prefix+s),...staticFiles,
 'research/scripts/read-rp-native-corners.test.mjs','tests/import-rp-native-corners.test.ts','research/scripts/read-rp-adaptive-styles.test.mjs','tests/import-rp.test.ts','tests/import-rp-adaptive-styles.test.ts',...logs,
 ...evidence.sources.map(s=>s.file),
])];
const manifest={stage:'native-corners-format',capturedAt:evidence.capturedAt,validation:evidence.validation,totals:audit.totals,files:fileNames.map(pin),sources:[pin(dll),...audit.sources,...census.sources].filter((v,i,a)=>a.findIndex(w=>w.file===v.file)===i),samples:census.samples.map(s=>({file:s.file,sha256:s.sha256}))};
for(const r of [...manifest.files,...manifest.sources,...manifest.samples])assert.equal(sha(r.file),r.sha256);
fs.writeFileSync(prefix+'manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({evidence:pin(prefix+'evidence.json'),markdown:pin(prefix+'evidence.md'),manifest:pin(prefix+'manifest.json'),files:manifest.files.length,sources:manifest.sources.length,samples:manifest.samples.length,validation:{node:nodeCount,vitest:vitestCount},totals:audit.totals},null,2));
