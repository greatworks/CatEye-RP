import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex'),bound=p=>({path:p,sha256:hash(p)}),read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const sourcePairs=[
 ['src/runtime/export-runtime.ts','research/native-layers-runtime-final-export-runtime.ts.txt'],
 ['src/runtime/engine.ts','research/native-layers-runtime-final-engine.ts.txt'],
 ['src/runtime/expressions.ts','research/native-layers-runtime-final-expressions.ts.txt'],
 ['src/components/Preview.tsx','research/native-layers-runtime-final-Preview.tsx.txt'],
 ['src/model/types.ts','research/native-layers-runtime-final-types.ts.txt'],
];
const implementation=sourcePairs.map(([p,fallback])=>{assert.equal(hash(p),hash(fallback),'Final snapshot drift '+p);return{...bound(p),fallback:bound(fallback)}});
assert.equal(implementation[0].sha256,'5d8cb997dd29745add36a3270c40c7c743342a0621da1a001403544e8d651128');
const finalFiles=[
 'research/native-layers-runtime-integration-final-resize.json',
 'research/native-layers-runtime-initial-state-review-green.json',
 'research/native-layers-runtime-initial-state-integration-probes.json',
 'research/native-layers-runtime-final-consumers-probes.json',
];
const tests=finalFiles.map(file=>{
 const r=read(file);assert.equal(r.summary.failed,0);assert.ok(r.sourceStable??r.inputStable);
 const inputs=r.sources??r.inputs??[r.implementation,...r.dependencies];
 for(const item of inputs)assert.equal(hash(item.path),item.sha256,'Final probe input drift '+item.path);
 assert.equal(hash(r.script.path),r.script.sha256);
 return{...bound(file),script:r.script,summary:r.summary};
});
const previousManifest='research/native-layers-runtime-manifest.json',supplementManifest='research/native-layers-runtime-supplement-manifest.json';
assert.equal(hash(previousManifest),'200ef8293b83121fb06357d4d9d74e664088987293db8c303bda8e095d6db77a');
assert.equal(hash(supplementManifest),'511e53e23d2fc392e82150b09d6892d2a5733e183ead88262d9f347bed0a4482');
const previous=read(previousManifest),supplement=read(supplementManifest);
const sources=[...new Map([...previous.sources,...supplement.sources].map(x=>[x.path,x])).values()];
for(const source of sources)assert.equal(hash(source.path),source.sha256);
const importFile='research/native-layers-runtime-import-events-review.json',importReview=read(importFile);
assert.equal(importReview.summary.failed,0);for(const input of importReview.inputs)assert.equal(hash(input.path),input.sha256);
const historic=[
 {path:'src/runtime/export-runtime.ts',sha256:'d0225887038d5e675b07cf9250f73883aaa7877d4814ca89e57237da70c7262b',observedIn:'research/native-layers-runtime-integration-first-probes.json',status:'historical-hash-only',fallback:null},
 {path:'src/runtime/export-runtime.ts',sha256:'60f520c08c22fa5d7b787309d28128530e7bd086a7acd19752d020ecbacf2fb1',observedIn:'research/native-layers-runtime-integration-resize-correction-probes.json',status:'historical-hash-only',fallback:null},
 {path:'src/runtime/export-runtime.ts',sha256:'766a76bbbe9d2eb493f770180e1eb9866fe81957e431b4c50da9565fd6585ac1',observedIn:'research/native-layers-runtime-initial-state-review-red.json',status:'historical-hash-only',fallback:null},
];
const search=read('research/native-layers-runtime-source-snapshot-search.json');
for(const item of historic)assert.ok(!search.some(x=>x.sha256===item.sha256),'Update fallback if genuine snapshot found');
const historicalScriptFallbacks=[
 ['research/native-layers-runtime-initial-state-review-first.json','research/native-layers-runtime-initial-state-review-first-probe.mjs'],
 ['research/native-layers-runtime-initial-bounds-first-probes.json','research/native-layers-runtime-initial-bounds-first-probe.mjs'],
 ['research/native-layers-runtime-move-action-first-probes.json','research/native-layers-runtime-move-action-first-probe.mjs'],
].map(([file,fallback])=>{const r=read(file);assert.equal(r.script.sha256,hash(fallback));return{reportedPath:r.script.path,sha256:r.script.sha256,observedIn:bound(file),fallback:bound(fallback)}});
const reviewPath='research/native-layers-runtime-integration-review.json',mdPath='research/native-layers-runtime-integration-review.md',manifestPath='research/native-layers-runtime-integration-manifest.json';
for(const file of [reviewPath,mdPath,manifestPath])assert.ok(!fs.existsSync(file),'Preserve '+file);
const summary={finalIndependentCases:tests.reduce((n,t)=>n+t.summary.total,0),passed:tests.reduce((n,t)=>n+t.summary.passed,0),failed:0,rawImportEvents:13,originalSourceCasesInPriorFrozenReports:111,unresolvedConfirmedProductDefectsInReviewedScope:0};
const findings=[
 {id:'NLR-REVIEW-01',status:'fixed-and-independently-retested',problem:'Layer edge-anchor Resize used rotated AABB origin instead of offsetLocation(ignoreRotation).',red:bound(historic[0].observedIn),intermediateGreen:bound(historic[1].observedIn),finalGreen:bound(finalFiles[0]),expected:{x:160,y:132,width:60,height:32},originalProduct:{x:165,y:126,width:60,height:32}},
 {id:'NLR-REVIEW-02',status:'fixed-and-independently-retested',problem:'Layer initial selected+disabled used authored disabled during pre-disable selected propagation; child remained unselected.',red:bound(historic[2].observedIn),finalGreen:bound(finalFiles[1]),fullMatrixGreen:bound(finalFiles[2]),limit:'Error counterpart passed already. First harness report lacked page.interactions and is not a product defect.'},
 {id:'NLR-INTEGRATION-03',status:'source-contract-reconciled-and-retested',problem:'Initial generated Layer bounds must survive Base; runtime filtered bounds are named/fit cache only.',finalGreen:bound(finalFiles[3]),source:'adaptive.js 48–159 and cache precedence probes'},
 {id:'NLR-INTEGRATION-04',status:'source-contract-reconciled-and-retested',problem:'Combined Resize+Rotate offsets are per-leaf, after Resize invocation, with different X/Y event target carriers.',finalGreen:bound(finalFiles[3]),limit:'64ms actual Node consumer dispatch and expression-read tracing; native orbit was an explicit sink, so no new full native orbit pixel claim.'},
 {id:'NLR-WITHDRAWN-01',status:'withdrawn-before-product-fix',problem:'Direct MoveWidget(to=true) per-member delta was initially overgeneralized to actual Move To action.',correction:'Actual action computes root delta then calls moveBy. Uniform member delta is correct.',source:bound('research/native-layers-runtime-move-action-probes.json')},
];
const limits=[
 'No original GUI/browser/pixel comparison or vendor DLL execution by this review.',
 'Final 50 cases are independent product module/serialized Node executions. Original exact-source fixtures use declared DOM/query/style/expression/fit/animation sinks as documented in frozen 78+33 reports.',
 'Combined native orbit remains an argument/completion sink; nonzero source Resize supplemental probe observes start only. The product 64ms check uses real Node timers, not browser layout or native jQuery timing.',
 'Native initial-state event dispatch is bounded to the selected/disabled two-widget matrix. General selection groups, arbitrary reentrant initialization, all contained/tree branches and every nested repeater persistence combination are not claimed fully equivalent.',
 'Current snapshots are genuine copies and match final reviewed hashes. Three historical intermediate product versions have recorded hashes/sourceStable outputs but no retained full byte snapshots; the author confirmed none were saved, and bounded local snapshot search found none. They cannot be independently re-executed from the retained bytes. No red source was reconstructed.',
 'The raw 13-event audit independently walks two original files. Its whole-corpus 182-layer/unchanged-leaf totals are attributed to the format audit, not an independent complete reimport.',
 'Editor grouping/ungrouping, pinning, author resize/rotate controls, arbitrary fixed/percent panels and unknown native Layer branches are outside this runtime review.',
 'Product finite/dimension guards may deliberately reject native nonfinite outcomes; all-excluded logical Layer bounds sentinel is tested separately from nonnegative CSS render size.',
];
const evidence=[
 previousManifest,supplementManifest,'research/native-layers-runtime-evidence.md','research/native-layers-runtime-supplement-evidence.md',
 'research/native-layers-runtime-supplement-evidence.json',importFile,'research/native-layers-runtime-import-events-review.mjs',
 'research/native-layers-runtime-source-snapshot-search.json',...historic.map(x=>x.observedIn),
 ...historicalScriptFallbacks.flatMap(x=>[x.observedIn.path,x.fallback.path]),
 ...finalFiles,...tests.map(t=>t.script.path),
];
const report={capturedAt:new Date().toISOString(),scope:'Independent read-only Layer runtime integration review; no production/test modifications and no full suite/browser runs.',summary,sources,implementation,tests,findings,historicalImplementation:historic,historicalScriptFallbacks,sourceSearch:bound('research/native-layers-runtime-source-snapshot-search.json'),importReview:bound(importFile),evidence:[...new Set(evidence)].map(bound),limits};
fs.writeFileSync(reviewPath,JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(mdPath,`# Native Layer runtime independent integration review

Final independent checks pass **50/50** against core \`5d8cb997dd29745add36a3270c40c7c743342a0621da1a001403544e8d651128\`. No unresolved confirmed defect remains in the inspected scope. No product or existing test files were edited, and no browser/full suite was run here.

NLR-REVIEW-01 is fixed: edge-anchor Layer Resize uses unrotated offsetLocation for the leading/trailing position and rotated bounds for the center. The original fixture expects (160,132,60,32); the first product yielded (165,126,60,32). Both final module/serialized cases match.

NLR-REVIEW-02 is fixed: initialization begins with empty Layer-subtree runtime state, applies error/selected before disabled, then visits child declarations in order. The original failing selected+disabled parent now selects then disables its child. The independent 16-case selected/disabled matrix passes in both factories, including SelectedChange event order/count. The Error control case was already passing and is not misreported as a fixed defect.

Initial Base data bounds, named-view runtime cache refresh, and return-to-Base fallback pass in both factories. Four Layer compression scopes also pass: visible, nested visible, hidden ancestor barrier, and qualifying sibling Layer moved once. Combined Resize+Rotate now reads offsets separately per leaf after starting Resize; X reads the Layer-bound event while Y reads the original event target. Both factories pass the 64ms dispatch/read-trace case, including the source's positive direction and Resize anchor branch.

The earlier Move-To suspicion is explicitly **withdrawn**. The low-level direct MoveWidget(to=true) probe does not represent the actual action, which converts destination to one delta before moveBy. No fix is justified from that incorrect generalization. The exact action correction is separately retained.

The raw-object event review passes **13/13**: ten Layer click→direct-member selected toggles and three click→panel-state actions. It follows native references independently of semantic event recovery and the product importer. All targets are on the same imported page, panel states belong to the target panel, and Propagate values match raw storage. Propagate is not treated as generic click broadcasting.

## Byte retention and verification

Current reviewed export-runtime, engine, expressions, Preview and types files have actual copied fallback bytes at \`research/native-layers-runtime-final-*.txt\`; JSON lists their exact paths and identical hashes. Original script sources are pinned by full path/hash. The frozen 78-case and 33-case manifests were not changed.

Three intermediate export-runtime hashes (\`d0225887…\`, \`60f520c0…\`, \`766a76bb…\`) were recorded at execution, with sourceStable checks, but neither investigator nor core author retained their complete old bytes. The bounded .build/research snapshot search found no matches. These are honestly marked **historical-hash-only**, with no fallback and no claimed rerun from old source. The final green source has genuine bytes; old red outputs remain preserved. Separate failed harness scripts do have matching snapshots and are mapped explicitly in JSON.

## Boundaries

These results do not establish complete Axure parity. The source probes run original JavaScript with declared facades, not an original GUI. Native combined orbit is still a sink; source nonzero-duration supplement observes start only. The product combined check uses Node timers and verifies dispatch/read order, not native browser animation pixels. General reentrant initialization, all contained/tree/repeater branches, editor pins/resize and fixed/percent behaviors are not covered. Whole-corpus import totals remain attributed to the format audit. Finite guards are a product boundary, distinct from native all-excluded negative cache geometry.

The JSON companion separates current verifiable inputs, historical hashes, red/green artifacts, original source contracts, product execution, and limitations.
`);
const manifest={capturedAt:new Date().toISOString(),summary,sources,implementation:implementation.flatMap(x=>[{path:x.path,sha256:x.sha256},x.fallback]),tests:tests.flatMap(t=>[{path:t.path,sha256:t.sha256},t.script]),evidence:[...report.evidence,bound(reviewPath),bound(mdPath),bound(import.meta.filename)],historicalHashOnly:historic};
fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({summary,review:bound(reviewPath),manifest:bound(manifestPath)},null,2));
