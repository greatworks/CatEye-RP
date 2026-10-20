# Native point commit: authoring integration analysis

Read-only design review of the frozen native-point-editing implementation. No product, test, original evidence or release file was changed, and no browser, native application, DLL or test suite was run. New native commit geometry and adaptive-write evidence is still being collected; recommendations below are not a claim of original GUI parity.

## Current dataflow

| Surface | Current implementation and consequence |
| --- | --- |
| Effective author widget | `App.tsx:89–106` resolves the active adaptive chain, then selects the current panel/state/repeater-template editing scope. Coordinates in that scope are parent-local, not page-global. |
| Point preparation | `App.tsx:119–130`, `vector-authoring.ts:8–24` prepare the effective normal contour, gate unsupported parameter configurations, and clear effect preview. State flags are retained; point mode paints normal adaptive geometry. |
| Held gesture | `CanvasVectorTools.tsx:16–38,59–108` keeps a prepared path and pointer origin, derives normalized deltas using current width/height and inverse center rotation, and stores only a transient path. Pointer-up commits once; cancellation and returning to the starting path leave the document unchanged. |
| Canvas geometry operations | `vector-editing.ts:19–54,61–147` decode logical anchors, share an explicit closing endpoint with the first anchor, move adjacent handles with an anchor, and re-encode bounded normalized commands. They do not compute new owner bounds. |
| Numeric operations | `Inspector.tsx:487–533` edits prepared command coordinates, segment type and topology. A number commits on blur/Enter through `NumberField:113–126`; select/button changes commit immediately. Numeric rows are command-oriented, whereas canvas anchors merge a duplicated closing endpoint. Neither path currently re-bounds the owner. |
| Shared document commit | `App.tsx:145–147,316–318` sends both numeric and canvas edits to `applyAdaptivePointEdit`. `adaptive.ts:17–30` validates the path, rejects unsupported configurations, compares against the prepared contour, then changes only shared Base `type`/`vectorPath`. The general type-change guard remains at `adaptive.ts:490–492`. |
| History | `App.tsx:132,372–373` commits one document snapshot; undo/redo reset tools and selection. Point gestures do not use the ordinary drag's live document writes at `App.tsx:419–424`. |
| Current rendering | `WidgetView.tsx:71–79,171–183` maps normalized commands using the saved width/height and rotates the owner around its CSS center. SVG overflow is visible. The matching portable path at `export-runtime.ts:2553` uses the same saved layout. Thus an out-of-bounds point currently draws outside an unchanged owner rectangle. |

The existing point command intentionally ignores Affect all views: path and identity are shared content, while all active/inactive layout/style declarations are preserved. The next stage must not silently keep that assumption for a native normalization operation that also writes layout.

## Native facts already available, and remaining decisions

The frozen [point-editing evidence](native-point-editing-evidence.md), section “Conversion and history boundaries,” identifies `VectorShapeEdit.RN4I`100702640 and `TN46`100702684 as further normalization/layout paths. `RN4I` captures state, invokes `hN4K`, disables AutoFitHeight/Width, stores controls, and updates geometry/rotation inside an edit scope. `TN46` also normalizes and writes location/size/controls, but is not itself an identity conversion. These are retained CIL observations, not observed end-to-end original gestures.

The format investigator has additionally traced the two AutoFit setters to shared `mNYN`/`GNZZ` fields rather than adaptive PName declarations. The parent reports that `tN4P` has per-view iteration and that the surrounding TrapConns scope is a connector scope, not proof of an adaptive/all-views transaction. Therefore this report does **not** propose implementing native commit by calling ordinary all-views layout editing or only editing the active view.

At review close, the evidence investigator reports an **in-progress** narrower bounds trace: `RN4I → hN4K(..., true) → iN4x` uses bounds of participating enabled segments rather than the control-handle hull, rounds outward with a strict near-integer1e-5 exception, normalizes against the rounded bounds **before** minimum-size expansion, and then expands owner axes to at least `max(strokeWidth,1)` with a floored centered origin. A zero normalization axis maps to0.5. Its full curve-extrema/rotation oracle and final evidence manifest are not yet frozen. This early trace already means a single rectangle cannot represent both normalization and final owner layout.

Still required before implementation:

1. The final independently replayed `hN4K` bounds/curve-extrema oracle, participating-segment mapping to the product's M/L/C/Z schema, multiple-contour/empty behavior and rotation transform order. The early rounded-bounds/minimum-size/zero-axis trace must be tested as distinct stages, not silently approximated with a control hull.
2. `RN4I` versus `TN46` dispatch for anchor/handle moves, insert/delete, sharp/curve changes, numeric coordinates and fill-rule-only changes. Current product entries converge on one path callback; that is not evidence that every original entry has identical side effects.
3. `tN4P`'s per-view algorithm: which saved/effective rectangle is read, which declarations are written, whether inherited/inactive maps are visited, and whether Affect all views changes the operation. Do not substitute ordinary P101/P105 rules merely because the output fields have the same names.
4. Whether rotation is preserved numerically, normalized, or changed with a compensating path transform. The model has one center-origin angle, not a general native affine matrix/pivot.

