# Selection adaptive SVG: read-only product integration review

Date: 2026-10-21. Scope: current product architecture only. No product/test/build/old evidence changes and no test/browser/DLL execution in this review.

fullAxureParity=false; originalGuiCompared=false; published=false.

Baseline: research/selection-state-verification.json SHA256 **10ffa18375ffe761a8c0722e2cbba7c1e0030e7d52df8a3c202998f07c00aedc**. All ten inspected production files below match that verification's frozen sources. This report does not reuse the earlier agent-owned d4b5478 source as the final baseline; the released stage includes the parent's later host/fallback and bounded-history fixes.

## Recommendation

Keep an independent, per-instance SVG transform history in the runtime asset ledger. Advance it only at a source-confirmed adaptive SVG application. Rendering, font readiness, pointer/effect repaint, action SetStyle, owner Move/Resize/SetText, and rebuilding a browser label must only consume the current snapshot. Do not implement adaptive scale by replacing P94, changing path coordinates/viewBox, scaling the owner, or multiplying the current DOM matrix on every render.

The current selectionPaintState is the smallest storage location: it already has full row keys, page/repeater disposal, atomic rollback and engine snapshot transport. Its asset.width is **outline stroke width**, not owner width. Any ratio denominator needs separately named immutable normal owner size, or a source-specific resolver that reads normal Base dimensions. The final scalar/crop fields should be chosen after the two evidence workers freeze their exact scale and initial-asset contracts.

## Existing dataflow and exact attachment sites

| Product location | Current behavior | Consequence for integration |
|---|---|---|
| export-runtime.ts:140–198, adaptivePage/chooseView/activeSelectionId | Shared sets are projected into a page chain; constructor selects an initial view when viewport policy exists. Active identity and forced/auto mode are closure state. | Initial named selection is already known before Loaded; initial Base must not be conflated with a later adaptive event. |
| export-runtime.ts:419–451, adaptiveOverride | Returns merged sparse adaptive declarations, oldest ancestor to leaf. Normal geometry is not filled into an absent width/height key. Padding gets its special sparse projection. | Preserve whether adaptive size was actually declared. P94-only or empty/no-size chains must not acquire a size merely because currentWidget has full dimensions. Inherited size in an ancestor still belongs to the merged declaration. |
| export-runtime.ts:470–488, baseWidget | Normal declaration + adaptive declaration + runtime action overrides; stateStyles can replace the effect map. | This is too late to derive the adaptive size request: action width/height or text AutoFit may contaminate the input. |
| export-runtime.ts:619–658, ensureSelectionPaint/paintSelection/getter | Fixed normal asset plus event paint and persistent width attributes. Getter may lazily initialize the asset and returns a detached snapshot; no transform history exists. Unsupported paint becomes sticky fallback until asset reset. | Add transform as a separate ledger concern. Do not tie a scale mutation to the generic paintSelection call: it also runs for selected/error/focus/hover/enabled/actions. Keep transform history even when the host is temporarily unable to paint. |
| export-runtime.ts:882–890, renderWidget | Records host projection/rich-text state and returns effective widget. | Never use this frequently called getter as a new adaptive-event detector. |
| export-runtime.ts:3000–3042, initialization | initializeLayerStates performs state initialization, then initializeSelectionPaints repaints selected enabled controls and initial named views; it traverses Layers/all panel states, while rows are initialized separately. | Separate initial named adaptive application from the selected-binding repaint. A combined boolean condition is sufficient for paint but cannot represent a transform event count. |
| export-runtime.ts:3090–3132, row refresh | Actual product row regeneration calls forgetRow, bumps revision, rebuilds rows and initializes new assets. Adaptive persist keeps selected/error/disabled dictionaries but the row DOM is still regenerated. | New asset generation resets scale; reinitializing a row in the active named view may apply that view once. Native pre-generated-row reuse remains a separate unimplemented lifecycle. |
| export-runtime.ts:3346–3430, applyAdaptiveView | Same managed view identity returns early. A real transition resets action geometry/styles, clears accumulated SVG action styles, repaints non-row selection assets, rebuilds affected repeaters, then emits adaptiveViewChange. | Attach a dedicated adaptive-transform event here, not to every non-row repaint. Base restoration may repaint without a scale event. Preserve exact initial/named/Base/unknown eligibility from the source contract. |
| export-runtime.ts:3439–3446, selectionDisplaySource | Deep-cloned authored template + effective declaration, including adaptive rich-run projection; deliberately ignores runtime text/actions/row expression values. | Continue using it for display-only text/layout. It is not an initial SVG asset or event ledger and must not redefine asset dimensions. |
| export-runtime.ts:1798,1936 and SetStyle:2425–2440 | Ordinary runtime Resize excludes checkbox/radio; group resize may move them. SetStyle applies sparse final SVG paint. | Neither action channel should advance adaptive scale. SetText/AutoFit owner geometry also stays separate. |
| selection-display.ts:20–85 | WeakMap per label caches measured panel by authored source; every cache hit and resolved font promise reapplies the current paint. Stale font completions are rejected. Fallback removes only the SVG, preserving its input/label host. | Store no history in the WeakMap. Pass immutable transform in the same snapshot and assign it absolutely on each apply. Font remeasure must use the latest snapshot without adding another scale. |
| selection-indicator.ts:68–111 | Every paint rewrites the same paths and b×b viewBox/viewport, at result.indicator.x/y. No SVG transform is currently written. | Add one absolute SVG transform projection, and explicitly clear it for authoring/identity. Keep initial crop/translation separate from scale so text/input/owner stay unscaled. |

