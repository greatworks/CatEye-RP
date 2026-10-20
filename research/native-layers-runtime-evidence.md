# Native Layer runtime evidence — Axure RP 11.0.0.4150

This stage executed **78/78 bounded original-JavaScript probes**: 43 traversal/bounds/Move, 30 state/action/focus, and 5 cache precedence cases. These are **NodeVM runs with declared in-memory facades**, not original GUI or generated-page visual comparison. No product or historical evidence files were edited.

The proposed structural model `type: layer; layer: {widgets, propagate?}` is supported, provided `widgets` remains ordered and members retain their containing page/state coordinates. A Layer is not a panel coordinate origin. Its runtime `layerDegree` is independent of member orientation and must not become a shared CSS transform on the subtree. Saved/editor bounds and runtime cache bounds are different concepts.

## Evidence and source integrity

The JSON companion records all 11 original files with full paths, byte lengths and SHA-256. Each probe records every extracted source range and the exact slice hash. The frozen prior harness dependency is `runtime-transform-special-probe.mjs`, SHA-256 `11870fe01e55a5b0ef4e47b883705c88130b84ed5f9b22c7dbfcc1c593e086e8`. Original full math.js/move.js run inside that harness; newly selected query, state, queue and action functions remain unchanged.

| Source | SHA-256 |
|---|---|
| action.js | `c3c051ceb20b76128619df0f3a691f2cf59539c48eb28c7bec311907010c44c3` |
| axQuery.js | `f5a2eaeef5c65135a580b6ed6fa3cc59ac0fc291ea2e0801070ae21e4a5d5330` |
| axQuery.std.js | `0427b0387fdb1c5ef29b77f830a61422bb136a502002c7e9326cd4561e4830cd` |
| move.js | `c823954b5ed5862d56176b8984837e8f26588540ee4768d4483d68a399b95644` |
| math.js | `f56ab4a6c3f6e91aaba9bebf2e81485965fc82bca63af0c606593d580c1de883` |
| visibility.js | `bbf8974eaa4ffa2b9800797725ada6805c47c532f47d9a5647dc205966ab8a53` |
| repeater.js | `d4c44f2392e126263bdfec6e8c0392f4e186f30e26da9aeeecf8bab2e0b91b2b` |
| style.js | `f19830b3fe20d1460c64cada136b8f1aeb38ad7aa67d89dc6b034d0d4689f14c` |
| events.js | `a4af00772806e3951b0cfaa849361c7481613cc4b361038ccbbd52221c850bb3` |
| doc.js | `986e90c2fc4ddefc64063b8e865b88466bf76ea76ca26df5d72104f7f3a1e8b1` |
| adaptive.js | `e141ea07bb973b6007f2ad7d7205516a041a801ec97e410467352c27af3b2928` |

## Coordinates, traversal and bounds

**NLR-01–04.** `getLayerChildrenDeep` recurses only through Layer children. Panels and repeaters are single members, preserving their independent coordinate systems. Move enumeration normally omits own-inline-hidden branches; Resize/Rotate explicitly request hidden members. Neither default deep call excludes limbo. The original `getChildren` has a separate `ignoreUnplaced` argument.

`offsetBoundingRect` prefers moved/resized caches, then Layer `data-left/top/width/height`, then effective style. A string `"0"` is present. Walking Layer parents does not add their positions. The temporary ref-counted container subtracts and later restores the Layer origin in the DOM facade; this is temporary rebasing, not a different authored member coordinate system.

Runtime `childrenBoundingRect` filters own hidden/limbo, fixed-horizontal dynamic panels and empty Layers, and includes rotated/shadow bounds. An empty child list gives zero bounds. A nonempty all-filtered list instead gives `(99999,99999,-99999,-99999)`; a negative-only child `(-40,-30,10,5)` produces size `40×30` because right/bottom start at zero. The source actually writes the all-filtered result to moved/resized Layer caches. A product render guard may be needed, but a silent replacement of public query/cache values is not source-equivalent.

