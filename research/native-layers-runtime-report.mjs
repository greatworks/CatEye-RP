import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
const record=p=>({path:p,sha256:sha(fs.readFileSync(p)),bytes:fs.statSync(p).size});
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const base=read('research/native-layers-runtime-second-probes.json');
const actions=read('research/native-layers-runtime-actions-probes.json');
const cache=read('research/native-layers-runtime-cache-final-probes.json');
for(const p of [...base.sources,...actions.sources,...cache.sources])assert.equal(sha(fs.readFileSync(p.path)),p.sha256,p.path);
for(const r of [base,actions,cache]){assert.equal(r.summary.failed,0);assert.equal(sha(fs.readFileSync(r.script.path)),r.script.sha256,r.script.path)}
const evidence=[
 {id:'NLR-01',status:'executed-exact-source-with-facade',title:'Layer is ordered structural membership, not a child coordinate origin',locations:['math.js:88-101','move.js:69-108','axQuery.std.js:1438-1575','visibility.js:822-1013'],contract:'Deep collection recurses only through Layers; panel/repeater is one leaf. Member coordinates stay in containing page/state scope. Temporary reference-counted containers subtract/re-add the Layer origin without changing the authored coordinate frame.'},
 {id:'NLR-02',status:'executed-exact-source-with-facade',title:'Movement eligibility differs from moved-cache recursion',locations:['math.js:88-101','move.js:84-108','visibility.js:1347-1414'],contract:'Move event/member-info enumeration excludes own inline-hidden branches, but movement cache recursion still changes hidden and limbo descendants. It stops at non-Layer containers. MoveTo registers each visible member against the same requested target; its recorded delta can differ from the shared translated displacement. Public zero MoveBy emits only root Move.'},
 {id:'NLR-03',status:'executed-exact-source-with-facade',title:'Runtime bounds have filtering and sentinel quirks',locations:['axQuery.std.js:1299-1371','axQuery.std.js:1438-1575','repeater.js:1896-1930'],contract:'childrenBoundingRect excludes own hidden, limbo, fixed-horizontal panels and zero-by-zero Layers. It includes rotated/shadow bounds. Nonempty lists seed left/top=99999 and right/bottom=0: all-excluded yields negative dimensions, negative-only union extends to origin. _updateLayerRectCache actually stores these values. Empty list differs: zero bounds. Size event precedes location event.'},
 {id:'NLR-04',status:'executed-exact-source-with-facade',title:'Cache/data/style priority and instance keys',locations:['axQuery.std.js:1438-1575','visibility.js:1347-1414'],contract:'Moved/resized caches beat data-left/top/width/height, which beat normal/effective style geometry. DOM string \"0\" counts as present. Cache keys are full element IDs; fixture row instances remain isolated. Native row binding and deletion lifecycle are not replayed here.'},
 {id:'NLR-05',status:'executed-exact-source-with-facade',title:'Layer Resize expands ordered members and reserves separate channels',locations:['action.js:1286-1506','action.js:1654-1732','axQuery.std.js:570-826'],contract:'Root resize plus nested Layer resize and leaf resize/move reservations. Deep collection includes hidden/limbo. Root reads current bounds at queue start, rounds requested dimension differences then applies stop ratio. Leaf resize applies type gates; nonresizable leaf can move without resizing. Top-left, center and bottom-right numerical results are recorded. Nested Layer emits Resize but does not directly scale itself in this branch.'},
 {id:'NLR-06',status:'executed-producer-and-queue-orbit-sink',title:'Layer Rotate has independent layerDegree and member orientation gates',locations:['action.js:1061-1065','action.js:1082-1189','action.js:1192-1197','action.js:1240-1256'],contract:'Root layerDegree caches full target before partial animation. Nested Layer gets Rotate event without changing its independent layerDegree. Leaf orbit pivot uses Layer bounding center plus anchor/offset in containing scope. Image/hotspot/panel/vector/line rotate orientation; other leaf types orbit only. New probes execute queue and producer but replace orbit rendering with an explicit argument/completion sink.'},
 {id:'NLR-07',status:'executed-producer-and-queue-orbit-sink',title:'Combined Layer Resize and Rotate quirks',locations:['action.js:1355-1365','action.js:1381-1400'],contract:'Root Rotate is raised twice. Member pivot applies resizeInfo.anchor rather than rotateInfo.anchor. This branch does not apply clockwise sign; false still delivers +90 in the fixture. resizeOffset and per-member resizeDeltaMove are passed separately. This is not proof of full composed browser animation.'},
 {id:'NLR-08',status:'executed-control-flow-paint-sinks',title:'Propagate affects hover/down only, with a container barrier',locations:['events.js:1018-1061','events.js:1438-1456','repeater.js:2605-2653'],contract:'Missing/false propagate is false by runtime truthiness. Traversal skips a nonpropagating child container and its whole branch; ordinary leaves have no such flag gate. True container propagates hover/down through descendants including hidden/limbo. Upward lookup can cross false intermediate parent, returning direct=false. Container handlers paint children, not their own hover/down style. This flag is not a generic click broadcast flag.'},
 {id:'NLR-09',status:'executed-control-flow-paint-sinks',title:'Selected, Enabled and Error use different independent recursion',locations:['style.js:186-253','axQuery.std.js:1087-1178'],contract:'Selected ignores propagate, includes hidden/limbo children, skips disabled subtree, emits child events before parent. Enabled/Error ignore propagate but use ignoreUnplaced=true, including hidden and skipping limbo. Grouped-selection and contained-owner redirection branches remain outside these fixtures.'},
 {id:'NLR-10',status:'executed-control-flow-dom-facade',title:'Focus uses the first ordered child, not the first visible child',locations:['events.js:650-710'],contract:'Maps objs[0], follows nested Layer recursively, does not filter hidden/limbo, and does not fall back past an empty first Layer. Final input/img/div suffix selection remains ordered. Existing own focus interaction suppresses proxy need; ancestor focus interaction can request it.'},
 {id:'NLR-11',status:'static-source-only-in-this-stage',title:'Parent fitting and adaptive cache recomputation',locations:['repeater.js:1590-1626','repeater.js:1881-1930','adaptive.js:149'],contract:'fitParentPanel first updates nearest Layer/RDO; only changed Layer bounds recurse upwards. Panel/row/body handling follows. updateAllLayerSizeCaches visits reverse collected Layer order, skipping own/ancestor limbo. Full fit/row/animation event integration is not executed by this stage, whose fit callback is a recording sink.'},
 {id:'NLR-12',status:'static-source-only-in-this-stage',title:'Show/hide and event bubbling remain separate from Propagate',locations:['visibility.js:55-121','events.js:323-406'],contract:'Layer show/hide uses a temporary container wrapper, like the panel path with isPanel=false, not a child hidden-flag rewrite. Limbo is an early gate. Generic handled-event/bubbling is separate from hover/down propagation. These complete browser event and visibility paths were read, not replayed here.'}
];
const limits=[
 'No original Axure GUI was operated or pixel-compared by this stage; no proprietary DLL method executed.',
 'All 78 current passing cases are isolated original-JavaScript NodeVM executions with declared in-memory DOM/query, style and scheduling facades. They are not 78 full-original-page/browser tests.',
 'Original full math.js/move.js and named exact source slices are executed. CSS style resolution, fixed-position detection, expression compilation, real repeater binding, fit-parent completion, event listener reentrancy, annotation and flyout effects are not fully composed.',
 'The action probe executes real producer/queue/public Resize and Move consumers. Its Rotate orbit is an explicit argument/completion sink. It establishes reservation, eligibility, pivot and cache/event inputs, not complete browser orbit pixels or timing.',
 'Controlled animation completion is not real jQuery timing/easing. Nonzero-duration nested Layer queue interruption and reentrant fit/action behavior remain unverified.',
 'All-filtered negative dimensions are proven in query and runtime caches. Browser treatment of negative CSS dimensions, visual wrapper clipping and product render guards require separate verification.',
 'Managed editor bounds differ from runtime bounds: format-agent CIL reports flattened actual leaves with first-leaf union seed and no runtime visible/shadow filter. This report does not substitute the runtime sentinel rule for saved/editor geometry.',
 'Selection groups, contained widget redirection, tree special recursion, fixed members, percent-width panels, full repeater lifecycle, focus delivery and generic click bubbling are not fully executed end to end.',
 'No product sources or tests were changed. Proposed schema and implementation guidance below are recommendations, not claims of an already matching implementation.'
];
const failureHistory=[
 {report:'research/native-layers-runtime-first-probes.json',summary:'32/43; 11 harness failures because window.document was absent.',scriptSnapshot:'research/native-layers-runtime-first-probe.mjs',correction:'Set window.document to the already-declared document facade. Original slices unchanged.'},
 {report:'research/native-layers-runtime-actions-first-probes.json',summary:'13/22; 9 harness failures from absent $ax.splice and omitted _updateOffset slice.',scriptSnapshot:'research/native-layers-runtime-actions-first-probe.mjs',correction:'Provide array splice facade and include unchanged original action.js 1192-1197.'},
 {report:'research/native-layers-runtime-actions-second-probes.json',summary:'22/22 intermediate success.',scriptSnapshot:'research/native-layers-runtime-actions-second-probe.mjs',correction:'Later eight cases extend cache/composition/focus coverage; snapshot retained.'},
 {report:'research/native-layers-runtime-actions-third-probes.json',summary:'26/30; four focus harness syntax failures because the slice stopped before its closing brace.',scriptSnapshot:'research/native-layers-runtime-actions-third-probe.mjs',correction:'Extend exact focus slice through events.js 710; no original statements changed.'},
 {report:'research/native-layers-runtime-cache-probes.json',summary:'2/5; three assertion-shape failures because expected location omitted original left/top aliases.',scriptSnapshot:'research/native-layers-runtime-cache-first-probe.mjs',correction:'Retain original output and expect all four location aliases, without changing consumer code.'}
];
for(const x of failureHistory){
 const r=read(x.report);
 assert.equal(record(x.scriptSnapshot).sha256,r.script.sha256,`${x.report}: old script snapshot must match`);
}
const report={capturedAt:new Date().toISOString(),target:'Axure RP 11.0.0.4150',stage:'native-layers-runtime',summary:{total:78,passed:78,failed:0,groups:{structureBoundsMove:43,stateActionsFocus:30,cachePrecedence:5}},sources:base.sources,evidence,probeReports:['research/native-layers-runtime-second-probes.json','research/native-layers-runtime-actions-probes.json','research/native-layers-runtime-cache-final-probes.json'].map(record),failureHistory,limits,modelRecommendation:{type:'layer',data:{widgets:'ordered child identities, preserving nested Layers',propagate:'optional boolean; runtime default false'},geometry:'Members remain in the containing non-Layer coordinate space. Keep declared/editor bounds distinct from cached runtime bounds. Do not add Layer x/y to members or apply a shared CSS rotate to the whole subtree.',rotation:'Independent runtime layerDegree. Member geometry/orientation updates are actual motion operations, with type-specific eligibility.',state:'Keep root state and ordered member recursion. Do not implement Propagate as a blanket event/disabled/selected broadcast switch.'},originalDllExecuted:false,originalGuiCompared:false};
const md=`# Native Layer runtime evidence — Axure RP 11.0.0.4150

This stage executed **78/78 bounded original-JavaScript probes**: 43 traversal/bounds/Move, 30 state/action/focus, and 5 cache precedence cases. These are **NodeVM runs with declared in-memory facades**, not original GUI or generated-page visual comparison. No product or historical evidence files were edited.

The proposed structural model \`type: layer; layer: {widgets, propagate?}\` is supported, provided \`widgets\` remains ordered and members retain their containing page/state coordinates. A Layer is not a panel coordinate origin. Its runtime \`layerDegree\` is independent of member orientation and must not become a shared CSS transform on the subtree. Saved/editor bounds and runtime cache bounds are different concepts.

## Evidence and source integrity

The JSON companion records all 11 original files with full paths, byte lengths and SHA-256. Each probe records every extracted source range and the exact slice hash. The frozen prior harness dependency is \`runtime-transform-special-probe.mjs\`, SHA-256 \`11870fe01e55a5b0ef4e47b883705c88130b84ed5f9b22c7dbfcc1c593e086e8\`. Original full math.js/move.js run inside that harness; newly selected query, state, queue and action functions remain unchanged.

| Source | SHA-256 |
|---|---|
${base.sources.map(s=>`| ${path.basename(s.path)} | \`${s.sha256}\` |`).join('\n')}