## Host routes and lifecycle hazards

- Preview.tsx:44–89 creates a viewport-managed session, registers controls, subscribes to state and calls start. React WidgetView.SelectionControl (line140) runs its layout effect every render. Preview passes both selectionDisplaySource and selectionIndicatorPaint at line198. A render/effect count is not a native adaptive dispatch count.
- Offline export creates the same portable runtime and renderer factories through Function.toString in export.ts:44–47. Embedded file frames use export.ts:61; the built frame-player.ts:32–36 uses the same module factories. No new hidden value dependency may enter the serialized factory.
- Offline mount preserves the widget node by page/row instance key (export-runtime.ts:3787–3798), and the label/input pair by the supported author source. Runtime null paint is handed to the existing host fallback. Its source eligibility test must not revert to choosing a different legacy label merely because runtime transform/paint is unavailable; the prior stage specifically fixed that input-identity failure.
- Hidden ordinary widgets and inactive panel subtrees can be absent from product DOM. Showing them may create a new label/SVG even though the logical runtime asset history must survive. Thus **DOM creation is not sufficient to reset the logical asset**. Reset on page/repeater-generation lifecycle, then project the ledger into any recreated node.
- Sticky unsupported paint already remains fallback until logical asset recreation. New transform logic must not accidentally restore SVG support or clear that flag. Conversely a fallback's DOM removal must not alone erase an otherwise valid transform history.
- A font completion can run after an adaptive source change, after runtime SetText, or after a later snapshot update. Existing entry identity guards reject stale source work; cached entry.current/paint are updated on ordinary repaint. Extend this behavior rather than replacing it with matrix reads.

## Evidence available while this review was written

The preceding frozen asset evidence (research/selection-state-assets-evidence.md) proves reuse of ordinary inline SVG across adaptive/action/P94 updates and that setAdaptiveStyle scales a non-Rectangle SVG without regenerating d/viewBox. The current scale worker additionally reported these exact-source static facts; its new numeric/original-browser matrix is still being completed, so this report does not manufacture numeric endpoints:

1. Same view ID returns from adaptive._switchView; force may still post its callback, not repeat style application.
2. A real view switch resets CSS on the owner and its **direct children**, not recursively. The native owner → absolute label → inline SVG hierarchy means that clearing the label transform does not clear the descendant SVG transform.
3. named → Base does not call setAdaptiveStyle; clearAdaptiveStyles instead repaints the normal asset and removes adaptive classes. Do not reset or multiply SVG scale just because current view is now Base.
4. computeAllOverrides produces sparse overrides. P94-only/empty declarations do not synthesize normal size. The scale denominator's normal Base lookup is distinct from the current named declaration and from runtime action geometry.
5. Native size is a carrier. Product width-only/height-only overrides are legal, but equating these with a malformed native half-size object is unproved. A possible compatibility projection is to detect declared size presence then fill the missing companion axis from effective **declarations**, never actions; this is a product mapping requiring an explicit decision and tests, not an original-source claim.

Still pending from the evidence workers: exact cumulative scale arithmetic/readback behavior, origin/crop box, invalid/zero ratios, state/contained traversal, half-size carrier behavior, unknown view IDs and the precise pre-generated versus regenerated row path. These must remain explicit gates, not guesses embedded into rendering.

## Snapshot compatibility issue to address

engine.ts:10–18 creates a new factory without viewport policy, then Object.assign restores the serializable runtime state. The paint ledger survives, but activeSelectionId, activeView and selectionMode are closure values and are **not restored**. This is directly visible in current code, not a newly executed behavioral probe.

Once transform is cumulative, two separate executeInteraction calls selecting the same named view can differ from one live session: the second factory can mistake the already selected view for a fresh Base→named transition and apply another factor, while the live session would return at the same-ID gate. Prefer a small runtime-only saved adaptive identity/mode with synchronized restore semantics. Do not patch around it with a per-widget lastView shortcut: that cannot distinguish genuine repeated setAdaptiveStyle calls, row asset generation or other explicit refresh reasons. Document files must remain unchanged.

