# Native pill rendering and editing analysis

This review started read-only. The parent subsequently authorized one bounded product correction: normalize rectangle **qualification** for the retained six-anchor pills. Only `src/model/line-style.ts` and the new `tests/native-pills-renderer.test.ts` were changed. Initial-versus-dynamic paint lifecycle, native reader/importer, React/offline renderers, and authoring controls were not changed here.

The evidence types are distinct: the source inventory reads retained native records; the accompanying probe executes current product code and a saved pre-fix product source; the native evidence owner performs bounded CIL interpretation and retained JavaScript slices with sinks. None is an original Axure GUI observation or a native initial-render screenshot.

## Qualification defect and correction

[native-pills-format-inventory.json](native-pills-format-inventory.json) contains the 41 previously excluded Shape0 owners. Exactly 28 are the six-anchor Form pill subset. All 28 already pass `rectangleRadii(path, originalWidth, originalHeight)`. Before this correction, only six pass the normalized family check used by `supportsCorners`; the other 22 fail in both module and serialized-factory execution.

One exact example is source `ae97309c679341bd880e3f1e1ca9fd09`, package `5ad6e3711a514f7ba00105ba02f41959`, size35×14, radius7, mask15. The saved path has six segments. `rectangleFamily` reconstructs a 1×0.4 comparison space, deriving right corner radii `0.19999999999999996` and `0.2`. `rectangleSegments`' strict inequality creates a seventh straight segment between those values. Every point and handle is already within the existing 1e-7 comparison tolerance, but the preceding exact segment-count check rejects the contour. The report JSON retains the exact diagnostic intermediate, source hashes, source ID, and before/after result for every pill.

Current locations in `src/model/line-style.ts`:

- Lines20–24 generate expected rectangular segments and omit only exactly zero-length straight edges.
- Lines28–44 validate physical rectangle geometry; lines35–41 now reconcile an expected segment-count mismatch in `allowLarge` mode by removing expected straight edges whose endpoints already compare equal under the existing tolerance.
- Lines49–61 normalize the original rectangle aspect ratio before the validation call.
- Lines63–65 expose corner capability; line10 exposes border-side capability.
- Lines151–156 choose parameterized rectangle painting only for a qualifying `box` path with explicit native mask, or the existing legacy hidden-border route.

The correction does **not** increase tolerance, ignore cubic handles, infer a rectangle from six vertices alone, mutate saved geometry, or remove edges from the dynamic painter. It only runs when the expected and saved segment counts disagree in the normalized-family comparison. A changed handle, wrong widget type, open or compound contour remains outside the domain. Old vector snapshots without a mask still do not gain new corner controls or ordinary parameter regeneration.

## Model and import boundary

The general vector model already supports this shape: `src/model/vector.ts:6–32` validates bounded M/L/C/Z commands, and `vectorPathData` at lines36–51 maps their normalized coordinates to current width/height. A six-anchor pill needs no new path opcode or general widget schema. `src/model/document.ts:821` passes stored vector data through that validator.

Qualification alone is not native identity. The existing import must still prove Shape0, complete stored contour, effective independent P71/P81, cache/source identity, and the supported surface. The format inventory currently records these pills as generic stored-path candidates; the native reader/import expansion is separately owned. This probe deliberately supplies `type:'box'` and explicit native mask to measure the renderer's capability, and does not misrepresent that as an end-to-end imported result.

The same inventory also contains nine other saved eight-vertex paths and four Default records. They must not be swept into a rule accepting all six/eight-vertex objects. This correction tests the 28 pill subset only; the native owners retain responsibility for the other domains.

## Initial managed geometry versus dynamic JavaScript

The new native investigation reports a managed chain from `i5vf` token100722498 through IL06CA into `m5vw` token100722500. The builder creates eight points and coalesces adjacent/closing coincident anchors when the adjacent handles are degenerate, preserving the surviving incoming/outgoing handles. Its bounded replay matches all 28 raw pill anchors/handles/segment flags. A horizontal or vertical pill becomes six anchors; a square can become four. This is an interpreted managed geometry prefix, not the complete SVG writer or final rasterization.

The retained JavaScript Rectangle update described by [native-corners-evidence.md](native-corners-evidence.md) writes four corner cubics and straight sides, including degenerate sides at pill poles, with separate stroke and fill geometry. It does not perform that managed coalescence. Its stroke path uses half-border insets, and its dynamic width0/line-pattern-none gates preserve prior paths. The managed geometry prefix by itself does not prove initial exported stroke placement, clipping, or raster pixels.

