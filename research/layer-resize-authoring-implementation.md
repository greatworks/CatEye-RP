# Layer resize and pin authoring integration

This is the editor integration for the source-bounded Layer controller. It does not claim original GUI, canvas-pixel, arbitrary-container, or general modifier-key parity. Capability/schema evidence is separately frozen in `layer-resize-capability-manifest.json` and `layer-resize-pins-model-implementation.json`; the numerical and controller owners retain their own source/oracle reports.

## Implemented paths

- `App.tsx` exposes eight Layer handles. Every pointer frame plans from the gesture's original document, original effective Layer subtrees, view, scope, and zoom. Results are applied only after every selected root succeeds. A mixed Layer/ordinary selection is rejected with a visible notice.
- Pointer resizing uses the shared selection rectangle of all selected direct Layer roots, including a selected locked root. Child coordinates remain in the enclosing page/panel/repeater scope; Layer's independent degree is not applied as a CSS frame rotation. The controller owns handle freedom, delta clamping, constraints, contact propagation, output validity, and patches.
- Inspector `Group width` and `Group height` use the same controller, with each selected Layer's own requested-minus-original axis delta. This multiple-target numeric policy is an explicit product convention; the original multiple-selection numeric UI has not been closed. It is distinct from the source-proven shared-frame pointer path.
- Controller patches write changed Location and Size as independent complete pairs into the current adaptive slot. They do not route through the general Affect-all-views edit command, materialize unchanged pairs, write Layer-owned adaptive geometry, or remove other views' declarations. Shared `shapeText` changes are applied to the original widget. Derived Layer frames are refitted.
- Live preview never becomes the next frame's baseline. Out-and-back, Escape, pointer cancellation, and view/scope/zoom/document context changes discard the provisional edit. A successful pointer gesture adds one Undo entry. Zero-delta commands preserve the original document exactly.
- `Inspector.tsx` exposes `Horizontal pin`, `Vertical pin`, `Fixed width`, and `Fixed height` only in normal properties. Each sends one explicit style field, preserving heterogeneous selected targets. These use existing current-view/All-views model semantics. The UI distinguishes stored flags from capability-enforced dimensions; it does not duplicate the native capability table.
- Ordinary non-Layer resize behavior is unchanged. Layer resizing does not inherit the ordinary 8px UI minimum; planner/model limits determine admissible geometry.

## Evidence and corrections retained

- The previous production build fails the added handle test with **0 actual / 8 expected** handles. See `.build/layer-resize-ui-red.json`, its log and trace.
- The first development run had page-load timeouts before editor actions and was stopped after the same server issue was independently reproduced. Its log and attachments are retained. No timeout was increased.
- The first production run was **3 passed / 4 failed**. One was the real side-axis wiring gap: the initial planner default accepted both deltas for an east handle. The controller's original constructor evidence supplies horizontal/vertical freedom. Two failures were test-history preconditions: File Open is itself undoable. Tests now wait for exact autosave and reload before asserting an empty history stack. The fourth was an invalid shared-set fixture retaining page-owned Base metadata; the parser correctly rejected it.
- The initially proposed multiple-Layer pointer policy (each root independently receiving the same delta) was superseded by exact `CbNX` evidence: all roots use one selection rectangle. The revised test uses the 400→500 source case, yielding two 100→125 roots and relative second x=300→375.
- The first production source bytes are retained under `.build/layer-resize-authoring-production-first-source/`; the first E2E source is `.build/layer-resize-authoring-production-first.spec.ts`. New results never replace these.
- The corrected production candidate then passed **7/8** workflows. The remaining test used `fill('100')` on an already-100 input, so no actual edit/change event occurred and the field correctly had no modified intent. The test now performs Ctrl+A, Backspace, and real typing of `100`; the strict second-target geometry assertion is unchanged. That focused case passes **1/1**. Its previous test bytes are `.build/layer-resize-authoring-production-second.spec.ts`. No product change was made for this correction.

## Verification scope

The new `tests/e2e/layer-resize-authoring.spec.ts` contains eight workflows: pointer/numeric agreement, horizontal/vertical axis behavior, zoom and sub-8px geometry, one-step Undo/Redo, cancellation and context changes, nested Layer/panel coordinates, current-view edits with Affect all views checked, shared/inactive declarations and AutoFit, heterogeneous numeric targets including a true no-op target, mixed/unsupported atomic rejection, independent pin edits, shared-frame multiple selection, locked-root participation, and crossing the opposite boundary. Save/reopen comparisons retain full documents and unrelated fields.

Final focused run status and exact file hashes are recorded in the companion implementation JSON. The final eight-test source is frozen; one unified green run of all eight is delegated to the parent's comprehensive production run, rather than represented as already complete here. Comprehensive regression, packaging, and release acceptance remain the parent task's responsibility.

## Explicit limits

- `preserveAspect` remains false. The complete original Shift/aspect activation gate is not proven. Ctrl/Alt/Shift facts are supplied to the planner for the separately proven constraint-override branch.
- The planner rejects currently unclosed compound/control descendants before any edit. Pin storage and capabilities do not imply that every native widget's resize consumer has been reconstructed.
- Hidden/unplaced editor selection may involve multiple original selection frames; this stage does not generalize beyond the admitted displayed direct roots. Selected locked roots are included in the shared frame and skipped by the controller's write policy.
- Document limits and atomic failure are explicit safety policies. They are not claims that native notifications/history or nonfinite intermediate state behave identically.
- No native project writeback, original GUI observation, full original pixel comparison, or package result is inferred from these editor tests.