## Coordinates, traversal and bounds

**NLR-01–04.** \`getLayerChildrenDeep\` recurses only through Layer children. Panels and repeaters are single members, preserving their independent coordinate systems. Move enumeration normally omits own-inline-hidden branches; Resize/Rotate explicitly request hidden members. Neither default deep call excludes limbo. The original \`getChildren\` has a separate \`ignoreUnplaced\` argument.

\`offsetBoundingRect\` prefers moved/resized caches, then Layer \`data-left/top/width/height\`, then effective style. A string \`"0"\` is present. Walking Layer parents does not add their positions. The temporary ref-counted container subtracts and later restores the Layer origin in the DOM facade; this is temporary rebasing, not a different authored member coordinate system.

Runtime \`childrenBoundingRect\` filters own hidden/limbo, fixed-horizontal dynamic panels and empty Layers, and includes rotated/shadow bounds. An empty child list gives zero bounds. A nonempty all-filtered list instead gives \`(99999,99999,-99999,-99999)\`; a negative-only child \`(-40,-30,10,5)\` produces size \`40×30\` because right/bottom start at zero. The source actually writes the all-filtered result to moved/resized Layer caches. A product render guard may be needed, but a silent replacement of public query/cache values is not source-equivalent.

The source-derived fixture with child \`(100,100,200,100)\`, rotation 90°, outer shadow \`(offsetX10,offsetY20,blur6)\` produces runtime bounds size \`126×216\`, center \`(208,163)\`. This used the original geometry functions with controlled style inputs.

Format-agent managed bounds findings are deliberately distinct: editor bounds flatten actual leaves and use a first-leaf union seed, not this runtime query's sentinel/zero seeds. That CIL route was not re-executed in this probe.

## Move, Resize and Rotate

**NLR-02.** Layer Move translates the container once and recursively advances member movement caches, including hidden/limbo members. Move events and move-info registration enumerate visible members. Thus a hidden child moves but receives no Move event. Root event precedes depth-first visible member events. Public zero \`moveBy(0,0)\` raises only the root event. MoveTo registers each member using the same requested point; its stored per-member move-info delta can differ from the shared geometric translation.

**NLR-05.** Layer Resize reserves root Resize, then nested Layer Resize or leaf Resize+Move in deep order. At queue start it reads current bounds and calculates each scale change as:

\`\`\`
round(requested dimension - current bounding dimension)
  / current bounding dimension
  * (instant ? 1 : (stop.end-stop.start)/(stop.len-stop.start))
\`\`\`

Root Resize is emitted and its channel released before leaf consumers. A nested Layer emits Resize but is not itself scaled in that branch. Leaf public Resize applies native type gates; a checkbox keeps its size yet changes position with group scaling. The fixture group \`(100,100,200,100)\` → \`300×160\` scales a \`40×20\` vector to \`60×32\`. At child \`(140,120)\`, displacement is \`(20,12)\` for top-left, \`(-30,-18)\` for center, \`(-80,-48)\` for bottom-right. A 40→70/100 slice applies one half of the remaining difference: leaf \`50×26\`. Requested differences of .49 round to zero. The helpers also cover nine anchors, nonresizable members, fixed-position and percent-width branches; the last two remain controlled input branches, not full browser integration.

**NLR-06.** Layer Rotate reserves root Rotate, then nested Layer Rotate or leaf Rotate+Move. It keeps an independent full target \`layerDegree\` before partial motion: By90 in slice40→70/100 stores90 while passing45 to member orbit. Nested Layer degree15 remains15 while receiving its Rotate event. Subsequent To30 on the root uses cached90 and passes−60. Hidden members participate. The orientation filter includes image/hotspot/panel/vector/line; other members can orbit without rotating their own orientation.

**NLR-07.** Combined Layer Resize+Rotate is observably different: root Rotate fires twice; the pivot uses Resize anchor; this branch ignores Rotate's clockwise=false sign. The tested Resize300×160/top-left plus Rotate90/bottom-right/counterclockwise passes degree+90, pivot(100,100), resizeOffset(−50,−30), and each member's resizeDeltaMove. These are exact producer/queue observations. **Orbit rendering is an explicit sink in the new action probe**, so this is not a new full combined-animation pixel result.

The public Resize/Move consumers run unchanged. Parent-fit completion is a logging sink, so their member events do not establish complete reentrant Layer cache/fit event order. Static source shows \`fitParentPanel\` updates the nearest Layer first; \`_updateLayerRectCache\` raises Resize before Move, recursing to higher containers only when changed.

## Propagate, independent states and focus

**NLR-08.** \`propagate\` has no missing-value default of true: omitted/false is false. Container hover/down handlers are installed for truthy \`propagate\`. Downward propagation skips a child container whose flag is false, including its whole branch. Ordinary leaves are painted without their own flag. Hidden/limbo leaves are not filtered. Upward lookup may cross a false intermediate container to a true ancestor, marking that relation \`direct:false\`. The handler paints descendants, not its own hover/down style. This flag does not define generic click broadcast or all state propagation.

**NLR-09.** Selected cascades independently of propagate, includes hidden/limbo, and skips disabled child subtrees. Child Selected events precede the parent. Enabled/Error also ignore propagate, but pass \`ignoreUnplaced:true\`, so hidden participates and limbo does not. Selection-group deduplication, tree and contained-owner special branches are retained in source but outside the executed fixtures.

**NLR-10.** Layer focus mapping uses \`objs[0]\`, even hidden/limbo. It recursively maps a nested first Layer and does not try later siblings when that first Layer is empty. Target preference is input, then img, then div, then element. Focus delivery itself was not exercised.

## Lifecycle and limits

**NLR-11/12, static only here.** Adaptive layer-size cache refresh visits reverse collected order and skips own/ancestor limbo. Layer Show/Hide uses temporary container mechanics with \`isPanel=false\`, not rewriting descendant hidden declarations. Generic handled-event/bubbling logic is separate from Propagate. These complete paths, real nested-row rebinding, DOM browser layout, long-running interruption and reentrant listeners require additional integration proof.

${limits.map(x=>`- ${x}`).join('\n')}

## Preserved failures

${failureHistory.map(x=>`- \`${x.report}\`: ${x.summary} ${x.correction} Exact script snapshot: \`${x.scriptSnapshot}\`.`).join('\n')}

