import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex'),bound=p=>({path:p,sha256:hash(p)}),read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const probeFiles=[
 'research/native-layers-runtime-initial-bounds-probes.json',
 'research/native-layers-runtime-init-compress-first-probes.json',
 'research/native-layers-runtime-move-action-probes.json',
 'research/native-layers-runtime-initial-state-matrix-probes.json',
 'research/native-layers-runtime-combined-offset-probes.json',
];
const probes=probeFiles.map(file=>{const r=read(file);assert.equal(r.summary.failed,0);assert.equal(hash(r.script.path),r.script.sha256);for(const s of r.sources)assert.equal(hash(s.path),s.sha256);return { ...bound(file),kind:r.kind,summary:r.summary,script:r.script };});
const sourceMap=new Map();for(const file of probeFiles)for(const s of read(file).sources)sourceMap.set(path.resolve(s.path),s);
const failures=[
 {report:'research/native-layers-runtime-initial-bounds-first-probes.json',script:'research/native-layers-runtime-initial-bounds-first-probe.mjs',reason:'6 syntax failures: exact slice stopped one line before closing brace; corrected only slice boundary.'},
 {report:'research/native-layers-runtime-move-action-first-probes.json',script:'research/native-layers-runtime-move-action-first-probe.mjs',reason:'2 syntax failures: incorrect exact-slice boundary; corrected boundary, not original statements.'},
 {report:'research/native-layers-runtime-initial-state-review-first.json',script:'research/native-layers-runtime-initial-state-review-first-probe.mjs',reason:'4 product harness errors: hand-authored document omitted required page.interactions. Corrected fixture; independent product red retained separately.'},
 {report:'research/native-layers-runtime-combined-offset-first-failure.txt',script:'research/native-layers-runtime-combined-offset-first-probe.mjs',reason:'Harness expression trace filter included pre-existing width/height records. No JSON completed.'},
 {report:'research/native-layers-runtime-combined-offset-second-failure.txt',script:'research/native-layers-runtime-combined-offset-second-probe.mjs',reason:'Nonzero Resize facade flush lacked real jQuery tween parameter. Final bounded nonzero case records start only; animated completion remains unproved.'},
];
const mdPath='research/native-layers-runtime-supplement-evidence.md',jsonPath='research/native-layers-runtime-supplement-evidence.json',manifestPath='research/native-layers-runtime-supplement-manifest.json';
for(const f of [mdPath,jsonPath,manifestPath])assert.ok(!fs.existsSync(f),'Preserve '+f);
const report={
 capturedAt:new Date().toISOString(),kind:'Append-only supplement to frozen 78-case native Layer runtime evidence. Original JavaScript NodeVM with explicit facades, not original GUI.',
 previous:bound('research/native-layers-runtime-manifest.json'),sources:[...sourceMap.values()],probes,
 summary:{additionalOriginalSourceCases:probes.reduce((n,p)=>n+p.summary.total,0),passed:probes.reduce((n,p)=>n+p.summary.passed,0),failed:0},
 contracts:[
  {id:'NLR-S01',claim:'Initial Base does not refresh all Layer caches. Named view does; named→Base clears moved/resized caches but does not call all-Layer refresh. Original data attributes survive and become fallback. Particular fit/repeater callbacks may still refresh individual Layers.',evidence:probeFiles[0],source:'adaptive.js 48–159 / 715–752; axQuery.std.js 1471–1517; repeater.js 1881–1930'},
  {id:'NLR-S02',claim:'Initial Layer error/selected are applied before disabled. Root then child declaration application starts from empty runtime dictionaries. For two selected/disabled flags the 16-case observed child selected is rootSelected || (!rootDisabled && childSelected); disabled is rootDisabled || childDisabled. Selected events are child then root and are not re-raised by a redundant true declaration.',evidence:probeFiles[3],source:'events.js 805–838; style.js 186–253 and 322–324; axQuery.std.js 1087–1178'},
  {id:'NLR-S03',claim:'Visible Layer nesting does not isolate widgetsBelow/Right from enclosing item/state/body. Hidden Layer is a scope barrier. Fully qualifying sibling Layer moves once as Layer, avoiding duplicate leaf motion.',evidence:probeFiles[1],source:'repeater.js 2362–2480 / 2506 onward',limit:'Controlled geometry/DOM facade; hidden temporary-container interior geometry and full item binding remain unproved.'},
  {id:'NLR-S04',claim:'Move To action converts root destination into delta before calling moveBy. Member move-info shares this delta. The frozen report direct MoveWidget(to=true) case remains a low-level result and is not the user action contract.',evidence:probeFiles[2],source:'action.js 756–1042'},
  {id:'NLR-S05',claim:'Layer Resize+Rotate evaluates degree once in root Rotate job; evaluates offsetX and offsetY per leaf after calling that leaf Resize. X uses copied event targeted at Layer; Y uses original supplied event. Instant controlled Resize events can alter successive offset results. Root Rotate is emitted twice.',evidence:probeFiles[4],source:'action.js 1286–1506',limit:'Direct consumer, not complete action planner reachability; supplied original target is controlled. Orbit is an argument/completion sink. Nonzero duration is start-only.'},
 ],
 independentImportReview:bound('research/native-layers-runtime-import-events-review.json'),
 productFindings:[
  {id:'NLR-REVIEW-01',status:'corrected in observed intermediate product hash; final source may change',red:bound('research/native-layers-runtime-integration-first-probes.json'),green:bound('research/native-layers-runtime-integration-resize-correction-probes.json')},
  {id:'NLR-REVIEW-02',status:'confirmed product selected initialization failure; correction pending at supplement freeze',red:bound('research/native-layers-runtime-initial-state-review-red.json'),limit:'Error sibling case passes. Do not broaden this failure to Error initialization.'},
 ],
 preservedFailures:failures.map(f=>({...f,reportHash:bound(f.report),scriptHash:bound(f.script)})),
 limits:['No vendor DLL execution or original GUI/browser comparison.','New source probes add 33 bounded cases, not 33 complete original-page tests.','Named→Base probe uses empty widget enumeration and logging sinks; data priority is separately established in frozen cache probes.','No conclusion that every initial named-view/row lifecycle has full browser equivalence.','Combination offset observation does not establish full animation pixels, arbitrary event reentrancy or upstream expression compilation.','Product still under core edits; later independent integration review binds final inspected bytes.'],
};
fs.writeFileSync(jsonPath,JSON.stringify(report,null,2)+'\n');
const md=`# Native Layer runtime: bounded supplement

This append-only report adds **33/33 original-JavaScript NodeVM cases** to the frozen 78-case report. All source and slice hashes remain recorded. No product/test files or earlier evidence were changed. These are controlled function executions, not original GUI or full generated-page comparisons.

The primary correction is a distinction between the public low-level MoveWidget API and the actual Move To action. The latter resolves one root delta and calls moveBy; every member receives that shared delta. The earlier direct-API per-member To result must not be generalized to actions.

Initial Base reads generated Layer data bounds. Initial named view refreshes runtime Layer bounds. A named→Base transition clears moved/resized caches and falls back to generated attributes, without unconditional all-Layer refresh. Fit and repeater callbacks can separately update particular Layers; the six lifecycle probes isolate control-flow calls with empty element enumeration.

The 16-state matrix executes parent-before-child initialization. Runtime dictionaries begin empty: error and selected initialize before disabled. For the two-widget selected/disabled matrix, child selected is \`rootSelected || (!rootDisabled && childSelected)\`; child disabled is \`rootDisabled || childDisabled\`. A selected+disabled parent first selects its child, then disables it. A disabled but unselected parent suppresses the child's later authored selected=true. Red product evidence NLR-REVIEW-02 preserves a real failure in both module/serialized implementations; the analogous Error check passes.

Layer compression climbs visible Layer ancestors into the enclosing scope. A hidden Layer stops that climb. A fully qualifying sibling Layer moves once as a Layer. These four compression cases retain the declared geometry and temporary-container facade limits.

Combined Resize+Rotate evaluates degree in the root job, then offsets separately for each leaf **after** that leaf's Resize call. Source line 1405 uses the copied event for X and the original supplied event for Y. In the controlled instant case, Resize events advance a counter: root reads degree at 1; first leaf offsets read 2; second leaf offsets read 3. Corresponding pivots are (102,102) and (103,103). The nonzero-duration case records synchronous start only, with both offsets at counter 1. This is direct consumer evidence: orbit is a sink, source expression evaluation is a counter/observation facade, and instant-combination reachability through the full planner was not established here.

The independent raw-object review verifies all **13 newly recovered Layer Click cases**: ten direct-member selection toggles and three panel-state destinations. It decodes only the two relevant original files and does not call semantic interaction recovery or the product importer. The then-current import audit contains 182 Layers, with unchanged prior leaf content; those whole-corpus totals are attributed to that audit.

NLR-REVIEW-01 (edge-anchor Resize of rotated member) is independently corrected: original expected (160,132,60,32), first product (165,126,60,32), intermediate corrected product passes both modes. Product hashes are attached to each red/green output; this supplement is not a final whole-product approval.

Five harness failure artifacts are retained separately: initial/move exact-slice syntax boundaries, missing page.interactions in a hand-authored fixture, an overly broad trace filter, and an unsupported fake jQuery tween completion. No failure was reclassified as passing source evidence. See the JSON for exact files, hashes and limitations.
`;
fs.writeFileSync(mdPath,md);
const evidenceFiles=[...probeFiles,...probes.map(p=>p.script.path),'research/native-layers-runtime-probe.mjs','research/runtime-transform-special-probe.mjs','research/native-layers-runtime-manifest.json','research/native-layers-runtime-evidence.md','research/native-layers-runtime-import-events-review.json','research/native-layers-runtime-import-events-review.mjs','research/native-layers-runtime-integration-first-probes.json','research/native-layers-runtime-integration-resize-correction-probes.json','research/native-layers-runtime-integration-probe.mjs','research/native-layers-runtime-initial-state-review-red.json','research/native-layers-runtime-initial-state-review-probe.mjs',...failures.flatMap(f=>[f.report,f.script]),mdPath,jsonPath,import.meta.filename];
fs.writeFileSync(manifestPath,JSON.stringify({capturedAt:new Date().toISOString(),sources:report.sources,evidence:[...new Set(evidenceFiles)].map(bound),summary:report.summary},null,2)+'\n');
console.log(JSON.stringify({summary:report.summary,manifest:bound(manifestPath)},null,2));