## Smallest coherent implementation shape

Keep two layers, with exact geometry and scope policy supplied by the new evidence:

1. A **pure commit-geometry helper**, separate from gesture editing and Pen creation. Input is an immutable effective-normal frame and the edited path in that frame's normalized coordinates. Output distinguishes normalization bounds from final owner bounds, plus the normalized path and any transform needed to project the operation into the evidenced view frames. No DOM measurement, no document mutation, no state/effect paint.
2. Extend the existing **dedicated adaptive point command**, rather than relaxing the generic type guard. It checks a real path mutation before side effects, validates the complete plan, applies shared identity/path/AutoFit changes and all evidenced layout writes atomically, then returns one Page. `resolveAdaptivePage`/`commitAdaptivePage` remain the shared-set adapter. Only the final valid document reaches App's `commit`.

An illustrative API boundary is `planVectorPointCommit(frame, editedPath) -> plan`, consumed inside `applyAdaptivePointEdit(page, viewId, id, value, options?)`. The exact plan fields and whether `options.allViews` has any effect are deliberately **not frozen** before `tN4P` evidence. No new persistent provenance field appears necessary for ordinary rotation-only supported shapes; zero-size results may expose an existing schema limitation instead.

Do not call `applyAdaptiveWidgetEdits` with a converted `path` against the original `box`: it correctly rejects that type change. Do not flatten an effective selected/Phone widget into Base to bypass that guard. A narrowly composed internal layout writer, or an intermediate identity-preserving layout plan, can keep unrelated styles/content and the existing type restriction intact.

## Rotation and coordinate-frame invariants

Every input point and handle starts in the **pre-commit** owner frame. `canvasToVectorPoint` (`vector-editing.ts:175–178`) removes the current center rotation; the overlay reverses it using SVG translate/rotate (`CanvasVectorTools.tsx:30–36`). Preserve that immutable frame throughout a held gesture. Re-bounding after every pointer-move and then interpreting the next pointer in the new frame would compound the transform and make the handle drift.

If future evidence confirms a pure local translation/re-normalization with unchanged angle, a mathematical world-position oracle is available. Let `O` be old parent-local origin, `C` old half-size, `m` the new bounds' local minimum, `C′` new half-size, and `R` the center-rotation matrix. The compensated origin must satisfy:

`O′ = O + C - C′ + R(m + C′ - C)`

This follows from equating old and new rendered point positions; it is **not** a claim that native `hN4K` uses this formula. At zero rotation it reduces to `O′ = O + m`. At nonzero rotation merely adding `m` is generally wrong. It is an oracle only when normalization and owner frames represent a pure equivalent reparameterization. Native outward rounding or minimum-size expansion can intentionally change that relation; test those cases against source-derived intermediate values rather than enforcing ideal geometry preservation.

`finishPenPath` (`vector-editing.ts:185–195`) is not a substitute: it takes new Pen anchors in canvas pixels, includes handles in a control hull, clamps dimensions to at least1, and assumes no existing rotated owner. The ordinary resize helper (`rotation-geometry.ts:14–34`) instead pins an opposite edge/corner and rounds adjusted dimensions. Neither establishes the native point-commit bounds algorithm.

## Adaptive and document implications

- `AdaptiveWidgetOverride` (`types.ts:208–212`) carries x/y/width/height/rotation plus visual declarations; path/type/shapeText are shared. `resolveAdaptiveWidgets` (`adaptive.ts:160–175`) filters shared table/menu/tree descendants. Keep those restrictions rather than extending arbitrary contained targets.
- Ordinary all-views editing (`adaptive.ts:387–479`) promotes a changed whole Point/Size and clears those properties from every map. This is useful reference behavior, **not an approved implementation of point re-bounding**. A shared normalized path plus changed owner bounds can have different pixel consequences in another view; do not automatically compensate or overwrite every view without the new source contract.
- `commitAdaptivePage` (`adaptive-view-sets.ts:192–215`) converts projected active maps back to shared-page storage and retains inactive maps. A specialized point plan must operate on the complete page, not only the currently entered panel or repeater template array.
- Input path limits are4096 commands and coordinate magnitude10000 (`vector.ts:3–33`). Persisted owner sizes and adaptive dimensions are at least1 and at most100000; positions/angle are bounded. A flat line or single remaining anchor may produce a zero geometric extent. Do not silently reuse Pen's min1 policy or mutate only half the document if native results do not fit the model.
- Clone/component flows use generic widget traversal/remapping (`components.ts:31,102–160`). Once the atomic command produces valid shared data, they should carry it without special serialization, but need tests for conversion, bounds and flag retention. A point edit does not implicitly publish a linked component definition.

