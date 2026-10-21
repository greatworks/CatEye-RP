# Selection pointer Shift integration

This stage extends the existing SelectionButton gesture model with the source-proven Shift projection. It does not establish complete Axure keyboard, snapping, GUI or pixel equivalence. The previous [pointer stage](selection-pointer-verification.json) remains immutable; this source change has not replaced the published Windows package.

## Behavior and evidence

`AxKeys.Shift` is 65536. The retained `hInw` instructions read the platform key mask on each call and pass the original `BJG9/QJGS` test to `CbNX`. A single checkbox/radio still has no visible perpendicular handle, so Shift does not enable proportional height resizing. Multiple selection uses the common original frame and the existing proportional solver. The per-target text panel and fit flags remain live across frames, while original geometry stays fixed.

`JbNd` continues to use the original handle freedom. The solver's aspect projection must not silently change that fit decision to both axes. Size/layout runs before final requested Location. For the retained 530 by 20 common-frame example, Shift + right delta 106 requests heights 24; after the explicit text service returns height 20, the final controls are `(100,98,288,20)` and `(520,98,216,20)`. Re-centering after text height correction would differ from the retained instructions.

The new source replay executes `hInw`, the native key-mask tests, and the existing `CbNX`/Size/layout instruction chain through a bounded interpreter. Its 55 scenarios and 163 frames use explicit platform-key and text/graphics facades, not execution of the original DLL or GUI. Model tests consume the 31 scenarios / 91 frames without Ctrl or Alt. Other key-mask cases in the source record do not establish their complete upstream mouse semantics.

The [source report](selection-pointer-modifiers-evidence.md) also traces the Windows virtual-key bridge and a separate upstream Shift corner-snap correction. That correction participates in guide/grid/object candidate processing before `hInw`; this stage does not reproduce it. The report preserves the unknown platform snap-shortcut binding and key-only delivery instead of inferring either from the downstream numerical result.

## Host correction

The existing host already snapshots modifiers on each pointer move and final pointer-up, and the asynchronous session copies each request while fonts load. This stage preserves that behavior. A key press after pointer-up cannot rewrite the pending final request. The host does not add a key-only synthetic resize: whether native keyboard dispatch synthesizes a mouse update remains unproven. Native upstream snapping and modifier-dependent coordinate correction also remain outside this implementation.

The independent review identified a separate reachable defect: selecting one legacy `groupId` member through Outline, then pressing its handle with Shift, expanded the selected targets to all group members. Browser reproduction confirmed one frame became three (two leaves and a group frame), changing the numerical branch and invalidating the gesture context. Handle presses now retain the existing selection; Shift-additive selection applies only to widget-body presses. The regression checks the other member remains unchanged and the gesture creates one Undo.

## Changes and checks

- `src/model/selection-pointer-resize.ts`: accept Shift, preserve the single/multiple native gate, continue atomic Ctrl/Alt rejection.
- `src/App.tsx`: distinguish handle modifiers from additive body selection.
- `tests/selection-pointer-resize.test.ts`: original instruction-frame comparisons and failed-second-target preservation/retry; 88 dedicated model cases.
- `tests/e2e/selection-pointer-resize.spec.ts`: five new browser scenarios covering both single types, the common-frame/text correction, the legacy-group regression and font-delayed final modifier capture.

Initial model red tests and browser failures are retained separately from the passing final build. The original Shift blanket rejection produced 2/2 browser failures. The first new build passed three Shift checks and reproduced the legacy-group defect; it was corrected before final validation. Exact final source hashes, test results, inspected screenshot and unchanged prior evidence are recorded in [selection-pointer-modifiers-verification.json](selection-pointer-modifiers-verification.json).

The same final production source passed typecheck, 5,633/5,633 unit tests, 21/21 pointer browser cases and 72/72 related browser regressions. Every check's recorded input hashes were unchanged during and after its run. The final Shift multiple-selection screenshot was actually inspected: the shared label is clear, and the visible Inspector shows y98, width288 and text-corrected height20. These 93 browser cases are focused acceptance, not the whole browser suite or Windows-package acceptance.

## Remaining scope

Ctrl/Alt combinations, full native snapping and key-only event delivery, mixed ordinary widgets, recursive Layer resizing containing selection controls, rotated/container-local coordinates, complete creation defaults, selected-state typography and exact native font/DPI/layout remain open. The current accepted domain is unrotated explicit-layout selection controls in page or Layer editing coordinates with host-supplied deltas. Native `.rp` writeback, original GUI/pixel comparison, complete browser/package acceptance and full Axure feature parity remain unimplemented or unverified.
