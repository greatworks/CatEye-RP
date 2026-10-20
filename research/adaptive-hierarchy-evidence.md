# Adaptive selection and inheritance in the retained RP 11 runtime

2026-10-15. Original distribution **11.0.0.4150**, SHA-256 `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`, extraction Evidence ID `ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`. This is new research; earlier adaptive reset evidence is unchanged.

**83 exact-source NodeVM cases pass.** The harness executes retained JavaScript slices with controlled view records, window-size readers, jQuery shallow `extend`, DOM/style endpoints and terminal interaction sinks. It does not execute the native GUI, a complete generated page, CSS media queries, or browser pixels. Source paths, whole-file SHA-256 and every executed slice hash are retained in `adaptive-hierarchy-probe.json` and the evidence manifest.

## Data contract and automatic selection

`adaptive.js:715–729` reads two independent page records: ordered `pageData.adaptiveViews` and `pageData.defaultAdaptiveView`. Named views use `id`, `size.width`, `size.height`, and optionally `baseViewId`. The default size is **not read from the page canvas size**. The runtime name search and execution find no `_getCondCompare` in this pinned `adaptive.js`; the selector at `:376–422` does not read per-view `enabled`, `condition`, operator, max-width, or comparator fields. Injecting those extra fields does not change the observed result.

`document.configuration.useViews` controls whether all named views enter `_enabledViews`. `_idToView` still contains all named views when that configuration is false, so manual selection remains available. The commented `pageData.isAdaptiveEnabled` guard at `:49` does not prevent switching. These statements are about this retained runtime, not every historical Axure version or editor metadata format.

The selection algorithm is not a list of maximum-width breakpoints:

1. Seed a lower candidate with the default view when `windowWidth >= default.width`; seed the upper fallback with the default view unconditionally.
2. Visit enabled named views in array order. Among widths `<= windowWidth`, prefer the largest width.
3. At the same lower-candidate width, height is a tie-breaker: if the incumbent height fits (`<= windowHeight`), replace it only with a larger fitting height; otherwise replace it with a smaller height. With complete finite numeric heights this chooses the largest fitting height, or the smallest height when none fit.
4. Separately, for widths `>= windowWidth`, retain the lexicographically smallest `(width,height)` upper candidate. **Only this upper/fallback comparison** substitutes `1000000` for falsy width/height values.
5. Return the lower candidate if it exists, otherwise the upper fallback.

Height therefore is not a global eligibility filter. A width600/height2000 view beats a width400/height300 view at viewport700×300 because width takes priority. Exact width and height boundaries are inclusive. An exact dimension tie retains the current candidate: the default wins its tie, and equal named records preserve the first declaration.

### Requested default-zero matrix

The exact original selector was run with default `(0,0)`, Phone `(390,0)`, Tablet `(768,0)`. Each row was tested at viewport heights **0 and 900**, with identical outcomes:

| Viewport width | Original result |
| ---: | --- |
| 0 | Base |
| 389.999 | Base |
| 390 | Phone |
| 767.999 | Phone |
| 768 | Tablet |
| 1000 | Tablet |

For three named views of width768 and heights0/400/900 at viewport width768:

| Viewport height | Original result |
| ---: | --- |
| 0 | height0 |
| 399.999 | height0 |
| 400 | height400 |
| 899.999 | height400 |
| 900 | height900 |

For width500 and heights300/600/900, viewport height0 still selects height300; it does not select Base simply because every named height is too tall. All raw input/output records are in the probe JSON.

Zero is not universally “missing.” In the lower comparison it is an ordinary numeric threshold. Missing width is `undefined`, fails `>=`, and differs from zero. A missing incumbent height can prevent equal-width candidates replacing it because comparisons with `undefined` fail. A missing whole `size` throws. The `1000000` upper sentinel is finite and observable for very large malformed/synthetic sizes. These edge probes bound the algorithm; they do not demonstrate native editor authorability of missing or million-pixel dimensions. A reconstruction can validate finite nonnegative dimensions, normalize omitted supported height to0, and reject malformed records rather than reproduce accidental JavaScript coercions.

Recommended independent model: explicit `page.adaptiveSelection:'native-size'`, independent `adaptiveBaseSize:{width,height}`, named views with width/height and optional `baseViewId`, and declaration order retained. Existing documents can retain legacy maximum-width semantics when the new mode is absent. This compatibility discriminator is a product design choice, not a source field. Do not derive native default size from canvas bounds.

## Inheritance is separate from selection

`adaptive.js:171–180` resolves `baseViewId` through `_idToView`, then reverses the collected chain: least specific ancestor → selected leaf. It does not compare sizes, infer parents from order, or require ancestor breakpoints to be eligible. The test array deliberately puts leaf first and gives its parent a larger threshold; inheritance still resolves `[grand,parent,leaf]`.

The default record is not inserted into `_idToView` (`:721–725`). A named `baseViewId` pointing to a default GUID absent from the named table terminates normally. A stored default whose own parent equals itself must not be copied into the named inheritance table. Runtime Base uses an empty/undefined ID in the switch (`:51–53`). The parallel static-format evidence now closes the default identity mapping: `wJe6.OJeL`, token100694304, branches at IL0080 past the normal identity write at IL0106–010F for the default GUID; it also skips the parent identity write when the parent is Base (IL0198–01AD). See `adaptive-hierarchy-format-generator-cil.json`. This is retained CIL inspection, not DLL execution or a new generated-page capture.

Unknown starting IDs return an empty chain. A missing parent ends the chain. A named cycle is not protected by the original loop; a bounded30ms VM probe times out rather than hanging the research process. Production schema cycle/unknown-reference rejection is a deliberate validation boundary.