## AutoFit is not text measurement at point commit

`shapeText` is optional shared metadata (`types.ts:165–166`, `document.ts:823–826`), containing two required booleans. Its **presence**, not whether either flag is true, enables the native initial text-layout branch when padding and vertical alignment are available (`shape-text.ts:8–20`). Clearing autoFitWidth switches nowrap to normal; autoFitHeight currently does not alter that initial CSS, but both flags gate runtime resizing.

For a widget that already has shapeText, the new commit can set both booleans false in the same transaction once the command's native side-effect gate is confirmed. Preserve omission on legacy widgets: adding `{false,false}` to an omitted field can activate a different text-layout mode. The parent has accepted this compatibility boundary. Do not remove shapeText entirely from imported shapes, because that would select the legacy clipping/layout path.

The separate player `SetText` pipeline (`export-runtime.ts:1338–1364,1727–1768`) measures current DOM text and conditionally changes dimensions using those flags. A point commit should not call that runtime measurement or its resize/move events. Saved false flags should naturally prevent subsequent SetText AutoFit in preview/offline, while text content, rich runs, links and text-change dispatch remain intact. Empty text and preexisting false/false must be covered; no authored font-size or text normalization changes are implied.

## Draft and history changes to plan explicitly

Keep held previews in the old frame, or provide a complete preview frame+path; never pair newly normalized commands with old dimensions. Rebound only the final gesture if the native live-gesture timing remains unproved. Compare the raw mutation with its prepared starting path **before** disabling AutoFit or deriving bounds, preserving entry/no-op/cancel semantics.

The current `vectorContext` key (`App.tsx:123`) includes x/y/width/height/rotation. A successful rebound would remount CanvasVectorTools and reset selected-point state, even while pointEditingId remains selected. The parent has confirmed the new product requirement: preserve the selected logical anchor across an accepted self-commit, while external view/scope/open changes still cancel. Lift that selection or distinguish an accepted self-commit from external geometry changes; do not rely on an accidental remount. A second consecutive drag followed by a keyboard sharp/curve command is a required regression when this lifecycle changes.

Numeric edits commit per blur/select/button; canvas pointer edits commit per completed gesture. Both must consume the same final geometry plan and create exactly one document undo entry. Numeric command indices and canvas logical anchors are different APIs; keep existing closure semantics unless separately authorized. Failure must retain original type, path, dimensions, rotation, shapeText and all maps, with a visible error rather than a partial conversion.

## Recommended red cases and regression set

1. An out-of-bounds anchor and a handle-only overshoot where control hull differs from actual curve extrema; independently assert source-confirmed curve bounds, rounded normalization bounds, expanded owner bounds and final rendered positions. Include translated/shrunk bounds, multiple contours and near-integer values just inside/outside the strict tolerance. Use exact world-position preservation only in the unquantized/unexpanded branch where it is mathematically warranted.
2. Rotations0,37,90,-90 and a fractional angle/size; at least two zoom levels. Test parent-local editing in a rotated panel and a repeater template without importing parent rotation twice.
3. Flat horizontal/vertical contours, one remaining anchor, coincident endpoints, repeated close coordinates and exact schema limits. Assert either the proved legal result or complete rejection, never NaN/Infinity or silent clipping.
4. Base, inherited child, shared view set and inactive map fixtures with different dimensions/rotations. Test both Affect all views values against the eventual per-view contract; preserve unrelated object/declaration bytes.
5. Existing shapeText TT/TF/FT/FF become FF on actual eligible commits; omission stays omitted; entry, no-op, Escape and pointercancel do not change flags. Save/reopen preserves them; runtime SetText retains new bounds after conversion in preview and offline.
6. Numeric and canvas mutations yield the same normalized geometry for the same edited local points, each with one Undo/Redo; cancelled/out-and-back gestures retain exact source bytes. A second consecutive anchor/handle edit keeps a coherent selection and coordinate frame.
7. Custom identity never promotes to box; unsupported partial-border/independent-corner parameter configurations stay gated; legacy stored-path fallback follows the approved compatibility policy. Styles, rich links, events, clipboard and component mappings remain intact.

Existing focused suites to reuse without weakening: `native-point-editing-authoring/geometry`, `vector-editing` and independent review tests, `rotation-authoring`, `adaptive-hierarchy`, `adaptive-all-views-authoring`, `native-text-layout/renderer`, and `runtime-text-autofit/lifecycle`. Parent-owned browser fixtures already cover entry, numeric conversion, draft painting, cancellation and shared maps; add new commit expectations in new stage tests rather than overwriting frozen evidence.

Implementation remains pending the common native commit contract. The companion JSON records the inspected source hashes and the design's unresolved decisions.