For the 28 retained pills at their original dimensions, this report independently compares the product's all-borders-visible projected **fill** contour with the saved normalized contour. All28 match within the existing point tolerance after ignoring degenerate straight edges and contour start rotation. This establishes the bounded fill-shape comparison only: it does not establish initial SVG stroke equivalence, other border masks, any GUI appearance, or every oversized-radius configuration.

## Current editor, preview, offline and state flow

`WidgetView.tsx:137` resolves static selected/error/disabled style and `:171` immediately calls `lines.vectorRectangle(w)` for every vector render. The selected fill/stroke paths are used at `:179–180`. There is no corner paint-phase cache. The editor's first render and subsequent property/selection renders use the same declarative rectangle painter once qualification succeeds.

Preview uses the runtime's effective widget and passes it to `WidgetContent` (`Preview.tsx:187`). Core `baseWidget` at `export-runtime.ts:440–459` merges adaptive declarations and action style; `interactionStyle` at `:551–565` composes pointer/focus/selected/error/hint/disabled state. `currentWidget` at `:705–726` resolves these to the displayed widget. SetStyle writes its style override at `:1386–1395`. Those paths preserve scalar/mask independence but carry no initial-managed-versus-dynamic corner phase.

Offline `export-runtime.ts:2722` likewise computes `vectorRectangle(w)` on every render and writes stroke/fill `d` at `:2739` and `:2748`. The same factory is serialized by `runtime/export.ts:43` and child-frame bootstrap `:57`; `frame-player.ts:32` supplies the same helper. Module and serialized recognition therefore need identical boundaries. Gradient paint sessions at `WidgetView.tsx:135–136` and offline `:2723` are gradient-specific and do not distinguish corner geometry stages.

The minimal accepted pill stage is to restore strict qualification/import while retaining the declared product rendering contract. A later exact native lifecycle implementation should separate recognized source geometry, initial managed/export geometry, and dynamic update history rather than infer phase from equal style values. It would require per-instance identity and cleanup across rows, navigation, adaptive changes, and frame remounts, plus an explicit definition of which source events invoke the native painter. No such state machine was added here. The pre-existing width0/none stale-path difference remains documented rather than silently generalized as parity.

## Confirmed remaining node-editing discrepancy

`CanvasVectorTools.tsx:24–25` obtains anchors from the stored `widget.vectorPath`; its segment hit targets at `:146` use that same path. App passes `current` directly to the overlay at `App.tsx:458`, and the border double-click hit test at `:419` also reads stored vector segments. Numeric node editing in `Inspector.tsx:485–488` edits those saved commands. These are not the parameter-regenerated display contour.

For the real35×14 example, changing effective radius to2 leaves the stored first anchor at pixel(0,7), while the rendered fill starts at(0,2) and now has ordinary separated corner/side segments. The report JSON contains both paths. This is a concrete product integration discrepancy, not a native GUI comparison. A subsequent handle edit can invalidate rectangle qualification, causing rendering to return to the edited saved path. The parent explicitly retained this as a remaining issue for a separately designed editing handoff; this narrow recognition change does not attempt to rewrite node geometry or discard native parameters.

## Regression evidence and freeze

- `.build/native-pills-renderer-red.json/.log`: new115 tests,71 passed/44 failed before the fix. The44 failures are22 real-source qualification failures in module and serialized modes.
- `.build/native-pills-renderer-green.json/.log`:141/141 across the new115 and26 existing corner/control tests.
- `.build/native-pills-renderer-line-regression.json/.log`:38/38 existing line-style model/runtime tests.
- `.build/native-pills-renderer-typecheck.log`: full TypeScript check exit0.

The new tests exercise each retained pill at its original dimensions and two changed aspect ratios, reject an actual handle perturbation for every source, retain no-mask/type/open/compound restrictions, and assert the saved path is unchanged. No full suite, browser, build, or package was run by this scope.

Only `line-style.ts` and the new test are production/test handoff changes. The pre-fix helper is retained at `.build/native-pills-renderer-before-line-style.ts`. The companion JSON binds source hashes, per-source results, logs, the diagnostic script and these limitations. The owner will aggregate final import/browser/package acceptance separately.
