# Selection pointer input model implementation

This stage adds only `src/model/selection-pointer-input.ts` and its dedicated test file. It implements ordinary unrotated checkbox/radio resize input from the retained Windows key/controller and grid-only CIL evidence. It neither invokes the original DLL nor claims original GUI or font equivalence. The existing selection layout solver and its direct Ctrl/Alt rejection remain byte-for-byte unchanged.

## Host contract

`prepareSelectionPointerInput({targetCount, handle, freedom, initialModifiers, initialHotzonePoint, grid})` copies the captured settings and selects `mode: 'resize' | 'rotate'`. Only a multi-target gesture beginning with exactly Control selects rotation. A single SelectionButton has no native Rotation capability. Ctrl+Shift/Alt combinations remain resize; later key changes do not reselect the mode. Rotation input is explicitly unsupported by this adapter.

`selectionPointerHotzonePoint(bounds, handle)` reproduces the modern BoxModel, zero-angle logical point. W/E use `y+(height-1)/2`; N/S use `x+(width-1)/2`; right/bottom use the actual outer edge. It does not use the physical press point or DOM hit-box center. `selectionPointerBounds(rects)` folds a nonempty finite union without adding the origin. Selected locked owners remain part of this union.

For every queued move, `planSelectionPointerInput(original, {absolutePoint, currentBounds, modifiers})` returns either an atomic failure or `{rawDelta, delta, layoutModifiers, trace}`. The caller must supply the current accepted owner union after the preceding layout frame. The resize solver independently retains its original geometry snapshot. Alt bypasses snapping; otherwise enabled grid computes the candidate and correction. Ctrl/Alt are consumed only after confirming captured resize mode. Shift is retained in `layoutModifiers`; raw keys remain in the trace.

`delta` preserves the source order `(absolutePoint + correction) - initialHotzonePoint`. Both axes survive input processing, including an orthogonal correction on a side handle. Subsequent sizing freedom, not the input adapter, controls their geometry effect. Pointer-up is a transaction completion and must not be sent as another layout frame. The parent owns that host change.

Two additional pure exports, `selectionPointerCandidate` and `selectionPointerGridCorrection`, expose the source decomposition for numerical validation. Grid correction receives the opposite anchor, whereas candidate receives the dragged handle. Guides and object providers are not included.

## Numerical and source boundaries

- Candidate uses live bounds. Corner Shift first expands the smaller signed axis to the current ratio, before crossing and freedom rules.
- The source no-candidate value is the finite rectangle `(-100000,-100000,200000,200000)`. It still participates in grid correction; it is not discarded.
- Grid snaps absolute edges from world origin zero, using midpoint rounding away from zero. Opposite-anchor priority, bottom/right tie order, inclusive tolerance and the final corner-Shift correction are retained.
- Grid width and height are explicit settings. One host-converted tolerance is used for both axes. The parent's `5 / zoom` is an explicit uniform graphics substitute, not arbitrary native DPI/transform parity; product spacing 8 is not claimed as the native persisted default.
- Finite positive current owner bounds, nonempty selections of at most 10,000 targets, positive finite grid spacing, nonnegative finite tolerance and Boolean modifiers are product input requirements. A computed nonfinite correction is rejected before a layout request. Native propagation of every degenerate numeric value is not reproduced.
- General rotations/transforms, other BoxModels, guide/object snapping, native settings migration, key-only dispatch, multi-target rotation mode, and arbitrary scope translations remain outside this module. Ctrl/Alt consumption is specific to the proved ordinary SelectionButton resize branch, not Layer pin handling or general widgets.

## Validation and preserved failures

The final focused command is:

`npx vitest run tests/selection-pointer-input.test.ts tests/selection-pointer-resize.test.ts --reporter=json --outputFile=.build/selection-input-model-focused-final.json`

It passes **107/107**: 19 new input tests and 88 existing pointer-layout tests. The new tests compare all **1,752** records from `selection-input-grid-probes.json` against the original CIL replay's `actual` values: 896 candidates, 774 corrections/thresholds, 64 logical anchors and 18 entry/live-bound records. They also compare all 128 recorded press-mode results, exercise modifier consumption through the actual existing layout planner, preserve the direct planner's rejection contract, and verify ownership, finite-domain rejection and logical press offsets. These records are not additional browser tests. `npx tsc --noEmit` then exits 0.

Failure artifacts are retained separately:

| Artifact prefix under `.build` | Result and classification |
| --- | --- |
| `selection-input-model-keys-red` | New module absent; collection failure, not six executed failing assertions. |
| `selection-input-model-hotzone-red` | 6 passed / 2 failed before the new bounds/hot-zone exports existed. |
| `selection-input-model-grid-red` | 9 passed / 5 failed before candidate/correction and enabled-grid implementation. |
| `selection-input-model-focused-first` | 106 passed / 1 failed: a test incorrectly expected a finite zero-axis correction with tolerance 5 to be nonfinite. The test now uses tolerance 0, which actually produces the rejected nonfinite result. No product change was made for that assertion. |
| `selection-input-model-typecheck-first` and `selection-input-model-bounds-red` | Typecheck found `forEach(rect)` passed the array index into `allowZero`; a regression proved the second zero-width owner was incorrectly admitted (18 passed / 1 failed). Replacing the callback with an explicit lambda fixes the actual defect. |
| `selection-input-model-focused-final` and `selection-input-model-typecheck-final` | 107 passed / 0 failed; typecheck exit 0. |

The immutable JSON manifest binds the final source/test snapshots, all listed reports and the independent source evidence. The earlier analysis and design-correction note remain preserved; the pre-queue projection hypothesis in the first analysis was superseded by the current-bounds source contract. Parent-owned App/session/browser work is verified separately and is not included in this module's completion claim.
