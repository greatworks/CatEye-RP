# Selection pointer modifiers: host review

Read-only review of the frozen fifth-build selection pointer implementation. No product/test changes, new browser run, vendor DLL execution, GUI action, or release mutation was performed by this reviewer. This report distinguishes baseline source behavior, retained native evidence, and proposed integration. Exact reviewed-source hashes and immutable snapshot paths are in the adjacent JSON. During review, the parent began new Shift tests and the core agent began modifying the model; those concurrent edits are explicitly outside this baseline assessment, not silently rebound as reviewed code.

## Actionable result

The baseline host already transports a separate modifier snapshot for each pointer frame. Its model rejects any nonzero modifier before any target work (`selection-pointer-resize.ts:109`). Supporting modifiers therefore requires numerical/controller semantics, not merely passing more flags. Removing that guard alone would silently ignore every modifier: the baseline multiple-target solver receives `preserveAspect:false`, and its single-target branch has no modifier-dependent operation. The new Shift model under concurrent development is not assessed here.

The host does not explicitly resubmit a frame on Shift/Ctrl/Alt keydown or keyup. During a selection gesture its keydown handler prevents default, cancels for Escape or Ctrl/Meta+Z/Y, and otherwise returns. There is no keyup listener in this host. If a browser delivers only keyboard events while the pointer is stationary, no frame is planned until the next pointer move/up. Whether a particular browser also emits a pointer event after a modifier change was not observed here. This is a coverage/integration gap, not a newly demonstrated regression in the deliberately unsupported modifier domain.

### Concrete host risk: Shift changes legacy grouped target IDs

`startDrag` applies its body-selection Shift rule even when `handle` is present. A reachable example has two metadata-bearing checkbox/radio controls A/B with the same legacy `groupId`. The Outline row explicitly executes `setSelected([A])`, so only A has a visible single-control handle. Without Shift, pressing A's handle yields IDs `[A]`; with Shift, line740 yields the union `[A,B]` through `groupIds`. This unexpectedly changes the numerical single/multiple branch. The new gesture also captures the previous `[A]` context while `setSelected([A,B])` schedules a new context/serial, so the ownership checks can cancel it on the next render.

This is a deterministic source-branch finding, not a browser execution claim. Suggested narrow fix: for resize handles retain the already selected target IDs; use Shift-additive selection only for widget-body selection. A focused browser repro should first select A through `[data-outline-widget-id="A"]`, then Shift-drag its east handle, and assert that B remains unselected/unchanged, the single-target planner runs, and one Undo is created. Existing all-selected group overlays and controls without `groupId` do not expose this branch difference. This finding was sent to the parent before implementation.

## Current event and snapshot contract

| Path | Current behavior | Consequence for the next stage |
|---|---|---|
| Pointer-down | Chooses target IDs, including Shift's existing additive-selection rule; captures document/context/serial, old geometry, zoom and snap. It does not enqueue a resize frame. | Do not retroactively change the target set when Shift changes during a gesture. A modifier-only press/release with no movement currently makes no edit. |
| Pointer-move | Computes accumulated screen displacement from initial pointer coordinates, divides by captured zoom, then snaps each axis with `Math.round(delta/8)*8` when captured snap is true. Reads live `ctrlKey/altKey/shiftKey`. | Keep raw pointer position distinct from snapped delta if key-only recomputation is added. Do not use the published owner frame as the new origin. |
| Session update | Copies delta and modifier objects. Queues every received frame in order during font preparation; consumes each prior layout state once ready. | A last-frame-only queue or deduplication by delta alone would erase fit/cache transitions. Modifier changes at identical delta are distinct requests. |
| Keydown/keyup | Keydown blocks commands; Escape and Ctrl/Meta+Z/Y cancel. No explicit modifier update or keyup handling. | Decide from evidence whether key-only changes require a frame. If enabled, handle both press and release, suppress repeat-only duplicates, and preserve cancellation shortcuts. |
| Pointer-up | Recomputes full delta+modifiers. Appends it only when a prior frame exists or delta is nonzero, and it differs from the last move request. Calls `finish()` without another final request. | Release with changed modifiers at the same delta is included. No-move zero-delta press/release does not invoke fit setters just because a modifier was held. Preserve this distinction unless source evidence changes it. |
| Finishing | Session refuses further updates; already queued frames retain their captured modifiers while fonts finish. | Keyboard release after pointer-up must not rewrite queued requests or add work. Do not let a key handler consult current keys during later replay. |
| Failure/cancel | Any unsupported frame or measurement failure restores the owned baseline; earlier published previews are not retained as partial success. History is written only at successful completion. | A sequence normal→modifier→normal currently fails at the first modifier and never recovers within that gesture. This is the existing explicit policy. Test the new supported sequence separately from failure recovery. |
| Capture/context | Pointercancel cancels. Lost capture cancels except in finishing; normal release's capture loss is ignored. Document reference, serial and context protect publication. Zoom/view/scope changes cancel. | Preserve actual abnormal-loss rollback, late font rejection handling, and ownership checks. The host has no separate window-blur/modifier-reset listener; Alt/app-switch event ordering needs a focused browser check before making claims. |

