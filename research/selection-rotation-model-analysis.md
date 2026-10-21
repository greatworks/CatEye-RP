# Selection Ctrl-only rotation: model integration analysis

This is a read-only integration plan for the next authoring stage. No product or test source has been changed for this stage. The previous input/resize implementation and evidence remain frozen. `fullAxureParity=false`, `originalGuiCompared=false`, and `published=false` apply to this new stage.

## Existing boundaries

`selection-pointer-input.ts` already captures the native initial controller mode. One ordinary checkbox/radio cannot select rotation through its capability gate; multiple targets beginning with exactly Ctrl select mode 2. Later keys do not reselect the mode. The numerical input wrapper currently rejects that mode. Its exported candidate/correction/hot-zone/bounds helpers already cover the proved grid-only, modern BoxModel, zero-angle context.

`selection-pointer-resize.ts` is an ordinary Selection size/layout controller, not a rotation implementation. Its immutable original geometry and persistent current state are deliberately separate. It invokes fit setters, Size/OI8Z, font services and final Location. Reusing that whole path for mode 2 would introduce effects not present in the early native branch evidence. Its direct Ctrl/Alt rejection should remain intact.

`SelectionLayoutInput` admits only owner/text rotation zero and requires a real text-panel snapshot and layout services. `SelectionLayoutState` carries owner geometry, panel, diagram location, fit flags and guard state; it has no own-angle field. A rotation-only Location plan should not manufacture that state merely to satisfy a result type or wait on fonts when no source layout call occurs.

`applySelectionAuthorEffects` currently accepts a full successful layout result, then replays persistent fit/side/Size/Location effects. It writes full Location/Size pairs, preserves unrelated declarations and inactive maps, and refreshes Base Layer caches. It does not persist an arbitrary `style.Rotation` trace. The parent proposes factoring the already validated write replay into `applySelectionAuthorWriteEffects(page, viewId, id, effects)`, leaving the old wrapper intact. That is preferable to fabricating a `SelectionLayoutResult`.

The generic `rotation-geometry.ts` explicitly implements the editor's CSS center-origin model, not the native author controller. Its trigonometric normalization and resize anchoring must not be treated as a source oracle for mode 2. `author-resize-solver.ts` supplies source-derived resize primitives but is likewise a different entry. Runtime Rotate has queues, easing, dynamic bounds and its own capabilities; none of that should be reused as an author pointer transaction.

## Source contract received so far

Early retained-source reads identify `CbNX` 100686248 mode 2 separately from the resize branch. For multiple selected roots it uses the original `PbSc` center and a snapshot of each root's original geometry. `IbNU` 100686255 skips a locked root, attempts the rotation setter and then invokes `xJ0B(newLocation,false,true,null)`. The Rotation capability gate makes the SelectionButton/Checkbox angle setter return early. Thus the currently evidenced behavior is orbiting each owner location, not adding a CSS rotation to the checkbox/radio. Exact angular quantization, location equality/rounding, notification consequences and complete per-frame numerical results remain the evidence owners' current work.

Two origins must be retained. `DFQ8` is the logical hot-zone point already established by the input stage. `YbSE` is the real pointer-down point. Current mode-2 angle input is formed from `YbSE + correctedDelta`, not directly from the current absolute point. The common pivot is the initial selection rectangle center. The grid/input owner is still checking the complete entry chain; this report does not yet declare an untested angle formula or modifier snap rule.

The native effect owner is checking that Location's `[101]` notification avoids Selection text layout. If confirmed, the host can branch before font preparation and capture geometry only. Text, rich runs, P94, padding, fit/side flags, width, height, selected paint, and owner rotation must remain unchanged by the new module.

## Minimal proposed interface

The new module is `src/model/selection-pointer-rotate.ts`; tests are `tests/selection-pointer-rotate.test.ts`. These API names and exact state fields are provisional until the final numerical/effect source fixtures arrive:

```ts
prepareSelectionPointerRotate({
  targets,        // ordered ordinary selection roots: id/type/locked, old frame and diagram location
  input,          // captured mode-2 input settings, including logical hot-zone point
  downPoint,      // actual pointer-down point; independent from the hot-zone point
}) -> { original, state }

planSelectionPointerRotate(original, state, { point, modifiers })
  -> { ok: true, state, results: [{ id, effects }], trace }
   | { ok: false, reason, widgetIds, trace }
```

The original captures geometry/common pivot/down-point once. Current state records accepted owner locations for native equality/no-write decisions. Results contain the frame's ordered location writes, with the source's exact current-view flags. Width/height/rotation and all text state remain unchanged unless forthcoming source proves another operation. Locked roots remain available to the source selection/pivot rule but are skipped by the commit branch. Geometry bounds validation must finish for every target before any document is published.

After the input owner confirms mode 2 uses the same grid producer, the parent has coordinated permission to refactor only the common projection body of `selection-pointer-input.ts` into `projectSelectionPointerInput(original, frame)`. It would accept a valid captured resize/rotate mode and report that mode in the trace. The old `planSelectionPointerInput` would keep its rotation rejection and delegate for resize. This avoids cloning grid logic or lying about the captured mode. Existing tests retain their meaning; the new rotation tests cover the added entry. No such source edit has happened at the time of this analysis.

## Host/transaction integration

The existing generic pointer session can retain ordered raw point/key queues, stale-ownership checks, one final undo, rollback and pointer-up completion. A discriminated prepare/plan branch can select resize or rotate once. If no measurement is required, rotation preparation should not fail because a font promise or text panel is unavailable. Frame planning remains synchronous and pure. The parent owns App/session, effect replay, UI messages and browser validation.

Do not route these writes through generic `changeWidgets` with Affect All Views. That would replace the native current-view transaction with a different author command and could remove declarations. Preserve full paired Location writes and all unrelated/inactive adaptive fields. Page and unrotated Layer scopes can retain the existing coordinate admission; panel/repeater translation and general transforms should not be silently inferred. Layer frames remain derived caches, not additional transforms or explicit geometry overrides.

## Tests to derive from final source fixtures

1. Multiple ordinary Selection roots orbit about the original common pivot while each own angle, size and text/fit state remain unchanged; checkbox and radio mixed roots are allowed only within this family.
2. All eight initial handles; separate real press and logical hot-zone points; grid on/off and Alt bypass; current versus initial candidate geometry according to the exact mode-2 source entry.
3. Positive/negative quarter turns, half/full turn crossing, zero vector/pivot hit, tiny deltas and the exact original angular quantization/modifier rule, without replacing it with shortest-arc or CSS math.
4. Consecutive frames use original geometry for projection and current accepted locations for equality; return-to-start preserves or omits writes exactly as the source does.
5. Locked root eligibility and pivot inclusion; mixed locked/unlocked roots; all-locked host availability remains distinct from a mathematical empty selection.
6. Current adaptive view versus Base, existing explicit Location pairs, parent/sibling/inactive declarations, nested Layer cache refresh and one undo/redo. No width/height/fit/rich-text mutation.
7. An invalid or out-of-model target fails the entire batch; caller objects remain unchanged; no partial effects are committable. This atomic publication is the product policy, not a claim that every native exception rolls back.
8. Session-level no-move completion, pointer-up with changed keys, cancellation, context switch and mode persistence. The parent supplies the real UI/browser cases.

The final model tests should consume the independent retained-instruction fixtures, not derive their expected coordinates from this product module. Original CIL replay counts, product tests and browser tests must remain separate.