Final passing reports are \`native-layers-runtime-second-probes.json\` (43), \`native-layers-runtime-actions-probes.json\` (30), and \`native-layers-runtime-cache-final-probes.json\` (5). Their fixtures and source hashes can serve as bounded implementation oracles; they do not justify claims of complete Layer parity.
`;
for(const f of ['research/native-layers-runtime-evidence.md','research/native-layers-runtime-evidence.json','research/native-layers-runtime-manifest.json'])assert.ok(!fs.existsSync(f),'Preserve '+f);
fs.writeFileSync('research/native-layers-runtime-evidence.md',md);
fs.writeFileSync('research/native-layers-runtime-evidence.json',JSON.stringify(report,null,2)+'\n');
const files=fs.readdirSync('research').filter(x=>x.startsWith('native-layers-runtime-')&&x!=='native-layers-runtime-manifest.json').map(x=>'research/'+x);
const manifest={capturedAt:new Date().toISOString(),sources:base.sources,evidence:files.map(record),dependencies:[record('research/runtime-transform-special-probe.mjs'),record('research/runtime-rotate-motion-evidence.json')],implementation:[],tests:[],screenshots:[],summary:report.summary,originalDllExecuted:false,originalGuiCompared:false};
fs.writeFileSync('research/native-layers-runtime-manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({summary:report.summary,manifest:record('research/native-layers-runtime-manifest.json')},null,2));