Snap is a gesture snapshot, not an Alt/Ctrl bypass. The current host never alters snap because a modifier changes. Ctrl-wheel changes zoom and therefore cancels through context invalidation; treating Ctrl as a resize modifier must not accidentally disable this established cancellation route. Native upstream snap/key dispatch remains outside the retained pointer proof.

## Retained native evidence and what it does not prove

- `selection-pointer-evidence.md` SP-06 binds `hInw` **100686246**, `BJG9` **100691309** and `CbNX` **100686248**. The entry boolean is read through a modifier mask; the retained report does not claim full live key delivery. `CbNX` IL419–469 additionally requires an orthogonal hot-zone whose `WbSB` **100686225** is visible and not marked `DbNv`.
- A single SelectionButton has only Left/Right hot-zones. Its orthogonal vertical hot-zone is hidden, so the retained single-control replay obtains identical results with that **entry aspect boolean** on/off. This does not prove that all other Shift-dependent upstream delta processing is a no-op. The parent reported two new single-Shift red tests while this review was underway; their full modifier path is being established separately. Multiple selection can enable the aspect branch; exact mappings must come from the complete source contract, not common editor conventions.
- `layer-resize-controller-evidence.md` binds `kbNq` **100686252** to exact `(AxKeys & -65536) == 393216`: Control+Alt, without Shift, selects an override branch. Current Layer product maps this to bypassed member pins/fixed fields. Ordinary multiple SelectionButton roots instead receive `PinInfo=null` in the retained CbNX path. A descendant pin bypass must not be recast as a root fixed-dimension switch.
- Native hot-zone/snapshot/solver evidence is bounded retained-CIL interpretation with controlled services. It does not establish Shift/Alt event timing, Windows menu activation, snapping, font metrics, or original pointer GUI behavior.

## Layer recursion is a separate next dependency

There are two current paths:

1. Enter an unrotated Layer and select checkbox/radio children directly. `startSelectionResize` finds their effective declaration, permits only Layer ancestors with rotation zero, and uses page/shared Layer coordinates. The SelectionButton planner runs once per direct target. Panels/repeaters and general transforms remain outside this host.
2. Select the outer Layer and resize it. `planLayerResizeDocument` invokes `planAuthorLayerResize`; its ordinary whitelist omits checkbox/radio. Snapshot collection rejects those leaves before projection, even if a later lock test might skip a write. `selectionText` availability has not removed this guard. The returned failure is atomic; old members are not flattened or dropped.

The latter cannot reuse `prepareSelectionPointerResize` on a leaf array as though it were a direct multi-selection. Native Layer `jbNm` **100686249** uses old relative frames, a predicted contacting subset, then contacting and remaining passes with different new-parent rectangles; nested Layers repeat this. `ubNp` **100686251** prediction is solver geometry, not an author text measurement. Requested/candidate parent frames must not be replaced arbitrarily by a text-corrected final child union.

Required integration pieces are now identifiable:

- Retain each descendant's original geometry/relative snapshots across frames, but carry its live owner/panel/fit state between successful frames. The current Layer host replans from `d.document` and `d.original` on each move; that stateless route cannot preserve the already-proven SelectionButton first-frame fit change and evolving TextPanel by itself.
- Invoke the SelectionButton Size/layout transaction after numerical projection, then the native final Location write. Do not assign the numerical requested size directly: text/indicator layout can change actual height and positioning.
- Extend result persistence to ordered SelectionLayout effects and shared `selectionText` fit flags. Existing Layer patches only carry geometry and `shapeText`, while the selection host already has `applySelectionAuthorEffects`. Preserve paired current-view Size/Location and inactive maps; do not route internal geometry through generic Affect All Views diffs.
- Use descendant PinInfo capability behavior. SelectionButton has FixedWidth capability but not FixedHeight; the native member PinInfo forces fixed height. This is not an absolute height lock: dual-edge pins may override it, and the subsequent layout setter can correct height. `JbNd` **100686253** turns a previously true selection AutoFitWidth off for horizontal non-near-zero delta without the VectorShape fixed-width exception.
- Preserve inherited lock/current-Layer/background behavior. Native descendant locking is not simply each child's `locked`; mixed locked direct roots and recursive descendants have different gates. Font preparation should follow the same actual write eligibility, without inferring that a child's own lock necessarily suppresses its layout.
- Prepare all required descendant measurement services before publication and apply all plans atomically. A later descendant failure must restore all earlier preview writes and fit changes. One successful pointer gesture remains one Undo. Native history/notification fidelity beyond the retained sinks remains a boundary.

These are dependencies for a new adapter, not authorization or a proposal to broaden the existing whitelist in this review. Earlier `selection-author-resize` corpus/import counts describe their historical source-bound stage and are not reused as current admission counts.

## Minimum focused validation matrix

The frozen 16-case E2E covers normal controls, delayed fonts, cancellation, zoom+snap, current-view effects, multi-target failure, locks and legacy compatibility. Its Control+A operations are selection setup, and Escape/Ctrl+Z are cancellation checks; it contains no successful Shift/Ctrl/Alt resize case. The parent is now adding separate modifier cases, so this statement refers specifically to the snapshot bound in the JSON. Existing session tests establish ordered/copy semantics, not native modifier geometry.

Before enabling the new modifier domain, independently check:

1. Single east/west with modifiers already held, including the native orthogonal-hot-zone exclusion and zero-move no-op.
2. Multi corner and side handles for every supported combination, including Control+Alt versus Control+Alt+Shift. Do not derive expected values from the product planner.
3. Mid-drag none→Shift→none at the same pointer coordinate, with and without a subsequent pointermove; then release on pointer-up. Record actual keyboard/pointer delivery and any native contract still unknown.
4. Font-pending ordered modifier frames and release before fonts resolve, compared with ready execution using the same requests. Keep live panel/fit transitions and one Undo.
5. Modifier-only final-up change at unchanged delta, exact duplicate up, and release after entering finishing. Verify no duplicated final setter or rewritten queued request.
6. Zoom 0.5 with snap both on/off and negative half-grid deltas. Confirm modifiers do not accidentally rebase or resnap an already snapped value. Ctrl-wheel/context round-trip cancels, rather than continuing under a different scale.
7. Modifier-active Escape/Ctrl+Z, abnormal lost capture, native dragstart prevention, and Alt/app-switch focus paths. Retain rollback and no late publication after cancel.
8. Direct controls inside Layer versus outer-Layer recursive resize, including pinned/fixed/dual-edge, contacting/remaining, nested Layer and inherited-lock examples; fail the second measured leaf and require full rollback.

## Suggested smallest host interface change

Retain `SelectionPointerRequest {delta, modifiers}` as value data. If source evidence calls for stationary-key updates, store the latest physical client point and the last accepted modifier tuple in the gesture, then enqueue a fresh request only for an actual tuple transition while preparing/active. Convert from the immutable start/zoom/snap snapshot; do not mutate previous requests or reset original geometry. Keep `finish()` as the point after which no new keyboard frame is accepted. This is a proposed independent host policy until its native dispatch relationship is established.

No new blocker was found in the declared no-modifier domain. The legacy-group Shift target expansion is a concrete next-stage host issue. The baseline blanket rejection, missing key-only dispatch, and recursive SelectionButton setter gap are explicit next-stage work. The exact native key-only callback remains unresolved here. Source snapshots and earlier failure evidence were not changed.