A dedicated event helper should accept a reason/phase (initial named application, actual named transition, row generation) and a sparse declaration size input, calculate the next finite transform in the same atomic operation as paint, and never execute from selectionIndicatorPaint/renderWidget/display.update/fontsReady. No broad action engine rewrite is needed.

## Suggested tests and locations

1. New module + bare serialized runtime suite beside tests/selection-state-runtime.test.ts: initial Base versus initial named; initial named applied once before Loaded; named A→B→Base→A; same-view viewport and forced requests; P94-only/color-only/no-size versus inherited size; legal product half-axis policy; negative/zero/nonfinite ratios as the final evidence permits. Preserve exact source fixture provenance.
2. Test independent owner action history: SetStyle with P94/stroke/width-related state, ordinary Resize (selection exclusion), SetText AutoFit or Move, then adaptive switch. Compare SVG transform, owner rect and d/viewBox independently; owner resize must never silently become adaptive scale.
3. Extend tests/selection-display-host.test.ts's latest-snapshot/cache-hit/font-ready cases (lines96–165): repeated updates leave scale unchanged; latest paint/transform survives delayed fonts; stale font promise cannot restore an old transform; fallback and recovery do not replace the input or advance the ledger.
4. Extend selection-indicator geometry/projection tests near lines150–210: asset d/viewBox stable, transform assigned absolutely, identity cleared on authoring, crop offsets and transform-origin verified separately from transformed bounding rectangles. Numeric author/provider crop probes must not be labeled browser font parity.
5. Repeater module cases: independent rows and nested contexts; refresh generation resets only rebuilt rows; no cross-row history; adaptive named rebuild initializes once. Page navigation, restart/dispose and failed multi-action transactions clear/rollback as appropriate. Snapshot engine chain must match live session identity gating.
6. New production browser fixture beside tests/e2e/selection-state-paint.spec.ts and selection-display.spec.ts, shared across Preview/file HTML/inline frame: assert CSS matrix plus actual SVG bounding rect, unchanged path/viewBox, label/input identity, checked behavior, and text remaining unscaled; include late font promise and hidden/show reconstruction.
7. Keep runtime-adaptive-transition.test.ts same-ID, initial hidden/inactive, destination-page and auto/forced selection assertions intact. They locate the current event boundaries and protect unrelated adaptive reset behavior.

## Minimal file ownership proposal

- Runtime event state and portable snapshot/transition integration: src/runtime/export-runtime.ts; engine snapshot handling may require src/runtime/engine.ts or a narrowly restored runtime-only carrier.
- Snapshot/crop type and pure SVG projection: src/model/selection-indicator.ts.
- Host snapshot plumbing/repaint lifecycle: src/runtime/selection-display.ts; Preview.tsx/WidgetView.tsx only if a new field/API is used. Reusing the existing snapshot field avoids extra host imperative effects.
- Serialized export/frame-player paths should inherit the same factory; edit them only if a new explicit dependency is unavoidable.
- No Document model, author selection geometry, UI command, native importer or general motion consumer change is required by this narrow adaptive SVG task.

## Frozen source hashes inspected

- src/runtime/export-runtime.ts — 99aa003b7d0f6b230b464e8b4641f815ee06a0e155848825e587c9d203b77829
- src/runtime/engine.ts — 9df0fab611180061800d823172452b62ca18bb8a0375666066af9ef6604fb040
- src/runtime/selection-display.ts — f4755d8c282079bf572afee76dd8cb8bf2d9285f9499c89795df8ad2b96791a6
- src/model/selection-indicator.ts — a41bdeb77722cfae4f1010ff8085ab0c8c9db7060aedcd4173c9eb1f219e4a3c
- src/runtime/selection-text-layout.ts — a78e70066506567db12d64687d1a561e4d5eec0c9ec20e2d3650ab09cf3ff9bf
- src/components/Preview.tsx — 696a5606d4b8468cef16e3d0ea20aaf2430dffe06a76e8a8c2cb2f63cb62f29b
- src/components/WidgetView.tsx — 3724e42ba44aad9c1afc7d00a79b8ed25ee4d5b4f528a5d969328c34639c7370
- src/runtime/export.ts — 45c62e446bfb16cc93efd12e048e7563af42702e6c6952d00352d3963419f43c
- src/runtime/frame-player.ts — 4ec76c5bf301d254bbd76a5d68f92978b3cad8c0c7fc22b4efc119c28a47be1f
- src/runtime/inline-frame-runtime.ts — 474a0b36fb9170b8aa0b5c8ffaf97c3dac3e9a1557be4bda2cb0b0f48885fa7c

The only file written by this review is research/selection-adaptive-product-review.md. No source changes or additional test claims are included.