The source-derived fixture with child `(100,100,200,100)`, rotation 90°, outer shadow `(offsetX10,offsetY20,blur6)` produces runtime bounds size `126×216`, center `(208,163)`. This used the original geometry functions with controlled style inputs.

Format-agent managed bounds findings are deliberately distinct: editor bounds flatten actual leaves and use a first-leaf union seed, not this runtime query's sentinel/zero seeds. That CIL route was not re-executed in this probe.

## Move, Resize and Rotate

**NLR-02.** Layer Move translates the container once and recursively advances member movement caches, including hidden/limbo members. Move events and move-info registration enumerate visible members. Thus a hidden child moves but receives no Move event. Root event precedes depth-first visible member events. Public zero `moveBy(0,0)` raises only the root event. MoveTo registers each member using the same requested point; its stored per-member move-info delta can differ from the shared geometric translation.

**NLR-05.** Layer Resize reserves root Resize, then nested Layer Resize or leaf Resize+Move in deep order. At queue start it reads current bounds and calculates each scale change as:

```
round(requested dimension - current bounding dimension)
  / current bounding dimension
  * (instant ? 1 : (stop.end-stop.start)/(stop.len-stop.start))
```

Root Resize is emitted and its channel released before leaf consumers. A nested Layer emits Resize but is not itself scaled in that branch. Leaf public Resize applies native type gates; a checkbox keeps its size yet changes position with group scaling. The fixture group `(100,100,200,100)` → `300×160` scales a `40×20` vector to `60×32`. At child `(140,120)`, displacement is `(20,12)` for top-left, `(-30,-18)` for center, `(-80,-48)` for bottom-right. A 40→70/100 slice applies one half of the remaining difference: leaf `50×26`. Requested differences of .49 round to zero. The helpers also cover nine anchors, nonresizable members, fixed-position and percent-width branches; the last two remain controlled input branches, not full browser integration.

**NLR-06.** Layer Rotate reserves root Rotate, then nested Layer Rotate or leaf Rotate+Move. It keeps an independent full target `layerDegree` before partial motion: By90 in slice40→70/100 stores90 while passing45 to member orbit. Nested Layer degree15 remains15 while receiving its Rotate event. Subsequent To30 on the root uses cached90 and passes−60. Hidden members participate. The orientation filter includes image/hotspot/panel/vector/line; other members can orbit without rotating their own orientation.

**NLR-07.** Combined Layer Resize+Rotate is observably different: root Rotate fires twice; the pivot uses Resize anchor; this branch ignores Rotate's clockwise=false sign. The tested Resize300×160/top-left plus Rotate90/bottom-right/counterclockwise passes degree+90, pivot(100,100), resizeOffset(−50,−30), and each member's resizeDeltaMove. These are exact producer/queue observations. **Orbit rendering is an explicit sink in the new action probe**, so this is not a new full combined-animation pixel result.

The public Resize/Move consumers run unchanged. Parent-fit completion is a logging sink, so their member events do not establish complete reentrant Layer cache/fit event order. Static source shows `fitParentPanel` updates the nearest Layer first; `_updateLayerRectCache` raises Resize before Move, recursing to higher containers only when changed.

## Propagate, independent states and focus

**NLR-08.** `propagate` has no missing-value default of true: omitted/false is false. Container hover/down handlers are installed for truthy `propagate`. Downward propagation skips a child container whose flag is false, including its whole branch. Ordinary leaves are painted without their own flag. Hidden/limbo leaves are not filtered. Upward lookup may cross a false intermediate container to a true ancestor, marking that relation `direct:false`. The handler paints descendants, not its own hover/down style. This flag does not define generic click broadcast or all state propagation.

**NLR-09.** Selected cascades independently of propagate, includes hidden/limbo, and skips disabled child subtrees. Child Selected events precede the parent. Enabled/Error also ignore propagate, but pass `ignoreUnplaced:true`, so hidden participates and limbo does not. Selection-group deduplication, tree and contained-owner special branches are retained in source but outside the executed fixtures.