`getPageStyle`, `:208–219`, shallow-merges base page style and each ancestor/leaf patch. A child `size:{width:200}` replaces the prior whole `size` object; it does not retain its prior height by a deep merge. Explicit zero dimensions survive. Current model properties may be flattened differently; this result describes the original generated style records.

Widget normal styles use `style.js:1794–1819`: process the full view chain in order, applying a view patch's named base style before that patch. State-style inheritance is **different** (`:1849–1866`): search from leaf toward ancestors and take the first state style as one patch. An explicit state map blocks older maps even when it does not contain the requested state. Thus child `{stateStyles:{selected:{color:'x'}}}` does not separately inherit its ancestor selected fill; and `{stateStyles:{mouseOver:{...}}}` can block selected inheritance. Base object state is the final fallback when no view map blocks it. Contained objects obtain state declarations from their containing owner. Existing state priority and reset details remain in the frozen adaptive-transition report.

`applyView`, `adaptive.js:245–269`, adds only the selected leaf's class, computes its complete ancestor chain, then applies each object once. It restores limbo/hidden declarations after the object pass and updates the percent-panel cache last. Ancestor classes are not separately added by this function. Any generated CSS inheritance/selector expansion is a separate generator layer; this VM does not establish the final CSS cascade.

Image selection (`:319–356`) searches from leaf toward ancestor for the full requested state, then Base images for that state/highest-priority state, then decomposes states. It prefers a source-specific `scriptId~state~view` key before `state~view`. This lookup has its own priority rather than property-merging image assets.

## Auto, forced and player-owned selection

The exact control probes cover `adaptive.js:6–42`, `:48–159`, `:429–451`, and `:707–752`:

- `setAdaptiveView('auto')` normalizes to undefined, enables auto, and immediately evaluates the window size unless the sidebar owns auto sizing.
- `setAdaptiveView('default')` normalizes to an empty ID, disables auto, and forces Base. Any explicit ID disables auto; ordinary resize then keeps that view.
- `setAuto(true)` changes only the boolean. It does not immediately recompute a view by itself.
- Before initialization, explicit selection is queued. Initialization applies it only inside the nonempty `adaptiveViews` branch. An empty list still registers the resize handler but does not apply the queued ID then.
- Forced selection does not validate the ID in this control layer; an unknown ID can become current with an empty style chain. The independent model should not treat that as a reason to accept dangling parent chains.
- Player `switchAdaptiveView` messages require `isInPlayer()` and the decoded current filename matching `data.src`. `setAdaptiveViewForSize` requires player mode, sets sidebar ownership, and selects using its supplied width/height.
- Sidebar size requests invoke `_switchView(...,'auto')` even if `_auto` was false; they do not themselves change `_auto`. A queued sidebar size takes precedence over a queued explicit view during initialization. Once sidebar ownership is true, ordinary window auto resize is suppressed unless a force token is supplied.

Same-view `_switchView` returns before reset, style application or view events. A truthy force token still posts the player notification. The public API alone does not always supply such a token. `setAdaptiveViewForSize` does supply `'auto'`, including when its selected ID is unchanged.

## Event order and master-specific views

`init.temp.js:241–251` places event initialization before adaptive initialization, then loads widgets/containers, then calls `adaptive.loadFinished()`, then repeater initial refresh. This is a static call-order observation, not a claim that all asynchronous Wait continuations have finished.

`adaptive.loadFinished`, `adaptive.js:17–22`, is one-shot. If a named view is current it fires page/master adaptive-view events; at Base it only posts the player notification. A view selected during initial adaptive initialization triggers the bindable `viewChanged`, but page/master adaptive interaction events are deferred until loadFinished.

For a real view change after loading: reset/application completes → bindable `viewChanged` (`:157`) → page/master adaptive interaction dispatch (`:158`). The window resize callback then dispatches ordinary resize (`:732–735`). Same-view resize only dispatches resize.

`events.js:1840–1861` invokes `onAdaptiveViewChange` through container traversal, then posts `adaptiveViewChange` to the player. The source traversal (`:1901–2018`) is executed in the probe with terminal action dispatch recorded:

- Page first, then master instances in source traversal order; nested masters recurse.
- Dynamic-panel traversal visits **all diagrams**, not only the active state. Panels themselves do not receive this adaptive event because the call filter contains only Page and RDO.
- Layers recurse into their children. Repeater descendants are not searched for this event because Repeater is not in this search filter.
- A missing source path identity (the source comment describes limbo) skips that container.
- Adaptive dispatch is synthetic and `skipShowDescription=false`; it is not treated as Load's special menu suppression. Actual case-selection and Wait continuation behavior remain governed by the existing event engine, which is a sink in this focused probe.
- Player notification requires a main-frame context or recognized parent player; cross-origin parent access is caught. No external URL is visited by the probe.

Master style ancestry does not automatically follow the page's selected view ID. `style.js:1777–1791` resolves the containing RDO's effective `viewOverride` (including its state), then calls `getMasterAdaptiveIdChain` against that master's own view table. The tests demonstrate independent page and master IDs. Native component/master serialization and editor UI mapping are not newly recovered here.

## Boundaries and validation record

The whole retained adaptive file is authoritative for this runtime version; metadata names from older releases are not substituted. No new font, GUI, native DLL execution, generator decryption, or original full-page CSS measurement was performed. The NodeVM loop/timeouts and sinks are stated explicitly in the JSON. The current model's safe cycle/size validation and legacy-mode discriminator are implementation recommendations, not original behavior claims.

During harness development the first control slice ended inside `_setAuto`, producing a SyntaxError. It was corrected to include the complete source function through line42; no product assertion was changed. The final83 cases pass, including selection matrices, configuration and player paths, parent/style/image inheritance, and actual event traversal. Source content was checked against pinned whole-file hashes before evaluation.