**NLR-10.** Layer focus mapping uses `objs[0]`, even hidden/limbo. It recursively maps a nested first Layer and does not try later siblings when that first Layer is empty. Target preference is input, then img, then div, then element. Focus delivery itself was not exercised.

## Lifecycle and limits

**NLR-11/12, static only here.** Adaptive layer-size cache refresh visits reverse collected order and skips own/ancestor limbo. Layer Show/Hide uses temporary container mechanics with `isPanel=false`, not rewriting descendant hidden declarations. Generic handled-event/bubbling logic is separate from Propagate. These complete paths, real nested-row rebinding, DOM browser layout, long-running interruption and reentrant listeners require additional integration proof.

- No original Axure GUI was operated or pixel-compared by this stage; no proprietary DLL method executed.
- All 78 current passing cases are isolated original-JavaScript NodeVM executions with declared in-memory DOM/query, style and scheduling facades. They are not 78 full-original-page/browser tests.
- Original full math.js/move.js and named exact source slices are executed. CSS style resolution, fixed-position detection, expression compilation, real repeater binding, fit-parent completion, event listener reentrancy, annotation and flyout effects are not fully composed.
- The action probe executes real producer/queue/public Resize and Move consumers. Its Rotate orbit is an explicit argument/completion sink. It establishes reservation, eligibility, pivot and cache/event inputs, not complete browser orbit pixels or timing.
- Controlled animation completion is not real jQuery timing/easing. Nonzero-duration nested Layer queue interruption and reentrant fit/action behavior remain unverified.
- All-filtered negative dimensions are proven in query and runtime caches. Browser treatment of negative CSS dimensions, visual wrapper clipping and product render guards require separate verification.
- Managed editor bounds differ from runtime bounds: format-agent CIL reports flattened actual leaves with first-leaf union seed and no runtime visible/shadow filter. This report does not substitute the runtime sentinel rule for saved/editor geometry.
- Selection groups, contained widget redirection, tree special recursion, fixed members, percent-width panels, full repeater lifecycle, focus delivery and generic click bubbling are not fully executed end to end.
- No product sources or tests were changed. Proposed schema and implementation guidance below are recommendations, not claims of an already matching implementation.

## Preserved failures

- `research/native-layers-runtime-first-probes.json`: 32/43; 11 harness failures because window.document was absent. Set window.document to the already-declared document facade. Original slices unchanged. Exact script snapshot: `research/native-layers-runtime-first-probe.mjs`.
- `research/native-layers-runtime-actions-first-probes.json`: 13/22; 9 harness failures from absent $ax.splice and omitted _updateOffset slice. Provide array splice facade and include unchanged original action.js 1192-1197. Exact script snapshot: `research/native-layers-runtime-actions-first-probe.mjs`.
- `research/native-layers-runtime-actions-second-probes.json`: 22/22 intermediate success. Later eight cases extend cache/composition/focus coverage; snapshot retained. Exact script snapshot: `research/native-layers-runtime-actions-second-probe.mjs`.
- `research/native-layers-runtime-actions-third-probes.json`: 26/30; four focus harness syntax failures because the slice stopped before its closing brace. Extend exact focus slice through events.js 710; no original statements changed. Exact script snapshot: `research/native-layers-runtime-actions-third-probe.mjs`.
- `research/native-layers-runtime-cache-probes.json`: 2/5; three assertion-shape failures because expected location omitted original left/top aliases. Retain original output and expect all four location aliases, without changing consumer code. Exact script snapshot: `research/native-layers-runtime-cache-first-probe.mjs`.

Final passing reports are `native-layers-runtime-second-probes.json` (43), `native-layers-runtime-actions-probes.json` (30), and `native-layers-runtime-cache-final-probes.json` (5). Their fixtures and source hashes can serve as bounded implementation oracles; they do not justify claims of complete Layer parity.
